import { createHash } from 'node:crypto';
import { classifyIntent, getRetrievalStrategy } from './intentClassifier.js';
import { expandQuery } from './queryExpander.js';
import { fetchFromPubMed } from '../apis/pubmed.js';
import { fetchFromOpenAlex } from '../apis/openalex.js';
import { fetchFromClinicalTrials } from '../apis/clinicaltrials.js';
import { normalizeAndDeduplicate } from './normalizer.js';
import { rerankCandidates, selectForContext, computeEvidenceStrength } from './reranker.js';
import { buildRAGContext, buildSystemPrompt, buildUserPrompt } from './contextPackager.js';
import { callLLM, parseLLMResponse, semanticRerank } from '../llm.js';
import SourceDoc from '../../models/SourceDoc.js';
import logger from '../../lib/logger.js';
import Analytics from '../../models/Analytics.js';

const RERANK_SKIP_SIMILARITY_THRESHOLD = 0.97;

export async function runRetrievalPipeline(session, userMessage, conversationHistory = [], options = {}) {
  const startTime = Date.now();
  const stageTimingsMs = createStageTimings();
  const traceId = options.traceId || buildDeterministicTraceId(session?._id, userMessage, startTime);
  const llmTrace = {
    provider: null,
    cacheHit: false,
    cacheSimilarity: null,
    pipelineTimings: []
  };

  let stageStart = Date.now();
  const intentType = classifyIntent(userMessage, session.intent);
  const strategy = getRetrievalStrategy(intentType);
  stageTimingsMs.intent = Date.now() - stageStart;

  stageStart = Date.now();
  const expanded = expandQuery(session.disease, userMessage, intentType);

  const isFollowUp = conversationHistory.length > 0;
  let contextBadge = null;

  if (isFollowUp) {
    contextBadge = `Using context: ${session.disease}`;
    if (!userMessage.toLowerCase().includes(session.disease.toLowerCase())) {
      expanded.fullQuery = `${userMessage} ${session.disease}`;
      expanded.pubmedQuery = `(${userMessage}) AND (${session.disease})`;
      expanded.openalexQuery = expanded.fullQuery;
      expanded.ctCondition = session.disease;
      expanded.ctIntervention = userMessage;
    }
  }
  stageTimingsMs.expansion = Date.now() - stageStart;

  logger.info(`Starting retrieval for query: "${expanded.fullQuery}"`);
  stageStart = Date.now();
  const [pubmedResults, openalexResults, ctResults] = await Promise.all([
    fetchFromPubMed(expanded.pubmedQuery, Number(process.env.RETRIEVAL_PUBMED_MAX || 200), strategy.pubmedSort),
    fetchFromOpenAlex(expanded.openalexQuery, Number(process.env.RETRIEVAL_OPENALEX_MAX || 200)),
    fetchFromClinicalTrials(expanded.ctCondition, expanded.ctIntervention, session.location, Number(process.env.RETRIEVAL_CT_MAX || 100))
  ]);
  stageTimingsMs.retrieval = Date.now() - stageStart;

  const stats = {
    traceId,
    stageTimingsMs,
    pubmedFetched: pubmedResults.length,
    openalexFetched: openalexResults.length,
    ctFetched: ctResults.length,
    totalCandidates: pubmedResults.length + openalexResults.length + ctResults.length
  };

  stageStart = Date.now();
  const normalized = normalizeAndDeduplicate(pubmedResults, openalexResults, ctResults);
  stageTimingsMs.normalization = Date.now() - stageStart;

  if (!normalized.length) {
    const evidenceStrength = {
      label: 'LIMITED',
      emoji: '🔴',
      description: 'No usable evidence returned from configured retrieval sources'
    };
    const structuredAnswer = createNoEvidenceStructuredAnswer(session.disease, userMessage);
    stats.rerankedTo = 0;
    stats.pipeline_timings = [];
    stats.timeTakenMs = Date.now() - startTime;

    const trace = {
      llm: {
        provider: 'none',
        model: null,
        elapsed_seconds: 0,
        semantic_cache_hit: false
      },
      pipeline_timings: []
    };

    await Analytics.create({
      event: 'query',
      disease: session.disease.toLowerCase(),
      intentType,
      sessionId: session._id,
      metadata: {
        stats,
        queryExpanded: expanded.fullQuery,
        strategy,
        trace,
        noEvidence: true
      }
    }).catch((err) => {
      logger.error(`Analytics logging error: ${err.message}`);
    });

    return {
      responseText: buildPlainTextSummary(structuredAnswer, stats),
      structuredAnswer,
      contextDocs: [],
      evidenceDocs: [],
      rankedAll: [],
      stats,
      evidenceStrength,
      intentType,
      expandedQuery: expanded,
      contextBadge,
      sourceIndex: {},
      trace
    };
  }

  stageStart = Date.now();
  const queryTerms = expanded.fullQuery
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 3);

  const keywordRanked = rerankCandidates(normalized, queryTerms, intentType, session.location);
  const publicationQuota = intentType === 'CLINICAL_TRIALS' ? 35 : 55;
  const trialQuota = intentType === 'CLINICAL_TRIALS' ? 35 : 20;

  const topPublications = keywordRanked
    .filter((doc) => doc.type === 'publication')
    .slice(0, publicationQuota);
  const topTrials = keywordRanked.filter((doc) => doc.type === 'trial').slice(0, trialQuota);

  const seededPool = [...topPublications, ...topTrials];
  const seededIds = new Set(seededPool.map((doc) => String(doc.id || doc._id)));
  const backfill = keywordRanked
    .filter((doc) => !seededIds.has(String(doc.id || doc._id)))
    .slice(0, Math.max(0, 100 - seededPool.length));
  const semanticInput = [...seededPool, ...backfill].slice(0, 100);

  const bestSimilarity = Number(keywordRanked[0]?.relevanceScore || 0);
  const shouldSkipSemanticRerank = bestSimilarity >= RERANK_SKIP_SIMILARITY_THRESHOLD;
  const ranked = shouldSkipSemanticRerank
    ? keywordRanked.slice(0, 100)
    : await semanticRerank(expanded.fullQuery, semanticInput);
  stats.queryContextSimilarity = bestSimilarity;
  stats.semanticRerankSkipped = shouldSkipSemanticRerank;

  const minTrialsForContext = ctResults.length > 0 ? (intentType === 'CLINICAL_TRIALS' ? 2 : 1) : 0;
  const contextDocs = selectForContext(ranked, 8, 5, { minTrials: minTrialsForContext });
  stats.rerankedTo = contextDocs.length;

  const evidenceStrength = computeEvidenceStrength(contextDocs);
  stageTimingsMs.rerank = Date.now() - stageStart;

  stageStart = Date.now();
  const upsertOps = contextDocs.map((doc) => {
    const { id, ...docData } = doc;

    return {
      updateOne: {
        filter: { _id: id },
        update: {
          $setOnInsert: { _id: id },
          $set: {
            ...docData,
            lastRelevanceScore: doc.finalScore || 0
          },
          $inc: { timesUsed: 1 },
          $addToSet: { queryAssociations: expanded.fullQuery }
        },
        upsert: true
      }
    };
  });

  if (upsertOps.length) {
    await SourceDoc.bulkWrite(upsertOps, { ordered: false }).catch((err) => {
      logger.error(`SourceDoc upsert error: ${err.message}`);
    });
  }

  const { sourcesText, sourceIndex } = buildRAGContext(
    contextDocs,
    session.disease,
    userMessage,
    session
  );

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(
    session.disease,
    userMessage,
    session,
    sourcesText,
    evidenceStrength,
    intentType
  );
  stageTimingsMs.context = Date.now() - stageStart;

  stageStart = Date.now();
  let structuredAnswer;
  let trace = {
    llm: {
      provider: 'none',
      model: null,
      elapsed_seconds: 0,
      semantic_cache_hit: false
    },
    pipeline_timings: []
  };
  try {
    const llmData = await callLLM(systemPrompt, userPrompt);
    const pipelineTimings = Array.isArray(llmData?.pipeline_timings) ? llmData.pipeline_timings : [];
    trace = {
      llm: {
        provider: llmData?.provider || 'unknown',
        model: llmData?.model || null,
        elapsed_seconds: Number(llmData?.elapsed_seconds || 0),
        semantic_cache_hit: Boolean(llmData?.semantic_cache_hit)
      },
      pipeline_timings: pipelineTimings
    };

    structuredAnswer = parseLLMResponse(llmData, {
      allowedCitationIds: Object.keys(sourceIndex || {}),
      contextDocs,
      disease: session.disease,
      evidenceStrengthLabel: evidenceStrength.label
    });

    const citationValidation = validateAnswerCitations(structuredAnswer, sourceIndex);
    if (!citationValidation.isValid) {
      throw new Error(citationValidation.reason || 'Structured answer citations are invalid');
    }
    structuredAnswer = citationValidation.answer;
  } catch (llmErr) {
    logger.warn(`LLM failed, using graceful fallback: ${llmErr.message}`);
    structuredAnswer = createFallbackStructuredAnswer(contextDocs, session.disease, evidenceStrength, sourceIndex);
    llmTrace.provider = llmTrace.provider || 'local';
  }
  stageTimingsMs.llm = Math.max(stageTimingsMs.llm, Date.now() - stageStart);

  stats.llmCacheHit = llmTrace.cacheHit;
  if (llmTrace.cacheSimilarity !== null) {
    stats.llmCacheSimilarity = llmTrace.cacheSimilarity;
  }

  const responseText = buildPlainTextSummary(structuredAnswer, stats);

  stats.pipeline_timings = trace.pipeline_timings;
  stats.timeTakenMs = Date.now() - startTime;

  await Analytics.create({
    event: 'query',
    disease: session.disease.toLowerCase(),
    intentType,
    sessionId: session._id,
    metadata: {
      stats,
      queryExpanded: expanded.fullQuery,
      strategy,
      trace
    }
  }).catch((err) => {
    logger.error(`Analytics logging error: ${err.message}`);
  });

  return {
    responseText,
    structuredAnswer,
    contextDocs,
    evidenceDocs: ranked,
    rankedAll: ranked,
    stats,
    evidenceStrength,
    intentType,
    expandedQuery: expanded,
    contextBadge,
    sourceIndex,
    trace
  };
}

