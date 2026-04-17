# PROJECT CONTEXT

Last Updated: 2026-04-17T10:47:08.038Z
Workspace: Curalink

## What This Is
- Auto-generated project snapshot for quick operational context.
- Regenerate with: `npm run context:refresh`
- Full verification run (and refresh): `npm run doctor`

## Services
- Frontend (React + Vite)
  - Path: client
  - Startup: npm --prefix client run dev
  - Health: Open http://localhost:5173
- Backend (Express + MongoDB)
  - Path: server
  - Startup: npm --prefix server run dev
  - Health: GET http://127.0.0.1:5000/api/health
- LLM Service (FastAPI)
  - Path: llm-service
  - Startup: python -m uvicorn main:app --app-dir llm-service --host 127.0.0.1 --port 8001
  - Health: GET http://127.0.0.1:8001/health

## Required Connections (You Must Provide)
- MongoDB URI must be valid and reachable (Atlas or local fallback).
- LLM service URL must point to running FastAPI service (default http://127.0.0.1:8001).
- Frontend origin must be listed in FRONTEND_URL for CORS in backend.
- If using Ollama, ensure OLLAMA_URL and OLLAMA_MODEL are reachable/available.
- If using hosted fallback, set GROQ_API_KEY.
- Internet access is required for PubMed, OpenAlex, and ClinicalTrials retrieval APIs.

## Environment Variables
### Backend (.env.example)
- MONGODB_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/curalink?retryWrites=true&w=majority (URL-encode special characters in the password (example: @ => %40). If Atlas SRV DNS lookups fail on Windows, switch to a non-SRV URI with explicit hosts.)
- MONGODB_URI_FALLBACK=mongodb://username:password@cluster0-shard-00-00.example.mongodb.net:27017,cluster0-shard-00-01.example.mongodb.net:27017,cluster0-shard-00-02.example.mongodb.net:27017/curalink?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority (Optional non-SRV fallback URI (recommended for Windows DNS/SRV issues).)
- MONGODB_URI_LOCAL=mongodb://127.0.0.1:27017/curalink?directConnection=true (Optional local Mongo fallback URI.)
- MONGODB_ALLOW_LOCAL_FALLBACK=false (Allow using local Mongo URI fallback in production only when explicitly enabled.)
- MONGODB_MEMORY_FALLBACK=false (Enable in-memory Mongo fallback when no external MongoDB is reachable.)
- LLM_SERVICE_URL=http://127.0.0.1:8001
- FRONTEND_URL=http://localhost:5173 (Comma-separated allowed origins for browser access.)
- PORT=5000
- TRUST_PROXY=0 (Set explicitly per deployment topology (for example 1 behind reverse proxy).)
- NODE_ENV=development
- PUBMED_EMAIL=you@example.com

### Frontend (.env.example + .env.production)
- VITE_APP_NAME=Curalink
- VITE_API_URL=https://your-backend.railway.app/api

### Discovered In Code (process.env/os.getenv)
- FALLBACK_EMBED_DIM=<set-as-needed>
- FRONTEND_URL=<set-as-needed>
- GROQ_API_KEY=<set-as-needed>
- GROQ_MODEL=<set-as-needed>
- LLM_SERVICE_URL=<set-as-needed>
- LOCAL_FALLBACK_ENABLED=<set-as-needed>
- MONGODB_ALLOW_LOCAL_FALLBACK=<set-as-needed>
- MONGODB_CONNECT_TIMEOUT_MS=<set-as-needed>
- MONGODB_MAX_IDLE_MS=<set-as-needed>
- MONGODB_MAX_POOL_SIZE=<set-as-needed>
- MONGODB_MEMORY_FALLBACK=<set-as-needed>
- MONGODB_MIN_POOL_SIZE=<set-as-needed>
- MONGODB_RETRY_MS=<set-as-needed>
- MONGODB_SERVER_SELECTION_TIMEOUT_MS=<set-as-needed>
- MONGODB_SOCKET_TIMEOUT_MS=<set-as-needed>
- MONGODB_URI=<set-as-needed>
- MONGODB_URI_FALLBACK=<set-as-needed>
- MONGODB_URI_LOCAL=<set-as-needed>
- NODE_ENV=<set-as-needed>
- OLLAMA_EMBED_MODEL=<set-as-needed>
- OLLAMA_EMBED_TIMEOUT_SEC=<set-as-needed>
- OLLAMA_MODEL=<set-as-needed>
- OLLAMA_URL=<set-as-needed>
- PORT=<set-as-needed>
- PUBMED_EMAIL=<set-as-needed>
- TRUST_PROXY=<set-as-needed>
- USE_LANGGRAPH_WORKFLOW=<set-as-needed>
- VITE_API_URL=<set-as-needed>
- VITE_APP_NAME=<set-as-needed>
- VITE_DEV_API_PROXY=<set-as-needed>

## Backend API Endpoints
- DELETE /api/sessions/:id (server/src/routes/sessions.js)
- GET /api/analytics/intent-breakdown (server/src/routes/analytics.js)
- GET /api/analytics/overview (server/src/routes/analytics.js)
- GET /api/analytics/snapshots (server/src/routes/analytics.js)
- GET /api/analytics/source-stats (server/src/routes/analytics.js)
- GET /api/analytics/top-diseases (server/src/routes/analytics.js)
- GET /api/analytics/trial-status (server/src/routes/analytics.js)
- GET /api/health (server/src/app.js)
- GET /api/sessions (server/src/routes/sessions.js)
- GET /api/sessions/:id (server/src/routes/sessions.js)
- GET /api/sessions/:id/sources (server/src/routes/sessions.js)
- GET /api/sessions/:id/sources/:messageId (server/src/routes/sessions.js)
- POST /api/export/:sessionId (server/src/routes/export.js)
- POST /api/sessions (server/src/routes/sessions.js)
- POST /api/sessions/:id/query (server/src/routes/query.js)

## LLM API Endpoints
- GET /health (llm-service/main.py)
- POST /embed (llm-service/main.py)
- POST /generate (llm-service/main.py)
- POST /rerank (llm-service/main.py)

## Frontend Routes
- / (client/src/App.jsx)
- /app (client/src/App.jsx)
- /research/:sessionId (client/src/App.jsx)
- /analytics (client/src/App.jsx)
- /platform (client/src/App.jsx)
- /status (client/src/App.jsx)

## Dependencies Snapshot
- Root dependencies: 2
- Client dependencies: 14
- Server dependencies: 12
- LLM python requirements: 10

## Quick Checks
- npm --prefix server run check
- npm --prefix client run check
- python -m py_compile llm-service/main.py
- Invoke-RestMethod -Method Get -Uri http://127.0.0.1:5000/api/health
- Invoke-RestMethod -Method Get -Uri http://127.0.0.1:8001/health

## Workspace Tree (Depth 2)
- .github/
  - .github/agents/
    - .github/agents/prd-backend-pipeline.agent.md
    - .github/agents/prd-frontend-experience.agent.md
    - .github/agents/prd-llm-rag.agent.md
    - .github/agents/prd-sync-orchestrator.agent.md
    - .github/agents/prd-validation-sync.agent.md
- .superdesign/
  - .superdesign/init/
    - .superdesign/init/components.md
    - .superdesign/init/extractable-components.md
    - .superdesign/init/layouts.md
    - .superdesign/init/pages.md
    - .superdesign/init/routes.md
    - .superdesign/init/theme.md
  - .superdesign/design-system.md
- client/
  - client/public/
    - client/public/favicon.ico
    - client/public/favicon.svg
  - client/src/
    - client/src/components/
    - client/src/hooks/
    - client/src/lib/
    - client/src/pages/
    - client/src/store/
    - client/src/utils/
    - client/src/App.jsx
    - client/src/main.jsx
    - client/src/styles.css
  - client/.env.example
  - client/.env.production
  - client/index.html
  - client/package-lock.json
  - client/package.json
  - client/vite.config.js
- llm-service/
  - llm-service/Dockerfile
  - llm-service/main.py
  - llm-service/requirements.txt
  - llm-service/start.sh
- scripts/
  - scripts/generate-project-context.mjs
  - scripts/integration-smoke.mjs
- server/
  - server/src/
    - server/src/lib/
    - server/src/middleware/
    - server/src/models/
    - server/src/routes/
    - server/src/services/
    - server/src/app.js
  - server/.env
  - server/.env.example
  - server/package-lock.json
  - server/package.json
- .gitignore
- DAY1_IMPLEMENTATION.md
- DAY2_IMPLEMENTATION.md
- DAY3_IMPLEMENTATION.md
- DAY4_IMPLEMENTATION.md
- main.py
- package-lock.json
- package.json
- PRD (1).md
- PROJECT_CONTEXT.json
- PROJECT_CONTEXT.md
- README.md
- TODO.md

