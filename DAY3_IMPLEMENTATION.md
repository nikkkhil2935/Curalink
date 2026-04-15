# Curalink — Day 3 Implementation Plan
## LLM Service + RAG Pipeline + Structured Answers + Context Awareness + Unique Features

---

## 🎯 Day 3 Goals
By end of Day 3 you should have:
- [ ] Python FastAPI LLM service running (Ollama or HuggingFace)
- [ ] Full RAG prompt builder with structured output
- [ ] LLM returning valid JSON structured answers
- [ ] Responses rendered with proper sections ([P1][T1] citations)
- [ ] Multi-turn conversation with context injection working
- [ ] Follow-up detection + context badge working
- [ ] Evidence Strength Meter in UI
- [ ] Researcher Spotlight tab working
- [ ] Follow-up suggestions (clickable chips)
- [ ] Voice input fully working

**Time estimate: 10-12 hours**

---

## STEP 1: Python LLM Service Setup (1.5 hours)

### llm-service/requirements.txt
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
httpx==0.27.0
sentence-transformers==3.2.0
torch==2.4.0
transformers==4.45.0
pydantic==2.9.0
ollama==0.3.3
numpy==1.26.4
```

### llm-service/main.py
```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx
import json
import re
import os
import logging
import time
from sentence_transformers import SentenceTransformer
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Curalink LLM Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# ─── Config ────────────────────────────────────────────
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")  
# alternatives: "mistral:7b", "biomistral" (if available), "phi3:mini" for speed

# ─── Embedding model (loads once at startup) ──────────
logger.info("Loading embedding model...")
embed_model = SentenceTransformer("all-MiniLM-L6-v2")  # fast, 384-dim
logger.info("✅ Embedding model loaded")

# ─── Pydantic Models ───────────────────────────────────
class GenerateRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    temperature: float = 0.1
    max_tokens: int = 2048

class EmbedRequest(BaseModel):
    texts: List[str]

class RerankRequest(BaseModel):
    query: str
    documents: List[dict]  # list of {id, text}
    top_k: int = 15

# ─── Routes ────────────────────────────────────────────

