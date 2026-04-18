from __future__ import annotations

import uuid

from .chunker import chunk_document
from .pdf_parser import ParsedDocument, parse_pdf
from .vector_store import embed_and_store_chunks, get_session_pdf_stats, hybrid_retrieve


async def ingest_pdf(file_bytes: bytes, session_id: str, filename: str) -> dict:
    doc: ParsedDocument = parse_pdf(file_bytes)
    doc_id = str(uuid.uuid4())[:8]

    chunks = chunk_document(doc, session_id, doc_id)
    for index, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = index
        chunk.metadata["filename"] = filename

    embed_and_store_chunks(chunks, session_id)

    abnormal_findings = [
        entity
        for entity in doc.medical_entities
        if entity.flag in {"HIGH", "LOW", "CRITICAL"}
    ]

    return {
        "doc_id": doc_id,
        "filename": filename,
        "document_type": doc.document_type,
        "structured_summary": doc.structured_summary,
        "medical_entities": [entity.__dict__ for entity in doc.medical_entities],
        "total_chunks": len(chunks),
        "abnormal_findings": [entity.__dict__ for entity in abnormal_findings],
        "has_abnormal_findings": bool(abnormal_findings),
        "metadata": doc.metadata,
    }


async def retrieve_pdf_context(
    query: str,
    session_id: str,
    top_k: int = 6,
    focus_abnormal: bool = False,
) -> dict:
    chunks = hybrid_retrieve(
        query=query,
        session_id=session_id,
        top_k=top_k,
        require_abnormal=focus_abnormal,
    )

    if not chunks:
        return {
            "chunks": [],
            "context_text": "",
            "source_docs": [],
            "has_pdf_context": False,
        }

    context_blocks: list[str] = []
    source_docs: list[str] = []
    seen_doc_ids: set[str] = set()

    for chunk in chunks:
        metadata = chunk.get("metadata") or {}
        score = float(chunk.get("final_score") or 0.0)
        source_filename = str(metadata.get("filename") or metadata.get("doc_id") or "Uploaded PDF")
        source_doc_type = str(metadata.get("doc_type") or "unknown")
        source_doc_id = str(metadata.get("doc_id") or "")

        if source_doc_id and source_doc_id not in seen_doc_ids:
            seen_doc_ids.add(source_doc_id)
            source_docs.append(source_doc_id)

        context_blocks.append(
            "\n".join(
                [
                    f"[Source: {source_filename}, Type: {source_doc_type}, Relevance: {score:.2f}]",
                    str(chunk.get("text") or ""),
                ]
            ).strip()
        )

    context_text = "=== PDF Document Context ===\n" + "\n---\n".join(context_blocks)

    return {
        "chunks": chunks,
        "context_text": context_text,
        "source_docs": source_docs,
        "has_pdf_context": True,
    }


__all__ = [
    "ingest_pdf",
    "retrieve_pdf_context",
    "get_session_pdf_stats",
]
