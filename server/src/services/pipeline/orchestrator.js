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
import Analytics from '../../models/Analytics.js';

export async function runRetrievalPipeline(session, userMessage, conversationHistory = []) {
  const startTime = Date.now();

  const intentType = classifyIntent(userMessage, session.intent);
  const strategy = getRetrievalStrategy(intentType);

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

  console.log(`Starting retrieval for query: "${expanded.fullQuery}"`);
  const [pubmedResults, openalexResults, ctResults] = await Promise.all([
    fetchFromPubMed(expanded.pubmedQuery, 200, strategy.pubmedSort),
    fetchFromOpenAlex(expanded.openalexQuery, 200),
    fetchFromClinicalTrials(expanded.ctCondition, expanded.ctIntervention, session.location, 100)
  ]);

  const stats = {
    pubmedFetched: pubmedResults.length,
    openalexFetched: openalexResults.length,
    ctFetched: ctResults.length,
    totalCandidates: pubmedResults.length + openalexResults.length + ctResults.length
  };

  const normalized = normalizeAndDeduplicate(pubmedResults, openalexResults, ctResults);

  if (!normalized.length) {
    const evidenceStrength = {
      label: 'LIMITED',
      emoji: 'LOW',
      description: 'No usable evidence returned from configured retrieval sources'
    };
    const structuredAnswer = createNoEvidenceStructuredAnswer(session.disease, userMessage);
    stats.rerankedTo = 0;
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
        noEvidence: true
      }
    }).catch((err) => {
      console.error('Analytics logging error:', err.message);
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
      sourceIndex: {}
    };
  }

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

  const ranked = await semanticRerank(expanded.fullQuery, semanticInput);

  const minTrialsForContext = ctResults.length > 0 ? (intentType === 'CLINICAL_TRIALS' ? 2 : 1) : 0;
  const contextDocs = selectForContext(ranked, 8, 5, { minTrials: minTrialsForContext });
  stats.rerankedTo = contextDocs.length;

  const evidenceStrength = computeEvidenceStrength(contextDocs);

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
      console.error('SourceDoc upsert error:', err.message);
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

  let structuredAnswer;
  try {
    const llmData = await callLLM(systemPrompt, userPrompt);
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
    console.error('LLM failed, using graceful fallback:', llmErr.message);
    structuredAnswer = createFallbackStructuredAnswer(contextDocs, session.disease, evidenceStrength, sourceIndex);
  }

  const responseText = buildPlainTextSummary(structuredAnswer, stats);

  stats.timeTakenMs = Date.now() - startTime;

  await Analytics.create({
    event: 'query',
    disease: session.disease.toLowerCase(),
    intentType,
    sessionId: session._id,
    metadata: {
      stats,
      queryExpanded: expanded.fullQuery,
      strategy
    }
  }).catch((err) => {
    console.error('Analytics logging error:', err.message);
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
    sourceIndex
  };
}

function createNoEvidenceStructuredAnswer(disease, userMessage) {
  return {
    condition_overview:
      `No grounded evidence could be retrieved for ${disease}. Please refine the query or broaden the condition context and try again.`,
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
    ]
  };
}

function createFallbackStructuredAnswer(docs, disease, evidenceStrength, sourceIndex = {}) {
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
    ]
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
      clinical_trials: clinicalTrials
    }
  };
}
