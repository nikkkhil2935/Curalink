# Curalink — AI Medical Research Assistant
## Product Requirements Document (PRD)
### Version 1.0 | Hackathon Edition

---

## 1. EXECUTIVE SUMMARY

Curalink is a full-stack, AI-powered Medical Research Assistant that transforms how patients and caregivers access evidence-based medical knowledge. Unlike generic chatbots, Curalink operates as a **Research Intelligence Engine** — retrieving deep candidate pools from OpenAlex, PubMed, and ClinicalTrials.gov, re-ranking them using a hybrid scoring pipeline, and synthesizing structured, personalized, source-cited answers using a local open-source LLM (Ollama / BioMistral).

The key differentiator: **every claim Curalink makes is traceable back to a real, linked, ranked research source.** No hallucination. No generic responses.

---

## 2. PROBLEM STATEMENT

- Patients with serious diseases spend hours searching PubMed, Google Scholar, and clinical trial registries — tools designed for researchers, not patients.
- General-purpose LLMs (GPT-4, Gemini) answer health queries from memorized training data — no real-time research retrieval, no source citations, high hallucination risk.
- There is no tool that combines: structured patient context + multi-source deep retrieval + intelligent re-ranking + local LLM reasoning + conversation memory + location-aware trial matching.

**Curalink closes this gap.**

---

## 3. TARGET USERS

| User Type | Description |
|---|---|
| Patient / Caregiver | Searching for latest treatments and trials for a specific disease |
| Medical Student | Rapidly exploring research landscape for a condition |
| Healthcare Researcher | Quick literature + trial survey before deep dive |

---

## 4. UNIQUE DIFFERENTIATORS (Standout Features)

These features go beyond the hackathon spec and are designed to make the demo unforgettable:

### 4.1 🧠 Smart Intent Classifier
Automatically detects the "research intent" from user query before retrieval:
- `TREATMENT` → prioritize latest treatment publications + recruiting trials
- `DIAGNOSIS` → prioritize diagnostic studies
- `SIDE_EFFECTS` → prioritize pharmacovigilance studies
- `RESEARCHERS` → return author network analysis from OpenAlex
- `GENERAL` → balanced retrieval across all types

**Implementation**: simple keyword classifier + LLM-assisted intent tagging

### 4.2 🗺️ Research Timeline Visualization
After any query, show a sparkline/timeline chart showing:
- Number of publications per year on the disease+query
- "Research momentum" — is research accelerating or declining?
- Highlights key years with breakthrough papers

**Data source**: OpenAlex publication_date distribution across retrieved set

### 4.3 🧬 Evidence Strength Meter
For each response section, show a visual confidence score:
- `🔴 Limited` — fewer than 5 sources, older than 5 years
- `🟡 Moderate` — 5-15 sources, mixed recency
- `🟢 Strong` — 15+ sources, recent, multi-source agreement

Computed from: source count × recency weight × cross-source agreement

### 4.4 📍 Location-Aware Trial Matching
Using user's city/country:
- Filter and surface trials actively recruiting in user's region
- Show distance/country match prominently
- Add a "Trials Near You" dedicated tab

### 4.5 🔬 Researcher Spotlight
Powered by OpenAlex author data:
- Surface top 3-5 researchers on the disease+query combination
- Show: name, institution, publication count, h-index (if available), recent paper
- "Who is leading this research?" — direct, useful, impressive

### 4.6 🧪 Treatment Comparison Mode
User can ask: "Compare DBS vs medication for Parkinson's"
- Dual-panel view with publications/trials for each treatment
- Side-by-side evidence strength comparison

### 4.7 📄 Research Brief Export (PDF)
One-click export of the current conversation as a structured PDF:
- Patient context
- Key findings
- All cited sources with links
- Generated using `jsPDF` or server-side PDF generation

### 4.8 💬 Voice Input Support
- Web Speech API for voice queries
- Especially relevant for elderly/less tech-savvy users
- Demonstrates product thinking beyond just dev skills

### 4.9 🔄 Smart Follow-Up with Context Injection
Multi-turn awareness with auto-context detection:
- If follow-up is off-topic, ask clarifying question
- If follow-up is related, silently inject previous disease+context
- Show "(using context: Parkinson's Disease)" badge on follow-up answers

### 4.10 📊 Query Analytics Dashboard (Demo-worthy)
Simple admin-style page showing:
- Most searched diseases today
- Top trials by recruiting status
- Source distribution (% PubMed vs OpenAlex vs ClinicalTrials)
- Average retrieval depth (shows the "50-300 candidates" stat visually)

