from __future__ import annotations

from typing import NamedTuple
import re

from langchain_text_splitters import RecursiveCharacterTextSplitter

from .pdf_parser import MedicalEntity, ParsedDocument


class Chunk(NamedTuple):
    text: str
    metadata: dict


LAB_SECTION_HEADERS = [
    ("CBC", re.compile(r"\b(?:cbc|complete blood count)\b", re.IGNORECASE)),
    ("BMP", re.compile(r"\b(?:bmp|basic metabolic panel)\b", re.IGNORECASE)),
    ("CMP", re.compile(r"\b(?:cmp|comprehensive metabolic panel)\b", re.IGNORECASE)),
    ("LFT", re.compile(r"\b(?:lft|liver function)\b", re.IGNORECASE)),
    ("Lipid Panel", re.compile(r"\b(?:lipid|cholesterol|triglycerides|ldl|hdl)\b", re.IGNORECASE)),
    ("Thyroid", re.compile(r"\b(?:thyroid|tsh|t3|t4)\b", re.IGNORECASE)),
    ("Diabetes", re.compile(r"\b(?:hba1c|fasting glucose|diabetes)\b", re.IGNORECASE)),
]

RESEARCH_HEADER_PATTERN = re.compile(
    r"^(abstract|introduction|methods?|materials and methods|results?|discussion|conclusion[s]?)\s*$",
    re.IGNORECASE,
)


def _tokens_to_chars(token_count: int) -> int:
    return max(256, token_count * 4)


def _build_splitter(
    chunk_tokens: int,
    overlap_tokens: int,
    separators: list[str] | None = None,
) -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=_tokens_to_chars(chunk_tokens),
        chunk_overlap=_tokens_to_chars(overlap_tokens),
        separators=separators or ["\n\n", "\n", ". ", " "],
    )


def _find_page_number(pages: list[str], chunk_text: str) -> int:
    if not pages:
        return 1

    snippet = re.sub(r"\s+", " ", chunk_text).strip()[:140]
    if not snippet:
        return 1

    snippet_lower = snippet.lower()
    for index, page in enumerate(pages, start=1):
        if snippet_lower in re.sub(r"\s+", " ", page).lower():
            return index

    return 1


def _entities_for_chunk(chunk_text: str, entities: list[MedicalEntity]) -> list[MedicalEntity]:
    chunk_lower = chunk_text.lower()
    matches: list[MedicalEntity] = []

    for entity in entities:
        if entity.name and entity.name.lower() in chunk_lower:
            matches.append(entity)
            continue

        if entity.value and str(entity.value).lower() in chunk_lower and entity.entity_type in {"lab_value", "medication", "vital"}:
            matches.append(entity)

    return matches


def _summarize_entities(entities: list[MedicalEntity]) -> str:
    if not entities:
        return ""

    parts: list[str] = []
    for entity in entities[:12]:
        value = str(entity.value or "").strip()
        unit = str(entity.unit or "").strip()
        reference = str(entity.reference_range or "").strip()
        flag = str(entity.flag or "").strip()

        value_part = value
        if unit:
            value_part = f"{value_part} {unit}".strip()
        if flag:
            value_part = f"{value_part} [{flag}]".strip()
        if reference:
            value_part = f"{value_part} (ref: {reference})".strip()

        parts.append(f"{entity.name}={value_part or 'n/a'}")

    return ", ".join(parts)


def build_entity_enriched_chunk_text(chunk_text: str, entities_in_chunk: list[MedicalEntity]) -> str:
    if not entities_in_chunk:
        return chunk_text

    entity_summary = _summarize_entities(entities_in_chunk)
    if not entity_summary:
        return chunk_text

    return f"Entities: {entity_summary}\n---\n{chunk_text}"


def _split_lab_sections(doc: ParsedDocument) -> list[tuple[str, str]]:
    sections: dict[str, list[str]] = {}
    active_section = "General Lab Section"
    sections[active_section] = []

    for raw_line in doc.full_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        matched_header = None
        for section_name, pattern in LAB_SECTION_HEADERS:
            if pattern.search(line):
                matched_header = section_name
                break

        if matched_header:
            active_section = matched_header
            sections.setdefault(active_section, [])
            continue

        sections.setdefault(active_section, []).append(line)

    output: list[tuple[str, str]] = []
    for section_name, lines in sections.items():
        text = "\n".join(lines).strip()
        if text:
            output.append((section_name, text))

    return output or [("General Lab Section", doc.full_text)]


