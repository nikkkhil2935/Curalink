from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import re
import tempfile
from typing import Literal, Optional

import pdfplumber

try:
    import pytesseract
except Exception:  # pragma: no cover - optional dependency at runtime
    pytesseract = None

try:
    from unstructured.partition.pdf import partition_pdf
except Exception:  # pragma: no cover - optional dependency at runtime
    partition_pdf = None

DocumentType = Literal[
    "lab_report",
    "research_paper",
    "prescription",
    "clinical_note",
    "radiology_report",
    "unknown",
]


@dataclass
class MedicalEntity:
    entity_type: str
    name: str
    value: Optional[str]
    unit: Optional[str]
    reference_range: Optional[str]
    flag: Optional[str]


@dataclass
class ParsedDocument:
    document_type: DocumentType
    full_text: str
    pages: list[str]
    medical_entities: list[MedicalEntity]
    metadata: dict
    structured_summary: str
    has_ocr_content: bool


DOCUMENT_TYPE_PATTERNS: dict[DocumentType, list[str]] = {
    "lab_report": [
        r"\breference\s*range\b",
        r"\bresult\b",
        r"\bhemoglobin\b",
        r"\bwbc\b",
        r"\bcreatinine\b",
        r"\bhba1c\b",
        r"\bglucose\b",
    ],
    "research_paper": [
        r"\babstract\b",
        r"\bintroduction\b",
        r"\bmethods?\b",
        r"\bresults?\b",
        r"\bconclusion\b",
        r"\bdoi\s*:",
        r"\bpmid\b",
        r"\bp-value\b",
        r"\b95%\s*ci\b",
    ],
    "prescription": [
        r"\brx\b",
        r"\bsig\s*:",
        r"\brefills?\b",
        r"\bdispense\b",
        r"\btablet\b",
        r"\bcapsule\b",
        r"\bonce\s+daily\b",
        r"\btwice\s+daily\b",
    ],
    "clinical_note": [
        r"\bchief\s+complaint\b",
        r"\bhpi\b",
        r"\bassessment\b",
        r"\bplan\b",
        r"\bsoap\b",
        r"\bhistory\s+of\s+present\s+illness\b",
    ],
    "radiology_report": [
        r"\bimpression\b",
        r"\bfindings\b",
        r"\bradiograph\b",
        r"\bmri\b",
        r"\bct\s+scan\b",
        r"\bx-?ray\b",
        r"\bopacity\b",
        r"\blesion\b",
    ],
    "unknown": [],
}

LAB_NAMES = {
    "WBC",
    "RBC",
    "HEMOGLOBIN",
    "HEMATOCRIT",
    "PLATELETS",
    "MCV",
    "MCH",
    "MCHC",
    "SODIUM",
    "POTASSIUM",
    "CHLORIDE",
    "CO2",
    "BUN",
    "CREATININE",
    "GLUCOSE",
    "CALCIUM",
    "ALT",
    "AST",
    "ALKALINE PHOSPHATASE",
    "BILIRUBIN",
    "ALBUMIN",
    "TOTAL CHOLESTEROL",
    "LDL",
    "HDL",
    "TRIGLYCERIDES",
    "TSH",
    "T3",
    "T4",
    "HBA1C",
    "FASTING GLUCOSE",
    "TROPONIN",
    "BNP",
    "CK-MB",
    "URINE PROTEIN",
    "URINE GLUCOSE",
    "URINE WBC",
    "URINE RBC",
}

LAB_ROW_PATTERNS = [
    re.compile(
        r"^(?P<name>[A-Za-z][A-Za-z0-9\-_/()% ]{1,64})\s*[:\-]?\s+"
        r"(?P<value>-?\d+(?:\.\d+)?)\s*"
        r"(?P<unit>[A-Za-z%/^\d\.]+)?\s*"
        r"(?P<ref>(?:<?\s*\d+(?:\.\d+)?\s*[-\u2013]\s*\d+(?:\.\d+)?|<?\s*\d+(?:\.\d+)?|>\s*\d+(?:\.\d+)?))?\s*"
        r"(?P<flag>H|L|HIGH|LOW|CRITICAL)?$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?P<name>[A-Za-z][A-Za-z0-9\-_/()% ]{1,64})\s{2,}"
        r"(?P<value>-?\d+(?:\.\d+)?)\s+"
        r"(?P<unit>[A-Za-z%/^\d\.]+)?\s*"
        r"(?P<ref>(?:<?\s*\d+(?:\.\d+)?\s*[-\u2013]\s*\d+(?:\.\d+)?|<?\s*\d+(?:\.\d+)?|>\s*\d+(?:\.\d+)?))?\s*"
        r"(?P<flag>H|L|HIGH|LOW|CRITICAL)?$",
        re.IGNORECASE,
    ),
]