---

## 5. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Chat Panel  │  │ Evidence     │  │  Timeline / Dash     │  │
│  │  (left)      │  │ Panel (right)│  │  (bottom/tab)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               Pipeline Orchestrator                      │    │
│  │  1. Intent Classifier → 2. Query Expander               │    │
│  │  3. Multi-source Retriever → 4. Normalizer              │    │
│  │  5. Re-ranker (hybrid score) → 6. Context Packager      │    │
│  │  7. RAG Prompt Builder → 8. LLM Caller                  │    │
│  │  9. Response Parser → 10. Session Persister             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  MongoDB (sessions, messages, sourceDocs, analytics)            │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼────────────────────────────┐
│  External APIs      │   │  LLM Service (Python FastAPI)         │
│  - OpenAlex         │   │  - Ollama (llama3.1:8b) OR            │
│  - PubMed NCBI      │   │  - BioMistral-7B via HuggingFace      │
│  - ClinicalTrials   │   │  - /generate endpoint                 │
└─────────────────────┘   │  - /embed endpoint (MiniLM)           │
                          └───────────────────────────────────────┘
```

---

## 6. TECH STACK

| Layer | Technology | Reasoning |
|---|---|---|
| Frontend | React 18 + Vite | Fast dev, hackathon-friendly |
| Styling | Tailwind CSS + shadcn/ui | Clean, rapid UI |
| Charts | Recharts | Timeline visualization |
| PDF Export | jsPDF + html2canvas | Client-side, no server needed |
| Backend | Node.js + Express | MERN requirement |
| Database | MongoDB Atlas | MERN requirement, free tier |
| ORM | Mongoose | Clean schema validation |
| LLM | Ollama (llama3.1:8b) | Open-source, local, fast |
| Embedding | all-MiniLM-L6-v2 (via HF) | Lightweight, effective |
| LLM Service | Python FastAPI | Best LLM/ML ecosystem |
| Deployment | Railway (backend) + Vercel (frontend) + Render (LLM) | Free tier, fast deploy |

---

## 7. DATA PIPELINE — DETAILED SPEC

### 7.1 Query Expansion
```
Input:  { disease: "Parkinson's disease", intent: "deep brain stimulation", location: "Toronto, Canada" }
Output: {
  full_query: "deep brain stimulation Parkinson's disease",
  pubmed_query: "deep brain stimulation AND Parkinson's disease",
  openalex_query: "deep brain stimulation Parkinson's disease",
  ct_cond: "Parkinson's disease",
  ct_intr: "deep brain stimulation",
  intent_type: "TREATMENT"
}
```

### 7.2 Retrieval Targets
| Source | Fetch Count | Method |
|---|---|---|
| OpenAlex | 100 (page 1) + 100 (page 2) = 200 | search + pagination |
| PubMed | Up to 200 PMIDs → batch efetch | esearch + efetch |
| ClinicalTrials.gov | 100 studies | query.cond + query.intr |
| **Total Candidates** | **~500** | Combined |

### 7.3 Normalization Schema
```typescript
interface SourceDoc {
  id: string;              // "pubmed:12345" | "openalex:W123" | "ct:NCT123"
  type: "publication" | "trial";
  source: "PubMed" | "OpenAlex" | "ClinicalTrials";
  title: string;
  abstract?: string;       // truncated to 500 chars for RAG
  authors?: string[];
  year?: number;
  url: string;
  // Trial-specific
  status?: string;         // RECRUITING, COMPLETED, etc.
  phase?: string;
  eligibility?: string;
  locations?: string[];
  contacts?: { name: string; email?: string; phone?: string }[];
  // Scoring
  relevanceScore?: number;
  recencyScore?: number;
  locationScore?: number;
  finalScore?: number;
}
```

### 7.4 Hybrid Re-Ranking Formula
```
finalScore = (0.45 × relevanceScore) + (0.30 × recencyScore) + (0.15 × locationScore) + (0.10 × sourceCredibility)

Where:
  relevanceScore   = cosine_sim(embed(title+abstract), embed(disease+intent))
                     fallback: BM25/TF-IDF keyword score
  recencyScore     = normalize(year, min=2000, max=2025)  → 0 to 1
  locationScore    = 1.0 if country match | 0.5 if region | 0.0 otherwise
  sourceCredibility = 0.9 (PubMed) | 0.85 (OpenAlex) | 0.8 (ClinicalTrials)