@app.get("/health")
async def health():
    """Check if Ollama is reachable and model is available"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in r.json().get("models", [])]
            model_available = any(OLLAMA_MODEL in m for m in models)
            return {
                "status": "ok",
                "ollama": "online",
                "model": OLLAMA_MODEL,
                "model_available": model_available,
                "available_models": models[:5]
            }
    except Exception as e:
        return {"status": "degraded", "ollama": "offline", "error": str(e)}


@app.post("/generate")
async def generate(req: GenerateRequest):
    """
    Generate LLM response using Ollama with structured RAG prompt.
    Returns raw text (JSON string expected).
    """
    start = time.time()
    
    # Build Ollama chat format
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": req.system_prompt},
            {"role": "user", "content": req.user_prompt}
        ],
        "stream": False,
        "options": {
            "temperature": req.temperature,
            "num_predict": req.max_tokens,
            "top_p": 0.9,
            "repeat_penalty": 1.1
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()
        
        raw_text = data["message"]["content"]
        elapsed = round(time.time() - start, 2)
        
        logger.info(f"✅ LLM generated in {elapsed}s, length={len(raw_text)}")
        
        # Try to extract JSON from response
        parsed = extract_json(raw_text)
        
        return {
            "text": raw_text,
            "parsed": parsed,
            "model": OLLAMA_MODEL,
            "elapsed_seconds": elapsed
        }
    except httpx.TimeoutException:
        raise HTTPException(503, "LLM service timeout. Model may be loading.")
    except Exception as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(500, f"Generation failed: {str(e)}")


@app.post("/embed")
async def embed(req: EmbedRequest):
    """
    Generate embeddings for re-ranking.
    Returns list of embedding vectors.
    """
    if not req.texts:
        raise HTTPException(400, "No texts provided")
    
    # Truncate texts to avoid memory issues
    truncated = [t[:512] for t in req.texts]
    embeddings = embed_model.encode(truncated, normalize_embeddings=True)
    
    return {
        "embeddings": embeddings.tolist(),
        "count": len(embeddings),
        "dim": embeddings.shape[1]
    }


@app.post("/rerank")
async def rerank(req: RerankRequest):
    """
    Re-rank documents using semantic similarity to query.
    Returns scored document IDs.
    """
    if not req.documents:
        raise HTTPException(400, "No documents provided")
    
    # Embed query
    query_emb = embed_model.encode([req.query], normalize_embeddings=True)[0]
    
    # Embed documents
    texts = [d.get("text", "")[:512] for d in req.documents]
    doc_embs = embed_model.encode(texts, normalize_embeddings=True)
    
    # Compute cosine similarity
    scores = np.dot(doc_embs, query_emb)
    
    # Return ranked results
    ranked = [
        {"id": req.documents[i]["id"], "score": float(scores[i])}
        for i in range(len(req.documents))
    ]
    ranked.sort(key=lambda x: x["score"], reverse=True)
    
    return {"ranked": ranked[:req.top_k]}


# ─── Helpers ───────────────────────────────────────────

def extract_json(text: str) -> Optional[dict]:
    """Extract JSON from LLM response that may have extra text"""
    # Try direct parse
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    
    # Try extracting JSON block from markdown
    patterns = [
        r'```json\s*([\s\S]*?)```',
        r'```\s*([\s\S]*?)```',
        r'\{[\s\S]*\}'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                candidate = match.group(1) if '```' in pattern else match.group(0)
                return json.loads(candidate.strip())
            except json.JSONDecodeError:
                continue
    
    return None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
```

### Ollama Setup Commands
```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the model (do this BEFORE demo)
ollama pull llama3.1:8b          # ~4.7GB, good quality
# OR for faster/smaller:
ollama pull mistral:7b            # ~4.1GB
# OR for biomedical (if available):
ollama pull medllama3             # specialized

# Test it works
ollama run llama3.1:8b "Hello, are you working?"

# Start service (auto-starts on most systems)
ollama serve

# Start LLM FastAPI service
cd llm-service
uvicorn main:app --reload --port 8001
```

---

## STEP 2: RAG Prompt Builder (1 hour)

### server/src/services/pipeline/contextPackager.js
```javascript
/**
 * Packages retrieved sources into RAG prompt format.
 * Builds source snippets with citation IDs.
 */

export function buildRAGContext(contextDocs, disease, userMessage, session) {
  const publications = contextDocs.filter(d => d.type === 'publication');
  const trials = contextDocs.filter(d => d.type === 'trial');
  
  const sourceLines = [];
  const sourceIndex = {};  // maps citation ID to doc ID
  
  // Add publications
  publications.forEach((doc, i) => {
    const citationId = `P${i + 1}`;
    sourceIndex[citationId] = doc.id;
    
    const line = [
      `[${citationId}] ${doc.source} | ${doc.year || 'Year N/A'}`,
      `Title: ${doc.title}`,
      doc.authors?.length > 0 ? `Authors: ${doc.authors.slice(0, 3).join(', ')}` : '',
      doc.abstract ? `Abstract: ${doc.abstract.substring(0, 300)}` : '',
      `URL: ${doc.url}`
    ].filter(Boolean).join('\n');
    
    sourceLines.push(line);
  });
  
  // Add trials
  trials.forEach((doc, i) => {
    const citationId = `T${i + 1}`;
    sourceIndex[citationId] = doc.id;
    
    const line = [
      `[${citationId}] ClinicalTrials.gov | Status: ${doc.status}`,
      `Title: ${doc.title}`,
      doc.phase !== 'N/A' ? `Phase: ${doc.phase}` : '',
      doc.locations?.length > 0 ? `Locations: ${doc.locations.slice(0, 3).join(', ')}` : '',
      doc.eligibility ? `Eligibility: ${doc.eligibility.substring(0, 200)}` : '',
      doc.contacts?.[0]?.name ? `Contact: ${doc.contacts[0].name} (${doc.contacts[0].email || ''})` : '',
      `URL: ${doc.url}`
    ].filter(Boolean).join('\n');
    
    sourceLines.push(line);
  });
  
  const sourcesText = sourceLines.join('\n\n---\n\n');
  
  return { sourcesText, sourceIndex, pubCount: publications.length, trialCount: trials.length };
}

export function buildSystemPrompt() {
  return `You are Curalink, an AI Medical Research Assistant. You help patients and caregivers understand medical research in a clear, empathetic way.

STRICT RULES:
1. ONLY use information from the SOURCES section below. Do NOT use your training knowledge.
2. Every research_insight and clinical_trial entry MUST include source_ids (e.g., ["P1", "P2"]).
3. If a claim cannot be supported by the provided sources, say: "Evidence not available in current research pool."
4. NEVER give direct medical advice or dosage recommendations. Always suggest consulting a healthcare provider.
5. Be empathetic, clear, and avoid excessive medical jargon.
6. Output MUST be valid JSON only. No text before or after the JSON.

OUTPUT FORMAT (respond ONLY with this JSON structure):
{
  "condition_overview": "2-3 sentence overview of the condition and what research shows",
  "evidence_strength": "LIMITED|MODERATE|STRONG",
  "research_insights": [
    {
      "insight": "Clear, plain-English finding from the research",
      "type": "TREATMENT|DIAGNOSIS|RISK|PREVENTION|GENERAL",
      "source_ids": ["P1"]
    }
  ],
  "clinical_trials": [
    {
      "summary": "What the trial is studying and why it matters",
      "status": "RECRUITING|COMPLETED|etc.",
      "location_relevant": true/false,
      "contact": "contact info if available",
      "source_ids": ["T1"]
    }
  ],
  "key_researchers": [
    "Dr. Name — Institution (based on publication authorship)"
  ],
  "recommendations": "Empathetic, non-prescriptive summary of what the patient should consider. Always end with: Please consult your healthcare provider.",
  "follow_up_suggestions": [
    "Specific question the patient might ask next (3 items)"
  ]
}`;
}

export function buildUserPrompt(disease, userMessage, session, sourcesText, evidenceStrength, intentType) {
  const demographics = [];
  if (session.demographics?.age) demographics.push(`Age: ${session.demographics.age}`);
  if (session.demographics?.sex) demographics.push(`Sex: ${session.demographics.sex}`);
  
  return `PATIENT PROFILE:
- Primary Condition: ${disease}
- Location: ${session.location?.city ? `${session.location.city}, ${session.location.country}` : session.location?.country || 'Not specified'}
${demographics.length > 0 ? '- ' + demographics.join('\n- ') : ''}
- Query Intent Type: ${intentType}
- Evidence Available: ${evidenceStrength.label}

USER QUESTION:
"${userMessage}"

SOURCES (use ONLY these):
${sourcesText}

Now provide a structured JSON response following the output format.`;
}
```

---

## STEP 3: LLM Caller + Response Parser (1 hour)

### server/src/services/llm.js
```javascript
import axios from 'axios';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8001';

/**
 * Call LLM service to generate RAG response
 */
export async function callLLM(systemPrompt, userPrompt) {
  try {
    const { data } = await axios.post(`${LLM_SERVICE_URL}/generate`, {
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      temperature: 0.1,
      max_tokens: 2048
    }, { timeout: 120000 });  // 2 min timeout
    
    return data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      throw new Error('LLM service is not running. Please start Ollama and the FastAPI service.');
    }
    throw err;
  }
}

/**
 * Call embedding service for semantic re-ranking
 */
export async function getEmbeddings(texts) {
  try {
    const { data } = await axios.post(`${LLM_SERVICE_URL}/embed`, { texts }, { timeout: 30000 });
    return data.embeddings;
  } catch (err) {
    console.warn('Embedding service unavailable, falling back to keyword scoring');
    return null;
  }
}

/**
 * Semantic re-ranking using embeddings (upgrades keyword scoring)
 */
export async function semanticRerank(query, documents) {
  try {
    const { data } = await axios.post(`${LLM_SERVICE_URL}/rerank`, {
      query,
      documents: documents.map(d => ({
        id: d.id,
        text: `${d.title} ${d.abstract || ''}`.substring(0, 512)
      })),
      top_k: 15
    }, { timeout: 30000 });
    
    // Merge semantic scores with existing scores
    const scoreMap = {};
    for (const item of data.ranked) {
      scoreMap[item.id] = item.score;
    }
    
    return documents.map(doc => ({
      ...doc,
      semanticScore: scoreMap[doc.id] || 0,
      finalScore: (doc.finalScore * 0.5) + ((scoreMap[doc.id] || 0) * 0.5)  // blend
    })).sort((a, b) => b.finalScore - a.finalScore);
    
  } catch (err) {
    console.warn('Semantic reranking failed, using keyword scores');
    return documents;
  }
}

/**
 * Parse and validate LLM JSON response with fallbacks
 */
export function parseLLMResponse(llmData) {
  // Try parsed JSON from LLM service
  if (llmData?.parsed && isValidStructuredAnswer(llmData.parsed)) {
    return llmData.parsed;
  }
  
  // Try parsing raw text
  if (llmData?.text) {
    try {
      const cleaned = llmData.text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (isValidStructuredAnswer(parsed)) return parsed;
    } catch {}
  }
  
  // Return graceful fallback
  console.warn('LLM response could not be parsed as structured JSON, using fallback');
  return createFallbackResponse(llmData?.text || '');
}

function isValidStructuredAnswer(obj) {
  return obj && 
    typeof obj === 'object' && 
    (obj.condition_overview || obj.research_insights || obj.recommendations);
}

function createFallbackResponse(rawText) {
  return {
    condition_overview: rawText.substring(0, 300) || 'Research analysis in progress.',
    evidence_strength: 'MODERATE',
    research_insights: [{
      insight: rawText.substring(0, 200) || 'See retrieved sources for details.',
      type: 'GENERAL',
      source_ids: []
    }],
    clinical_trials: [],
    key_researchers: [],
    recommendations: 'Please review the research sources listed and consult your healthcare provider.',
    follow_up_suggestions: [
      'What are the latest treatments available?',
      'Are there clinical trials I can join?',
      'What do researchers currently recommend?'
    ]
  };
}
```

---

## STEP 4: Update Orchestrator with LLM (1 hour)

### server/src/services/pipeline/orchestrator.js — Full Version
```javascript
// ADD these imports to existing orchestrator.js
import { buildRAGContext, buildSystemPrompt, buildUserPrompt } from './contextPackager.js';
import { callLLM, parseLLMResponse, semanticRerank } from '../llm.js';

// REPLACE the runRetrievalPipeline function with this full version:
export async function runRetrievalPipeline(session, userMessage, conversationHistory = []) {
  const startTime = Date.now();
  
  // 1. Intent + query expansion
  const intentType = classifyIntent(userMessage, session.intent);
  const expanded = expandQuery(session.disease, userMessage, intentType);
  
  // 2. Detect if this is a follow-up (inject disease context)
  const isFollowUp = conversationHistory.length > 0;
  let contextBadge = null;
  
  if (isFollowUp) {
    contextBadge = `Using context: ${session.disease}`;
    // If user asks off-topic question, still combine with disease
    if (!userMessage.toLowerCase().includes(session.disease.toLowerCase())) {
      expanded.fullQuery = `${userMessage} ${session.disease}`;
      expanded.pubmedQuery = `(${userMessage}) AND (${session.disease})`;
    }
  }
  
  // 3. Parallel retrieval
  const [pubmedResults, openalexResults, ctResults] = await Promise.all([
    fetchFromPubMed(expanded.pubmedQuery, 200),
    fetchFromOpenAlex(expanded.openalexQuery, 200),
    fetchFromClinicalTrials(expanded.ctCondition, expanded.ctIntervention, session.location, 100)
  ]);
  
  const stats = {
    pubmedFetched: pubmedResults.length,
    openalexFetched: openalexResults.length,
    ctFetched: ctResults.length,
    totalCandidates: pubmedResults.length + openalexResults.length + ctResults.length
  };
  
  // 4. Normalize
  const normalized = normalizeAndDeduplicate(pubmedResults, openalexResults, ctResults);
  
  // 5. Keyword re-ranking first
  const queryTerms = expanded.fullQuery.split(' ').filter(t => t.length > 3);
  let ranked = rerankCandidates(normalized, queryTerms, intentType, session.location);
  
  // 6. Semantic re-ranking on top 100 candidates (upgrade keyword scores)
  const top100 = ranked.slice(0, 100);
  ranked = await semanticRerank(expanded.fullQuery, top100);
  
  // 7. Select context docs
  const contextDocs = selectForContext(ranked, 8, 5);
  stats.rerankedTo = contextDocs.length;
  
  // 8. Evidence strength
  const evidenceStrength = computeEvidenceStrength(contextDocs);
  
  // 9. Save SourceDocs
  const upsertOps = contextDocs.map(doc => ({
    updateOne: {
      filter: { _id: doc.id },
      update: { $set: { ...doc, _id: doc.id }, $inc: { timesUsed: 1 }, $addToSet: { queryAssociations: expanded.fullQuery } },
      upsert: true
    }
  }));
  if (upsertOps.length) await SourceDoc.bulkWrite(upsertOps).catch(console.error);
  
  // 10. Build RAG context
  const { sourcesText, sourceIndex } = buildRAGContext(contextDocs, session.disease, userMessage, session);
  
  // 11. Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(session.disease, userMessage, session, sourcesText, evidenceStrength, intentType);
  
  // 12. Call LLM
  let structuredAnswer;
  let llmRawText = '';
  try {
    const llmData = await callLLM(systemPrompt, userPrompt);
    structuredAnswer = parseLLMResponse(llmData);
    llmRawText = llmData.text || '';
  } catch (llmErr) {
    console.error('LLM failed, using graceful fallback:', llmErr.message);
    structuredAnswer = createFallbackResponse(contextDocs, session.disease, evidenceStrength);
  }
  
  // 13. Build plain text summary for message.text field
  const responseText = buildPlainTextSummary(structuredAnswer, stats);
  
  stats.timeTakenMs = Date.now() - startTime;
  
  await Analytics.create({
    event: 'query',
    disease: session.disease.toLowerCase(),
    intentType,
    sessionId: session._id,
    metadata: { stats, queryExpanded: expanded.fullQuery }
  }).catch(console.error);
  
  return {
    responseText,
    structuredAnswer,
    contextDocs,
    rankedAll: ranked,
    stats,
    evidenceStrength,
    intentType,
    expandedQuery: expanded,
    contextBadge,
    sourceIndex
  };
}

function createFallbackResponse(docs, disease, evidenceStrength) {
  return {
    condition_overview: `Research analysis for ${disease} — ${docs.length} sources retrieved and ranked.`,
    evidence_strength: evidenceStrength.label,
    research_insights: docs.filter(d => d.type === 'publication').slice(0, 3).map((d, i) => ({
      insight: d.abstract?.substring(0, 150) || d.title,
      type: 'GENERAL',
      source_ids: [`P${i + 1}`]
    })),
    clinical_trials: docs.filter(d => d.type === 'trial').slice(0, 3).map((d, i) => ({
      summary: d.title,
      status: d.status,
      location_relevant: d.isLocationRelevant,
      source_ids: [`T${i + 1}`]
    })),
    key_researchers: [],
    recommendations: `Based on the retrieved research, please review the sources listed and consult your healthcare provider for personalized guidance on ${disease}.`,
    follow_up_suggestions: [
      `What are the latest treatments for ${disease}?`,
      `Are there any recruiting clinical trials I can join?`,
      `What side effects should I be aware of?`
    ]
  };
}

function buildPlainTextSummary(answer, stats) {
  const parts = [];
  if (answer.condition_overview) parts.push(answer.condition_overview);
  if (stats.totalCandidates) parts.push(`\n\n[Analyzed ${stats.totalCandidates} research candidates from PubMed, OpenAlex, and ClinicalTrials.gov — showing top ${stats.rerankedTo} most relevant.]`);
  return parts.join('');
}
```

---

## STEP 5: Structured Answer Renderer (2 hours)

### client/src/components/chat/MessageBubble.jsx
```jsx
import StructuredAnswer from './StructuredAnswer';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-white">{message.text}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex justify-start">
      <div className="max-w-full w-full">
        {/* Context badge */}
        {message.contextBadge && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-blue-950 border border-blue-800 text-blue-300 px-2 py-0.5 rounded-full">
              🔗 {message.contextBadge}
            </span>
          </div>
        )}
        
        {/* Structured answer or plain text */}
        {message.structuredAnswer ? (
          <StructuredAnswer answer={message.structuredAnswer} retrievalStats={message.retrievalStats} />
        ) : (
          <div className="bg-gray-900 rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-800">
            <p className="text-sm text-gray-200 leading-relaxed">{message.text}</p>
          </div>
        )}
        
        {/* Follow-up suggestions */}
        {message.structuredAnswer?.follow_up_suggestions?.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-600 mb-2">Suggested follow-ups:</p>
            <div className="flex flex-wrap gap-2">
              {message.structuredAnswer.follow_up_suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    // Inject into chat input
                    const event = new CustomEvent('set-chat-input', { detail: s });
                    window.dispatchEvent(event);
                  }}
                  className="text-xs px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-full text-gray-400 hover:text-white transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### client/src/components/chat/StructuredAnswer.jsx
```jsx
const EVIDENCE_STYLES = {
  STRONG: { color: 'text-green-400', bg: 'bg-green-950 border-green-800', emoji: '🟢' },
  MODERATE: { color: 'text-yellow-400', bg: 'bg-yellow-950 border-yellow-800', emoji: '🟡' },
  LIMITED: { color: 'text-red-400', bg: 'bg-red-950 border-red-800', emoji: '🔴' }
};

const INSIGHT_ICONS = {
  TREATMENT: '💊', DIAGNOSIS: '🔬', RISK: '⚠️', PREVENTION: '🛡️', GENERAL: '📋'
};

function CitationTag({ id }) {
  const isPublication = id.startsWith('P');
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
      isPublication 
        ? 'bg-blue-900 text-blue-300 border border-blue-700' 
        : 'bg-green-900 text-green-300 border border-green-700'
    }`}>
      [{id}]
    </span>
  );
}

export default function StructuredAnswer({ answer, retrievalStats }) {
  const evidenceStyle = EVIDENCE_STYLES[answer.evidence_strength] || EVIDENCE_STYLES.MODERATE;
  
  return (
    <div className="bg-gray-900 rounded-2xl rounded-tl-sm border border-gray-800 overflow-hidden">
      {/* Evidence strength header */}
      <div className={`px-4 py-2 border-b border-gray-800 flex items-center justify-between`}>
        <span className={`text-xs font-medium ${evidenceStyle.color} flex items-center gap-1`}>
          {evidenceStyle.emoji} {answer.evidence_strength} EVIDENCE
        </span>
        {retrievalStats && (
          <span className="text-xs text-gray-600">
            {retrievalStats.totalCandidates} candidates → {retrievalStats.rerankedTo} ranked
          </span>
        )}
      </div>
      
      <div className="p-4 space-y-4">
        {/* Condition Overview */}
        {answer.condition_overview && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Overview</h4>
            <p className="text-sm text-gray-200 leading-relaxed">{answer.condition_overview}</p>
          </div>
        )}
        
        {/* Research Insights */}
        {answer.research_insights?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Research Findings</h4>
            <div className="space-y-2">
              {answer.research_insights.map((insight, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0">{INSIGHT_ICONS[insight.type] || '📋'}</span>
                    <div>
                      <p className="text-sm text-gray-200 leading-relaxed">{insight.insight}</p>
                      {insight.source_ids?.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {insight.source_ids.map(id => <CitationTag key={id} id={id} />)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Clinical Trials */}
        {answer.clinical_trials?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Clinical Trials</h4>
            <div className="space-y-2">
              {answer.clinical_trials.map((trial, i) => (
                <div key={i} className={`rounded-lg p-3 border ${
                  trial.location_relevant 
                    ? 'bg-green-950/50 border-green-800' 
                    : 'bg-gray-800 border-gray-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      trial.status === 'RECRUITING' 
                        ? 'text-green-400 bg-green-950 border-green-700'
                        : 'text-gray-400 bg-gray-900 border-gray-700'
                    }`}>
                      {trial.status}
                    </span>
                    {trial.location_relevant && (
                      <span className="text-xs text-green-400">📍 Near You</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200">{trial.summary}</p>
                  {trial.contact && (
                    <p className="text-xs text-gray-500 mt-1">Contact: {trial.contact}</p>
                  )}
                  {trial.source_ids?.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {trial.source_ids.map(id => <CitationTag key={id} id={id} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Recommendations */}
        {answer.recommendations && (
          <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Guidance</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{answer.recommendations}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## STEP 6: Researcher Spotlight Tab (45 min)

### client/src/components/evidence/ResearchersTab.jsx
```jsx
export default function ResearchersTab({ sources }) {
  // Extract researcher data from publications
  const authorMap = {};
  
  sources.filter(s => s.type === 'publication').forEach(doc => {
    doc.authors?.forEach((author, idx) => {
      if (!author || author.length < 3) return;
      if (!authorMap[author]) {
        authorMap[author] = { name: author, papers: [], years: [], sources: new Set() };
      }
      authorMap[author].papers.push(doc.title);
      if (doc.year) authorMap[author].years.push(doc.year);
      authorMap[author].sources.add(doc.source);
      // First author gets higher weight
      authorMap[author].firstAuthorCount = (authorMap[author].firstAuthorCount || 0) + (idx === 0 ? 2 : 1);
    });
  });
  
  const topResearchers = Object.values(authorMap)
    .filter(a => a.papers.length >= 1)
    .sort((a, b) => b.firstAuthorCount - a.firstAuthorCount)
    .slice(0, 8);
  
  if (topResearchers.length === 0) {
    return (
      <div className="text-center text-gray-600 text-sm mt-8">
        <p className="text-3xl mb-2">👤</p>
        <p>No researcher data available yet. Run a query to see top researchers in this field.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600 mb-3">
        Top researchers identified from retrieved publications
      </p>
      {topResearchers.map((researcher, i) => (
        <div key={researcher.name} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
              {researcher.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-white">{researcher.name}</h4>
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                <span>📄 {researcher.papers.length} paper{researcher.papers.length > 1 ? 's' : ''}</span>
                {researcher.years.length > 0 && (
                  <span>📅 {Math.min(...researcher.years)}–{Math.max(...researcher.years)}</span>
                )}
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {[...researcher.sources].map(s => (
                  <span key={s} className="text-xs bg-gray-800 border border-gray-700 px-2 py-0.5 rounded text-gray-400">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-2">
                <p className="text-xs text-gray-600 truncate">
                  Recent: {researcher.papers[0]?.substring(0, 60)}...
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## STEP 7: Research Timeline Chart (1 hour)

### client/src/components/evidence/TimelineTab.jsx
```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function TimelineTab({ sources }) {
  const publications = sources.filter(s => s.type === 'publication' && s.year);
  
  if (publications.length === 0) {
    return (
      <div className="text-center text-gray-600 text-sm mt-8">
        <p className="text-3xl mb-2">📈</p>
        <p>Publication timeline will appear here after querying</p>
      </div>
    );
  }
  
  // Build year distribution
  const yearCounts = {};
  publications.forEach(doc => {
    const year = doc.year;
    if (year >= 2010) {
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
  });
  
  const chartData = Object.entries(yearCounts)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([year, count]) => ({ year: parseInt(year), count }));
  
  const maxCount = Math.max(...chartData.map(d => d.count));
  const currentYear = new Date().getFullYear();
  
  // Research momentum
  const recentYears = chartData.filter(d => d.year >= currentYear - 3);
  const olderYears = chartData.filter(d => d.year < currentYear - 3 && d.year >= currentYear - 6);
  const recentAvg = recentYears.reduce((s, d) => s + d.count, 0) / Math.max(recentYears.length, 1);
  const olderAvg = olderYears.reduce((s, d) => s + d.count, 0) / Math.max(olderYears.length, 1);
  const momentum = recentAvg > olderAvg * 1.2 ? 'Accelerating 🚀' : recentAvg > olderAvg * 0.8 ? 'Stable 📊' : 'Declining 📉';
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Publication Timeline</h3>
        <span className="text-xs text-gray-400">Research momentum: {momentum}</span>
      </div>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <XAxis 
              dataKey="year" 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#e5e7eb', fontSize: 12 }}
              formatter={(val) => [`${val} papers`, 'Publications']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.count === maxCount ? '#3b82f6' : entry.year >= currentYear - 2 ? '#6366f1' : '#374151'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Papers', value: publications.length },
          { label: 'Peak Year', value: chartData.find(d => d.count === maxCount)?.year || 'N/A' },
          { label: 'Since 2020', value: publications.filter(p => p.year >= 2020).length }
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
            <p className="text-lg font-bold text-blue-400">{stat.value}</p>
            <p className="text-xs text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## STEP 8: Wire Follow-up Input to Chat (30 min)

### Update ChatInput to listen for programmatic input
```jsx
// Add to ChatInput.jsx inside the component:
useEffect(() => {
  const handler = (e) => setText(e.detail);
  window.addEventListener('set-chat-input', handler);
  return () => window.removeEventListener('set-chat-input', handler);
}, []);
```

---

## STEP 9: PDF Export Feature (45 min)

### client/src/components/sidebar/ExportButton.jsx
```jsx
import { Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function ExportButton() {
  const { currentSession, messages, sources } = useAppStore();
  
  const handleExport = async () => {
    // Dynamic import to avoid bundle bloat
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    let y = 20;
    const margin = 20;
    const pageWidth = 170;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246);
    doc.text('Curalink Research Brief', margin, y);
    y += 10;
    
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Disease: ${currentSession?.disease || 'N/A'}`, margin, y);
    y += 6;
    doc.text(`Location: ${currentSession?.location?.city || ''}, ${currentSession?.location?.country || ''}`, margin, y);
    y += 6;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);
    y += 10;
    
    // Separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, 190, y);
    y += 8;
    
    // Last assistant message structured answer
    const lastAnswer = [...messages].reverse().find(m => m.role === 'assistant' && m.structuredAnswer);
    
    if (lastAnswer?.structuredAnswer) {
      const ans = lastAnswer.structuredAnswer;
      
      // Overview
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Condition Overview', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      const overviewLines = doc.splitTextToSize(ans.condition_overview || '', pageWidth);
      doc.text(overviewLines, margin, y);
      y += overviewLines.length * 5 + 8;
      
      // Research insights
      if (ans.research_insights?.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Key Research Findings', margin, y);
        y += 6;
        
        ans.research_insights.slice(0, 5).forEach((ins, i) => {
          if (y > 260) { doc.addPage(); y = 20; }
          doc.setFontSize(10);
          doc.setTextColor(50, 50, 50);
          const lines = doc.splitTextToSize(`${i + 1}. ${ins.insight}`, pageWidth);
          doc.text(lines, margin, y);
          y += lines.length * 5 + 3;
        });
        y += 5;
      }
      
      // Sources
      if (sources.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Research Sources', margin, y);
        y += 6;
        
        sources.slice(0, 8).forEach((s, i) => {
          if (y > 260) { doc.addPage(); y = 20; }
          doc.setFontSize(9);
          doc.setTextColor(50, 50, 50);
          const titleLine = doc.splitTextToSize(`[${s.type === 'publication' ? 'P' : 'T'}${i + 1}] ${s.title}`, pageWidth);
          doc.text(titleLine, margin, y);
          y += titleLine.length * 4.5;
          doc.setTextColor(100, 100, 200);
          doc.text(s.url || '', margin + 4, y);
          y += 5;
        });
      }
    }
    
    doc.save(`curalink-${(currentSession?.disease || 'research').replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };
  
  return (
    <button
      onClick={handleExport}
      className="w-full flex items-center justify-center gap-2 text-xs py-2.5 bg-blue-950 hover:bg-blue-900 border border-blue-800 rounded-lg text-blue-300 hover:text-blue-200 transition-all"
    >
      <Download size={12} />
      Export Research Brief PDF
    </button>
  );
}
```

Install jsPDF:
```bash
cd client && npm install jspdf
```

---

## ✅ Day 3 Checklist

- [ ] `cd llm-service && uvicorn main:app --reload` starts without error
- [ ] `GET http://127.0.0.1:8001/health` returns `{ ollama: online, model_available: true }`
- [ ] `POST http://127.0.0.1:8001/generate` returns structured JSON
- [ ] Embedding endpoint works: `POST /embed` returns vectors
- [ ] Semantic re-ranking upgrades scores (check logs for "semantic rerank" message)
- [ ] Full pipeline returns `structuredAnswer` with real insights and citations [P1][T1]
- [ ] StructuredAnswer component renders sections properly
- [ ] Evidence strength badge shows (🟢/🟡/🔴)
- [ ] Follow-up suggestion chips are clickable and populate input
- [ ] Context badge appears on follow-up queries
- [ ] Researcher Spotlight tab shows author names from retrieved papers
- [ ] Timeline chart renders publication year distribution
- [ ] PDF export generates and downloads a real PDF
- [ ] Voice input transcribes and sends message

## 🚀 End of Day 3 Commit Message
```
feat: day 3 - ollama llm service, full rag pipeline, structured answers, researcher spotlight, timeline viz, pdf export
```
