# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownParameterType=false, reportUnknownLambdaType=false, reportConstantRedefinition=false

import asyncio
import hashlib
import importlib
import json
import logging
import math
import os
import re
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Set, TypedDict

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, field_validator

try:
    from groq import Groq
except Exception:  # pragma: no cover - optional dependency until installed
    Groq = None

from rag import (
    delete_document_chunks as rag_delete_document_chunks,
    delete_session_collection as rag_delete_session_collection,
    get_session_pdf_stats as rag_get_session_pdf_stats,
    ingest_pdf as rag_ingest_pdf,
    retrieve_pdf_context as rag_retrieve_pdf_context,
)

langchain_import_error: Optional[str] = None
ChatPromptTemplate: Any = None
try:
    ChatPromptTemplate = importlib.import_module("langchain_core.prompts").ChatPromptTemplate
except Exception as exc:
    langchain_import_error = str(exc)

langgraph_import_error: Optional[str] = None
END: Any = None
StateGraph: Any = None
try:
    _graph_module = importlib.import_module("langgraph.graph")
    END = _graph_module.END
    StateGraph = _graph_module.StateGraph
except Exception as exc:
    langgraph_import_error = str(exc)

np: Any = None
try:
    import numpy as np  # type: ignore[no-redef]
except Exception:
    np = None

embedding_import_error: Optional[str] = None
SentenceTransformer: Any = None
try:
    SentenceTransformer = importlib.import_module("sentence_transformers").SentenceTransformer
except Exception as exc:
    embedding_import_error = str(exc)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not can_use_local_embedding_model():
        logger.warning("Embedding dependencies unavailable: %s", embedding_import_error or "numpy missing")
    elif EMBEDDING_BACKGROUND_WARMUP:
        schedule_embedding_model_load("startup")

    yield