function createStageTimings() {
  return {
    intent: 0,
    expansion: 0,
    retrieval: 0,
    normalization: 0,
    rerank: 0,
    context: 0,
    llm: 0,
    total: 0
  };
}

function getSemanticSkipThreshold() {
  const rawThreshold = Number.parseFloat(process.env.RETRIEVAL_SEMANTIC_SKIP_THRESHOLD || '0.97');
  if (Number.isNaN(rawThreshold)) {
    return 0.97;
  }

  return Math.min(1, Math.max(0, rawThreshold));
}

function normalizeSimilarityText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTokenFrequency(text) {
  const freq = new Map();
  const tokens = normalizeSimilarityText(text)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  return freq;
}

function computeCosineTokenSimilarity(leftText, rightText) {
  const left = buildTokenFrequency(leftText);
  const right = buildTokenFrequency(rightText);

  if (!left.size || !right.size) {
    return 0;
  }

  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (const value of left.values()) {
    leftNorm += value * value;
  }

  for (const value of right.values()) {
    rightNorm += value * value;
  }

  for (const [token, value] of left.entries()) {
    dotProduct += value * (right.get(token) || 0);
  }

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function computeTopContextSimilarity(query, docs = [], sampleSize = 20) {
  const queryText = normalizeSimilarityText(query);
  if (!queryText) {
    return 0;
  }

  let bestScore = 0;

  for (const doc of docs.slice(0, sampleSize)) {
    const docText = normalizeSimilarityText(`${doc?.title || ''} ${doc?.abstract || ''}`);
    if (!docText) {
      continue;
    }

    if (docText.includes(queryText)) {
      return 1;
    }

    const score = computeCosineTokenSimilarity(queryText, docText);
    if (score > bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

function buildDeterministicTraceId(sessionId, userMessage, seedMs) {
  const sessionPart = String(sessionId || 'session').slice(-6);
  const normalizedMessage = String(userMessage || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const seed = String(Number(seedMs) || Date.now());
  const digest = createHash('sha1')
    .update(`${sessionPart}:${normalizedMessage}:${seed}`)
    .digest('hex')
    .slice(0, 10);

  return `q_${sessionPart}_${Number(seed).toString(36)}_${digest}`;
}

function createNoEvidenceStructuredAnswer(disease, userMessage) {
  return {
    condition_overview: 'No research found for this query. Try broadening the disease term.',
    evidence_strength: 'LIMITED',
    research_insights: [],
    clinical_trials: [],
    key_researchers: [],
    recommendations:
      `No source-backed answer is available for "${userMessage}" right now. Please consult your healthcare provider for personalized guidance.`,
    follow_up_suggestions: [
      `Can you broaden the search scope for ${disease}?`,
      `Can you prioritize review papers or meta-analyses for ${disease}?`,
      'Can you focus on currently recruiting clinical trials near my location?'
    ],
    confidence_breakdown: []
  };
}

function createFallbackStructuredAnswer(docs, disease, evidenceStrength, sourceIndex = {}) {
  const toScore = (value, fallback = 0.5) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.max(0, Math.min(1, numeric));
  };

  const citationEntries = Object.entries(sourceIndex || {});
  const idToCitation = new Map(citationEntries.map(([citationId, sourceId]) => [String(sourceId), String(citationId)]));

  const publicationWithCitation = docs
    .filter((doc) => doc.type === 'publication')
    .map((doc) => ({
      ...doc,
      citationId: idToCitation.get(String(doc.id || doc._id)) || null
    }))
    .filter((doc) => doc.citationId)
    .slice(0, 3);

  const trialsWithCitation = docs
    .filter((doc) => doc.type === 'trial')
    .map((doc) => ({
      ...doc,
      citationId: idToCitation.get(String(doc.id || doc._id)) || null
    }))
    .filter((doc) => doc.citationId)
    .slice(0, 3);

  const confidenceBreakdown = [...publicationWithCitation, ...trialsWithCitation].map((doc) => {
    const relevance = toScore(doc.relevanceScore ?? doc.lastRelevanceScore ?? doc.finalScore, 0.5);
    const credibility = toScore(doc.sourceCredibility, 0.7);
    const recency = toScore(doc.recencyScore, 0.5);
    const composite = toScore(doc.finalScore, relevance * 0.45 + credibility * 0.25 + recency * 0.3);

    return {
      source_id: doc.citationId,
      title: doc.title || doc.citationId,
      relevance_score: relevance,
      credibility_score: credibility,
      recency_score: recency,
      composite_score: composite
    };
  });

  return {
    condition_overview: `Research analysis for ${disease} - ${docs.length} sources retrieved and ranked.`,
    evidence_strength: evidenceStrength.label,
    research_insights: publicationWithCitation
      .map((doc, index) => ({
        insight: doc.abstract?.substring(0, 150) || doc.title,
        type: 'GENERAL',
        source_ids: [doc.citationId || `P${index + 1}`]
      })),
    clinical_trials: trialsWithCitation
      .map((doc, index) => ({
        summary: doc.title,
        status: doc.status,
        location_relevant: doc.isLocationRelevant,
        contact: doc.contacts?.[0]
          ? `${doc.contacts[0].name}${doc.contacts[0].email ? ` (${doc.contacts[0].email})` : ''}`
          : '',
        source_ids: [doc.citationId || `T${index + 1}`]
      })),
    key_researchers: [],
    recommendations:
      `Based on the retrieved research, please review the sources listed and consult your healthcare provider for personalized guidance on ${disease}.`,
    follow_up_suggestions: [
      `What are the latest treatments for ${disease}?`,
      'Are there any recruiting clinical trials I can join?',
      'What side effects should I be aware of?'
    ],
    confidence_breakdown: confidenceBreakdown
  };
}

function buildPlainTextSummary(answer, stats) {
  const parts = [];
  if (answer.condition_overview) {
    parts.push(answer.condition_overview);
  }
  if (stats.totalCandidates) {
    parts.push(
      `\n\n[Analyzed ${stats.totalCandidates} research candidates from PubMed, OpenAlex, and ClinicalTrials.gov - showing top ${stats.rerankedTo} most relevant.]`
    );
  }

  return parts.join('');
}

function validateAnswerCitations(answer, sourceIndex) {
  const validCitationIds = new Set(Object.keys(sourceIndex || {}));
  if (!validCitationIds.size) {
    return { isValid: true, answer };
  }

  const sanitizeSourceIds = (ids) =>
    (Array.isArray(ids) ? ids : [])
      .map((id) => String(id))
      .filter((id) => validCitationIds.has(id));

  let hasInvalidCitation = false;

  const researchInsights = Array.isArray(answer?.research_insights)
    ? answer.research_insights.map((insight) => {
        const nextSourceIds = sanitizeSourceIds(insight?.source_ids);
        if (Array.isArray(insight?.source_ids) && nextSourceIds.length !== insight.source_ids.length) {
          hasInvalidCitation = true;
        }
        return {
          ...insight,
          source_ids: nextSourceIds
        };
      })
    : [];

  const clinicalTrials = Array.isArray(answer?.clinical_trials)
    ? answer.clinical_trials.map((trial) => {
        const nextSourceIds = sanitizeSourceIds(trial?.source_ids);
        if (Array.isArray(trial?.source_ids) && nextSourceIds.length !== trial.source_ids.length) {
          hasInvalidCitation = true;
        }
        return {
          ...trial,
          source_ids: nextSourceIds
        };
      })
    : [];

  const confidenceBreakdown = Array.isArray(answer?.confidence_breakdown)
    ? answer.confidence_breakdown
        .map((entry) => {
          const sourceId = String(entry?.source_id || '').toUpperCase();
          if (!sourceId || !validCitationIds.has(sourceId)) {
            if (sourceId) {
              hasInvalidCitation = true;
            }
            return null;
          }

          return {
            source_id: sourceId,
            title: entry?.title || sourceId,
            relevance_score: Number(entry?.relevance_score || 0),
            credibility_score: Number(entry?.credibility_score || 0),
            recency_score: Number(entry?.recency_score || 0),
            composite_score: Number(entry?.composite_score || 0)
          };
        })
        .filter(Boolean)
    : [];

  const hasMissingInsightCitations = researchInsights.some((insight) => !insight.source_ids?.length);
  const hasMissingTrialCitations = clinicalTrials.some((trial) => !trial.source_ids?.length);

  if (hasInvalidCitation || hasMissingInsightCitations || hasMissingTrialCitations) {
    return {
      isValid: false,
      reason: 'Structured answer citation IDs were missing or not present in source index',
      answer
    };
  }

  return {
    isValid: true,
    answer: {
      ...answer,
      research_insights: researchInsights,
      clinical_trials: clinicalTrials,
      confidence_breakdown: confidenceBreakdown
    }
  };
}
