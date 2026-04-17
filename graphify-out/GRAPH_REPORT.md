# Graph Report - .  (2026-04-18)

## Corpus Check
- Corpus is ~46,986 words - fits in a single context window. You may not need a graph.

## Summary
- 475 nodes · 646 edges · 58 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 122 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Day Rationale Llm|Day Rationale Llm]]
- [[_COMMUNITY_Fetchfromclinicaltrials Buildragcontext Buildsystemprompt|Fetchfromclinicaltrials Buildragcontext Buildsystemprompt]]
- [[_COMMUNITY_Payload State Session|Payload State Session]]
- [[_COMMUNITY_Analytics Llm Context|Analytics Llm Context]]
- [[_COMMUNITY_Rationale Hackathon Research|Rationale Hackathon Research]]
- [[_COMMUNITY_Build Embed Normalize|Build Embed Normalize]]
- [[_COMMUNITY_Buildtreelines Deduperoutes Extractapproutes|Buildtreelines Deduperoutes Extractapproutes]]
- [[_COMMUNITY_Bootstrapmongoconnection Connectinmemorymongo Connectmongouri|Bootstrapmongoconnection Connectinmemorymongo Connectmongouri]]
- [[_COMMUNITY_Jsx Apptopnav Chat|Jsx Apptopnav Chat]]
- [[_COMMUNITY_Jsx Themetoggle Usetheme|Jsx Themetoggle Usetheme]]
- [[_COMMUNITY_Log Resolvenpmcommand Resolvepythonexecutable|Log Resolvenpmcommand Resolvepythonexecutable]]
- [[_COMMUNITY_Sessions Attachcitations Hasvalidsessionid|Sessions Attachcitations Hasvalidsessionid]]
- [[_COMMUNITY_Analyticsdashboard Charttooltip Sectiontitle|Analyticsdashboard Charttooltip Sectiontitle]]
- [[_COMMUNITY_Theme Research Interface|Theme Research Interface]]
- [[_COMMUNITY_Structuredanswer Jsx Citationtag|Structuredanswer Jsx Citationtag]]
- [[_COMMUNITY_Publicationstab Jsx Publicationcard|Publicationstab Jsx Publicationcard]]
- [[_COMMUNITY_Sidebar Jsx Inforow|Sidebar Jsx Inforow]]
- [[_COMMUNITY_Connectivity Motif Curalink|Connectivity Motif Curalink]]
- [[_COMMUNITY_Contextform Jsx Field|Contextform Jsx Field]]
- [[_COMMUNITY_Researcherstab Jsx Initials|Researcherstab Jsx Initials]]
- [[_COMMUNITY_Timelinetab Jsx Customtooltip|Timelinetab Jsx Customtooltip]]
- [[_COMMUNITY_Trialstab Jsx Statusbadge|Trialstab Jsx Statusbadge]]
- [[_COMMUNITY_Statuspage Jsx Statusicon|Statuspage Jsx Statusicon]]
- [[_COMMUNITY_Textarea Classname Merge|Textarea Classname Merge]]
- [[_COMMUNITY_Chatinput Useautoresize Jsx|Chatinput Useautoresize Jsx]]
- [[_COMMUNITY_Chatpanel Emptystate Jsx|Chatpanel Emptystate Jsx]]
- [[_COMMUNITY_Evidencepanel Jsx Emptyevidence|Evidencepanel Jsx Emptyevidence]]
- [[_COMMUNITY_Platformpage Jsx Featurecard|Platformpage Jsx Featurecard]]
- [[_COMMUNITY_Variant Factory Cva|Variant Factory Cva]]
- [[_COMMUNITY_Mobile Tabbed Research|Mobile Tabbed Research]]
- [[_COMMUNITY_Compatibility Asgi Entrypoint|Compatibility Asgi Entrypoint]]
- [[_COMMUNITY_Messagebubble Jsx|Messagebubble Jsx]]
- [[_COMMUNITY_Sourcecard Jsx|Sourcecard Jsx]]
- [[_COMMUNITY_Exportbutton Jsx|Exportbutton Jsx]]
- [[_COMMUNITY_Errorbanner Jsx|Errorbanner Jsx]]
- [[_COMMUNITY_Loadingoverlay Jsx|Loadingoverlay Jsx]]
- [[_COMMUNITY_Magicbackdrop Jsx|Magicbackdrop Jsx]]
- [[_COMMUNITY_Landingpage Jsx|Landingpage Jsx]]
- [[_COMMUNITY_Researchinterface Jsx|Researchinterface Jsx]]
- [[_COMMUNITY_Extractapierror|Extractapierror]]
- [[_COMMUNITY_Errorhandler|Errorhandler]]
- [[_COMMUNITY_Requestlogger|Requestlogger]]
- [[_COMMUNITY_Createmessagesandupdatesession Query|Createmessagesandupdatesession Query]]
- [[_COMMUNITY_Retrievecandidates Retriever|Retrievecandidates Retriever]]
- [[_COMMUNITY_Vite|Vite]]
- [[_COMMUNITY_Jsx|Jsx]]
- [[_COMMUNITY_Textarea Jsx|Textarea Jsx]]
- [[_COMMUNITY_Useappstore|Useappstore]]
- [[_COMMUNITY_Logger|Logger]]
- [[_COMMUNITY_Analytics|Analytics]]
- [[_COMMUNITY_Message|Message]]
- [[_COMMUNITY_Session|Session]]
- [[_COMMUNITY_Sourcedoc|Sourcedoc]]
- [[_COMMUNITY_User|User]]
- [[_COMMUNITY_Analytics|Analytics]]
- [[_COMMUNITY_Export|Export]]
- [[_COMMUNITY_Platform Marketing|Platform Marketing]]
- [[_COMMUNITY_Platform Feature Grid|Platform Feature Grid]]

