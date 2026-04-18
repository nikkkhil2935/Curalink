import axios from 'axios';
<<<<<<< HEAD
import http from 'node:http';
import https from 'node:https';
import logger from '../lib/logger.js';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8001';
const LLM_TIMEOUT_MS = Number.parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || '120000', 10);
const EMBED_TIMEOUT_MS = Number.parseInt(process.env.LLM_EMBED_TIMEOUT_MS || '30000', 10);
const KEEP_ALIVE_MAX_SOCKETS = Number.parseInt(process.env.LLM_KEEP_ALIVE_MAX_SOCKETS || '64', 10);
const KEEP_ALIVE_MAX_FREE_SOCKETS = Number.parseInt(process.env.LLM_KEEP_ALIVE_MAX_FREE_SOCKETS || '16', 10);

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: KEEP_ALIVE_MAX_SOCKETS,
  maxFreeSockets: KEEP_ALIVE_MAX_FREE_SOCKETS
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: KEEP_ALIVE_MAX_SOCKETS,
  maxFreeSockets: KEEP_ALIVE_MAX_FREE_SOCKETS
=======
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
});

const llmClient = axios.create({
  baseURL: LLM_SERVICE_URL,
<<<<<<< HEAD
  timeout: LLM_TIMEOUT_MS,
  httpAgent,
  httpsAgent,
  headers: {
    Connection: 'keep-alive'
  }
});
=======
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

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
      { timeout: LLM_TIMEOUT_MS }
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
<<<<<<< HEAD
    const { data } = await llmClient.post('/embed', { texts }, { timeout: EMBED_TIMEOUT_MS });
=======
    const { data } = await llmClient.post('/embed', { texts }, { timeout: 30000 });
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    return data.embeddings;
  } catch (err) {
    logger.warn('Embedding service unavailable, falling back to keyword scoring');
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
      { timeout: EMBED_TIMEOUT_MS }
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
    logger.warn('Semantic reranking failed, using keyword scores');
    return documents;
  }
}

/**
 * Parse and validate LLM response with resilient fallback behavior.
 */
export function parseLLMResponse(llmData, options = {}) {
<<<<<<< HEAD
  const allowedCitationIds = normalizeAllowedCitationIds(options.allowedCitationIds);

  if (llmData?.parsed !== null && llmData?.parsed !== undefined) {
    const normalized = normalizeStructuredAnswer(llmData.parsed, allowedCitationIds);
=======
  const allowedCitationIds = Array.isArray(options.allowedCitationIds)
    ? options.allowedCitationIds.map((id) => String(id).toUpperCase())
    : [];
  const contextDocs = Array.isArray(options.contextDocs) ? options.contextDocs : [];

  if (llmData?.parsed) {
    const normalized = normalizeStructuredAnswer(llmData.parsed, allowedCitationIds, contextDocs);
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    if (isValidStructuredAnswer(normalized)) {
      return normalized;
    }
  }

<<<<<<< HEAD
  if (typeof llmData?.text === 'string') {
    const cleanedText = stripMarkdownCodeFences(llmData.text).trim();
    const parsedFromCleanText = tryParseJson(cleanedText);
    if (parsedFromCleanText) {
      const normalized = normalizeStructuredAnswer(parsedFromCleanText, allowedCitationIds);
      if (isValidStructuredAnswer(normalized)) {
        return normalized;
      }
    }

    const parsedFromObjectMatch = extractFirstObjectJson(llmData.text);
    if (parsedFromObjectMatch) {
      const normalized = normalizeStructuredAnswer(parsedFromObjectMatch, allowedCitationIds);
      if (isValidStructuredAnswer(normalized)) {
        return normalized;
      }
=======
  const parsedFromText = extractJsonPayload(llmData?.text || '');
  if (parsedFromText) {
    const normalized = normalizeStructuredAnswer(parsedFromText, allowedCitationIds, contextDocs);
    if (isValidStructuredAnswer(normalized)) {
      return normalized;
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    }
  }

  return createParserFallback(options, allowedCitationIds);
}

function normalizeAllowedCitationIds(allowedCitationIds) {
  if (!Array.isArray(allowedCitationIds)) {
    return [];
  }

  return allowedCitationIds
    .map((id) => String(id || '').toUpperCase().trim())
    .filter((id) => /^[PT]\d+$/.test(id))
    .filter((id, index, arr) => arr.indexOf(id) === index);
}

function stripMarkdownCodeFences(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  return rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
}

function tryParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(rawText);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractFirstObjectJson(rawText) {
  const objectMatch = String(rawText || '').match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return null;
  }

  return tryParseJson(objectMatch[0]);
}

function createParserFallback(options = {}, allowedCitationIds = []) {
  const strength = ['LIMITED', 'MODERATE', 'STRONG'].includes(options.evidenceStrengthLabel)
    ? options.evidenceStrengthLabel
    : 'LIMITED';
  const disease = options.disease || 'this condition';
<<<<<<< HEAD
  const contextDocs = Array.isArray(options.contextDocs) ? options.contextDocs : [];
=======
  const fallbackBreakdown = buildDefaultConfidenceBreakdown(
    options.allowedCitationIds,
    options.contextDocs
  );
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

  const publicationCitations = allowedCitationIds.filter((id) => /^P\d+$/.test(id));
  const trialCitations = allowedCitationIds.filter((id) => /^T\d+$/.test(id));

  const researchInsights = contextDocs
    .filter((doc) => doc?.type === 'publication')
    .slice(0, 3)
    .map((doc, index) => {
      const citationId = publicationCitations[index];
      if (!citationId) {
        return null;
      }

      return {
        insight: String(doc?.abstract || doc?.title || 'Evidence not available in current research pool.').slice(0, 150),
        type: 'GENERAL',
        source_ids: [citationId]
      };
    })
    .filter(Boolean);

  const clinicalTrials = contextDocs
    .filter((doc) => doc?.type === 'trial')
    .slice(0, 3)
    .map((doc, index) => {
      const citationId = trialCitations[index];
      if (!citationId) {
        return null;
      }

      return {
        summary: String(doc?.title || 'Clinical trial details are limited in current context.'),
        status: String(doc?.status || 'UNKNOWN'),
        location_relevant: Boolean(doc?.isLocationRelevant),
        contact: doc?.contacts?.[0]
          ? `${doc.contacts[0].name || ''}${doc.contacts[0].email ? ` (${doc.contacts[0].email})` : ''}`.trim()
          : '',
        source_ids: [citationId]
      };
    })
    .filter(Boolean);

  return normalizeStructuredAnswer({
    condition_overview: `Structured generation could not be validated for ${disease}. Please review the evidence panel directly.`,
    evidence_strength: strength,
    research_insights: researchInsights,
    clinical_trials: clinicalTrials,
    key_researchers: [],
    recommendations:
      'Based on the retrieved research, please review the sources listed. Please consult your healthcare provider for personalized guidance.',
    follow_up_suggestions: [
      'Can you summarize the strongest findings from the listed sources?',
      'Can you focus on recruiting clinical trials near my location?',
      'Can you compare benefits and risks from the top studies?'
<<<<<<< HEAD
    ]
  }, allowedCitationIds);
=======
    ],
    confidence_breakdown: fallbackBreakdown
  };
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
}

