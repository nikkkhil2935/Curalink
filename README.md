# Curalink

AI-powered medical research assistant built for evidence-grounded clinical exploration.

## What Curalink does

Curalink helps users ask disease-focused medical questions, then:

1. retrieves research candidates from PubMed, OpenAlex, and ClinicalTrials.gov,
2. ranks and normalizes those sources,
3. generates a structured, citation-aware answer,
4. presents evidence, trials, timeline/researcher insights, bookmarks, export, and analytics.

The main product value is traceability: answers are tied to source citations rather than free-form model-only output.

## High-level architecture

```text
React/Vite client
  -> Express API server (sessions, retrieval pipeline, analytics, export)
      -> FastAPI LLM service (generate/embed/rerank/suggestions)
          -> External data APIs (PubMed/OpenAlex/ClinicalTrials)
          -> MongoDB Atlas (sessions/messages/sources/analytics)
```

## Repository layout

```text
client/        Frontend React app (chat, evidence panel, analytics)
server/        Backend Express app + Mongo models + retrieval pipeline
llm-service/   Python FastAPI service for generation/embedding/rerank
scripts/       Operational scripts (context refresh, smoke, latency bench)
```

## Product capabilities

- Multi-source retrieval from PubMed/OpenAlex/ClinicalTrials.gov
- Intent-aware query orchestration
- Structured RAG answers with source IDs
- Evidence tabs: Publications, Trials, Researchers, Timeline
- Session lifecycle + history search
- Bookmarks
- Session export (JSON/CSV/PDF)
- Analytics dashboard and snapshots

## Tech stack

### Frontend
- React 18
- Vite
- Tailwind CSS v4
- Recharts
- Zustand

### Backend
- Node.js + Express
- Mongoose
- Axios

### LLM service
- FastAPI
- sentence-transformers
- transformers + torch
- Groq primary provider with local fallback modes

## Prerequisites

- Node.js >= 20
- Python >= 3.11
- MongoDB Atlas connection details
- (Recommended) dedicated virtual environment at `.venv`

## Install

```bash
npm install
npm --prefix client install
npm --prefix server install
pip install -r llm-service/requirements.txt
```

## Quick start

```bash
npm run start:all
```

`start:all` launches all services and wires backend `LLM_SERVICE_URL` to the selected LLM port.

## Manual startup (3 terminals)

### Terminal 1: LLM service

```powershell
cd llm-service
$env:GROQ_API_KEY="<your-key>"
$env:PRIMARY_LLM_PROVIDER="groq"
python -m uvicorn main:app --app-dir . --host 127.0.0.1 --port 8001
```

### Terminal 2: Backend

```powershell
cd server
$env:LLM_SERVICE_URL="http://127.0.0.1:8001"
npm run dev
```

### Terminal 3: Frontend

```powershell
cd client
npm run dev -- --host 0.0.0.0 --port 5173
```

Service URLs:

- Frontend: http://localhost:5173
- Backend: http://127.0.0.1:5000
- LLM service: http://127.0.0.1:8001

## Route map

- `/` landing page
- `/app` landing route alias
- `/research/:sessionId` research workspace
- `/analytics` analytics dashboard

## Environment variables

### Backend (`server/.env`)

Required/critical:

- `MONGODB_URI` primary Atlas URI
- `LLM_SERVICE_URL` URL of FastAPI service
- `FRONTEND_URL` allowed origin for CORS
- `PORT` backend port

Recommended:

- `MONGODB_URI_FALLBACK` explicit-host Mongo URI for SRV DNS fallback on some Windows environments
- `APP_VERSION`
- `PUBMED_EMAIL`

Tuning:

- `MONGODB_SERVER_SELECTION_TIMEOUT_MS`
- `MONGODB_CONNECT_TIMEOUT_MS`
- `MONGODB_SOCKET_TIMEOUT_MS`
- `MONGODB_MAX_POOL_SIZE`
- `MONGODB_MIN_POOL_SIZE`
- `MONGODB_MAX_IDLE_MS`
- `QUERY_CACHE_TTL_MS`
- `QUERY_CACHE_MAX_ENTRIES`
- `LLM_KEEP_ALIVE_MS`
- `LLM_MAX_SOCKETS`

Scheduler:

- `ANALYTICS_SCHEDULER_ENABLED`
- `ANALYTICS_SNAPSHOT_CRON`

### LLM service

- `PRIMARY_LLM_PROVIDER` (`groq` or `ollama`)
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `OLLAMA_EMBED_MODEL`
- `OLLAMA_EMBED_TIMEOUT_SEC`
- `LOCAL_FALLBACK_ENABLED`
- `FALLBACK_EMBED_DIM`
- `USE_LANGGRAPH_WORKFLOW`
- `SEMANTIC_CACHE_THRESHOLD`
- `SEMANTIC_CACHE_MAX_SIZE`

### Frontend

