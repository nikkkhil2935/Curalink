import json
import logging
import os
import re
import time
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import numpy as np
except Exception:
    np = None

try:
    from sentence_transformers import SentenceTransformer
except Exception as exc:
    SentenceTransformer = None
    EMBEDDING_IMPORT_ERROR = str(exc)
else:
    EMBEDDING_IMPORT_ERROR = None

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
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

embed_model = None
if SentenceTransformer is not None and np is not None:
    try:
        logger.info("Loading embedding model...")
        embed_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded")
    except Exception as exc:
        EMBEDDING_IMPORT_ERROR = str(exc)
        logger.warning("Embedding model unavailable: %s", EMBEDDING_IMPORT_ERROR)
else:
    logger.warning("Embedding dependencies unavailable: %s", EMBEDDING_IMPORT_ERROR or "numpy missing")


class GenerateRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    temperature: float = 0.1
    max_tokens: int = 2048


class EmbedRequest(BaseModel):
    texts: List[str]


class RerankRequest(BaseModel):
    query: str
    documents: List[dict]
    top_k: int = 15


@app.get("/health")
async def health():
    """Check provider readiness for Ollama and optional Groq fallback."""
    ollama_status = {
        "status": "offline",
        "model": OLLAMA_MODEL,
        "model_available": False,
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
                "available_models": models[:5],
            }
    except Exception as exc:
        ollama_status["error"] = str(exc)

    groq_status = {
        "configured": bool(GROQ_API_KEY),
        "model": GROQ_MODEL,
    }

    is_ready = ollama_status["status"] == "online" or groq_status["configured"]

    return {
        "status": "ok" if is_ready else "degraded",
        "providers": {
            "ollama": ollama_status,
            "groq": groq_status,
        },
        "embeddings": {
            "available": bool(embed_model is not None and np is not None),
            "error": EMBEDDING_IMPORT_ERROR,
        },
    }


@app.post("/generate")
async def generate(req: GenerateRequest):
    """Generate an LLM response using Ollama chat API with a structured prompt."""
    start = time.time()
    ollama_payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": req.system_prompt},
            {"role": "user", "content": req.user_prompt},
        ],
        "stream": False,
        "options": {
            "temperature": req.temperature,
            "num_predict": req.max_tokens,
            "top_p": 0.9,
            "repeat_penalty": 1.1,
        },
    }

    provider = "ollama"
    model_name = OLLAMA_MODEL

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            try:
                response = await client.post(f"{OLLAMA_URL}/api/chat", json=ollama_payload)
                response.raise_for_status()
                data = response.json()
                raw_text = data.get("message", {}).get("content", "")
            except Exception as ollama_exc:
                if not GROQ_API_KEY:
                    raise ollama_exc

                provider = "groq"
                model_name = GROQ_MODEL
                raw_text = await call_groq(client, req)

        elapsed = round(time.time() - start, 2)
        logger.info("LLM generated via %s in %ss, length=%s", provider, elapsed, len(raw_text))

        parsed = extract_json(raw_text)
        return {
            "text": raw_text,
            "parsed": parsed,
            "model": model_name,
            "provider": provider,
            "elapsed_seconds": elapsed,
        }
    except httpx.TimeoutException as exc:
        raise HTTPException(503, "LLM service timeout. The model may still be loading.") from exc
    except Exception as exc:
        logger.error("Generation error: %s", exc)
        raise HTTPException(500, f"Generation failed: {exc}") from exc


async def call_groq(client: httpx.AsyncClient, req: GenerateRequest) -> str:
    """Call Groq Chat Completions API as a hosted fallback when Ollama is unavailable."""
    response = await client.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": req.system_prompt},
                {"role": "user", "content": req.user_prompt},
            ],
            "temperature": req.temperature,
            "max_tokens": req.max_tokens,
        },
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("choices", [{}])[0].get("message", {}).get("content", "")


@app.post("/embed")
async def embed(req: EmbedRequest):
    """Generate sentence embeddings for semantic similarity scoring."""
    if not req.texts:
        raise HTTPException(400, "No texts provided")

    ensure_embedding_model()

    truncated = [text[:512] for text in req.texts]
    embeddings = embed_model.encode(truncated, normalize_embeddings=True)

    return {
        "embeddings": embeddings.tolist(),
        "count": len(embeddings),
        "dim": int(embeddings.shape[1]),
    }


@app.post("/rerank")
async def rerank(req: RerankRequest):
    """Re-rank provided documents by cosine similarity against the query embedding."""
    if not req.documents:
        raise HTTPException(400, "No documents provided")

    ensure_embedding_model()

    query_embedding = embed_model.encode([req.query], normalize_embeddings=True)[0]
    texts = [doc.get("text", "")[:512] for doc in req.documents]
    doc_embeddings = embed_model.encode(texts, normalize_embeddings=True)
    scores = np.dot(doc_embeddings, query_embedding)

    ranked = [
        {"id": req.documents[index].get("id"), "score": float(scores[index])}
        for index in range(len(req.documents))
    ]
    ranked.sort(key=lambda item: item["score"], reverse=True)

    return {"ranked": ranked[: req.top_k]}


def ensure_embedding_model() -> None:
    if embed_model is None or np is None:
        message = "Embedding model unavailable. Install llm-service requirements to enable /embed and /rerank."
        if EMBEDDING_IMPORT_ERROR:
            message = f"{message} Import error: {EMBEDDING_IMPORT_ERROR}"
        raise HTTPException(503, message)


def extract_json(text: str) -> Optional[dict]:
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
