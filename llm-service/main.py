# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownParameterType=false, reportUnknownLambdaType=false, reportConstantRedefinition=false

import hashlib
import importlib
import json
import logging
import math
import os
import re
import time
from typing import Any, Dict, List, Literal, Optional, Set, TypedDict

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, field_validator
from cache.semantic_cache import SemanticLRUCache

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

try:
    import numpy as np
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

app = FastAPI(title="Curalink LLM Service", version="1.0.0")
SERVICE_START_AT = time.time()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_EMBED_TIMEOUT_SEC = float(os.getenv("OLLAMA_EMBED_TIMEOUT_SEC", "20"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
LOCAL_FALLBACK_ENABLED = os.getenv("LOCAL_FALLBACK_ENABLED", "true").lower() != "false"
FALLBACK_EMBED_DIM = max(32, int(os.getenv("FALLBACK_EMBED_DIM", "384")))
USE_LANGGRAPH_WORKFLOW = os.getenv("USE_LANGGRAPH_WORKFLOW", "true").lower() != "false"
LAST_GENERATION_PROVIDER = "none"
LAST_GENERATION_AT: Optional[float] = None
EMBEDDING_BACKEND = "hash-fallback"
EMBEDDING_MODEL = "hash-fallback"
SEMANTIC_CACHE_TTL_SEC = max(30.0, float(os.getenv("SEMANTIC_CACHE_TTL_SEC", "300")))
SEMANTIC_CACHE_MAX_ENTRIES = max(10, int(os.getenv("SEMANTIC_CACHE_MAX_ENTRIES", "300")))
SEMANTIC_CACHE_SIMILARITY_THRESHOLD = max(
    0.0,
    min(1.0, float(os.getenv("SEMANTIC_CACHE_SIMILARITY_THRESHOLD", "0.92"))),
)
semantic_response_cache = SemanticLRUCache(
    max_entries=SEMANTIC_CACHE_MAX_ENTRIES,
    ttl_seconds=SEMANTIC_CACHE_TTL_SEC,
    similarity_threshold=SEMANTIC_CACHE_SIMILARITY_THRESHOLD,
)

embed_model = None
if SentenceTransformer is not None and np is not None:
    try:
        logger.info("Loading embedding model...")
        embed_model = SentenceTransformer("all-MiniLM-L6-v2")
        EMBEDDING_BACKEND = "sentence-transformers"
        EMBEDDING_MODEL = "all-MiniLM-L6-v2"
        logger.info("Embedding model loaded")
    except Exception as exc:
        embedding_import_error = str(exc)
        logger.warning("Embedding model unavailable: %s", embedding_import_error)
else:
    logger.warning("Embedding dependencies unavailable: %s", embedding_import_error or "numpy missing")


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


class StructuredAnswerModel(BaseModel):
    condition_overview: str = ""
    evidence_strength: Literal["LIMITED", "MODERATE", "STRONG"] = "MODERATE"
    research_insights: List[ResearchInsightModel] = Field(default_factory=list)
    clinical_trials: List[ClinicalTrialModel] = Field(default_factory=list)
    key_researchers: List[str] = Field(default_factory=list)
    recommendations: str = ""
    follow_up_suggestions: List[str] = Field(default_factory=list)

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

    for match in re.findall(r"\[(P\d+|T\d+)\]", text or "", flags=re.IGNORECASE):
        citation_id = match.upper()
        if citation_id not in seen:
            citations.append(citation_id)
            seen.add(citation_id)

    return citations


def normalize_cache_query_text(value: str) -> str:
    normalized = re.sub(r"\s+", " ", str(value or "")).strip().lower()
    if not normalized:
        return ""

    normalized = re.sub(r"\[(?:P|T)\d+\]", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized[:600]


def extract_cache_query_text(user_prompt: str) -> str:
    prompt = str(user_prompt or "")
    match = re.search(
        r'USER QUESTION:\s*"([\s\S]*?)"\s*(?:\n\n|\nSOURCES|$)',
        prompt,
        flags=re.IGNORECASE,
    )
    if match:
        return normalize_cache_query_text(match.group(1))

    before_sources = prompt.split("\nSOURCES", 1)[0]
    return normalize_cache_query_text(before_sources or prompt)


def append_pipeline_timing(
    pipeline_timings: List[Dict[str, Any]],
    stage: str,
    started_at: float,
) -> None:
    elapsed_ms = max(0.0, (time.perf_counter() - started_at) * 1000.0)
    pipeline_timings.append({"stage": stage, "duration_ms": round(elapsed_ms, 3)})


def sanitize_pipeline_timings(pipeline_timings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sanitized: List[Dict[str, Any]] = []
    for item in pipeline_timings or []:
        stage = str(item.get("stage") or "").strip()
        duration_ms = float(item.get("duration_ms") or 0.0)
        if not stage or duration_ms < 0:
            continue
        sanitized.append({"stage": stage, "duration_ms": round(duration_ms, 3)})

    return sanitized


def build_generate_response(
    *,
    text: str,
    parsed: Dict[str, Any],
    model_name: str,
    provider: str,
    elapsed_seconds: float,
    provider_errors: List[str],
    validation_error: Optional[str],
    fallback_used: bool,
    fallback_reason: Optional[str],
    pipeline_timings: List[Dict[str, Any]],
    cache_hit: bool,
    cache_similarity: Optional[float],
) -> Dict[str, Any]:
    return {
        "text": text,
        "parsed": parsed,
        "model": model_name,
        "provider": provider,
        "elapsed_seconds": round(elapsed_seconds, 3),
        "provider_errors": provider_errors,
        "validation_error": validation_error,
        "fallback_used": bool(fallback_used),
        "fallback_reason": fallback_reason,
        "pipeline_timings": sanitize_pipeline_timings(pipeline_timings),
        "cache_hit": bool(cache_hit),
        "cache_similarity": cache_similarity,
    }


def normalize_source_ids(source_ids: List[str], allowed_set: Set[str]) -> List[str]:
    normalized: List[str] = []
    seen: Set[str] = set()

    for value in source_ids or []:
        source_id = str(value).upper().strip()
        if source_id in allowed_set and source_id not in seen:
            normalized.append(source_id)
            seen.add(source_id)

    return normalized


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
    if not allowed_set:
        return validated

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


async def invoke_provider_chain(
    req: GenerateRequest,
    messages: List[Dict[str, str]],
    allowed_citations: List[str],
) -> Dict[str, Any]:
    provider = "ollama"
    model_name = OLLAMA_MODEL
    raw_text = ""
    provider_errors = []

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": req.temperature,
                        "num_predict": req.max_tokens,
                        "top_p": 0.9,
                        "repeat_penalty": 1.1,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
            raw_text = data.get("message", {}).get("content", "")
        except Exception as ollama_exc:
            provider_errors.append(f"ollama: {ollama_exc}")

        if not raw_text and GROQ_API_KEY:
            try:
                provider = "groq"
                model_name = GROQ_MODEL
                raw_text = await call_groq(
                    client,
                    messages,
                    temperature=req.temperature,
                    max_tokens=req.max_tokens,
                )
            except Exception as groq_exc:
                provider_errors.append(f"groq: {groq_exc}")

        if not raw_text and LOCAL_FALLBACK_ENABLED:
            provider = "local"
            model_name = "curalink-local-fallback"
            raw_text = json.dumps(
                build_local_fallback_answer(req.user_prompt, allowed_citations),
                ensure_ascii=True,
            )

        if not raw_text:
            raise HTTPException(
                status_code=503,
                detail="No LLM provider available. Start Ollama, configure GROQ_API_KEY, or enable LOCAL_FALLBACK_ENABLED.",
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
        "provider": str(provider_result.get("provider", "local")),
        "model": str(provider_result.get("model", "curalink-local-fallback")),
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
        "provider": "local",
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


@app.get("/health")
async def health():
    """Check provider readiness for Ollama and optional Groq fallback."""
    ollama_status = {
        "status": "offline",
        "model": OLLAMA_MODEL,
        "model_available": False,
        "embed_model": OLLAMA_EMBED_MODEL,
        "embed_model_available": False,
        "available_models": [],
    }

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
            models = [model.get("name", "") for model in response.json().get("models", [])]
            ollama_status = {
                "status": "online",
                "model": OLLAMA_MODEL,
                "model_available": any(OLLAMA_MODEL in model_name for model_name in models),
                "embed_model": OLLAMA_EMBED_MODEL,
                "embed_model_available": any(OLLAMA_EMBED_MODEL in model_name for model_name in models),
                "available_models": models[:10],
            }
    except Exception as exc:
        ollama_status["error"] = str(exc)

    groq_status = {
        "configured": bool(GROQ_API_KEY),
        "model": GROQ_MODEL,
    }

    local_status = {
        "available": LOCAL_FALLBACK_ENABLED,
        "model": "curalink-local-fallback",
    }

    is_ready = (
        ollama_status["status"] == "online"
        or groq_status["configured"]
        or local_status["available"]
    )

    ollama_embeddings_ready = ollama_status["status"] == "online" and (
        bool(ollama_status.get("embed_model_available"))
        or bool(ollama_status.get("model_available"))
    )

    if EMBEDDING_BACKEND == "sentence-transformers":
        embeddings_mode = "sentence-transformers"
        embeddings_model = EMBEDDING_MODEL
        embeddings_error = None
    elif ollama_embeddings_ready:
        embeddings_mode = "ollama"
        embeddings_model = (
            OLLAMA_EMBED_MODEL
            if ollama_status.get("embed_model_available")
            else OLLAMA_MODEL
        )
        embeddings_error = None
    else:
        embeddings_mode = "hash-fallback"
        embeddings_model = "hash-fallback"
        embeddings_error = embedding_import_error

    last_generation_age = (
        round(time.time() - LAST_GENERATION_AT, 2)
        if LAST_GENERATION_AT is not None
        else None
    )

    llm_service_status = "online" if is_ready else "degraded"

    return {
        "status": "ok" if is_ready else "degraded",
        "version": app.version,
        "uptime_ms": int((time.time() - SERVICE_START_AT) * 1000),
        "services": {
            "llm": llm_service_status,
            "db": "n/a",
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "providers": {
            "ollama": ollama_status,
            "groq": groq_status,
            "local": local_status,
        },
        "embeddings": {
            "available": True,
            "mode": embeddings_mode,
            "model": embeddings_model,
            "error": embeddings_error,
        },
        "workflow": {
            "langgraph_enabled": bool(LANGGRAPH_WORKFLOW),
            "langchain_error": langchain_import_error,
            "langgraph_error": langgraph_import_error,
        },
        "effective_generation_provider": LAST_GENERATION_PROVIDER,
        "effective_generation_age_seconds": last_generation_age,
    }


@app.get("/api/health")
async def api_health():
    return await health()


@app.post("/generate")
async def generate(req: GenerateRequest):
    """Generate an LLM response using a LangGraph-orchestrated RAG flow."""
    global LAST_GENERATION_PROVIDER, LAST_GENERATION_AT
    started_at = time.perf_counter()
    logger.info("[generate:start] model=%s temp=%s", OLLAMA_MODEL, req.temperature)

    allowed_citations = extract_allowed_citations(req.user_prompt)
    pipeline_timings: List[Dict[str, Any]] = []

    cache_query = extract_cache_query_text(req.user_prompt)
    workflow_mode = "langgraph" if LANGGRAPH_WORKFLOW is not None else "direct"
    cache_namespace = f"{hashlib.sha1('|'.join(sorted(allowed_citations)).encode('utf-8')).hexdigest()[:12]}:{workflow_mode}"
    cache_key = hashlib.sha1(f"{cache_namespace}:{cache_query}".encode("utf-8")).hexdigest()
    cache_similarity: Optional[float] = None

    embed_started = time.perf_counter()
    query_embedding: List[float] = []
    try:
        query_embedding = await build_cache_query_embedding(cache_query)
    except Exception as cache_exc:
        logger.warning("Semantic cache embedding unavailable: %s", cache_exc)
    append_pipeline_timing(pipeline_timings, "query_embedding", embed_started)

    cache_lookup_started = time.perf_counter()
    cached_payload: Optional[Dict[str, Any]] = None
    if query_embedding:
        cached_payload, cache_similarity = semantic_response_cache.get(
            query_embedding=query_embedding,
            namespace=cache_namespace,
        )
    append_pipeline_timing(pipeline_timings, "semantic_cache_lookup", cache_lookup_started)

    if cached_payload:
        elapsed_seconds = time.perf_counter() - started_at
        cache_similarity = round(float(cache_similarity or 0.0), 4)
        provider = str(cached_payload.get("provider") or "cache")
        LAST_GENERATION_PROVIDER = provider
        LAST_GENERATION_AT = time.time()

        logger.info("[generate:cache-hit] similarity=%.3f", cache_similarity)
        return build_generate_response(
            text=str(cached_payload.get("text") or ""),
            parsed=dict(cached_payload.get("parsed") or {}),
            model_name=str(cached_payload.get("model") or "cached-response"),
            provider=provider,
            elapsed_seconds=elapsed_seconds,
            provider_errors=list(cached_payload.get("provider_errors") or []),
            validation_error=cached_payload.get("validation_error"),
            fallback_used=bool(cached_payload.get("fallback_used")),
            fallback_reason=cached_payload.get("fallback_reason"),
            pipeline_timings=pipeline_timings,
            cache_hit=True,
            cache_similarity=cache_similarity,
        )

    provider_errors: List[str] = []
    validation_error: Optional[str] = None
    fallback_used = False
    fallback_reason: Optional[str] = None
    raw_text = ""
    parsed: Dict[str, Any] = {}
    provider = "local"
    model_name = "curalink-local-fallback"

    try:
        if LANGGRAPH_WORKFLOW is not None:
            workflow_started = time.perf_counter()
            workflow_state = await LANGGRAPH_WORKFLOW.ainvoke(
                {
                    "system_prompt": req.system_prompt,
                    "user_prompt": req.user_prompt,
                    "temperature": req.temperature,
                    "max_tokens": req.max_tokens,
                }
            )
            append_pipeline_timing(pipeline_timings, "workflow_invoke", workflow_started)

            raw_text = str(workflow_state.get("raw_text", ""))
            provider = str(workflow_state.get("provider", "local"))
            model_name = str(workflow_state.get("model", "curalink-local-fallback"))
            provider_errors = list(workflow_state.get("provider_errors", []))
            workflow_parsed = workflow_state.get("parsed")

            if isinstance(workflow_parsed, dict):
                parsed = workflow_parsed
            else:
                parse_started = time.perf_counter()
                parsed = extract_json(raw_text) or {}
                append_pipeline_timing(pipeline_timings, "parse_json", parse_started)
        else:
            invoke_started = time.perf_counter()
            messages = build_prompt_messages(req.system_prompt, req.user_prompt)
            provider_result = await invoke_provider_chain(req, messages, allowed_citations)
            append_pipeline_timing(pipeline_timings, "provider_invoke", invoke_started)

            raw_text = str(provider_result["raw_text"])
            provider = str(provider_result["provider"])
            model_name = str(provider_result["model"])
            provider_errors = list(provider_result.get("provider_errors", []))

            parse_started = time.perf_counter()
            parsed = extract_json(raw_text) or {}
            append_pipeline_timing(pipeline_timings, "parse_json", parse_started)

        if parsed:
            validation_started = time.perf_counter()
            try:
                parsed = ensure_structured_schema(parsed, allowed_citations)
            except ValidationError as exc:
                validation_error = str(exc)
                fallback_used = True
                fallback_reason = validation_error
                parsed = build_local_fallback_answer(req.user_prompt, allowed_citations)
                raw_text = json.dumps(parsed, ensure_ascii=True)
                provider = "local"
                model_name = "curalink-local-fallback"
            append_pipeline_timing(pipeline_timings, "schema_validation", validation_started)
        else:
            validation_error = "Provider response was not valid JSON."
            fallback_used = True
            fallback_reason = validation_error
            parsed = build_local_fallback_answer(req.user_prompt, allowed_citations)
            raw_text = json.dumps(parsed, ensure_ascii=True)
            provider = "local"
            model_name = "curalink-local-fallback"

        if provider == "local":
            fallback_used = True
            fallback_reason = fallback_reason or "Local fallback provider response used."

        cache_store_started = time.perf_counter()
        if query_embedding and cache_query and not fallback_used:
            semantic_response_cache.set(
                cache_key=cache_key,
                query_embedding=query_embedding,
                namespace=cache_namespace,
                payload={
                    "text": raw_text,
                    "parsed": parsed,
                    "model": model_name,
                    "provider": provider,
                    "provider_errors": provider_errors,
                    "validation_error": validation_error,
                    "fallback_used": fallback_used,
                    "fallback_reason": fallback_reason,
                },
            )
        append_pipeline_timing(pipeline_timings, "semantic_cache_store", cache_store_started)

        elapsed_seconds = time.perf_counter() - started_at
        LAST_GENERATION_PROVIDER = provider
        LAST_GENERATION_AT = time.time()

        if provider_errors:
            logger.warning("Provider chain warnings: %s", " | ".join(provider_errors[:3]))
        if fallback_used:
            logger.warning("Structured fallback used: %s", fallback_reason or "unknown")
        logger.info("LLM generated via %s in %ss, length=%s", provider, round(elapsed_seconds, 3), len(raw_text))

        return build_generate_response(
            text=raw_text,
            parsed=parsed,
            model_name=model_name,
            provider=provider,
            elapsed_seconds=elapsed_seconds,
            provider_errors=provider_errors,
            validation_error=validation_error,
            fallback_used=fallback_used,
            fallback_reason=fallback_reason,
            pipeline_timings=pipeline_timings,
            cache_hit=False,
            cache_similarity=cache_similarity,
        )
    except httpx.TimeoutException:
        timeout_started = time.perf_counter()
        append_pipeline_timing(pipeline_timings, "exception_timeout", timeout_started)
        fallback = build_local_fallback_answer(req.user_prompt, allowed_citations)
        elapsed_seconds = time.perf_counter() - started_at
        return build_generate_response(
            text=json.dumps(fallback, ensure_ascii=True),
            parsed=fallback,
            model_name="curalink-local-fallback",
            provider="local",
            elapsed_seconds=elapsed_seconds,
            provider_errors=["provider timeout"],
            validation_error="LLM provider timeout",
            fallback_used=True,
            fallback_reason="LLM provider timeout",
            pipeline_timings=pipeline_timings,
            cache_hit=False,
            cache_similarity=cache_similarity,
        )
    except ValidationError as exc:
        validation_started = time.perf_counter()
        append_pipeline_timing(pipeline_timings, "exception_validation", validation_started)
        fallback = build_local_fallback_answer(req.user_prompt, allowed_citations)
        elapsed_seconds = time.perf_counter() - started_at
        return build_generate_response(
            text=json.dumps(fallback, ensure_ascii=True),
            parsed=fallback,
            model_name="curalink-local-fallback",
            provider="local",
            elapsed_seconds=elapsed_seconds,
            provider_errors=[],
            validation_error=str(exc),
            fallback_used=True,
            fallback_reason=str(exc),
            pipeline_timings=pipeline_timings,
            cache_hit=False,
            cache_similarity=cache_similarity,
        )
    except HTTPException as exc:
        http_started = time.perf_counter()
        append_pipeline_timing(pipeline_timings, "exception_http", http_started)
        safe_detail = str(exc.detail) if exc.detail else "Provider unavailable"
        fallback = build_local_fallback_answer(req.user_prompt, allowed_citations)
        elapsed_seconds = time.perf_counter() - started_at
        return build_generate_response(
            text=json.dumps(fallback, ensure_ascii=True),
            parsed=fallback,
            model_name="curalink-local-fallback",
            provider="local",
            elapsed_seconds=elapsed_seconds,
            provider_errors=[safe_detail],
            validation_error=safe_detail,
            fallback_used=True,
            fallback_reason=safe_detail,
            pipeline_timings=pipeline_timings,
            cache_hit=False,
            cache_similarity=cache_similarity,
        )
    except Exception as exc:
        generic_started = time.perf_counter()
        append_pipeline_timing(pipeline_timings, "exception_generic", generic_started)
        fallback = build_local_fallback_answer(req.user_prompt, allowed_citations)
        elapsed_seconds = time.perf_counter() - started_at
        return build_generate_response(
            text=json.dumps(fallback, ensure_ascii=True),
            parsed=fallback,
            model_name="curalink-local-fallback",
            provider="local",
            elapsed_seconds=elapsed_seconds,
            provider_errors=[str(exc)],
            validation_error=str(exc),
            fallback_used=True,
            fallback_reason=str(exc),
            pipeline_timings=pipeline_timings,
            cache_hit=False,
            cache_similarity=cache_similarity,
        )


async def call_groq(
    client: httpx.AsyncClient,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> str:
    """Call Groq Chat Completions API as a hosted fallback when Ollama is unavailable."""
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
    for candidate in [OLLAMA_EMBED_MODEL, OLLAMA_MODEL]:
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


async def build_cache_query_embedding(query_text: str) -> List[float]:
    if not query_text:
        return []

    if embed_model is not None and np is not None:
        vector = embed_model.encode([query_text], normalize_embeddings=True)[0]
        return [float(value) for value in vector.tolist()]

    ollama_embeddings, _, _ = await generate_ollama_embeddings([query_text])
    if ollama_embeddings and ollama_embeddings[0]:
        vector = [float(value) for value in ollama_embeddings[0]]
        norm = math.sqrt(sum(value * value for value in vector))
        if norm > 0:
            return [value / norm for value in vector]

    return build_hash_embedding(query_text)


@app.post("/embed")
async def embed(req: EmbedRequest):
    """Generate sentence embeddings for semantic similarity scoring."""
    if not req.texts:
        raise HTTPException(400, "No texts provided")

    truncated = [text[:512] for text in req.texts]
    mode = EMBEDDING_BACKEND
    model_name = EMBEDDING_MODEL
    warning: Optional[str] = None

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
    ranked.sort(key=lambda item: item["score"], reverse=True)

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
        ]
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