MEDICATION_PATTERN = re.compile(
    r"(?P<name>[A-Z][A-Za-z0-9\- ]{1,50})\s+"
    r"(?P<dose>\d+(?:\.\d+)?\s*(?:mg|mcg|g|iu|ml))"
    r"(?P<rest>.*)$",
    re.IGNORECASE,
)

DIAGNOSIS_LINE_PATTERN = re.compile(
    r"(?:diagnosis|impression|assessment|findings)\s*[:\-]\s*(?P<value>.+)$",
    re.IGNORECASE,
)

DATE_PATTERN = re.compile(
    r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|"
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b",
    re.IGNORECASE,
)


def _clean_page_text(text: str) -> str:
    cleaned = str(text or "").replace("\x00", " ")
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _normalize_flag(value: Optional[str]) -> Optional[str]:
    token = str(value or "").strip().upper()
    if token in {"H", "HIGH"}:
        return "HIGH"
    if token in {"L", "LOW"}:
        return "LOW"
    if token == "CRITICAL":
        return "CRITICAL"
    return None


def _is_lab_name(name: str) -> bool:
    normalized = _normalize_whitespace(name).upper()
    if normalized in LAB_NAMES:
        return True

    return any(lab in normalized for lab in LAB_NAMES)


def detect_document_type(text: str) -> DocumentType:
    candidate_text = str(text or "").lower()
    if not candidate_text:
        return "unknown"

    scores: dict[DocumentType, int] = {
        "lab_report": 0,
        "research_paper": 0,
        "prescription": 0,
        "clinical_note": 0,
        "radiology_report": 0,
        "unknown": 0,
    }

    for doc_type, patterns in DOCUMENT_TYPE_PATTERNS.items():
        if doc_type == "unknown":
            continue

        score = 0
        for pattern in patterns:
            if re.search(pattern, candidate_text, flags=re.IGNORECASE):
                score += 1
        scores[doc_type] = score

    best_type = max(scores, key=scores.get)
    return best_type if scores[best_type] >= 2 else "unknown"


def extract_lab_values(text: str) -> list[MedicalEntity]:
    entities: list[MedicalEntity] = []
    seen: set[tuple[str, str, str, str, str]] = set()

    for raw_line in str(text or "").splitlines():
        line = _normalize_whitespace(raw_line)
        if not line:
            continue

        for pattern in LAB_ROW_PATTERNS:
            match = pattern.match(line)
            if not match:
                continue

            name = _normalize_whitespace(match.group("name"))
            if not _is_lab_name(name):
                continue

            value = _normalize_whitespace(match.group("value"))
            unit = _normalize_whitespace(match.group("unit")) or None
            reference_range = _normalize_whitespace(match.group("ref")) or None
            flag = _normalize_flag(match.group("flag"))
            key = (
                name.lower(),
                value,
                unit or "",
                reference_range or "",
                flag or "",
            )
            if key in seen:
                continue

            seen.add(key)
            entities.append(
                MedicalEntity(
                    entity_type="lab_value",
                    name=name,
                    value=value,
                    unit=unit,
                    reference_range=reference_range,
                    flag=flag,
                )
            )
            break

    return entities


def extract_medications(text: str) -> list[MedicalEntity]:
    entities: list[MedicalEntity] = []
    seen: set[tuple[str, str]] = set()

    for raw_line in str(text or "").splitlines():
        line = _normalize_whitespace(raw_line)
        if not line:
            continue

        if "rx" not in line.lower() and not re.search(r"\b(?:mg|mcg|g|iu|ml)\b", line, flags=re.IGNORECASE):
            continue

        match = MEDICATION_PATTERN.search(line)
        if not match:
            continue

        name = _normalize_whitespace(match.group("name"))
        dose = _normalize_whitespace(match.group("dose"))
        rest = _normalize_whitespace(match.group("rest"))

        frequency_match = re.search(
            r"\b(od|bd|tds|qid|once daily|twice daily|daily|every\s+\d+\s+hours?)\b",
            rest,
            flags=re.IGNORECASE,
        )
        frequency = frequency_match.group(1) if frequency_match else ""
        value = _normalize_whitespace(" ".join(part for part in [dose, frequency] if part)) or dose

        key = (name.lower(), value.lower())
        if key in seen:
            continue

        seen.add(key)
        entities.append(
            MedicalEntity(
                entity_type="medication",
                name=name,
                value=value,
                unit=None,
                reference_range=None,
                flag=None,
            )
        )

    return entities


