from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import re
from typing import Optional

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

from .chunker import Chunk


DEFAULT_CHROMA_PERSIST_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "chroma_store")
)
CHROMA_PERSIST_DIR = os.path.normpath(os.getenv("CHROMA_PERSIST_DIR", DEFAULT_CHROMA_PERSIST_DIR))
EMBEDDING_MODEL_NAME = os.getenv("PDF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

_embedding_model: Optional[SentenceTransformer] = None
_chroma_client: Optional[chromadb.PersistentClient] = None


def _safe_session_id(session_id: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", str(session_id or ""))
    return cleaned[:48] or "default"


def _collection_name(session_id: str) -> str:
    return f"session_{_safe_session_id(session_id)}"


def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedding_model


def get_chroma_client() -> chromadb.PersistentClient:
    global _chroma_client
    if _chroma_client is None:
        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_or_create_collection(session_id: str) -> chromadb.Collection:
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=_collection_name(session_id),
        metadata={
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "hnsw:space": "cosine",
        },
    )


def _sanitize_metadata_value(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return float(value) if isinstance(value, float) else int(value)
    if isinstance(value, str):
        return value
    if value is None:
        return ""

    # Chroma metadata values must be scalar; encode nested/list values as JSON.
    return json.dumps(value, ensure_ascii=True, default=str)


def _sanitize_metadata(metadata: dict) -> dict:
    return {
        str(key): _sanitize_metadata_value(value)
        for key, value in (metadata or {}).items()
    }


def _get_collection_if_exists(session_id: str) -> Optional[chromadb.Collection]:
    client = get_chroma_client()
    try:
        return client.get_collection(name=_collection_name(session_id))
    except Exception:
        return None


def embed_and_store_chunks(chunks: list[Chunk], session_id: str) -> dict:
    if not chunks:
        return {
            "stored": 0,
            "collection": _collection_name(session_id),
            "doc_id": None,
        }

    collection = get_or_create_collection(session_id)
    model = get_embedding_model()

    texts = [chunk.text for chunk in chunks]
    metadatas = [_sanitize_metadata(dict(chunk.metadata)) for chunk in chunks]
    doc_id = str(metadatas[0].get("doc_id") or "")

    embeddings = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
    )
    if hasattr(embeddings, "tolist"):
        embeddings = embeddings.tolist()

    ids = [
        f"{doc_id}_chunk_{int(metadata.get('chunk_index', index))}"
        for index, metadata in enumerate(metadatas)
    ]

    collection.upsert(
        ids=ids,
        embeddings=[[float(value) for value in row] for row in embeddings],
        documents=texts,
        metadatas=metadatas,
    )

    return {
        "stored": len(chunks),
        "collection": _collection_name(session_id),
        "doc_id": doc_id,
    }


def _build_where_filter(doc_id_filter: Optional[str], require_abnormal: bool) -> Optional[dict]:
    filters = []

    if doc_id_filter:
        filters.append({"doc_id": str(doc_id_filter)})

    if require_abnormal:
        filters.append({"has_abnormal_values": True})

    if not filters:
        return None
    if len(filters) == 1:
        return filters[0]
    return {"$and": filters}


def hybrid_retrieve(
    query: str,
    session_id: str,
    top_k: int = 8,
    doc_id_filter: Optional[str] = None,
    require_abnormal: bool = False,
) -> list[dict]:
    query_text = str(query or "").strip()
    if not query_text or top_k <= 0:
        return []

    collection = _get_collection_if_exists(session_id)
    if collection is None:
        return []

    try:
        if int(collection.count()) <= 0:
            return []
    except Exception:
        return []

    model = get_embedding_model()
    query_embedding = model.encode([query_text], normalize_embeddings=True)
    if hasattr(query_embedding, "tolist"):
        query_embedding = query_embedding.tolist()[0]
    else:
        query_embedding = [float(value) for value in query_embedding[0]]

    where_filter = _build_where_filter(doc_id_filter, require_abnormal)

    result = collection.query(
        query_embeddings=[query_embedding],
        n_results=max(top_k * 3, top_k),
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    documents = (result.get("documents") or [[]])[0]
    metadatas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    query_tokens = set(re.findall(r"[a-z0-9]+", query_text.lower()))
    ranked: list[dict] = []

    for index, text in enumerate(documents):
        chunk_text = str(text or "")
        metadata = metadatas[index] if index < len(metadatas) else {}
        distance = float(distances[index]) if index < len(distances) else 1.0

        chunk_tokens = set(re.findall(r"[a-z0-9]+", chunk_text.lower()))
        overlap_count = len(query_tokens & chunk_tokens)
        keyword_score = overlap_count / max(len(query_tokens), 1)
        vector_score = max(0.0, 1.0 - distance)
        final_score = (vector_score * 0.7) + (keyword_score * 0.3)

        ranked.append(
            {
                "text": chunk_text,
                "metadata": metadata,
                "vector_score": vector_score,
                "keyword_score": keyword_score,
                "final_score": final_score,
            }
        )

    ranked.sort(key=lambda item: item["final_score"], reverse=True)
    return ranked[:top_k]


def delete_document_chunks(session_id: str, doc_id: str) -> int:
    collection = _get_collection_if_exists(session_id)
    if collection is None:
        return 0

    results = collection.get(where={"doc_id": doc_id}, include=[])
    ids = results.get("ids") or []
    if ids:
        collection.delete(ids=ids)

    return len(ids)


def delete_session_collection(session_id: str) -> bool:
    client = get_chroma_client()
    try:
        client.delete_collection(name=_collection_name(session_id))
        return True
    except Exception:
        return False


def get_session_pdf_stats(session_id: str) -> dict:
    collection = _get_collection_if_exists(session_id)
    if collection is None:
        return {
            "total_chunks": 0,
            "doc_ids": [],
            "doc_count": 0,
        }

    total_chunks = int(collection.count())
    if total_chunks <= 0:
        return {
            "total_chunks": 0,
            "doc_ids": [],
            "doc_count": 0,
        }

    results = collection.get(include=["metadatas"])
    metadatas = results.get("metadatas") or []
    doc_ids = sorted(
        {
            str(metadata.get("doc_id"))
            for metadata in metadatas
            if isinstance(metadata, dict) and metadata.get("doc_id")
        }
    )

    return {
        "total_chunks": total_chunks,
        "doc_ids": doc_ids,
        "doc_count": len(doc_ids),
    }
