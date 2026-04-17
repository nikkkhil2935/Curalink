# Curalink Audit Fixes TODO
Status: 9/11 complete ✅

Next step: #10 Run checks & test + #11 Branch/PR

## Plan Breakdown (Approved by User)

### 1. Create structured logger setup [✅]
- server/package.json: add winston
- server/src/lib/logger.js: Winston config (levels: error/info)

### 2. Replace console.logs in app.js [✅]
- Remove 8+ logs (Mongo connect/port/start)
- Use logger.info/error

### 3. Clean orchestrator.js logs/fallbacks [✅]
- Remove console.log('Starting retrieval...')
- Refine fallbacks

### 4. Clean API services logs [✅]
- pubmed.js, openalex.js, clinicaltrials.js: remove fetch logs/timings
- llm.js: remove console.warn

### 5. Clean middleware logs [✅]
- requestLogger.js, errorHandler.js

### 6. Delete duplicate/outdated docs [✅]
- rm PRD (1).md
- rm DAY1-4_IMPLEMENTATION.md (or archive)

### 7. Simplify MongoDB connection [ ]
- app.js: single connect + retry, remove memory fallback

### 8. Add env vars for quotas/timeouts [ ]
- .env.example updates
- Use in orchestrator/apis

### 9. Update .gitignore [ ]
- Add .venv/, *.log

### 10. Run checks & test [ ]
- npm run doctor
- Manual: server dev + /health

### 11. Branch/PR [ ]
- git checkout -b blackboxai/audit-fixes
- Commit + gh pr create

Next step: #3-4 Clean orchestrator & APIs (openalex/clinicaltrials/llm remaining)