app = FastAPI(title="Curalink LLM Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_EMBED_FALLBACK_MODEL = os.getenv("OLLAMA_EMBED_FALLBACK_MODEL", "nomic-embed-text")
OLLAMA_EMBED_TIMEOUT_SEC = float(os.getenv("OLLAMA_EMBED_TIMEOUT_SEC", "20"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
PRIMARY_LLM_PROVIDER = os.getenv("PRIMARY_LLM_PROVIDER", "groq").strip().lower()
LOCAL_FALLBACK_ENABLED = os.getenv("LOCAL_FALLBACK_ENABLED", "false").lower() != "false"
FALLBACK_EMBED_DIM = max(32, int(os.getenv("FALLBACK_EMBED_DIM", "384")))
USE_LANGGRAPH_WORKFLOW = os.getenv("USE_LANGGRAPH_WORKFLOW", "true").lower() != "false"
SEMANTIC_CACHE_THRESHOLD = float(os.getenv("SEMANTIC_CACHE_THRESHOLD", "0.92"))
SEMANTIC_CACHE_MAX_SIZE = max(16, int(os.getenv("SEMANTIC_CACHE_MAX_SIZE", "256")))
LOCAL_EMBED_MODEL = os.getenv("LOCAL_EMBED_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_BACKGROUND_WARMUP = os.getenv("EMBEDDING_BACKGROUND_WARMUP", "true").lower() != "false"
PDF_MAX_SIZE_MB = max(1, int(os.getenv("PDF_MAX_SIZE_MB", "20")))
PDF_MAX_SIZE_BYTES = PDF_MAX_SIZE_MB * 1024 * 1024
LAST_GENERATION_PROVIDER = "none"
LAST_GENERATION_AT: Optional[float] = None
EMBEDDING_BACKEND = "hash-fallback"
EMBEDDING_MODEL = "hash-fallback"
SERVICE_STARTED_AT = time.time()

semantic_response_cache: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
semantic_cache_lock = asyncio.Lock()
fused_response_cache: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
fused_cache_lock = asyncio.Lock()

embed_model: Any = None
embed_model_load_task: Optional[asyncio.Task[Any]] = None
groq_client: Any = None


def can_use_local_embedding_model() -> bool:
    return SentenceTransformer is not None and np is not None


async def load_embedding_model_in_background(trigger: str) -> None:
    global EMBEDDING_BACKEND, EMBEDDING_MODEL, embed_model, embedding_import_error, embed_model_load_task

    try:
        logger.info("Loading embedding model in background (trigger=%s)...", trigger)
        embed_model = await asyncio.to_thread(SentenceTransformer, LOCAL_EMBED_MODEL)
        EMBEDDING_BACKEND = "sentence-transformers"
        EMBEDDING_MODEL = LOCAL_EMBED_MODEL
        embedding_import_error = None
        logger.info("Embedding model loaded")
    except Exception as exc:
        embedding_import_error = str(exc)
        logger.warning("Embedding model unavailable: %s", embedding_import_error)
    finally:
        embed_model_load_task = None


def schedule_embedding_model_load(trigger: str) -> None:
    global embed_model_load_task

    if embed_model is not None:
        return

    if not can_use_local_embedding_model():
        return

    if embed_model_load_task is not None:
        return

    embed_model_load_task = asyncio.create_task(
        load_embedding_model_in_background(trigger),
        name="embedding-model-loader",
    )


class GenerateRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    temperature: float = 0.1
    max_tokens: int = 2048


class EmbedRequest(BaseModel):
    texts: List[str]


class RerankRequest(BaseModel):
    query: str
    documents: List[Dict[str, Any]]
    top_k: int = 15


class SuggestRequest(BaseModel):
    partial_query: str
    history: List[str] = Field(default_factory=list)
    common_topics: List[str] = Field(default_factory=list)
    limit: int = 5

    @field_validator("limit", mode="before")
    @classmethod
    def clamp_limit(cls, value: Any) -> int:
        try:
            numeric = int(value)
        except (TypeError, ValueError):
            return 5

        return max(3, min(5, numeric))


class PDFIngestResponse(BaseModel):
    doc_id: str
    filename: str
    document_type: str
    structured_summary: str
    medical_entities: list[dict]
    total_chunks: int
    abnormal_findings: list[dict]
    has_abnormal_findings: bool
    metadata: dict


class PDFQueryRequest(BaseModel):
    query: str
    session_id: str
    top_k: int = 6
    focus_abnormal: bool = False


class PDFQueryResponse(BaseModel):
    chunks: list[dict]
    context_text: str
    source_docs: list[str]
    has_pdf_context: bool


class PDFStatsResponse(BaseModel):
    total_chunks: int
    doc_ids: list[str]
    doc_count: int


class FusedGenerateRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    session_id: str
    pdf_context: Optional[str] = None
    research_context: Optional[str] = None
    conversation_history: list[dict] = Field(default_factory=list)
    temperature: float = 0.3
    max_tokens: int = 2048
    model: str = "llama-3.3-70b-versatile"


class ResearchInsightModel(BaseModel):
    insight: str = ""
    type: Literal["TREATMENT", "DIAGNOSIS", "RISK", "PREVENTION", "GENERAL"] = "GENERAL"
    source_ids: List[str] = Field(default_factory=list)


class ClinicalTrialModel(BaseModel):
    summary: str = ""
    status: str = ""
    location_relevant: bool = False
    contact: str = ""
    source_ids: List[str] = Field(default_factory=list)


class ConfidenceBreakdownModel(BaseModel):
    source_id: str = ""
    title: str = ""
    relevance_score: float = 0.0
    credibility_score: float = 0.0
    recency_score: float = 0.0
    composite_score: float = 0.0

    @field_validator("source_id", mode="before")
    @classmethod
    def normalize_source_id(cls, value: Any) -> str:
        return str(value or "").strip().upper()

    @field_validator(
        "relevance_score",
        "credibility_score",
        "recency_score",
        "composite_score",
        mode="before",
    )
    @classmethod
    def normalize_score(cls, value: Any) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return 0.0

        if numeric < 0:
            return 0.0
        if numeric > 1:
            return 1.0
        return numeric


class StructuredAnswerModel(BaseModel):
    condition_overview: str = ""
    evidence_strength: Literal["LIMITED", "MODERATE", "STRONG"] = "MODERATE"
    research_insights: List[ResearchInsightModel] = Field(default_factory=list)
    clinical_trials: List[ClinicalTrialModel] = Field(default_factory=list)
    key_researchers: List[str] = Field(default_factory=list)
    recommendations: str = ""
    follow_up_suggestions: List[str] = Field(default_factory=list)
    confidence_breakdown: List[ConfidenceBreakdownModel] = Field(default_factory=list)

    @field_validator("evidence_strength", mode="before")
    @classmethod
    def normalize_evidence_strength(cls, value: Any) -> str:
        normalized = str(value or "").upper()
        return normalized if normalized in {"LIMITED", "MODERATE", "STRONG"} else "MODERATE"

    @field_validator("follow_up_suggestions", mode="before")
    @classmethod
    def normalize_follow_ups(cls, value: Any) -> List[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]


class GenerationState(TypedDict, total=False):
    system_prompt: str
    user_prompt: str
    temperature: float
    max_tokens: int
    messages: List[Dict[str, str]]
    allowed_citations: List[str]
    raw_text: str
    parsed: Optional[Dict[str, Any]]
    provider: str
    model: str
    provider_errors: List[str]
    validation_error: Optional[str]
    needs_fallback: bool


def extract_allowed_citations(text: str) -> List[str]:
    seen: Set[str] = set()
    citations: List[str] = []

    for match in re.findall(r"\[(P\d+|T\d+|DOC)\]", text or "", flags=re.IGNORECASE):
        citation_id = match.upper()
        if citation_id not in seen:
            citations.append(citation_id)
            seen.add(citation_id)

    return citations


def normalize_source_ids(source_ids: List[str], allowed_set: Set[str]) -> List[str]:
    normalized: List[str] = []
    seen: Set[str] = set()

    for value in source_ids or []:
        source_id = str(value).upper().strip()
        if source_id in allowed_set and source_id not in seen:
            normalized.append(source_id)
            seen.add(source_id)

    return normalized


def clamp_score(value: Any, fallback: float = 0.5) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return fallback

    if numeric < 0:
        return 0.0
    if numeric > 1:
        return 1.0
    return numeric


def build_default_confidence_entry(citation_id: str) -> Dict[str, Any]:
    normalized = str(citation_id or "").strip().upper()
    return {
        "source_id": normalized,
        "title": normalized,
        "relevance_score": 0.5,
        "credibility_score": 0.7,
        "recency_score": 0.5,
        "composite_score": 0.55,
    }


def ensure_structured_schema(payload: Dict[str, Any], allowed_citations: List[str]) -> Dict[str, Any]:
    validated = StructuredAnswerModel.model_validate(payload).model_dump()

    recommendations = (validated.get("recommendations") or "").strip()
    if not recommendations:
        recommendations = "Please consult your healthcare provider."
    if "please consult your healthcare provider" not in recommendations.lower():
        recommendations = f"{recommendations.rstrip('.')}. Please consult your healthcare provider."
    validated["recommendations"] = recommendations

    follow_up_raw = validated.get("follow_up_suggestions") or []
    follow_up_suggestions = [str(item).strip() for item in follow_up_raw if str(item).strip()]
    default_follow_ups = [
        "Can you summarize the strongest findings from these sources?",
        "Can you focus on recruiting clinical trials near my location?",
        "Can you compare the likely benefits and risks from the top evidence?",
    ]

    if len(follow_up_suggestions) < 3:
        for suggestion in default_follow_ups:
            if suggestion not in follow_up_suggestions:
                follow_up_suggestions.append(suggestion)
            if len(follow_up_suggestions) >= 3:
                break
    validated["follow_up_suggestions"] = follow_up_suggestions[:3]

    allowed_set = set(allowed_citations)
    if allowed_set:
        publication_citations = [citation for citation in allowed_citations if citation.startswith("P")]
        trial_citations = [citation for citation in allowed_citations if citation.startswith("T")]

        clean_research: List[Dict[str, Any]] = []
        for item in validated.get("research_insights", []):
            normalized_source_ids = normalize_source_ids(item.get("source_ids") or [], allowed_set)
            if normalized_source_ids:
                item["source_ids"] = normalized_source_ids
                clean_research.append(item)

        clean_trials: List[Dict[str, Any]] = []
        for item in validated.get("clinical_trials", []):
            normalized_source_ids = normalize_source_ids(item.get("source_ids") or [], allowed_set)
            if normalized_source_ids:
                item["source_ids"] = normalized_source_ids
                clean_trials.append(item)

        if not clean_research and publication_citations:
            clean_research.append(
                {
                    "insight": "Top publication evidence was reviewed from the retrieved context.",
                    "type": "GENERAL",
                    "source_ids": [publication_citations[0]],
                }
            )

        if not clean_trials and trial_citations:
            clean_trials.append(
                {
                    "summary": "A relevant clinical trial was identified in the retrieved results.",
                    "status": "UNKNOWN",
                    "location_relevant": False,
                    "contact": "",
                    "source_ids": [trial_citations[0]],
                }
            )

        validated["research_insights"] = clean_research
        validated["clinical_trials"] = clean_trials

    normalized_breakdown: List[Dict[str, Any]] = []
    seen_breakdown_ids: Set[str] = set()

    for item in validated.get("confidence_breakdown", []):
        source_id = str(item.get("source_id") or "").strip().upper()
        if not source_id:
            continue

        if allowed_set and source_id not in allowed_set:
            continue

        if source_id in seen_breakdown_ids:
            continue

        relevance = clamp_score(item.get("relevance_score"), 0.5)
        credibility = clamp_score(item.get("credibility_score"), 0.7)
        recency = clamp_score(item.get("recency_score"), 0.5)
        composite = clamp_score(
            item.get("composite_score"),
            relevance * 0.45 + credibility * 0.25 + recency * 0.3,
        )

        normalized_breakdown.append(
            {
                "source_id": source_id,
                "title": str(item.get("title") or source_id),
                "relevance_score": relevance,
                "credibility_score": credibility,
                "recency_score": recency,
                "composite_score": composite,
            }
        )
        seen_breakdown_ids.add(source_id)

    if allowed_citations:
        for citation in allowed_citations:
            normalized_citation = str(citation or "").strip().upper()
            if normalized_citation and normalized_citation not in seen_breakdown_ids:
                normalized_breakdown.append(build_default_confidence_entry(normalized_citation))
                seen_breakdown_ids.add(normalized_citation)

    validated["confidence_breakdown"] = normalized_breakdown

    return validated


def build_prompt_messages(system_prompt: str, user_prompt: str) -> List[Dict[str, str]]:
    if ChatPromptTemplate is None:
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    template = ChatPromptTemplate.from_messages(
        [("system", "{system_prompt}"), ("human", "{user_prompt}")]
    )
    rendered = template.format_messages(system_prompt=system_prompt, user_prompt=user_prompt)
    role_map = {"system": "system", "human": "user", "ai": "assistant"}
    messages: List[Dict[str, str]] = []

    for msg in rendered:
        role = role_map.get(getattr(msg, "type", "human"), "user")
        messages.append({"role": role, "content": str(getattr(msg, "content", ""))})

    return messages


def get_groq_client() -> Any:
    global groq_client

    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured")

    if Groq is None:
        raise RuntimeError("groq package is not installed")

    if groq_client is None:
        groq_client = Groq(api_key=GROQ_API_KEY)

    return groq_client


def _normalize_history_messages(history: list[dict]) -> list[dict]:
    messages: list[dict] = []
    for item in history[-4:]:
        if not isinstance(item, dict):
            continue

        role = str(item.get("role") or "").strip().lower()
        content = str(item.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue

        messages.append({"role": role, "content": content})

    return messages


def _is_rate_limit_error(error: Exception) -> bool:
    status_code = getattr(error, "status_code", None)
    if status_code == 429:
        return True

    error_text = str(error).lower()
    return "429" in error_text and "rate" in error_text


async def call_groq_direct(
    system_prompt: str,
    user_prompt: str,
    history: list[dict],
    model: str = "llama-3.3-70b-versatile",
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    messages.extend(_normalize_history_messages(history))
    messages.append({"role": "user", "content": user_prompt})

    for attempt in range(2):
        try:
            client = get_groq_client()

            def _invoke() -> Any:
                return client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

            completion = await asyncio.wait_for(asyncio.to_thread(_invoke), timeout=30)
            content = completion.choices[0].message.content if completion and completion.choices else ""
            return str(content or "").strip()
        except Exception as exc:
            if attempt == 0 and _is_rate_limit_error(exc):
                await asyncio.sleep(2)
                continue

            logger.warning("Groq direct call failed: %s", exc)
            return (
                "I could not complete the fused generation request at this moment. "
                "Please try again shortly. Please consult your healthcare provider."
            )

    return (
        "I could not complete the fused generation request at this moment. "
        "Please try again shortly. Please consult your healthcare provider."
    )


def _build_fused_cache_key(pdf_context: str, user_prompt: str) -> str:
    key_source = f"{pdf_context[:200]}::{user_prompt.strip()}"
    return hashlib.sha256(key_source.encode("utf-8")).hexdigest()


async def lookup_fused_cache(cache_key: str) -> Optional[Dict[str, Any]]:
    async with fused_cache_lock:
        payload = fused_response_cache.get(cache_key)
        if payload is None:
            return None

        fused_response_cache.move_to_end(cache_key)
        return deepcopy(payload)


async def store_fused_cache(cache_key: str, payload: Dict[str, Any]) -> None:
    async with fused_cache_lock:
        fused_response_cache[cache_key] = deepcopy(payload)
        fused_response_cache.move_to_end(cache_key)

        while len(fused_response_cache) > SEMANTIC_CACHE_MAX_SIZE:
            fused_response_cache.popitem(last=False)


def get_generation_provider_order() -> List[str]:
    preferred = (
        PRIMARY_LLM_PROVIDER
        if PRIMARY_LLM_PROVIDER in {"groq", "local_fallback"}
        else "groq"
    )
    if preferred == "local_fallback":
        return ["local_fallback", "groq"]
    return ["groq", "local_fallback"]


async def invoke_provider_chain(
    req: GenerateRequest,
    messages: List[Dict[str, str]],
    allowed_citations: List[str],
) -> Dict[str, Any]:
    provider = "none"
    model_name = "none"
    raw_text = ""
    provider_errors: List[str] = []
    provider_order = get_generation_provider_order()

    async with httpx.AsyncClient(timeout=120) as client:
        for candidate in provider_order:
            if raw_text:
                break

            if candidate == "groq":
                if not GROQ_API_KEY:
                    provider_errors.append("groq: GROQ_API_KEY not configured")
                    continue

                provider = "groq"
                model_name = GROQ_MODEL
                try:
                    raw_text = await call_groq(
                        client,
                        messages,
                        temperature=req.temperature,
                        max_tokens=req.max_tokens,
                    )
                except Exception as groq_exc:
                    provider_errors.append(f"groq: {groq_exc}")
                continue

            if candidate == "local_fallback" and LOCAL_FALLBACK_ENABLED:
                provider = "local_fallback"
                model_name = "curalink-local-fallback"
                raw_text = json.dumps(
                    build_local_fallback_answer(req.user_prompt, allowed_citations),
                    ensure_ascii=True,
                )

        if not raw_text:
            raise HTTPException(
                status_code=503,
                detail="No generation provider available. Configure GROQ_API_KEY or enable LOCAL_FALLBACK_ENABLED.",
            )

    return {
        "raw_text": raw_text,
        "provider": provider,
        "model": model_name,
        "provider_errors": provider_errors,
    }


async def prepare_generation_node(state: GenerationState) -> GenerationState:
    user_prompt = state.get("user_prompt", "")
    system_prompt = state.get("system_prompt", "")

    return {
        "allowed_citations": extract_allowed_citations(user_prompt),
        "messages": build_prompt_messages(system_prompt, user_prompt),
        "provider_errors": [],
        "needs_fallback": False,
    }


async def provider_generation_node(state: GenerationState) -> GenerationState:
    req = GenerateRequest(
        system_prompt=state.get("system_prompt", ""),
        user_prompt=state.get("user_prompt", ""),
        temperature=state.get("temperature", 0.1),
        max_tokens=state.get("max_tokens", 2048),
    )
    provider_result = await invoke_provider_chain(
        req,
        state.get("messages", []),
        state.get("allowed_citations", []),
    )

    return {
        "raw_text": str(provider_result.get("raw_text", "")),
        "provider": str(provider_result.get("provider", "groq")),
        "model": str(provider_result.get("model", GROQ_MODEL if GROQ_API_KEY else "curalink-local-fallback")),
        "provider_errors": list(provider_result.get("provider_errors", [])),
        "needs_fallback": False,
    }


async def parse_generation_node(state: GenerationState) -> GenerationState:
    raw_text = state.get("raw_text", "")
    parsed = extract_json(raw_text)

    if parsed is None:
        return {
            "validation_error": "Provider response was not valid JSON.",
            "needs_fallback": True,
        }

    try:
        normalized = ensure_structured_schema(parsed, state.get("allowed_citations", []))
        return {
            "parsed": normalized,
            "validation_error": None,
            "needs_fallback": False,
        }
    except ValidationError as validation_error:
        return {
            "validation_error": str(validation_error),
            "needs_fallback": True,
        }
    except Exception as validation_error:
        return {
            "validation_error": str(validation_error),
            "needs_fallback": True,
        }


def parse_router(state: GenerationState) -> str:
    return "fallback" if state.get("needs_fallback") else "complete"


async def fallback_generation_node(state: GenerationState) -> GenerationState:
    fallback = build_local_fallback_answer(
        state.get("user_prompt", ""),
        state.get("allowed_citations", []),
    )

    return {
        "provider": "local_fallback",
        "model": "curalink-local-fallback",
        "raw_text": json.dumps(fallback, ensure_ascii=True),
        "parsed": fallback,
        "needs_fallback": False,
    }


LANGGRAPH_WORKFLOW = None
if USE_LANGGRAPH_WORKFLOW and StateGraph is not None and END is not None:
    _workflow = StateGraph(GenerationState)
    _workflow.add_node("prepare", prepare_generation_node)
    _workflow.add_node("generate", provider_generation_node)
    _workflow.add_node("parse", parse_generation_node)
    _workflow.add_node("fallback", fallback_generation_node)
    _workflow.set_entry_point("prepare")
    _workflow.add_edge("prepare", "generate")
    _workflow.add_edge("generate", "parse")
    _workflow.add_conditional_edges(
        "parse",
        parse_router,
        {
            "fallback": "fallback",
            "complete": END,
        },
    )
    _workflow.add_edge("fallback", END)
    LANGGRAPH_WORKFLOW = _workflow.compile()


@app.get("/")
async def root():
    return {
        "service": "curalink-llm",
        "status": "ok",
        "version": app.version,
        "uptime_ms": int((time.time() - SERVICE_STARTED_AT) * 1000),
        "timestamp": now_utc_iso(),
    }


@app.get("/health")
async def health():
    llm_status = await detect_llm_status()
    return build_health_payload(llm_status)


@app.get("/api/health")
async def api_health():
    llm_status = await detect_llm_status()
    return build_health_payload(llm_status)


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def build_health_payload(llm_status: str) -> Dict[str, Any]:
    return {
        "status": "ok" if llm_status != "offline" else "degraded",
        "version": app.version,
        "uptime_ms": int((time.time() - SERVICE_STARTED_AT) * 1000),
        "services": {
            "llm": llm_status,
            "db": "not_configured",
        },
        "timestamp": now_utc_iso(),
    }


async def detect_llm_status() -> str:
    if bool(GROQ_API_KEY):
        return "online"

    if LOCAL_FALLBACK_ENABLED:
        return "degraded"

    return "offline"


def add_stage_timing(pipeline_timings: List[Dict[str, Any]], stage: str, stage_start: float) -> None:
    duration_ms = round((time.perf_counter() - stage_start) * 1000, 2)
    pipeline_timings.append({"stage": stage, "duration_ms": duration_ms})


def normalize_embedding(vector: List[float]) -> List[float]:
    norm = math.sqrt(sum(float(value) * float(value) for value in vector))
    if norm <= 0:
        return [0.0 for _ in vector]
    return [float(value) / norm for value in vector]


def is_local_fallback_payload(payload: Optional[Dict[str, Any]]) -> bool:
    if not isinstance(payload, dict):
        return False

    provider = str(payload.get("provider") or "").strip().lower()
    model_name = str(payload.get("model") or "").strip().lower()

    if provider in {"local", "local_fallback", "none"}:
        return True

    if model_name == "curalink-local-fallback":
        return True

    parsed = payload.get("parsed")
    if isinstance(parsed, dict):
        overview = str(parsed.get("condition_overview") or "").lower()
        if "local fallback engine" in overview:
            return True

    return False


def build_semantic_cache_key(query_embedding: List[float]) -> str:
    rounded = ",".join(f"{value:.6f}" for value in query_embedding)
    return hashlib.sha256(rounded.encode("utf-8")).hexdigest()


async def generate_query_embedding(text: str) -> List[float]:
    normalized_text = str(text or "").strip()[:512]

    if embed_model is None:
        schedule_embedding_model_load("query-embedding")

    if embed_model is not None and np is not None:
        vector = embed_model.encode([normalized_text], normalize_embeddings=True)[0]
        return normalize_embedding([float(value) for value in vector])

    ollama_embeddings, _, _ = await generate_ollama_embeddings([normalized_text])
    if ollama_embeddings and len(ollama_embeddings) == 1:
        return normalize_embedding([float(value) for value in ollama_embeddings[0]])

    return normalize_embedding(build_hash_embedding(normalized_text))


async def lookup_semantic_cache(query_embedding: List[float]) -> tuple[Optional[Dict[str, Any]], float]:
    best_similarity = -1.0
    best_key: Optional[str] = None
    best_payload: Optional[Dict[str, Any]] = None

    async with semantic_cache_lock:
        stale_keys: List[str] = []

        for key, entry in semantic_response_cache.items():
            payload = entry.get("payload")
            if is_local_fallback_payload(payload):
                stale_keys.append(key)
                continue

            cached_embedding = entry.get("embedding") or []
            similarity = cosine_similarity(cached_embedding, query_embedding)
            if similarity > best_similarity:
                best_similarity = similarity
                best_key = key
                best_payload = payload

        for stale_key in stale_keys:
            semantic_response_cache.pop(stale_key, None)

        if best_key is None or best_payload is None or best_similarity < SEMANTIC_CACHE_THRESHOLD:
            return None, best_similarity

        semantic_response_cache.move_to_end(best_key)
        return deepcopy(best_payload), best_similarity


async def store_semantic_cache(query_embedding: List[float], payload: Dict[str, Any]) -> None:
    if is_local_fallback_payload(payload):
        return

    cache_key = build_semantic_cache_key(query_embedding)
    cache_entry = {
        "embedding": query_embedding,
        "payload": deepcopy(payload),
        "created_at": time.time(),
    }

    async with semantic_cache_lock:
        semantic_response_cache[cache_key] = cache_entry
        semantic_response_cache.move_to_end(cache_key)

        while len(semantic_response_cache) > SEMANTIC_CACHE_MAX_SIZE:
            semantic_response_cache.popitem(last=False)


def sanitize_suggestion_text(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""

    text = re.sub(r"^[\-\*\d\).\s]+", "", text)
    text = re.sub(r"\s+", " ", text).strip().strip('"')
    if not text:
        return ""

    if text[-1] not in {"?", "."}:
        text = f"{text}?"

    return text


def normalize_suggestions(
    items: List[Any],
    partial_query: str,
    history: List[str],
    common_topics: List[str],
    limit: int,
) -> List[str]:
    normalized: List[str] = []
    seen: Set[str] = set()
    trimmed_partial = partial_query.strip().rstrip("?").strip()

    def push(candidate: Any) -> None:
        text = sanitize_suggestion_text(candidate)
        if not text:
            return

        key = text.lower()
        if key in seen:
            return

        seen.add(key)
        normalized.append(text)

    for item in items:
        push(item)

    blended_topics = [
        *[str(entry or "").strip() for entry in history],
        *[str(entry or "").strip() for entry in common_topics],
    ]

    for topic in blended_topics:
        if len(normalized) >= limit:
            break

        if not topic:
            continue

        if trimmed_partial and topic.lower().startswith(trimmed_partial.lower()):
            push(topic)
            continue

        if trimmed_partial:
            push(f"{trimmed_partial} {topic}")

    if len(normalized) < limit and trimmed_partial:
        templates = [
            f"{trimmed_partial} treatment options with highest evidence quality",
            f"{trimmed_partial} adverse effects and contraindications",
            f"{trimmed_partial} currently recruiting clinical trials",
            f"{trimmed_partial} comparative efficacy across recent studies",
            f"{trimmed_partial} guideline updates and standard of care",
        ]
        for template in templates:
            if len(normalized) >= limit:
                break
            push(template)

    return normalized[:limit]


def parse_suggestion_candidates(raw_text: str) -> List[str]:
    parsed: Any = extract_json(raw_text)

    if isinstance(parsed, dict):
        raw_items = parsed.get("suggestions") or parsed.get("items") or []
        return [str(item) for item in raw_items] if isinstance(raw_items, list) else []

    if isinstance(parsed, list):
        return [str(item) for item in parsed]

    candidates: List[str] = []
    for line in str(raw_text or "").splitlines():
        cleaned = re.sub(r"^[\-\*\d\).\s]+", "", line).strip()
        if cleaned:
            candidates.append(cleaned)

    return candidates


def build_local_query_suggestions(
    partial_query: str,
    history: List[str],
    common_topics: List[str],
    limit: int,
) -> List[str]:
    return normalize_suggestions([], partial_query, history, common_topics, limit)


async def call_suggestion_provider(
    partial_query: str,
    history: List[str],
    common_topics: List[str],
    limit: int,
) -> tuple[str, str, str]:
    provider = "none"
    model_name = "none"
    raw_text = ""
    provider_order = get_generation_provider_order()

    history_excerpt = "\n".join(f"- {item}" for item in history[-8:]) or "- none"
    topic_excerpt = ", ".join(common_topics[:8]) or "none"

    system_message = (
        "You are a clinical autocomplete assistant. "
        "Return strict JSON only as {\"suggestions\": [\"...\"]}. "
        "Generate concise medically relevant query continuations."
    )
    user_message = (
        f"Partial query: {partial_query}\n"
        f"Recent query history:\n{history_excerpt}\n"
        f"Common medical topics: {topic_excerpt}\n"
        f"Return exactly {limit} suggestions."
    )
    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]

    async with httpx.AsyncClient(timeout=25) as client:
        for candidate in provider_order:
            if raw_text:
                break

            if candidate == "groq":
                if not GROQ_API_KEY:
                    continue

                provider = "groq"
                model_name = GROQ_MODEL
                try:
                    raw_text = await call_groq(client, messages, temperature=0.2, max_tokens=220)
                except Exception:
                    raw_text = ""
                continue

            if candidate == "local_fallback" and LOCAL_FALLBACK_ENABLED:
                provider = "local_fallback"
                model_name = "curalink-local-fallback"
                raw_text = json.dumps(
                    {
                        "suggestions": build_local_query_suggestions(
                            partial_query,
                            history,
                            common_topics,
                            limit,
                        )
                    },
                    ensure_ascii=True,
                )

        if not raw_text:
            raise HTTPException(
                status_code=503,
                detail="No suggestion provider available. Configure GROQ_API_KEY or enable LOCAL_FALLBACK_ENABLED.",
            )

    return raw_text, provider, model_name


@app.post("/suggestions")
async def suggest(req: SuggestRequest):
    partial_query = str(req.partial_query or "").strip()
    if len(partial_query) < 2:
        return {"suggestions": []}

    history = [str(item or "").strip() for item in req.history if str(item or "").strip()]
    common_topics = [str(item or "").strip() for item in req.common_topics if str(item or "").strip()]

    raw_text, provider, model_name = await call_suggestion_provider(
        partial_query,
        history,
        common_topics,
        req.limit,
    )
    raw_candidates = parse_suggestion_candidates(raw_text)
    suggestions = normalize_suggestions(raw_candidates, partial_query, history, common_topics, req.limit)

    return {
        "suggestions": suggestions,
        "provider": provider,
        "model": model_name,
    }


def _build_fused_system_prompt(request: FusedGenerateRequest) -> str:
    system_prompt = str(request.system_prompt or "").strip()

    if request.pdf_context and str(request.pdf_context).strip():
        system_prompt += (
            "\n\n## Patient Document Context\n"
            "The following content is extracted from the user's uploaded medical document(s). "
            "Treat this as primary evidence - it is about THIS patient specifically.\n"
            f"{str(request.pdf_context).strip()}"
        )

    if request.research_context and str(request.research_context).strip():
        system_prompt += (
            "\n\n## Research Evidence Context\n"
            "The following are retrieved research papers and clinical trials relevant to the query. "
            "Use these to provide research-backed context to the patient document findings.\n"
            f"{str(request.research_context).strip()}"
        )

    system_prompt += (
        "\n\n## Response Rules\n"
        "- Always prioritize the Patient Document Context over general knowledge\n"
        "- Cite document findings as [DOC] and research sources as [P1], [T1] etc.\n"
        "- If a lab value is abnormal, explain what it means clinically and cite supporting research\n"
        "- If the document context does not contain information relevant to the query, say so explicitly\n"
        "- Never fabricate lab values, diagnoses, or medications\n"
        "- Always recommend consulting a healthcare provider for clinical decisions"
    )

    return system_prompt


def _build_fused_user_prompt(request: FusedGenerateRequest) -> str:
    history = _normalize_history_messages(request.conversation_history)
    if not history:
        return str(request.user_prompt or "").strip()

    history_text = "\n".join(
        f"{item['role'].title()}: {item['content']}" for item in history
    )
    return f"Previous conversation:\n{history_text}\n\nCurrent question: {str(request.user_prompt or '').strip()}"


@app.post("/pdf/ingest", response_model=PDFIngestResponse)
async def ingest_pdf_endpoint(
    file: UploadFile = File(...),
    session_id: str = Form(...),
):
    try:
        content_type = str(file.content_type or "").lower()
        if content_type != "application/pdf":
            raise HTTPException(status_code=422, detail={"error": "Only PDF files are allowed"})

        file_bytes = await file.read()
        if len(file_bytes) > PDF_MAX_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail={"error": f"File too large. Maximum size is {PDF_MAX_SIZE_MB}MB."},
            )

        if not file_bytes:
            raise HTTPException(status_code=422, detail={"error": "Uploaded file is empty"})

        result = await rag_ingest_pdf(
            file_bytes=file_bytes,
            session_id=str(session_id),
            filename=str(file.filename or "uploaded.pdf"),
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail={"error": "PDF parsing failed", "detail": str(exc)},
        ) from exc


@app.post("/pdf/retrieve", response_model=PDFQueryResponse)
async def retrieve_pdf_context_endpoint(request: PDFQueryRequest):
    try:
        return await rag_retrieve_pdf_context(
            query=request.query,
            session_id=request.session_id,
            top_k=request.top_k,
            focus_abnormal=request.focus_abnormal,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "PDF retrieval failed", "detail": str(exc)},
        ) from exc


@app.delete("/pdf/session/{session_id}")
async def delete_session_pdf_store(session_id: str):
    deleted = rag_delete_session_collection(session_id)
    return {"deleted": deleted, "session_id": session_id}


@app.delete("/pdf/document/{session_id}/{doc_id}")
async def delete_pdf_document(session_id: str, doc_id: str):
    count = rag_delete_document_chunks(session_id, doc_id)
    return {"deleted_chunks": count, "doc_id": doc_id}


@app.get("/pdf/stats/{session_id}", response_model=PDFStatsResponse)
async def get_pdf_stats(session_id: str):
    return rag_get_session_pdf_stats(session_id)


@app.post("/generate/fused")
async def fused_generate(request: FusedGenerateRequest):
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "GROQ_API_KEY is required for fused generation.",
                "action": "Set GROQ_API_KEY and retry /generate/fused.",
            },
        )

    start_time = time.perf_counter()
    system_prompt = _build_fused_system_prompt(request)
    user_prompt = _build_fused_user_prompt(request)
    cache_key = _build_fused_cache_key(str(request.pdf_context or ""), user_prompt)

    cached_payload = await lookup_fused_cache(cache_key)
    if cached_payload is not None:
        cached_payload["semantic_cache_hit"] = True
        cached_payload["semantic_cache_similarity"] = 1.0
        cached_payload["elapsed_seconds"] = round(time.perf_counter() - start_time, 4)
        return cached_payload

    raw_text = await call_groq_direct(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        history=[],
        model=request.model or GROQ_MODEL,
        temperature=request.temperature,
        max_tokens=request.max_tokens,
    )

    allowed_citations = extract_allowed_citations(str(request.research_context or ""))
    if str(request.pdf_context or "").strip() and "DOC" not in allowed_citations:
        allowed_citations.append("DOC")
    parsed_payload = extract_json(raw_text)
    provider = "groq"
    if parsed_payload is None:
        provider = "local_fallback"
        parsed_payload = build_local_fallback_answer(user_prompt, allowed_citations)
    else:
        try:
            parsed_payload = ensure_structured_schema(parsed_payload, allowed_citations)
        except Exception:
            provider = "local_fallback"
            parsed_payload = build_local_fallback_answer(user_prompt, allowed_citations)

    response_payload = {
        "text": raw_text,
        "parsed": parsed_payload,
        "model": request.model or GROQ_MODEL,
        "provider": provider,
        "elapsed_seconds": round(time.perf_counter() - start_time, 4),
        "semantic_cache_hit": False,
        "semantic_cache_similarity": None,
        "pipeline_timings": [],
        "context_sources": {
            "pdf": bool(str(request.pdf_context or "").strip()),
            "research": bool(str(request.research_context or "").strip()),
        },
    }

    await store_fused_cache(cache_key, response_payload)
    return response_payload


@app.post("/generate")
async def generate(req: GenerateRequest):
    """Generate an LLM response using a LangGraph-orchestrated RAG flow."""
    global LAST_GENERATION_PROVIDER, LAST_GENERATION_AT
    flow_start = time.perf_counter()
    pipeline_timings: List[Dict[str, Any]] = []

    try:
        provider_errors = []

        cache_lookup_start = time.perf_counter()
        query_embedding = await generate_query_embedding(req.user_prompt)
        cached_payload, cache_similarity = await lookup_semantic_cache(query_embedding)
        add_stage_timing(pipeline_timings, "semantic_cache_lookup", cache_lookup_start)

        if cached_payload is not None:
            LAST_GENERATION_PROVIDER = "semantic-cache"
            LAST_GENERATION_AT = time.time()

            add_stage_timing(pipeline_timings, "total", flow_start)

            return {
                "text": cached_payload.get("text", ""),
                "parsed": cached_payload.get("parsed"),
                "model": cached_payload.get("model", "cached"),
                "provider": "semantic-cache",
                "elapsed_seconds": round(time.perf_counter() - flow_start, 4),
                "semantic_cache_hit": True,
                "semantic_cache_similarity": round(max(cache_similarity, 0.0), 4),
                "pipeline_timings": pipeline_timings,
            }

        if LANGGRAPH_WORKFLOW is not None:
            workflow_start = time.perf_counter()
            workflow_state = await LANGGRAPH_WORKFLOW.ainvoke(
                {
                    "system_prompt": req.system_prompt,
                    "user_prompt": req.user_prompt,
                    "temperature": req.temperature,
                    "max_tokens": req.max_tokens,
                }
            )
            add_stage_timing(pipeline_timings, "langgraph_workflow", workflow_start)

            raw_text = workflow_state.get("raw_text", "")
            parsed = workflow_state.get("parsed")
            provider = workflow_state.get("provider", "local")
            model_name = workflow_state.get("model", "curalink-local-fallback")
            provider_errors = workflow_state.get("provider_errors", [])
        else:
            prepare_start = time.perf_counter()
            allowed_citations = extract_allowed_citations(req.user_prompt)
            messages = build_prompt_messages(req.system_prompt, req.user_prompt)
            add_stage_timing(pipeline_timings, "prepare_messages", prepare_start)

            provider_start = time.perf_counter()
            provider_result = await invoke_provider_chain(req, messages, allowed_citations)
            add_stage_timing(pipeline_timings, "provider_generation", provider_start)

            raw_text = provider_result["raw_text"]
            provider = provider_result["provider"]
            model_name = provider_result["model"]
            provider_errors = provider_result.get("provider_errors", [])

            parse_start = time.perf_counter()
            parsed = extract_json(raw_text)
            if parsed is not None:
                parsed = ensure_structured_schema(parsed, allowed_citations)
            elif provider == "local":
                parsed = build_local_fallback_answer(req.user_prompt, allowed_citations)
            else:
                parsed = None
            add_stage_timing(pipeline_timings, "parse_and_validate", parse_start)

        cache_store_start = time.perf_counter()
        await store_semantic_cache(
            query_embedding,
            {
                "text": raw_text,
                "parsed": parsed,
                "model": model_name,
                "provider": provider,
            },
        )
        add_stage_timing(pipeline_timings, "semantic_cache_store", cache_store_start)

        add_stage_timing(pipeline_timings, "total", flow_start)

        elapsed = round(time.perf_counter() - flow_start, 4)
        LAST_GENERATION_PROVIDER = provider
        LAST_GENERATION_AT = time.time()
        if provider_errors:
            logger.warning("Provider chain warnings: %s", " | ".join(provider_errors[:3]))
        logger.info("LLM generated via %s in %ss, length=%s", provider, elapsed, len(raw_text))

        return {
            "text": raw_text,
            "parsed": parsed,
            "model": model_name,
            "provider": provider,
            "elapsed_seconds": elapsed,
            "semantic_cache_hit": False,
            "semantic_cache_similarity": None,
            "pipeline_timings": pipeline_timings,
        }
    except httpx.TimeoutException as exc:
        raise HTTPException(503, "LLM service timeout. The model may still be loading.") from exc
    except ValidationError as exc:
        logger.error("Generation validation error: %s", exc)
        raise HTTPException(500, f"Generation failed validation: {exc}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Generation error: %s", exc)
        raise HTTPException(500, f"Generation failed: {exc}") from exc


async def call_groq(
    client: httpx.AsyncClient,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> str:
    """Call Groq Chat Completions API as the hosted primary/fallback generation provider."""
    response = await client.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": GROQ_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("choices", [{}])[0].get("message", {}).get("content", "")


def coerce_float_vector(value: Any) -> Optional[List[float]]:
    if not isinstance(value, list):
        return None

    try:
        vector = [float(item) for item in value]
    except (TypeError, ValueError):
        return None

    return vector if vector else None


async def ollama_embed_via_embed_api(
    client: httpx.AsyncClient,
    model_name: str,
    texts: List[str],
) -> List[List[float]]:
    response = await client.post(
        f"{OLLAMA_URL}/api/embed",
        json={"model": model_name, "input": texts},
    )
    response.raise_for_status()
    payload = response.json()

    raw_embeddings = payload.get("embeddings")
    if isinstance(raw_embeddings, list) and raw_embeddings and isinstance(raw_embeddings[0], list):
        vectors: List[List[float]] = []
        for row in raw_embeddings:
            vector = coerce_float_vector(row)
            if vector is None:
                raise ValueError("Invalid embedding vector returned by /api/embed")
            vectors.append(vector)

        if len(vectors) == len(texts):
            return vectors

    single_vector = coerce_float_vector(raw_embeddings)
    if single_vector is not None and len(texts) == 1:
        return [single_vector]

    raise ValueError("Unexpected /api/embed response shape")


async def ollama_embed_via_legacy_api(
    client: httpx.AsyncClient,
    model_name: str,
    texts: List[str],
) -> List[List[float]]:
    vectors: List[List[float]] = []

    for text in texts:
        response = await client.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": model_name, "prompt": text},
        )
        response.raise_for_status()
        payload = response.json()
        vector = coerce_float_vector(payload.get("embedding"))
        if vector is None:
            raise ValueError("Unexpected /api/embeddings response shape")
        vectors.append(vector)

    return vectors


async def generate_ollama_embeddings(
    texts: List[str],
) -> tuple[Optional[List[List[float]]], Optional[str], Optional[str]]:
    model_candidates: List[str] = []
    for candidate in [OLLAMA_EMBED_MODEL, OLLAMA_EMBED_FALLBACK_MODEL]:
        normalized = str(candidate or "").strip()
        if normalized and normalized not in model_candidates:
            model_candidates.append(normalized)

    if not model_candidates:
        return None, None, "No Ollama embedding model configured"

    errors: List[str] = []
    async with httpx.AsyncClient(timeout=OLLAMA_EMBED_TIMEOUT_SEC) as client:
        for model_name in model_candidates:
            try:
                try:
                    vectors = await ollama_embed_via_embed_api(client, model_name, texts)
                except Exception:
                    vectors = await ollama_embed_via_legacy_api(client, model_name, texts)

                if vectors and len(vectors) == len(texts):
                    return vectors, model_name, None
            except Exception as exc:
                errors.append(f"{model_name}: {exc}")

    return None, None, "; ".join(errors[:2]) if errors else "Ollama embedding request failed"


@app.post("/embed")
async def embed(req: EmbedRequest):
    """Generate sentence embeddings for semantic similarity scoring."""
    if not req.texts:
        raise HTTPException(400, "No texts provided")

    truncated = [text[:512] for text in req.texts]
    mode = EMBEDDING_BACKEND
    model_name = EMBEDDING_MODEL
    warning: Optional[str] = None

    if embed_model is None:
        schedule_embedding_model_load("embed")

    if embed_model is not None and np is not None:
        embeddings = embed_model.encode(truncated, normalize_embeddings=True).tolist()
    else:
        ollama_embeddings, ollama_model, ollama_error = await generate_ollama_embeddings(truncated)
        if ollama_embeddings:
            embeddings = ollama_embeddings
            mode = "ollama"
            model_name = ollama_model or OLLAMA_EMBED_MODEL
        else:
            embeddings = [build_hash_embedding(text) for text in truncated]
            mode = "hash-fallback"
            model_name = "hash-fallback"
            warning = ollama_error or embedding_import_error

            if warning is None and embed_model_load_task is not None:
                warning = "Embedding model is warming up; using fallback embeddings"

    return {
        "embeddings": embeddings,
        "count": len(embeddings),
        "dim": len(embeddings[0]) if embeddings else FALLBACK_EMBED_DIM,
        "mode": mode,
        "model": model_name,
        "warning": warning,
    }


@app.post("/rerank")
async def rerank(req: RerankRequest):
    """Re-rank provided documents by cosine similarity against the query embedding."""
    if not req.documents:
        raise HTTPException(400, "No documents provided")

    texts = [doc.get("text", "")[:512] for doc in req.documents]
    embedding_mode = EMBEDDING_BACKEND

    if embed_model is None:
        schedule_embedding_model_load("rerank")

    if embed_model is not None and np is not None:
        query_embedding = embed_model.encode([req.query], normalize_embeddings=True)[0]
        doc_embeddings = embed_model.encode(texts, normalize_embeddings=True)
        scores = [float(score) for score in np.dot(doc_embeddings, query_embedding)]
    else:
        ollama_embeddings, _, _ = await generate_ollama_embeddings([req.query, *texts])
        if ollama_embeddings and len(ollama_embeddings) == len(texts) + 1:
            embedding_mode = "ollama"
            query_embedding = ollama_embeddings[0]
            doc_embeddings = ollama_embeddings[1:]
            scores = [cosine_similarity(embedding, query_embedding) for embedding in doc_embeddings]
        else:
            embedding_mode = "hash-fallback"
            query_embedding = build_hash_embedding(req.query)
            doc_embeddings = [build_hash_embedding(text) for text in texts]
            scores = [cosine_similarity(embedding, query_embedding) for embedding in doc_embeddings]

    ranked = [
        {"id": req.documents[index].get("id"), "score": float(scores[index])}
        for index in range(len(req.documents))
    ]

    def score_key(item: Dict[str, Any]) -> float:
        raw_score = item.get("score")
        return float(raw_score) if isinstance(raw_score, (int, float)) else 0.0

    ranked.sort(key=score_key, reverse=True)

    return {"ranked": ranked[: req.top_k], "embeddingMode": embedding_mode}


def build_hash_embedding(text: str, dim: int = FALLBACK_EMBED_DIM) -> List[float]:
    tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
    vector = [0.0] * dim

    if not tokens:
        return vector

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        primary = int.from_bytes(digest[:4], "big") % dim
        secondary = int.from_bytes(digest[4:8], "big") % dim
        vector[primary] += 1.0
        vector[secondary] += 0.5

    norm = math.sqrt(sum(value * value for value in vector))
    if norm > 0:
        vector = [value / norm for value in vector]

    return vector


def cosine_similarity(left: List[float], right: List[float]) -> float:
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0

    dot = sum(left[index] * right[index] for index in range(min(len(left), len(right))))
    return dot / (left_norm * right_norm)


def build_local_fallback_answer(
    user_prompt: str,
    allowed_citations: Optional[List[str]] = None,
) -> Dict[str, Any]:
    question = (user_prompt or "").strip()
    if not question:
        question = "the current research question"

    citations = [citation.upper() for citation in (allowed_citations or [])]
    publication_citations = [citation for citation in citations if citation.startswith("P")]
    trial_citations = [citation for citation in citations if citation.startswith("T")]

    research_insights = []
    if publication_citations:
        research_insights.append(
            {
                "insight": f"Your question was captured as: '{question}'.",
                "type": "GENERAL",
                "source_ids": publication_citations[:2],
            }
        )

    clinical_trials = []
    if trial_citations:
        clinical_trials.append(
            {
                "summary": "A relevant clinical trial was identified in the retrieved context.",
                "status": "UNKNOWN",
                "location_relevant": False,
                "contact": "",
                "source_ids": trial_citations[:1],
            }
        )

    confidence_breakdown = [
        {
            "source_id": citation,
            "title": citation,
            "relevance_score": 0.5,
            "credibility_score": 0.7,
            "recency_score": 0.5,
            "composite_score": 0.55,
        }
        for citation in citations
    ]

    return {
        "condition_overview": (
            "External model providers were unavailable, so this response was generated by the local fallback engine. "
            "Use the evidence tabs for detailed source review while infrastructure is being restored."
        ),
        "evidence_strength": "LIMITED",
        "research_insights": research_insights,
        "clinical_trials": clinical_trials,
        "key_researchers": [],
        "recommendations": (
            "This is a continuity response generated locally while external LLM providers are unavailable. "
            "Please consult your healthcare provider for personalized guidance."
        ),
        "follow_up_suggestions": [
            "Can you summarize the highest ranked publications?",
            "Can you focus on recruiting clinical trials near my location?",
            "Can you compare benefits and risks from the retrieved studies?"
        ],
        "confidence_breakdown": confidence_breakdown,
    }


def extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract a JSON object from LLM output that may include markdown wrappers."""
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    patterns = [
        r"```json\s*([\s\S]*?)```",
        r"```\s*([\s\S]*?)```",
        r"\{[\s\S]*\}",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue

        try:
            candidate = match.group(1) if "```" in pattern else match.group(0)
            return json.loads(candidate.strip())
        except json.JSONDecodeError:
            continue

    return None


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
