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

    return {
        "status": "ok" if is_ready else "degraded",
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


@app.post("/generate")
async def generate(req: GenerateRequest):
    """Generate an LLM response using a LangGraph-orchestrated RAG flow."""
    global LAST_GENERATION_PROVIDER, LAST_GENERATION_AT
    start = time.time()
    try:
        provider_errors = []

        if LANGGRAPH_WORKFLOW is not None:
            workflow_state = await LANGGRAPH_WORKFLOW.ainvoke(
                {
                    "system_prompt": req.system_prompt,
                    "user_prompt": req.user_prompt,
                    "temperature": req.temperature,
                    "max_tokens": req.max_tokens,
                }
            )
            raw_text = workflow_state.get("raw_text", "")
            parsed = workflow_state.get("parsed")
            provider = workflow_state.get("provider", "local")
            model_name = workflow_state.get("model", "curalink-local-fallback")
            provider_errors = workflow_state.get("provider_errors", [])
        else:
            allowed_citations = extract_allowed_citations(req.user_prompt)
            messages = build_prompt_messages(req.system_prompt, req.user_prompt)
            provider_result = await invoke_provider_chain(req, messages, allowed_citations)
            raw_text = provider_result["raw_text"]
            provider = provider_result["provider"]
            model_name = provider_result["model"]
            provider_errors = provider_result.get("provider_errors", [])

            parsed = extract_json(raw_text)
            if parsed is not None:
                parsed = ensure_structured_schema(parsed, allowed_citations)
            elif provider == "local":
                parsed = build_local_fallback_answer(req.user_prompt, allowed_citations)
            else:
                parsed = None

        elapsed = round(time.time() - start, 2)
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