```

Final output: **top 8 publications + top 5 trials** for RAG context

### 7.5 RAG Context Window
Select top 13 items, build snippets:
```
[P1] PubMed | 2024 | Title: "..." | Authors: Smith et al. | Abstract: "..."
[P2] OpenAlex | 2023 | Title: "..." | ...
[T1] ClinicalTrials | RECRUITING | Title: "..." | Location: Toronto, Canada | Eligibility: "..."
```

Estimated tokens: ~3,000-5,000 tokens for context → fits well in Llama 3.1 8B 8k context

---

## 8. LLM SERVICE SPEC

### 8.1 Model Choice
**Primary**: `llama3.1:8b` via Ollama (local/self-hosted)  
**Alternative**: `BioMistral-7B` via HuggingFace (better biomedical domain)  
**Fallback for demo**: Groq API with `llama-3.1-8b-instant` (open-source model, not OpenAI/Gemini)

### 8.2 System Prompt
```
You are Curalink, an AI Medical Research Assistant. You synthesize real medical research 
publications and clinical trials to answer patient questions.

STRICT RULES:
1. ONLY use information from the provided SOURCES section.
2. EVERY claim must reference at least one source using [P1], [T1] notation.
3. If evidence is not found in sources, say "Evidence not available in current research pool."
4. Never provide direct medical advice. Always recommend consulting a healthcare provider.
5. Be empathetic, clear, and non-technical in explanations.
6. Output MUST be valid JSON matching the schema below.