- `VITE_APP_NAME`
- `VITE_API_URL`
- `VITE_DEV_API_PROXY` (used by dev proxy)

## API overview

### Sessions

- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `DELETE /api/sessions/:id`
- `GET /api/sessions/:id/sources`
- `GET /api/sessions/:id/sources/:messageId`
- `POST /api/sessions/:id/query`
- `GET /api/suggestions`
- `POST /api/sessions/:id/messages/:msgId/bookmark`
- `GET /api/sessions/history/search`

### Analytics and export

- `GET /api/analytics/overview`
- `GET /api/analytics/top-diseases`
- `GET /api/analytics/source-stats`
- `GET /api/analytics/intent-breakdown`
- `GET /api/analytics/trial-status`
- `GET /api/analytics/snapshots`
- `GET /api/analytics/sessions/:id/breakdown`
- `GET /api/sessions/:id/export`

### Health

- `GET /api/health` backend
- `GET /health` backend alias
- `GET /health` LLM service
- `GET /api/health` LLM service alias

## Retrieval + generation pipeline

1. Intent classifier detects query intent category.
2. Query expander builds source-specific query forms.
3. Retrieval adapters fetch from PubMed/OpenAlex/ClinicalTrials.
4. Normalizer converts to unified source shape.
5. Reranker scores and orders candidate sources.
6. Context packager builds citation-indexed prompt context.
7. LLM service generates structured answer JSON.
8. Backend persists session/message/source associations and analytics metadata.

## Scripts

### Root scripts

- `npm run start` starts everything
- `npm run start:all` starts all services via `start.js`
- `npm run context:refresh` regenerates project context files
- `npm run check:server` backend syntax check
- `npm run check:client` frontend build check
- `npm run check:llm` Python compile check
- `npm run check:integration` full smoke test
- `npm run doctor` refresh context + all checks

### Additional scripts

- `node scripts/integration-smoke.mjs` end-to-end smoke scenario
- `node scripts/latency-bench.mjs` latency benchmark run

## Validation workflow

Recommended local workflow before commit:

```bash
npm run doctor
```

What this validates:

- server syntax checks
- client production build
- llm-service Python compile
- integration smoke run across all services

## Integration smoke behavior

`scripts/integration-smoke.mjs` now:

- accepts `MONGODB_URI` with `mongodb+srv://` or `mongodb://`,
- auto-loads missing env values from root `.env` and `server/.env`,
- validates health/session/query/bookmark/export/analytics/history flows.

## Frontend architecture notes

- Chat and evidence are message-scoped.
- State lives in Zustand stores under `client/src/store`.
- `EvidencePanel` coordinates tab-level source rendering.
- Analytics dashboard consumes `/api/analytics/*` routes.

## Backend architecture notes

- Express app bootstraps with health/readiness contracts.
- Mongo connection can use fallback URI strategy.
- Query pipeline is orchestrated in `server/src/services/pipeline/orchestrator.js`.
- Response caching and analytics snapshot scheduling are integrated.

## LLM service architecture notes

- Supports generation, embeddings, rerank, suggestions, and health endpoints.
- Includes provider fallbacks and local deterministic fallback modes.
- Normalizes output schema for backend consumption.

## Troubleshooting

### MongoDB connection issues on Windows

If Atlas SRV DNS resolution fails:

1. keep `MONGODB_URI` as primary,
2. add `MONGODB_URI_FALLBACK` using explicit hosts (`mongodb://...`),
3. ensure password special characters are URL-encoded.

### LLM service not reachable

- Verify LLM health at `http://127.0.0.1:8001/health`.
- If changing LLM port, update backend `LLM_SERVICE_URL`.
- Ensure `GROQ_API_KEY` is set for Groq mode.

### Frontend cannot hit backend

- Confirm backend is on `PORT` (default 5000).
- Verify `VITE_API_URL` or dev proxy target.
- Confirm CORS `FRONTEND_URL` includes active frontend origin.

### Smoke test failing early

- Ensure `.env` or `server/.env` has required vars.
- Ensure `MONGODB_URI` is present and uses accepted URI scheme.
- Ensure `GROQ_API_KEY` is available for Groq-first mode.

## Known limitations

- Reliability depends on external retrieval APIs and network stability.
- Some analytics and evidence views are sensitive to source payload contract drift.
- Semantic cache correctness should be monitored when context changes between semantically similar queries.

## Docs in this repo

- `PRD (1).md` product requirements
- `DAY1_IMPLEMENTATION.md` to `DAY4_IMPLEMENTATION.md` implementation plans
- `PROJECT_CONTEXT.md` generated operational context snapshot
- `.github/agents/*.agent.md` agent role contracts used for coordinated development

## Suggested roadmap

1. tighten response-contract tests for citation/source consistency,
2. expand automated validation to include edge-case API assertions,
3. add CI workflows for `doctor` and smoke subsets,
4. formalize versioned schema contracts for frontend/backend/LLM integration.
