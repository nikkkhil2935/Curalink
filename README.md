# Curalink

AI-powered medical research assistant focused on evidence-first responses.

## What Makes Curalink Unique

- Deep retrieval across PubMed, OpenAlex, and ClinicalTrials.gov
- Hybrid ranking pipeline (keyword + semantic + recency + location)
- Structured RAG output with source-linked evidence
- Timeline, researcher spotlight, and trial-centric evidence views
- PDF export for sharable research briefs
- Analytics dashboard for usage, intent, and source insights

## Architecture

```text
React (Vite)
  -> Express API (Node.js)
      -> Retrieval adapters (PubMed, OpenAlex, ClinicalTrials)
      -> Ranking + context packaging
      -> FastAPI LLM service
      -> MongoDB (sessions, messages, source docs, analytics)
```

## Stack

- Frontend: React 18, Vite, Tailwind CSS, Recharts, Zustand
- Backend: Node.js, Express, Mongoose
- LLM service: FastAPI, SentenceTransformers, Ollama-compatible generation
- Database: MongoDB
- Deployment targets: Vercel (frontend), Railway (backend), Render (LLM)

## Retrieval and Generation Pipeline

1. Intent classification
2. Query expansion
3. Parallel retrieval from 3 sources
4. Normalization and deduplication
5. Hybrid reranking
6. Context packaging with citation index
7. LLM structured synthesis
8. Evidence-first response rendering

## Local Setup

### 1) LLM service

```bash
cd llm-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 2) Backend

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

### 3) Frontend

```bash
cd client
npm install
npm run dev
```

### Local Troubleshooting

- If MongoDB Atlas SRV resolution fails on Windows, use a non-SRV URI with explicit shard hosts instead of `mongodb+srv://`.
- If your MongoDB password contains special characters (for example `@`), URL-encode them (for example `%40`).
- Local port `8000` may already be in use in some environments; keep `LLM_SERVICE_URL` on `http://127.0.0.1:8001` and run the LLM service on port `8001`.

## Production Environment Variables

### Backend (Railway)

- `MONGODB_URI`
- `LLM_SERVICE_URL`
- `FRONTEND_URL`
- `PORT`
- `NODE_ENV`

### LLM service (Render)

- `OLLAMA_URL` (if using Ollama endpoint)
- `OLLAMA_MODEL`
- `GROQ_API_KEY` (optional hosted fallback)

### Frontend (Vercel)

- `VITE_API_URL` (for example: `https://your-backend.railway.app/api`)

## API Endpoints

### Sessions

- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `GET /api/sessions/:id/sources`
- `DELETE /api/sessions/:id`

### Query

- `POST /api/sessions/:id/query`

### Analytics

- `GET /api/analytics/overview`
- `GET /api/analytics/top-diseases`
- `GET /api/analytics/intent-breakdown`
- `GET /api/analytics/source-stats`
- `GET /api/analytics/trial-status`

### Export

- `POST /api/export/:sessionId`

### Health

- `GET /api/health`
- `GET /health` (LLM service)

## Day 4 Status

- Expanded analytics API and dashboard widgets
- Added shared loading and error UI primitives
- Added mobile tabbed research layout
- Added production API client configuration for frontend
- Improved form submission resiliency and bootstrap error handling
