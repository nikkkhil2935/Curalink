# Curalink

AI-powered medical research assistant focused on evidence-first responses.

## What Makes Curalink Unique

- Deep retrieval across PubMed, OpenAlex, and ClinicalTrials.gov
- Hybrid ranking pipeline (keyword + semantic + recency + location)
- Structured RAG output with source-linked evidence
- Timeline, researcher spotlight, and trial-centric evidence views
- PDF export for sharable research briefs
- Analytics dashboard for usage, intent, and source insights

## Reliability And UX Upgrades

- Message-scoped evidence alignment: selecting an assistant answer now binds the evidence panel and export flow to that exact turn.
- Retrieval hardening: no-evidence queries return deterministic grounded fallbacks instead of unconstrained generation.
- Trial preservation in ranking: clinical trial evidence is retained through semantic reranking and context selection.
- Scheduled analytics snapshots: background scheduler records hourly growth snapshots exposed in dashboard trends.
- UI primitives upgraded with shadcn-style patterns (`class-variance-authority`, `clsx`, `tailwind-merge`) and motion-enhanced visuals (`framer-motion`).

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

Optional local quality checks:

```bash
cd client
npm run check

cd ../server
npm run check
```

Optional 21st.dev MCP tooling (from `client`):

```bash
npm run 21st:setup
npm run magic:mcp
```

### Local Troubleshooting

- If MongoDB Atlas SRV resolution fails on Windows, use a non-SRV URI with explicit shard hosts instead of `mongodb+srv://`.
- If your MongoDB password contains special characters (for example `@`), URL-encode them (for example `%40`).
- Local port `8000` may already be in use in some environments; keep `LLM_SERVICE_URL` on `http://127.0.0.1:8001` and run the LLM service on port `8001`.
- Backend now tries `MONGODB_URI`, then `MONGODB_URI_FALLBACK`, then optional local fallback (`MONGODB_URI_LOCAL`) when `MONGODB_ALLOW_LOCAL_FALLBACK=true`.
- In-memory Mongo fallback is intended for local development only and should be enabled explicitly via `MONGODB_MEMORY_FALLBACK=true`.
- LLM service now supports a local continuity fallback for `/generate`, `/embed`, and `/rerank` when Ollama/Groq/torch are unavailable.
- Frontend dev proxy can be changed with `VITE_DEV_API_PROXY` (default `http://localhost:5000`).
- Backend health now reports `llmQuality` so local fallback mode is visible (`full` vs `degraded`).
- Backend analytics scheduler is controlled by:
  - `ANALYTICS_SCHEDULER_ENABLED` (`true` by default)
  - `ANALYTICS_SNAPSHOT_CRON` (default hourly: `0 * * * *`)

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

## Frontend Routes

- `/` — Landing and session launch
- `/research/:sessionId` — Research workspace (chat + evidence + stats)
- `/analytics` — Analytics dashboard
- `/platform` — Product overview and pipeline view
- `/status` — Live operational readiness view

## Day 4 Status

- Expanded analytics API and dashboard widgets
- Added shared loading and error UI primitives
- Added mobile tabbed research layout
- Added production API client configuration for frontend
- Improved form submission resiliency and bootstrap error handling
