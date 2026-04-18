import axios from 'axios';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8001';
const LLM_KEEP_ALIVE_MS = Number.parseInt(process.env.LLM_KEEP_ALIVE_MS || '30000', 10);
const LLM_MAX_SOCKETS = Number.parseInt(process.env.LLM_MAX_SOCKETS || '50', 10);

const llmHttpAgent = new HttpAgent({
  keepAlive: true,
  keepAliveMsecs: LLM_KEEP_ALIVE_MS,
  maxSockets: LLM_MAX_SOCKETS,
  maxFreeSockets: 10
});

const llmHttpsAgent = new HttpsAgent({
  keepAlive: true,
  keepAliveMsecs: LLM_KEEP_ALIVE_MS,
  maxSockets: LLM_MAX_SOCKETS,
  maxFreeSockets: 10
});

const llmClient = axios.create({
  baseURL: LLM_SERVICE_URL,
  timeout: 120000,
  httpAgent: llmHttpAgent,
  httpsAgent: llmHttpsAgent
});

function normalizeSuggestions(items, limit = 5) {
  const max = Math.max(3, Math.min(5, Number(limit) || 5));
  const normalized = (Array.isArray(items) ? items : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  return normalized.slice(0, max);
}

export async function generateSmartSuggestions({ partialQuery, history, commonTopics, limit = 5 }) {
  const query = String(partialQuery || '').trim();
  if (!query) {
    return [];
  }

  const { data } = await llmClient.post(
    '/suggestions',
    {
      partial_query: query,
      history: Array.isArray(history) ? history : [],
      common_topics: Array.isArray(commonTopics) ? commonTopics : [],
      limit: Math.max(3, Math.min(5, Number(limit) || 5))
    },
    { timeout: 15000 }
  );

  return normalizeSuggestions(data?.suggestions, limit);
}

/**
 * Call LLM service for RAG generation.
 */
export async function callLLM(systemPrompt, userPrompt) {
  try {
    const { data } = await llmClient.post(
      '/generate',
      {
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        temperature: 0.1,
        max_tokens: 2048
      },
      { timeout: 120000 }
    );

    return data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      throw new Error('LLM service is unreachable. Please start the configured LLM provider service.');
    }

    throw err;
  }
}

/**
 * Generate embeddings for semantic ranking.
 */
export async function getEmbeddings(texts) {
  try {
    const { data } = await llmClient.post('/embed', { texts }, { timeout: 30000 });
    return data.embeddings;
  } catch (err) {
    console.warn('Embedding service unavailable, falling back to keyword scoring');
    return null;
  }
}

/**
 * Semantic rerank using embedding service.
 */
export async function semanticRerank(query, documents) {
  if (!documents?.length) {
    return documents || [];
  }

  try {
    const { data } = await llmClient.post(
      '/rerank',
      {
        query,
        documents: documents.map((doc) => ({
          id: doc.id,
          text: `${doc.title || ''} ${doc.abstract || ''}`.substring(0, 512)
        })),
        top_k: 100
      },
      { timeout: 30000 }
    );

    const scoreMap = {};
    for (const item of data.ranked || []) {
      scoreMap[item.id] = item.score;
    }

    return documents
      .map((doc) => ({
        ...doc,
        semanticScore: scoreMap[doc.id] || 0,
        finalScore: (doc.finalScore || 0) * 0.5 + (scoreMap[doc.id] || 0) * 0.5
      }))
      .sort((a, b) => b.finalScore - a.finalScore);
  } catch (err) {
    console.warn('Semantic reranking failed, using keyword scores');
    return documents;
  }
}

/**
 * Parse and validate LLM response with resilient fallback behavior.
 */
export function parseLLMResponse(llmData, options = {}) {
  const allowedCitationIds = Array.isArray(options.allowedCitationIds)
    ? options.allowedCitationIds.map((id) => String(id).toUpperCase())
    : [];
  const contextDocs = Array.isArray(options.contextDocs) ? options.contextDocs : [];

  if (llmData?.parsed) {
    const normalized = normalizeStructuredAnswer(llmData.parsed, allowedCitationIds, contextDocs);
    if (isValidStructuredAnswer(normalized)) {
      return normalized;
    }
  }

  const parsedFromText = extractJsonPayload(llmData?.text || '');
  if (parsedFromText) {
    const normalized = normalizeStructuredAnswer(parsedFromText, allowedCitationIds, contextDocs);
    if (isValidStructuredAnswer(normalized)) {
      return normalized;
    }
  }

  return createParserFallback(options);
}

function extractJsonPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to object extraction.
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return null;
  }

  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
}

function createParserFallback(options = {}) {
  const strength = ['LIMITED', 'MODERATE', 'STRONG'].includes(options.evidenceStrengthLabel)
    ? options.evidenceStrengthLabel
    : 'LIMITED';
  const disease = options.disease || 'this condition';
  const fallbackBreakdown = buildDefaultConfidenceBreakdown(
    options.allowedCitationIds,
    options.contextDocs
  );

  return {
    condition_overview: `Structured generation could not be validated for ${disease}. Please review the evidence panel directly.`,
    evidence_strength: strength,
    research_insights: [],
    clinical_trials: [],
    key_researchers: [],
    recommendations:
      'A structured summary was not available for this response. Please consult your healthcare provider for personalized guidance.',
    follow_up_suggestions: [
      'Can you summarize the strongest findings from the listed sources?',
      'Can you focus on recruiting clinical trials near my location?',
      'Can you compare benefits and risks from the top studies?'
    ],
    confidence_breakdown: fallbackBreakdown
  };
}

function isValidStructuredAnswer(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.condition_overview === 'string' &&
    Array.isArray(obj.research_insights) &&
    Array.isArray(obj.clinical_trials) &&
    Array.isArray(obj.follow_up_suggestions) &&
    Array.isArray(obj.confidence_breakdown)
  );
}

function normalizeScore(value, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numeric));
}

function getDocForCitation(citationId, contextDocs = []) {
  const match = String(citationId || '').match(/^([PT])(\d+)$/i);
  if (!match) {
    return null;
  }

  const bucket = match[1].toUpperCase() === 'P' ? 'publication' : 'trial';
  const index = Math.max(0, Number(match[2]) - 1);
  const docs = (Array.isArray(contextDocs) ? contextDocs : []).filter((doc) => doc.type === bucket);

  return docs[index] || null;
}

function buildDefaultConfidenceBreakdown(allowedCitationIds = [], contextDocs = []) {
  return (Array.isArray(allowedCitationIds) ? allowedCitationIds : []).map((citationId) => {
    const normalizedCitation = String(citationId || '').toUpperCase();
    const doc = getDocForCitation(normalizedCitation, contextDocs);
    const relevance = normalizeScore(doc?.relevanceScore ?? doc?.lastRelevanceScore ?? doc?.finalScore, 0.5);
    const credibility = normalizeScore(doc?.sourceCredibility, 0.7);
    const recency = normalizeScore(doc?.recencyScore, 0.5);
    const composite = normalizeScore(
      doc?.finalScore,
      relevance * 0.45 + credibility * 0.25 + recency * 0.3
    );

    return {
      source_id: normalizedCitation,
      title: String(doc?.title || normalizedCitation),
      relevance_score: relevance,
      credibility_score: credibility,
      recency_score: recency,
      composite_score: composite
    };
  });
}