def _split_research_sections(doc: ParsedDocument) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current_header = "Document"
    current_lines: list[str] = []

    for raw_line in doc.full_text.splitlines():
        line = raw_line.strip()
        if RESEARCH_HEADER_PATTERN.match(line):
            if current_lines:
                sections.append((current_header, "\n".join(current_lines).strip()))
            current_header = line.title()
            current_lines = []
            continue

        current_lines.append(raw_line)

    if current_lines:
        sections.append((current_header, "\n".join(current_lines).strip()))

    return [section for section in sections if section[1]] or [("Document", doc.full_text)]


def _chunk_with_default_splitter(text: str, chunk_tokens: int, overlap_tokens: int) -> list[str]:
    splitter = _build_splitter(chunk_tokens, overlap_tokens, ["\n\n", "\n", ". ", " "])
    return [chunk.strip() for chunk in splitter.split_text(text) if chunk.strip()]


def _build_chunk(
    base_text: str,
    chunk_index: int,
    doc: ParsedDocument,
    session_id: str,
    doc_id: str,
) -> Chunk:
    matched_entities = _entities_for_chunk(base_text, doc.medical_entities)
    has_abnormal = any(entity.flag in {"HIGH", "LOW", "CRITICAL"} for entity in matched_entities)
    page_num = _find_page_number(doc.pages, base_text)

    enriched_text = build_entity_enriched_chunk_text(base_text, matched_entities)
    metadata = {
        "chunk_index": chunk_index,
        "doc_type": doc.document_type,
        "page_num": page_num,
        "session_id": session_id,
        "doc_id": doc_id,
        "source_type": "pdf_upload",
        "entities_in_chunk": [entity.name for entity in matched_entities],
        "has_abnormal_values": has_abnormal,
    }

    return Chunk(text=enriched_text, metadata=metadata)


def chunk_document(doc: ParsedDocument, session_id: str, doc_id: str) -> list[Chunk]:
    chunks: list[Chunk] = []

    if doc.document_type == "lab_report":
        sections = _split_lab_sections(doc)
        for section_name, section_text in sections:
            section_header = f"Lab Report Section: {section_name}"
            section_entities = _entities_for_chunk(section_text, doc.medical_entities)
            entity_block = _summarize_entities(section_entities)
            merged = f"{section_header}\n{entity_block}\n{section_text}" if entity_block else f"{section_header}\n{section_text}"
            for split_text in _chunk_with_default_splitter(merged, chunk_tokens=600, overlap_tokens=100):
                chunks.append(_build_chunk(split_text, len(chunks), doc, session_id, doc_id))

        return chunks

    if doc.document_type == "research_paper":
        for section_name, section_text in _split_research_sections(doc):
            section_text = section_text.strip()
            if not section_text:
                continue

            if len(section_text.split()) <= 800:
                merged = f"Research Section: {section_name}\n{section_text}"
                chunks.append(_build_chunk(merged, len(chunks), doc, session_id, doc_id))
                continue

            splitter = _build_splitter(800, 150)
            for split_text in splitter.split_text(section_text):
                normalized = split_text.strip()
                if not normalized:
                    continue
                merged = f"Research Section: {section_name}\n{normalized}"
                chunks.append(_build_chunk(merged, len(chunks), doc, session_id, doc_id))

        return chunks

    if doc.document_type == "prescription":
        medication_entities = [entity for entity in doc.medical_entities if entity.entity_type == "medication"]
        if not medication_entities:
            medication_entities = [
                MedicalEntity(
                    entity_type="medication",
                    name="Prescription",
                    value=None,
                    unit=None,
                    reference_range=None,
                    flag=None,
                )
            ]

        lines = doc.full_text.splitlines()
        for med in medication_entities:
            line_match = next((line.strip() for line in lines if med.name.lower() in line.lower()), med.name)
            prefix = f"Prescription Entry: {med.name} {med.value or ''}".strip()
            chunk_text = f"{prefix}\n{line_match}".strip()
            chunks.append(_build_chunk(chunk_text, len(chunks), doc, session_id, doc_id))

        return chunks

    for split_text in _chunk_with_default_splitter(doc.full_text, chunk_tokens=600, overlap_tokens=120):
        chunks.append(_build_chunk(split_text, len(chunks), doc, session_id, doc_id))

    return chunks