OUTPUT SCHEMA:
{
  "condition_overview": "string — 2-3 sentence overview",
  "evidence_strength": "LIMITED | MODERATE | STRONG",
  "research_insights": [
    {
      "insight": "string — key finding",
      "type": "TREATMENT | DIAGNOSIS | RISK | PREVENTION | GENERAL",
      "source_ids": ["P1", "P2"]
    }
  ],
  "clinical_trials": [
    {
      "summary": "string",
      "status": "RECRUITING | COMPLETED | etc.",
      "location_relevant": true/false,
      "source_ids": ["T1"]
    }
  ],
  "key_researchers": ["Name — Institution (if available)"],
  "recommendations": "string — non-prescriptive, empathetic summary",
  "follow_up_suggestions": ["string — 3 suggested follow-up questions"]
}
```

### 8.3 FastAPI Endpoints
```
POST /generate       → main RAG completion
POST /embed          → generate embeddings for ranking
GET  /health         → model health check
GET  /models         → list available models
```

---

## 9. MONGODB SCHEMAS

### 9.1 User
```javascript
{
  _id: ObjectId,
  name: String,
  location: { city: String, country: String, coordinates: [Number] },
  demographics: { age: Number, sex: String },
  preferences: { units: String, language: String },
  createdAt: Date
}
```

### 9.2 Session
```javascript
{
  _id: ObjectId,
  userId: ObjectId,        // optional (guest sessions allowed)
  disease: String,
  location: { city, country },
  demographics: { age, sex },
  queryHistory: [String],  // list of expanded queries used
  createdAt: Date,
  updatedAt: Date,
  title: String            // auto-generated: "Parkinson's - DBS Research"
}
```

### 9.3 Message
```javascript
{
  _id: ObjectId,
  sessionId: ObjectId,
  role: "user" | "assistant",
  text: String,            // raw user text or LLM summary text
  structuredAnswer: {
    conditionOverview: String,
    evidenceStrength: String,
    researchInsights: Array,
    clinicalTrials: Array,
    keyResearchers: Array,
    recommendations: String,
    followUpSuggestions: Array
  },
  usedSourceIds: [String], // ["pubmed:123", "ct:NCT456"]
  retrievalStats: {
    totalCandidates: Number,
    pubmedFetched: Number,
    openalexFetched: Number,
    ctFetched: Number,
    rerankedTo: Number
  },
  intentType: String,
  createdAt: Date
}
```

### 9.4 SourceDoc (cached research items)
```javascript
{
  _id: String,             // "pubmed:41732954"
  type: "publication" | "trial",
  source: "PubMed" | "OpenAlex" | "ClinicalTrials",
  title: String,
  abstract: String,
  authors: [String],
  year: Number,
  url: String,
  // trial-specific
  status: String,
  phase: String,
  eligibility: String,
  locations: [String],
  contacts: Array,
  // analytics
  queryAssociations: [String],  // which queries surfaced this doc
  timesUsed: Number,
  createdAt: Date
}
```

### 9.5 Analytics (unique differentiator)
```javascript
{
  _id: ObjectId,
  event: "query" | "export" | "trial_click" | "source_click",
  disease: String,
  intentType: String,
  sessionId: ObjectId,
  metadata: Object,
  createdAt: Date
}
```

---

## 10. API ROUTES (Express)

| Method | Route | Description |
|---|---|---|
| POST | `/api/sessions` | Create new session with disease + context |
| GET | `/api/sessions/:id` | Get session + all messages |
| POST | `/api/sessions/:id/query` | Submit query, run full pipeline |
| GET | `/api/sessions/:id/sources` | Get all sources for session |
| GET | `/api/sessions` | List user's recent sessions |
| DELETE | `/api/sessions/:id` | Delete session |
| GET | `/api/analytics/top-diseases` | Top searched diseases |
| GET | `/api/analytics/source-stats` | Source distribution stats |
| POST | `/api/export/:sessionId` | Generate PDF brief |
| GET | `/api/health` | Backend health + LLM status |

---

## 11. FRONTEND SCREENS

### Screen 1: Landing / Onboarding
- Hero section with Curalink branding
- "Start Research" CTA → opens onboarding form
- Recent sessions list (if user returning)

### Screen 2: Patient Context Form (Modal/Slide-in)
Fields:
- Disease/Condition (required) — with autocomplete
- What do you want to know? (intent field)
- Your location (city, country) — with geolocation option
- Age (optional)
- Sex (optional)

### Screen 3: Main Research Interface (3-panel layout)
```
┌─────────────────┬──────────────────────┬────────────────┐
│   CHAT PANEL    │   EVIDENCE PANEL     │  SIDEBAR       │
│   (40%)         │   (40%)              │  (20%)         │
│                 │                      │                │
│  Chat history   │  Publications tab    │  Session info  │
│  User messages  │  Clinical Trials tab │  Disease       │
│  AI responses   │  Researchers tab     │  Location      │
│  with [P1][T1]  │  Timeline tab        │  Intent type   │
│  citations      │                      │  Retrieval     │
│                 │  Source cards with   │  stats         │
│  Input box      │  title/year/authors/ │                │
│  Voice button   │  abstract/link/      │  Export PDF    │
│                 │  evidence badge      │  button        │
└─────────────────┴──────────────────────┴────────────────┘
```

### Screen 4: Source Card Component
```
┌──────────────────────────────────────────────────────────┐
│ [P1]  🟢 Strong Evidence                    PubMed 2024 │
│                                                           │
│ Deep Brain Stimulation for Advanced Parkinson's...       │
│ Smith J, Johnson K, et al.                               │
│                                                           │
│ "DBS showed significant improvement in motor function    │
│  in 78% of participants across 3 clinical centers..."    │
│                                                           │
│ [View Abstract ▼]    [Open in PubMed ↗]                 │
└──────────────────────────────────────────────────────────┘
```

### Screen 5: Research Timeline Chart
- X-axis: Years (2015-2025)
- Y-axis: Publication count
- Bars colored by intent type
- Annotation on peak years

### Screen 6: Analytics Dashboard
- Donut chart: source distribution
- Bar chart: top 10 diseases searched
- Number card: "523 candidates retrieved → ranked to 8"
- Live trial status breakdown

---

## 12. MULTI-TURN CONVERSATION LOGIC

```javascript
async function buildContextForFollowUp(session, newMessage) {
  // 1. Classify if follow-up is related to existing disease context
  const isRelated = await classifyRelation(newMessage, session.disease);
  
  if (isRelated) {
    // 2. Inject disease context silently
    return {
      expandedQuery: `${newMessage} ${session.disease}`,
      contextBadge: `Using context: ${session.disease}`,
      reuseSourcePool: true  // don't re-fetch if same disease, new angle
    };
  } else {
    // 3. New topic — ask for clarification or start fresh
    return { requiresClarification: true };
  }
}
```

Memory strategy:
- Keep last 5 message pairs in session context
- Compress older messages to "summary" using LLM
- Always carry: disease, location, demographics forward

---

## 13. EVIDENCE STRENGTH ALGORITHM

```javascript
function computeEvidenceStrength(sources) {
  const count = sources.length;
  const avgYear = sources.reduce((s, d) => s + (d.year || 2015), 0) / count;
  const recencyScore = (avgYear - 2015) / (2025 - 2015);
  const sourceVariety = new Set(sources.map(s => s.source)).size;
  
  const score = (count / 15) * 0.4 + recencyScore * 0.4 + (sourceVariety / 3) * 0.2;
  
  if (score >= 0.7) return { label: "STRONG", color: "green", icon: "🟢" };
  if (score >= 0.4) return { label: "MODERATE", color: "yellow", icon: "🟡" };
  return { label: "LIMITED", color: "red", icon: "🔴" };
}
```

---

## 14. PERSONALIZATION LAYER

The LLM prompt always includes:
```
Patient Profile:
- Disease: {disease}
- Location: {city}, {country}
- Age: {age} (if provided)
- Sex: {sex} (if provided)
- Query History: {last 3 topics}