function normalizeStructuredAnswer(answer, allowedCitationIds = [], contextDocs = []) {
  const allowedSet = new Set(
    (Array.isArray(allowedCitationIds) ? allowedCitationIds : []).map((id) =>
      String(id).toUpperCase()
    )
  );

  const normalizeSourceIds = (sourceIds) => {
    if (!Array.isArray(sourceIds)) {
      return [];
    }

    const ids = sourceIds
      .map((id) => String(id).toUpperCase().trim())
      .filter(Boolean);

    if (!allowedSet.size) {
      return [];
    }

    return ids.filter((id, index) => allowedSet.has(id) && ids.indexOf(id) === index);
  };

  const normalizedInsights = Array.isArray(answer.research_insights)
    ? answer.research_insights
        .map((insight) => ({
          insight: insight?.insight || '',
          type: ['TREATMENT', 'DIAGNOSIS', 'RISK', 'PREVENTION', 'GENERAL'].includes(insight?.type)
            ? insight.type
            : 'GENERAL',
          source_ids: normalizeSourceIds(insight?.source_ids)
        }))
        .filter((insight) => insight.insight && insight.source_ids.length > 0)
    : [];

  const normalizedTrials = Array.isArray(answer.clinical_trials)
    ? answer.clinical_trials
        .map((trial) => ({
          summary: trial?.summary || '',
          status: trial?.status || '',
          location_relevant: Boolean(trial?.location_relevant),
          contact: trial?.contact || '',
          source_ids: normalizeSourceIds(trial?.source_ids)
        }))
        .filter((trial) => trial.summary && trial.source_ids.length > 0)
    : [];

  const followUpDefaults = [
    'Can you summarize the strongest findings from the listed sources?',
    'Can you focus on recruiting clinical trials near my location?',
    'Can you compare benefits and risks from the top studies?'
  ];

  const followUpSuggestions = [
    ...(Array.isArray(answer.follow_up_suggestions) ? answer.follow_up_suggestions : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
    ...followUpDefaults
  ].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 3);

  const baseRecommendations = String(answer.recommendations || '').trim();
  const providerSuffix = 'Please consult your healthcare provider for personalized guidance.';
  const recommendations = baseRecommendations
    ? baseRecommendations.toLowerCase().includes('please consult your healthcare provider')
      ? baseRecommendations
      : `${baseRecommendations.replace(/\.+$/, '')}. ${providerSuffix}`
    : providerSuffix;

  const confidenceBreakdownMap = new Map();
  if (Array.isArray(answer.confidence_breakdown)) {
    answer.confidence_breakdown.forEach((entry) => {
      const sourceId = String(entry?.source_id || '').toUpperCase().trim();
      if (!sourceId) {
        return;
      }

      if (allowedSet.size && !allowedSet.has(sourceId)) {
        return;
      }

      if (confidenceBreakdownMap.has(sourceId)) {
        return;
      }

      const doc = getDocForCitation(sourceId, contextDocs);
      const relevance = normalizeScore(entry?.relevance_score ?? doc?.relevanceScore, 0.5);
      const credibility = normalizeScore(entry?.credibility_score ?? doc?.sourceCredibility, 0.7);
      const recency = normalizeScore(entry?.recency_score ?? doc?.recencyScore, 0.5);
      const composite = normalizeScore(
        entry?.composite_score ?? doc?.finalScore,
        relevance * 0.45 + credibility * 0.25 + recency * 0.3
      );

      confidenceBreakdownMap.set(sourceId, {
        source_id: sourceId,
        title: String(entry?.title || doc?.title || sourceId),
        relevance_score: relevance,
        credibility_score: credibility,
        recency_score: recency,
        composite_score: composite
      });
    });
  }

  if (allowedSet.size) {
    buildDefaultConfidenceBreakdown(Array.from(allowedSet), contextDocs).forEach((entry) => {
      if (!confidenceBreakdownMap.has(entry.source_id)) {
        confidenceBreakdownMap.set(entry.source_id, entry);
      }
    });
  }

  return {
    condition_overview: String(answer.condition_overview || ''),
    evidence_strength: ['LIMITED', 'MODERATE', 'STRONG'].includes(answer.evidence_strength)
      ? answer.evidence_strength
      : 'MODERATE',
    research_insights: normalizedInsights,
    clinical_trials: normalizedTrials,
    key_researchers: Array.isArray(answer.key_researchers) ? answer.key_researchers.filter(Boolean) : [],
    recommendations,
    follow_up_suggestions: followUpSuggestions,
    confidence_breakdown: Array.from(confidenceBreakdownMap.values())
  };
}

// Backward-compatible helper for older callers.
export async function generateFromLlm(payload) {
  try {
    const systemPrompt = payload?.system_prompt || payload?.systemPrompt || '';
    const userPrompt = payload?.user_prompt || payload?.userPrompt || payload?.query || '';
    return await callLLM(systemPrompt, userPrompt);
  } catch (error) {
    return {
      status: 'placeholder',
      message: 'LLM generation failed or is not ready yet',
      details: error.message
    };
  }
}