function isValidStructuredAnswer(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.condition_overview === 'string' &&
    obj.condition_overview.trim().length > 0 &&
    Array.isArray(obj.research_insights) &&
    Array.isArray(obj.clinical_trials) &&
<<<<<<< HEAD
    typeof obj.recommendations === 'string' &&
    Array.isArray(obj.follow_up_suggestions) &&
    obj.follow_up_suggestions.length === 3
  );
}

function normalizeStructuredAnswer(answer, allowedCitationIds = []) {
  const safeAnswer = answer && typeof answer === 'object' ? answer : {};
=======
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
  const allowedSet = new Set(
    normalizeAllowedCitationIds(allowedCitationIds)
  );

  const normalizeSourceIds = (sourceIds, expectedPrefix) => {
    if (!Array.isArray(sourceIds)) {
      return [];
    }

    const ids = sourceIds
      .map((id) => String(id).toUpperCase().trim())
      .filter((id) => Boolean(id) && (!expectedPrefix || id.startsWith(expectedPrefix)));

    if (!allowedSet.size) {
      return [];
    }

    return ids.filter((id, index) => allowedSet.has(id) && ids.indexOf(id) === index);
  };

  const normalizedInsights = Array.isArray(safeAnswer.research_insights)
    ? safeAnswer.research_insights
        .map((insight) => ({
          insight: insight?.insight || '',
          type: ['TREATMENT', 'DIAGNOSIS', 'RISK', 'PREVENTION', 'GENERAL'].includes(insight?.type)
            ? insight.type
            : 'GENERAL',
          source_ids: normalizeSourceIds(insight?.source_ids, 'P')
        }))
        .filter((insight) => insight.insight && insight.source_ids.length > 0)
    : [];

  const normalizedTrials = Array.isArray(safeAnswer.clinical_trials)
    ? safeAnswer.clinical_trials
        .map((trial) => ({
          summary: trial?.summary || '',
          status: trial?.status || '',
          location_relevant: Boolean(trial?.location_relevant),
          contact: trial?.contact || '',
          source_ids: normalizeSourceIds(trial?.source_ids, 'T')
        }))
        .filter((trial) => trial.summary && trial.source_ids.length > 0)
    : [];

  const followUpDefaults = [
    'Can you summarize the strongest findings from the listed sources?',
    'Can you focus on recruiting clinical trials near my location?',
    'Can you compare benefits and risks from the top studies?'
  ];

  const followUpSuggestions = [
    ...(Array.isArray(safeAnswer.follow_up_suggestions) ? safeAnswer.follow_up_suggestions : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
    ...followUpDefaults
  ].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 3);

  const baseRecommendations = String(safeAnswer.recommendations || '').trim();
  const providerSuffix = 'Please consult your healthcare provider for personalized guidance.';
  const recommendations = baseRecommendations
    ? baseRecommendations.toLowerCase().includes(providerSuffix.toLowerCase())
      ? baseRecommendations
      : `${baseRecommendations.replace(/\.+$/, '')}. ${providerSuffix}`
    : `Based on the retrieved research, please review the listed sources. ${providerSuffix}`;

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
    condition_overview:
      String(safeAnswer.condition_overview || '').trim() || 'Evidence not available in current research pool.',
    evidence_strength: ['LIMITED', 'MODERATE', 'STRONG'].includes(safeAnswer.evidence_strength)
      ? safeAnswer.evidence_strength
      : 'MODERATE',
    research_insights: normalizedInsights,
    clinical_trials: normalizedTrials,
    key_researchers: Array.isArray(safeAnswer.key_researchers)
      ? safeAnswer.key_researchers
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      : [],
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