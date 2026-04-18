# PROJECT CONTEXT

<<<<<<< HEAD
Last Updated: 2026-04-17T11:18:50.082Z
=======
Last Updated: 2026-04-18T11:09:11.978Z
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
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
- MONGODB_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/curalink?retryWrites=true&w=majority (Required: MongoDB Atlas SRV URI only.)
- LLM_SERVICE_URL=http://127.0.0.1:8001 (Service endpoints)
- FRONTEND_URL=http://localhost:5173
- PORT=5000
- NODE_ENV=development (Runtime)
- APP_VERSION=1.0.0
- TRUST_PROXY=0
- PUBMED_EMAIL=you@example.com
- MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000 (MongoDB connection tuning)
- MONGODB_CONNECT_TIMEOUT_MS=10000
- MONGODB_SOCKET_TIMEOUT_MS=30000
- MONGODB_MAX_POOL_SIZE=20
- MONGODB_MIN_POOL_SIZE=0
- MONGODB_MAX_IDLE_MS=30000
- QUERY_CACHE_TTL_MS=300000 (Server caches and LLM HTTP keep-alive)
- QUERY_CACHE_MAX_ENTRIES=500
- LLM_KEEP_ALIVE_MS=30000
- LLM_MAX_SOCKETS=50
- ANALYTICS_SCHEDULER_ENABLED=true (Scheduler)
- ANALYTICS_SNAPSHOT_CRON=0 * * * *

### Frontend (.env.example + .env.production)
- VITE_APP_NAME=Curalink
- VITE_API_URL=http://127.0.0.1:5000/api
- VITE_API_URL=https://your-backend.railway.app/api

### Discovered In Code (process.env/os.getenv)
- ANALYTICS_SCHEDULER_ENABLED=<set-as-needed>
- ANALYTICS_SNAPSHOT_CRON=<set-as-needed>
- APP_VERSION=<set-as-needed>
- FALLBACK_EMBED_DIM=<set-as-needed>
- FRONTEND_URL=<set-as-needed>
- GROQ_API_KEY=<set-as-needed>
- GROQ_MODEL=<set-as-needed>
- LLM_KEEP_ALIVE_MS=<set-as-needed>
- LLM_MAX_SOCKETS=<set-as-needed>
- LLM_SERVICE_URL=<set-as-needed>
- LOCAL_FALLBACK_ENABLED=<set-as-needed>
- MONGODB_CONNECT_TIMEOUT_MS=<set-as-needed>
- MONGODB_MAX_IDLE_MS=<set-as-needed>
- MONGODB_MAX_POOL_SIZE=<set-as-needed>
- MONGODB_MIN_POOL_SIZE=<set-as-needed>
- MONGODB_SERVER_SELECTION_TIMEOUT_MS=<set-as-needed>
- MONGODB_SOCKET_TIMEOUT_MS=<set-as-needed>
- MONGODB_URI=<set-as-needed>
- MONGODB_URI_FALLBACK=<set-as-needed>
- NODE_ENV=<set-as-needed>
- OLLAMA_EMBED_MODEL=<set-as-needed>
- OLLAMA_EMBED_TIMEOUT_SEC=<set-as-needed>
- OLLAMA_MODEL=<set-as-needed>
- OLLAMA_URL=<set-as-needed>
- PORT=<set-as-needed>
- PRIMARY_LLM_PROVIDER=<set-as-needed>
- PUBMED_EMAIL=<set-as-needed>
- QUERY_CACHE_MAX_ENTRIES=<set-as-needed>
- QUERY_CACHE_TTL_MS=<set-as-needed>
- SEMANTIC_CACHE_MAX_SIZE=<set-as-needed>
- SEMANTIC_CACHE_THRESHOLD=<set-as-needed>
- TRUST_PROXY=<set-as-needed>
- USE_LANGGRAPH_WORKFLOW=<set-as-needed>
- VITE_API_URL=<set-as-needed>
- VITE_APP_NAME=<set-as-needed>
- VITE_DEV_API_PROXY=<set-as-needed>