def extract_diagnoses(text: str) -> list[MedicalEntity]:
    entities: list[MedicalEntity] = []
    seen: set[str] = set()

    for raw_line in str(text or "").splitlines():
        line = _normalize_whitespace(raw_line)
        if not line:
            continue

        match = DIAGNOSIS_LINE_PATTERN.search(line)
        if not match:
            continue

        values = [segment.strip(" -") for segment in re.split(r"[,;]", match.group("value"))]
        for value in values:
            normalized = _normalize_whitespace(value)
            if len(normalized) < 3:
                continue

            key = normalized.lower()
            if key in seen:
                continue

            seen.add(key)
            entities.append(
                MedicalEntity(
                    entity_type="diagnosis",
                    name=normalized,
                    value=None,
                    unit=None,
                    reference_range=None,
                    flag=None,
                )
            )

    return entities


def extract_vitals(text: str) -> list[MedicalEntity]:
    entities: list[MedicalEntity] = []

    patterns = [
        ("Blood Pressure", r"\b(?:bp|blood\s*pressure)\s*[:\-]?\s*(\d{2,3}/\d{2,3})\s*mmhg\b", "mmHg"),
        ("Heart Rate", r"\b(?:heart\s*rate|pulse)\s*[:\-]?\s*(\d{2,3})\s*(?:bpm|beats/min)\b", "bpm"),
        ("Temperature", r"\btemperature\s*[:\-]?\s*(\d{2,3}(?:\.\d+)?)\s*([fc])\b", None),
        ("Respiratory Rate", r"\b(?:respiratory\s*rate|rr)\s*[:\-]?\s*(\d{1,2})\s*(?:/min|bpm)\b", "breaths/min"),
        ("SpO2", r"\b(?:spo2|oxygen\s*saturation)\s*[:\-]?\s*(\d{2,3})\s*%\b", "%"),
    ]

    for name, pattern, default_unit in patterns:
        for match in re.finditer(pattern, str(text or ""), flags=re.IGNORECASE):
            value = _normalize_whitespace(match.group(1))
            unit = default_unit
            if name == "Temperature" and match.lastindex and match.lastindex >= 2:
                unit = match.group(2).upper()

            entities.append(
                MedicalEntity(
                    entity_type="vital",
                    name=name,
                    value=value,
                    unit=unit,
                    reference_range=None,
                    flag=None,
                )
            )

    return entities


def extract_metadata(text: str, entities: list[MedicalEntity]) -> dict:
    metadata: dict[str, object] = {}
    source_text = str(text or "")

    date_match = DATE_PATTERN.search(source_text)
    if date_match:
        metadata["date"] = _normalize_whitespace(date_match.group(1))

    patient_age_match = re.search(r"\bage\s*[:\-]?\s*(\d{1,3})\b", source_text, flags=re.IGNORECASE)
    if patient_age_match:
        metadata["patient_age"] = int(patient_age_match.group(1))

    patient_id_match = re.search(
        r"\b(?:patient\s*id|mrn|uhid|record\s*id)\s*[:\-]?\s*([A-Za-z0-9\-_/]+)",
        source_text,
        flags=re.IGNORECASE,
    )
    if patient_id_match:
        metadata["patient_id"] = _normalize_whitespace(patient_id_match.group(1))

    hospital_match = re.search(
        r"\b([A-Z][A-Za-z0-9,&\- ]+(?:Hospital|Clinic|Medical Center|Laboratory|Lab))\b",
        source_text,
    )
    if hospital_match:
        metadata["hospital"] = _normalize_whitespace(hospital_match.group(1))

    doctor_match = re.search(r"\bDr\.?\s+[A-Z][A-Za-z.\- ]+", source_text)
    if doctor_match:
        metadata["doctor"] = _normalize_whitespace(doctor_match.group(0))

    test_names = sorted({entity.name for entity in entities if entity.entity_type == "lab_value"})
    if test_names:
        metadata["test_names"] = test_names[:32]

    return metadata


