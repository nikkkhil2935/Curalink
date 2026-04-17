import axios from 'axios';
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
});

const llmClient = axios.create({
  baseURL: LLM_SERVICE_URL,
  timeout: LLM_TIMEOUT_MS,
  httpAgent,
  httpsAgent,
  headers: {
    Connection: 'keep-alive'
  }
});

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
    const { data } = await llmClient.post('/embed', { texts }, { timeout: EMBED_TIMEOUT_MS });
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
  const allowedCitationIds = normalizeAllowedCitationIds(options.allowedCitationIds);

  if (llmData?.parsed !== null && llmData?.parsed !== undefined) {
    const normalized = normalizeStructuredAnswer(llmData.parsed, allowedCitationIds);
    if (isValidStructuredAnswer(normalized)) {
      return normalized;
    }
  }

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
  const contextDocs = Array.isArray(options.contextDocs) ? options.contextDocs : [];

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
    ]
  }, allowedCitationIds);
}

function isValidStructuredAnswer(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.condition_overview === 'string' &&
    obj.condition_overview.trim().length > 0 &&
    Array.isArray(obj.research_insights) &&
    Array.isArray(obj.clinical_trials) &&
    typeof obj.recommendations === 'string' &&
    Array.isArray(obj.follow_up_suggestions) &&
    obj.follow_up_suggestions.length === 3
  );
}

function normalizeStructuredAnswer(answer, allowedCitationIds = []) {
  const safeAnswer = answer && typeof answer === 'object' ? answer : {};
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
    follow_up_suggestions: followUpSuggestions
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