## Backend API Endpoints
- DELETE /api/sessions/:id (server/src/routes/sessions.js)
- GET /api/analytics/intent-breakdown (server/src/routes/analytics.js)
- GET /api/analytics/overview (server/src/routes/analytics.js)
- GET /api/analytics/sessions/:id/breakdown (server/src/routes/analytics.js)
- GET /api/analytics/snapshots (server/src/routes/analytics.js)
- GET /api/analytics/source-stats (server/src/routes/analytics.js)
- GET /api/analytics/top-diseases (server/src/routes/analytics.js)
- GET /api/analytics/trial-status (server/src/routes/analytics.js)
- GET /api/sessions/:id/export (server/src/routes/export.js)
- GET /api/health (server/src/app.js)
- GET /api/sessions (server/src/routes/sessions.js)
- GET /api/sessions/:id (server/src/routes/sessions.js)
- GET /api/sessions/:id/insights (server/src/routes/sessions.js)
- GET /api/sessions/:id/sources (server/src/routes/sessions.js)
- GET /api/sessions/:id/sources/:messageId (server/src/routes/sessions.js)
- GET /api/sessions/history/search (server/src/routes/sessions.js)
- GET /api/suggestions (server/src/routes/query.js)
- GET /health (server/src/app.js)
- POST /api/sessions (server/src/routes/sessions.js)
- POST /api/sessions/:id/messages/:msgId/bookmark (server/src/routes/sessions.js)
- POST /api/sessions/:id/query (server/src/routes/query.js)

## LLM API Endpoints
- GET /api/health (llm-service/main.py)
- GET /health (llm-service/main.py)
- POST /embed (llm-service/main.py)
- POST /generate (llm-service/main.py)
- POST /rerank (llm-service/main.py)
- POST /suggestions (llm-service/main.py)

## Frontend Routes
- / (client/src/App.jsx)
- /app (client/src/App.jsx)
- /research/:sessionId (client/src/App.jsx)
- /analytics (client/src/App.jsx)

## Dependencies Snapshot
- Root dependencies: 3
- Client dependencies: 15
- Server dependencies: 13
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
- .mypy_cache/
  - .mypy_cache/3.12/
    - .mypy_cache/3.12/cache.db
  - .mypy_cache/.gitignore
  - .mypy_cache/CACHEDIR.TAG
- .superdesign/
  - .superdesign/init/
    - .superdesign/init/components.md
    - .superdesign/init/extractable-components.md
    - .superdesign/init/layouts.md
    - .superdesign/init/pages.md
    - .superdesign/init/routes.md
    - .superdesign/init/theme.md
  - .superdesign/design-system.md
  - .superdesign/SUPERDESIGN.md
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
  - client/tailwind.config.js
  - client/vite.config.js
- graphify-out/
  - graphify-out/latency-bench-2026-04-18T08-00-41-354Z.json
- llm-service/
  - llm-service/cache/
  - llm-service/Dockerfile
  - llm-service/main.py
  - llm-service/requirements.txt
  - llm-service/start.sh
- logs/
  - logs/combined.log
  - logs/error.log
- scripts/
  - scripts/generate-project-context.mjs
  - scripts/integration-smoke.mjs
  - scripts/latency-bench.mjs
- server/
  - server/logs/
    - server/logs/combined.log
    - server/logs/error.log
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
- .env.example
- .gitignore
- components.json
- DAY1_IMPLEMENTATION.md
- DAY2_IMPLEMENTATION.md
- DAY3_IMPLEMENTATION.md
- DAY4_IMPLEMENTATION.md
- integration-smoke.mjs
- main.py
- package-lock.json
- package.json
- PRD (1).md
- PROJECT_CONTEXT.json
- PROJECT_CONTEXT.md
- README.md
<<<<<<< HEAD
- TODO.md
=======
- start.js
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

