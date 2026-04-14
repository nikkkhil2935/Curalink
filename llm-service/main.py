from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    query: str = Field(default="")
    patient_profile: Dict[str, Any] = Field(default_factory=dict)
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    context: Optional[Dict[str, Any]] = None


class EmbedRequest(BaseModel):
    texts: List[str] = Field(default_factory=list)


app = FastAPI(title="Curalink LLM Service", version="0.1.0")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "llm-placeholder"}


@app.get("/models")
def models() -> Dict[str, List[str]]:
    return {
        "available": ["llama3.1:8b (placeholder)", "BioMistral-7B (placeholder)"],
        "active": ["llama3.1:8b (placeholder)"]
    }


@app.post("/embed")
def embed(payload: EmbedRequest) -> Dict[str, Any]:
    # Placeholder embeddings: deterministic zero vectors for Day 1 wiring.
    vectors = [[0.0] * 8 for _ in payload.texts]
    return {"embeddings": vectors, "dimension": 8, "status": "placeholder"}


@app.post("/generate")
def generate(payload: GenerateRequest) -> Dict[str, Any]:
    # Placeholder JSON response matching the target schema.
    return {
        "condition_overview": "Placeholder overview. Full RAG synthesis will be added in the next implementation phase.",
        "evidence_strength": "LIMITED",
        "research_insights": [
            {
                "insight": f"Received query: {payload.query}",
                "type": "GENERAL",
                "source_ids": []
            }
        ],
        "clinical_trials": [],
        "key_researchers": [],
        "recommendations": "This is a placeholder response. Please consult a healthcare professional for medical decisions.",
        "follow_up_suggestions": [
            "Would you like a treatment-focused search?",
            "Should I focus on recruiting trials near your location?",
            "Do you want publication timeline insights?"
        ]
    }