## God Nodes (most connected - your core abstractions)
1. `Run Retrieval Pipeline` - 25 edges
2. `runRetrievalPipeline()` - 23 edges
3. `Curalink Research Intelligence Engine` - 16 edges
4. `main()` - 15 edges
5. `Session Query Orchestrator` - 12 edges
6. `Express Application Core` - 12 edges
7. `Evidence Tab Router` - 10 edges
8. `LLM Generate Endpoint` - 9 edges
9. `generate()` - 8 edges
10. `Structured Answer Formatter` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Day2 Parallel Retrieval Rationale` --conceptually_related_to--> `Capture Analytics Snapshot`  [INFERRED]
  DAY2_IMPLEMENTATION.md → server/src/services/scheduler.js
- `Day1 Stub Route Progressive Delivery Rationale` --cites--> `Run Retrieval Pipeline`  [INFERRED]
  DAY1_IMPLEMENTATION.md → server/src/services/pipeline/orchestrator.js
- `Day3 Graceful Fallback Rationale` --semantically_similar_to--> `Day1 Stub Route Progressive Delivery Rationale`  [INFERRED] [semantically similar]
  DAY3_IMPLEMENTATION.md → DAY1_IMPLEMENTATION.md
- `Message Scoped Evidence Alignment` --semantically_similar_to--> `Follow Up Context Injection`  [INFERRED] [semantically similar]
  README.md → PRD (1).md
- `AppTopNav()` --calls--> `cn()`  [INFERRED]
  client\src\components\layout\AppTopNav.jsx → client\src\lib\utils.js

## Hyperedges (group relationships)
- **Favicon Composition** — favicon_curalink_icon, favicon_rounded_square_background, favicon_dual_blue_nodes, favicon_horizontal_link_bar [EXTRACTED 1.00]
- **Chat Response Pipeline** — chatpanel_query_orchestrator, messagebubble_assistant_answer_card, structuredanswer_answer_formatter, evidencepanel_tab_router, sidebar_session_telemetry_panel [INFERRED 0.86]
- **Evidence Aggregation Suite** — publicationstab_relevance_sorting, researcherstab_author_leaderboard_aggregation, timelinetab_publication_trend_analytics, trialstab_trial_prioritization_sort, evidencepanel_source_type_counters [INFERRED 0.82]
- **Global Store Consumers** — chatpanel_query_orchestrator, evidencepanel_tab_router, sidebar_session_telemetry_panel, exportbutton_pdf_report_generator, errorbanner_store_bound_error_state [EXTRACTED 1.00]
- **Research Session Lifecycle Flow** — landingpage_session_creation_flow, researchinterface_session_bootstrap_loader, useAppStore_sources_by_message_cache, api_axios_api_client, server_app_express_application [INFERRED 0.87]
- **Structured Answer Contract Alignment** — llm_main_structured_schema_enforcer, llm_main_generate_endpoint, message_model_structured_answer_subschema, integration_smoke_query_contract_assertions, useAppStore_apply_assistant_response_action [INFERRED 0.84]
- **Resilience Health Fallback Stack** — server_app_mongo_bootstrap_with_fallbacks, server_app_health_aggregation_endpoint, llm_main_provider_chain, llm_main_local_fallback_answer_builder, statuspage_core_service_status_mapping [INFERRED 0.79]
- **Retrieval Pipeline Composition** — orchestrator_run_retrieval_pipeline, intentclassifier_classify_intent, queryexpander_expand_query, pubmed_fetch_function, openalex_fetch_function, clinicaltrials_fetch_function, normalizer_normalize_and_deduplicate, reranker_rerank_candidates, llm_semantic_rerank, contextpackager_build_rag_context, llm_call_api [EXTRACTED 1.00]
- **Citation Integrity Path** — contextpackager_build_rag_context, orchestrator_validate_answer_citations, llm_parse_response, llm_normalize_structured_answer, sessions_order_source_ids, sessions_attach_citations, query_post_session_query_endpoint [INFERRED 0.86]
- **Analytics Feedback Loop** — query_post_session_query_endpoint, sessions_create_session_endpoint, export_pdf_placeholder_endpoint, scheduler_capture_snapshot, analytics_overview_endpoint, analytics_snapshots_endpoint, analytics_source_stats_endpoint [INFERRED 0.82]
- **Core Research Pipeline** — prd_1_smart_intent_classifier, prd_1_hybrid_reranking_formula, prd_1_rag_context_top13_sources, prd_1_llm_strict_json_output_schema [EXTRACTED 1.00]
- **Analytics Observability Implementation** — prd_1_query_analytics_dashboard, day4_implementation_analytics_dashboard, readme_scheduled_analytics_snapshots, project_context_backend_api_surface [INFERRED 0.86]
- **Deployment Runtime Bundle** — prd_1_deployment_architecture_free_tier, day4_implementation_deployment_vercel_railway_render, project_context_service_topology_three_services, requirements_fastapi_uvicorn_runtime [INFERRED 0.83]

## Communities

### Community 0 - "Day Rationale Llm"
Cohesion: 0.06
Nodes (55): Analytics Overview Endpoint, Analytics Snapshots Endpoint, Analytics Source Stats Endpoint, Analytics Trial Status Endpoint, ClinicalTrials Fetch Function, ClinicalTrials Status Color Map, Build RAG Context, Build System Prompt (+47 more)

### Community 1 - "Fetchfromclinicaltrials Buildragcontext Buildsystemprompt"
Cohesion: 0.06
Nodes (36): fetchFromClinicalTrials(), buildRAGContext(), buildSystemPrompt(), buildUserPrompt(), packageContext(), classifyIntent(), getRetrievalStrategy(), callLLM() (+28 more)

### Community 2 - "Payload State Session"
Cohesion: 0.07
Nodes (49): Application Route Map, Route Suspense Shell, Top Navigation Shell, Top Nav Theme Toggle Action, Chat Message Composer, Programmatic Input Seed Handler, Speech Recognition Dictation, Empty State Suggestion Dispatcher (+41 more)

### Community 3 - "Analytics Llm Context"
Cohesion: 0.07
Nodes (49): Analytics Index Definitions, Analytics Mongoose Schema, Analytics Dashboard Page, Analytics Chart Rendering Layer, Parallel Analytics Fetch Orchestrator, Axios API Client, API Error Extraction Helper, Error Handler Middleware (+41 more)

### Community 4 - "Rationale Hackathon Research"
Cohesion: 0.07
Nodes (44): Analytics Dashboard Implementation, Deployment Split Across Vercel Railway Render, End To End Hackathon Use Case Tests, Loom Demo Script, Rationale: Demo Structured Around Judging Criteria, Rationale: Use Hosted Fallback For Hackathon Speed, Curalink Research Intelligence Engine, Free Tier Deployment Architecture (+36 more)

### Community 5 - "Build Embed Normalize"
Cohesion: 0.09
Nodes (37): BaseModel, build_hash_embedding(), build_local_fallback_answer(), build_prompt_messages(), call_groq(), ClinicalTrialModel, coerce_float_vector(), cosine_similarity() (+29 more)

### Community 6 - "Buildtreelines Deduperoutes Extractapproutes"
Cohesion: 0.23
Nodes (17): buildTreeLines(), dedupeRoutes(), extractAppRoutes(), extractEnvEntries(), extractEnvUsagesFromNode(), extractEnvUsagesFromPython(), extractExpressRoutes(), extractFastApiRoutes() (+9 more)

### Community 7 - "Bootstrapmongoconnection Connectinmemorymongo Connectmongouri"
Cohesion: 0.22
Nodes (10): bootstrapMongoConnection(), connectInMemoryMongo(), connectMongoUri(), getMongoCandidates(), sanitizeMongoUri(), scheduleMongoReconnect(), shutdown(), captureAnalyticsSnapshot() (+2 more)

### Community 8 - "Jsx Apptopnav Chat"
Cohesion: 0.18
Nodes (6): AppTopNav(), Button(), Card(), cn(), useAutoResizeTextarea(), VercelV0Chat()

### Community 9 - "Jsx Themetoggle Usetheme"
Cohesion: 0.2
Nodes (3): App(), ThemeToggle(), useTheme()

### Community 10 - "Log Resolvenpmcommand Resolvepythonexecutable"
Cohesion: 0.44
Nodes (9): log(), main(), resolveNpmCommand(), resolvePythonExecutable(), runSmoke(), sleep(), spawnService(), terminateService() (+1 more)

### Community 11 - "Sessions Attachcitations Hasvalidsessionid"
Cohesion: 0.38
Nodes (3): normalizeDemographics(), normalizeLocation(), normalizeText()

### Community 12 - "Analyticsdashboard Charttooltip Sectiontitle"
Cohesion: 0.33
Nodes (0): 

### Community 13 - "Theme Research Interface"
Cohesion: 0.4
Nodes (6): Research Interface Mobile Tab Navigation, Research Interface Page, Theme Toggle Keyboard Radiogroup Navigation, Theme Toggle Component, Apply Theme DOM Function, useTheme Hook

### Community 14 - "Structuredanswer Jsx Citationtag"
Cohesion: 0.5
Nodes (2): sanitize(), StructuredAnswer()

### Community 15 - "Publicationstab Jsx Publicationcard"
Cohesion: 0.4
Nodes (0): 

### Community 16 - "Sidebar Jsx Inforow"
Cohesion: 0.4
Nodes (0): 

### Community 17 - "Connectivity Motif Curalink"
Cohesion: 0.6
Nodes (5): Connectivity Motif, Curalink Icon, Dual Blue Circular Nodes, Horizontal Link Bar, Rounded Square Background

### Community 18 - "Contextform Jsx Field"
Cohesion: 0.5
Nodes (0): 

### Community 19 - "Researcherstab Jsx Initials"
Cohesion: 0.67
Nodes (2): initials(), ResearcherCard()

### Community 20 - "Timelinetab Jsx Customtooltip"
Cohesion: 0.5
Nodes (0): 

### Community 21 - "Trialstab Jsx Statusbadge"
Cohesion: 0.5
Nodes (0): 

### Community 22 - "Statuspage Jsx Statusicon"
Cohesion: 0.5
Nodes (0): 

### Community 23 - "Textarea Classname Merge"
Cohesion: 0.67
Nodes (4): Textarea UI Component, Classname Merge Utility cn, Auto Resize Textarea Hook, Vercel v0 Chat Input Component

### Community 24 - "Chatinput Useautoresize Jsx"
Cohesion: 1.0
Nodes (2): ChatInput(), useAutoResize()

### Community 25 - "Chatpanel Emptystate Jsx"
Cohesion: 0.67
Nodes (0): 

### Community 26 - "Evidencepanel Jsx Emptyevidence"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Platformpage Jsx Featurecard"
Cohesion: 0.67
Nodes (0): 

### Community 28 - "Variant Factory Cva"
Cohesion: 0.67
Nodes (3): Button CVA Style Contract, Button Variant Factory, Card Variant Factory

### Community 29 - "Mobile Tabbed Research"
Cohesion: 0.67
Nodes (3): Mobile Tabbed Research Layout, UI Polish With Loading And Error States, UI Primitives And Motion Upgrade

### Community 30 - "Compatibility Asgi Entrypoint"
Cohesion: 1.0
Nodes (1): Compatibility ASGI entrypoint.  Allows running `uvicorn main:app` from the rep

### Community 31 - "Messagebubble Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Sourcecard Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Exportbutton Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Errorbanner Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Loadingoverlay Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Magicbackdrop Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Landingpage Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Researchinterface Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Extractapierror"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Errorhandler"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Requestlogger"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Createmessagesandupdatesession Query"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Retrievecandidates Retriever"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Vite"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Textarea Jsx"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Useappstore"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Logger"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Analytics"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Message"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Session"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Sourcedoc"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "User"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Analytics"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Export"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Platform Marketing"
Cohesion: 1.0
Nodes (1): Platform Marketing Page

### Community 57 - "Platform Feature Grid"
Cohesion: 1.0
Nodes (1): Platform Feature Grid

## Ambiguous Edges - Review These
- `Evidence Tab Router` → `Source Card Placeholder Component`  [AMBIGUOUS]
  client/src/components/evidence/SourceCard.jsx · relation: conceptually_related_to
- `Magic Backdrop Animated Background Component` → `Landing Page`  [AMBIGUOUS]
  client/src/components/ui/MagicBackdrop.jsx · relation: conceptually_related_to

## Knowledge Gaps
- **52 isolated node(s):** `Compatibility ASGI entrypoint.  Allows running `uvicorn main:app` from the rep`, `Check provider readiness for Ollama and optional Groq fallback.`, `Generate an LLM response using a LangGraph-orchestrated RAG flow.`, `Call Groq Chat Completions API as a hosted fallback when Ollama is unavailable.`, `Generate sentence embeddings for semantic similarity scoring.` (+47 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Compatibility Asgi Entrypoint`** (2 nodes): `main.py`, `Compatibility ASGI entrypoint.  Allows running `uvicorn main:app` from the rep`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Messagebubble Jsx`** (2 nodes): `MessageBubble.jsx`, `MessageBubble()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sourcecard Jsx`** (2 nodes): `SourceCard.jsx`, `SourceCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Exportbutton Jsx`** (2 nodes): `ExportButton.jsx`, `ExportButton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Errorbanner Jsx`** (2 nodes): `ErrorBanner.jsx`, `ErrorBanner()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loadingoverlay Jsx`** (2 nodes): `LoadingOverlay.jsx`, `LoadingOverlay()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Magicbackdrop Jsx`** (2 nodes): `MagicBackdrop.jsx`, `MagicBackdrop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Landingpage Jsx`** (2 nodes): `LandingPage.jsx`, `LandingPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Researchinterface Jsx`** (2 nodes): `ResearchInterface.jsx`, `ResearchInterface()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Extractapierror`** (2 nodes): `extractApiError()`, `api.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Errorhandler`** (2 nodes): `errorHandler()`, `errorHandler.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Requestlogger`** (2 nodes): `requestLogger()`, `requestLogger.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Createmessagesandupdatesession Query`** (2 nodes): `createMessagesAndUpdateSession()`, `query.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Retrievecandidates Retriever`** (2 nodes): `retrieveCandidates()`, `retriever.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Jsx`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Textarea Jsx`** (1 nodes): `textarea.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Useappstore`** (1 nodes): `useAppStore.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Logger`** (1 nodes): `logger.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Analytics`** (1 nodes): `Analytics.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Message`** (1 nodes): `Message.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Session`** (1 nodes): `Session.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sourcedoc`** (1 nodes): `SourceDoc.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User`** (1 nodes): `User.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Analytics`** (1 nodes): `analytics.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Export`** (1 nodes): `export.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Platform Marketing`** (1 nodes): `Platform Marketing Page`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Platform Feature Grid`** (1 nodes): `Platform Feature Grid`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Evidence Tab Router` and `Source Card Placeholder Component`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Magic Backdrop Animated Background Component` and `Landing Page`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Are the 3 inferred relationships involving `Run Retrieval Pipeline` (e.g. with `Analytics Source Stats Endpoint` and `Retriever Placeholder`) actually correct?**
  _`Run Retrieval Pipeline` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `runRetrievalPipeline()` (e.g. with `classifyIntent()` and `getRetrievalStrategy()`) actually correct?**
  _`runRetrievalPipeline()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `Session Query Orchestrator` (e.g. with `Vite Src Alias Resolver` and `Dev API Proxy Target`) actually correct?**
  _`Session Query Orchestrator` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Compatibility ASGI entrypoint.  Allows running `uvicorn main:app` from the rep`, `Check provider readiness for Ollama and optional Groq fallback.`, `Generate an LLM response using a LangGraph-orchestrated RAG flow.` to the rest of the system?**
  _52 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Day Rationale Llm` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._