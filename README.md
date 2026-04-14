# Curalink

Curalink is a full-stack AI medical research assistant scaffold aligned to your PRD and Day 1 implementation plan.

This repository currently includes:

- MERN skeleton (React + Node/Express + MongoDB schemas)
- FastAPI LLM service placeholder
- Session + query + analytics + export routes
- 3-panel research UI shell with chat/evidence/sidebar
- Placeholder responses for retrieval/ranking/generation (to be implemented later)

## Workspace Structure

```
Curalink/
  client/        React + Vite frontend
  server/        Express + MongoDB backend
  llm-service/   FastAPI placeholder service
```

## 1) Backend Setup

```bash
cd server
npm install
npm run dev
```

Runs on `http://localhost:5000`.

Environment file is at `server/.env`.

## 2) Frontend Setup

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173` and proxies `/api` to backend.

## 3) LLM Service Setup

```bash
cd llm-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Runs on `http://localhost:8000`.

## Day 1 Scope and Placeholders

The following are intentionally placeholder implementations for later phases:

- Retrieval integrations (PubMed/OpenAlex/ClinicalTrials)
- Hybrid ranking and evidence scoring internals
- Full RAG prompting with local Ollama/BioMistral
- Production PDF generation

## Current API Endpoints

### Backend

- `POST /api/sessions`
- `GET /api/sessions/:id`
- `GET /api/sessions/:id/sources`
- `GET /api/sessions`
- `DELETE /api/sessions/:id`
- `POST /api/sessions/:id/query` (placeholder answer)
- `GET /api/analytics/top-diseases`
- `GET /api/analytics/source-stats`
- `POST /api/export/:sessionId` (placeholder)
- `GET /api/health`

### LLM Service

- `GET /health`
- `GET /models`
- `POST /embed` (placeholder vectors)
- `POST /generate` (placeholder structured JSON)