def build_structured_summary(
    entities: list[MedicalEntity],
    doc_type: DocumentType,
    metadata: dict,
) -> str:
    labels = {
        "lab_report": "laboratory report",
        "research_paper": "research paper",
        "prescription": "prescription",
        "clinical_note": "clinical note",
        "radiology_report": "radiology report",
        "unknown": "medical document",
    }

    date_text = str(metadata.get("date") or "").strip()
    date_clause = f" dated {date_text}" if date_text else ""

    lab_count = sum(1 for entity in entities if entity.entity_type == "lab_value")
    diagnosis_count = sum(1 for entity in entities if entity.entity_type == "diagnosis")
    medication_count = sum(1 for entity in entities if entity.entity_type == "medication")

    abnormalities = [
        entity
        for entity in entities
        if entity.flag in {"HIGH", "LOW", "CRITICAL"}
    ]
    abnormal_summary = ", ".join(
        f"{entity.name} {entity.flag} at {entity.value}{(' ' + entity.unit) if entity.unit else ''}".strip()
        for entity in abnormalities[:4]
    )

    summary_parts = [
        f"This is a {labels.get(doc_type, 'medical document')}{date_clause}.",
        (
            f"It contains {lab_count} lab values, {diagnosis_count} diagnosis mentions, and "
            f"{medication_count} medication entries."
        ),
    ]

    if abnormal_summary:
        summary_parts.append(f"Notable abnormal findings include: {abnormal_summary}.")

    return " ".join(summary_parts)


def _extract_text_with_pdfplumber(file_bytes: bytes) -> list[str]:
    pages: list[str] = []
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            pages.append(_clean_page_text(page_text))
    return pages


def _extract_text_with_ocr(file_bytes: bytes) -> list[str]:
    if pytesseract is None:
        return []

    pages: list[str] = []
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                try:
                    image = page.to_image(resolution=220).original
                    page_text = pytesseract.image_to_string(image)
                except Exception:
                    page_text = ""
                pages.append(_clean_page_text(page_text))
    except Exception:
        return []

    return pages


def _extract_text_with_unstructured(file_bytes: bytes) -> list[str]:
    if partition_pdf is None:
        return []

    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as temp_file:
            temp_file.write(file_bytes)
            temp_file.flush()
            elements = partition_pdf(filename=temp_file.name, strategy="fast")

        merged = "\n".join(_normalize_whitespace(str(element)) for element in elements if str(element).strip())
        cleaned = _clean_page_text(merged)
        return [cleaned] if cleaned else []
    except Exception:
        return []


def parse_pdf(file_bytes: bytes) -> ParsedDocument:
    if not file_bytes:
        raise ValueError("Empty PDF payload")

    pages = _extract_text_with_pdfplumber(file_bytes)
    has_ocr_content = False

    total_chars = sum(len(page) for page in pages)
    page_count = max(len(pages), 1)
    avg_chars_per_page = total_chars / page_count

    if avg_chars_per_page < 100:
        ocr_pages = _extract_text_with_ocr(file_bytes)
        if sum(len(page) for page in ocr_pages) > total_chars:
            pages = ocr_pages
            total_chars = sum(len(page) for page in pages)
            has_ocr_content = bool(total_chars)

    if total_chars < 100:
        unstructured_pages = _extract_text_with_unstructured(file_bytes)
        if sum(len(page) for page in unstructured_pages) > total_chars:
            pages = unstructured_pages
            total_chars = sum(len(page) for page in pages)

    full_text = "\n\n".join(page for page in pages if page).strip()
    if len(full_text) < 40:
        raise ValueError("No extractable text found in PDF. OCR fallback also failed.")

    document_type = detect_document_type(full_text)
    lab_entities = extract_lab_values(full_text)
    medication_entities = extract_medications(full_text)
    diagnosis_entities = extract_diagnoses(full_text)
    vital_entities = extract_vitals(full_text)

    medical_entities = [
        *lab_entities,
        *diagnosis_entities,
        *medication_entities,
        *vital_entities,
    ]

    metadata = extract_metadata(full_text, medical_entities)
    if "patient_id" in metadata:
        medical_entities.append(
            MedicalEntity(
                entity_type="patient_id",
                name="Patient ID",
                value=str(metadata.get("patient_id") or ""),
                unit=None,
                reference_range=None,
                flag=None,
            )
        )

    if "date" in metadata:
        medical_entities.append(
            MedicalEntity(
                entity_type="date",
                name="Report Date",
                value=str(metadata.get("date") or ""),
                unit=None,
                reference_range=None,
                flag=None,
            )
        )

    structured_summary = build_structured_summary(medical_entities, document_type, metadata)

    return ParsedDocument(
        document_type=document_type,
        full_text=full_text,
        pages=pages,
        medical_entities=medical_entities,
        metadata=metadata,
        structured_summary=structured_summary,
        has_ocr_content=has_ocr_content,
    )