Personalization Instructions:
- Highlight trials in {country} specifically
- If age/sex provided, note studies that match this demographic
- Flag if evidence is particularly relevant or irrelevant for this profile
- Use layperson-friendly explanations, avoid excessive jargon
```

---

## 15. DEPLOYMENT ARCHITECTURE

```
Frontend (React)         → Vercel (free, instant deploy)
Backend (Node/Express)   → Railway (free tier, persistent)
LLM Service (FastAPI)    → Render (free tier) OR local Ollama
MongoDB                  → MongoDB Atlas (free 512MB)
```

Environment variables needed:
```
MONGODB_URI=
LLM_SERVICE_URL=http://localhost:8000
PUBMED_API_KEY=         # optional, higher rate limits
PORT=5000
FRONTEND_URL=
```

---

## 16. PERFORMANCE TARGETS

| Metric | Target |
|---|---|
| First response time | < 15 seconds (retrieval + LLM) |
| Candidate retrieval | 300-500 docs before re-ranking |
| Final sources shown | 6-8 publications + 4-5 trials |
| Context window used | < 6,000 tokens |
| Follow-up response | < 8 seconds (cached source pool) |
| PDF export | < 3 seconds |

---

## 17. ERROR HANDLING

| Error Type | Strategy |
|---|---|
| LLM service down | Fallback to structured template response + raw sources |
| PubMed API timeout | Proceed with OpenAlex + ClinicalTrials only |
| OpenAlex rate limit | Exponential backoff (3 retries) |
| Zero results returned | Broaden query (remove intent, use disease only) |
| LLM JSON parse fail | Regex extraction + graceful degradation |
| ClinicalTrials no results | Show publications only + message to user |

---

## 18. DEMO SCRIPT (Loom Video)

### Segment 1: Architecture Walkthrough (2 min)
- Show simple diagram
- Explain: "We fetch 500 candidates across 3 sources, re-rank using hybrid scoring, then pass top 13 to our local LLM"
- Emphasize: "Zero hallucination — every claim is traceable"

### Segment 2: Use Case 1 — Structured Input (3 min)
Query: Disease: "Parkinson's Disease", Intent: "Deep Brain Stimulation", Location: "Toronto, Canada"
- Show evidence panel populating
- Show timeline visualization
- Show "Trials Near You" in Toronto
- Click through source cards
- Show [P1][T1] citations in response

### Segment 3: Use Case 2 — Natural Follow-up (2 min)
Follow-up: "Can I take Vitamin D alongside the treatment?"
- Show "Using context: Parkinson's Disease" badge
- Show re-retrieval triggered
- Show personalized response

### Segment 4: Unique Features (2 min)
- Show Evidence Strength Meter
- Show Researcher Spotlight
- Export PDF → open it

### Segment 5: Analytics Dashboard (1 min)
- Show retrieval stats
- Show source distribution

---

## 19. EVALUATION SCORING STRATEGY

| Criterion | Our Approach | Score Target |
|---|---|---|
| AI Pipeline Quality | 500 candidates → hybrid re-rank → structured RAG | ⭐⭐⭐⭐⭐ |
| Retrieval + Ranking | Embedding + recency + location + credibility | ⭐⭐⭐⭐⭐ |
| Engineering Depth | FastAPI LLM service + Mongo + caching + analytics | ⭐⭐⭐⭐⭐ |
| Usability | 3-panel layout, voice input, PDF export, follow-up badge | ⭐⭐⭐⭐⭐ |
| Demo Clarity | Scripted Loom with architecture diagram + 4 use cases | ⭐⭐⭐⭐⭐ |

---

*PRD Version 1.0 | Curalink Hackathon | By: Nikhil Patil*
