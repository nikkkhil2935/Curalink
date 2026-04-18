import express from 'express';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { runRetrievalPipeline } from '../services/pipeline/orchestrator.js';
import { buildRAGContext, buildSystemPrompt } from '../services/pipeline/contextPackager.js';
import {
  callFusedLLM,
  generateSmartSuggestions,
  parseLLMResponse,
  retrievePdfContext
} from '../services/llm.js';
import { invalidateInsightsCache } from '../middleware/insightsCache.js';
import { gzipCompression } from '../middleware/gzipCompression.js';
import { applyHealthResponseContractPatch } from '../services/healthContract.js';
import { invalidateSessionInsightsCache } from '../services/insightsCache.js';
import { generateSessionBrief } from '../services/briefGenerator.js';
import logger from '../lib/logger.js';
import {
  getCachedQueryResult,
  setCachedQueryResult
} from '../services/queryResultCache.js';

const router = express.Router();
applyHealthResponseContractPatch();
router.use(gzipCompression());

const COMMON_MEDICAL_TOPICS = [
  'latest treatment guidelines',
  'contraindications and side effects',
  'dose adjustment in renal impairment',
  'recruiting clinical trials',
  'biomarkers and diagnostics',
  'meta-analysis evidence quality',
  'long-term outcome studies',
  'drug interaction risk'
];

function normalizeHistoryItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(-12);
}

function formatConversationHistory(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: String(message?.text || '').trim()
    }))
    .filter((entry) => entry.content)
    .slice(-4);
}

function buildAssistantTextFromStructuredAnswer(answer = {}) {
  const overview = String(answer?.condition_overview || '').trim();
  const recommendations = String(answer?.recommendations || '').trim();
  const topInsights = (Array.isArray(answer?.research_insights) ? answer.research_insights : [])
    .map((insight) => String(insight?.insight || '').trim())
    .filter(Boolean)
    .slice(0, 2);

  const blocks = [overview, ...topInsights, recommendations].filter(Boolean);
  if (!blocks.length) {
    return 'Please consult your healthcare provider for personalized guidance.';
  }

  return blocks.join('\n\n');
}

async function buildFusedQueryPayload({
  session,
  message,
  contextDocs,
  sourceIndex,
  evidenceStrength,
  patientProfile,
  conversationHistory
}) {
  const uploadedDocs = Array.isArray(session?.uploadedDocs) ? session.uploadedDocs : [];
  if (!uploadedDocs.length) {
    return {
      responseText: '',
      structuredAnswer: null,
      pdfContextUsed: false,
      pdfChunksUsed: []
    };
  }

  const pdfRetrieveResult = await retrievePdfContext({
    query: message,
    sessionId: String(session._id),
    topK: 6,
    focusAbnormal: false
  });

  if (!pdfRetrieveResult?.has_pdf_context) {
    return {
      responseText: '',
      structuredAnswer: null,
      pdfContextUsed: false,
      pdfChunksUsed: []
    };
  }

  const ragContext = buildRAGContext(contextDocs || [], session.disease, message, session);
  const llmData = await callFusedLLM({
    system_prompt: buildSystemPrompt(patientProfile?.promptContext || ''),
    user_prompt: message,
    session_id: String(session._id),
    pdf_context: pdfRetrieveResult.context_text,
    research_context: ragContext?.sourcesText || '',
    conversation_history: formatConversationHistory(conversationHistory),
    temperature: 0.3,
    max_tokens: 2048,
    model: 'llama-3.3-70b-versatile'
  });

  const structuredAnswer = parseLLMResponse(llmData, {
    allowedCitationIds: [...Object.keys(sourceIndex || {}), 'DOC'],
    contextDocs: contextDocs || [],
    disease: session?.disease,
    evidenceStrengthLabel: evidenceStrength?.label
  });

  return {
    responseText: buildAssistantTextFromStructuredAnswer(structuredAnswer),
    structuredAnswer,
    pdfContextUsed: true,
    pdfChunksUsed: Array.isArray(pdfRetrieveResult?.chunks) ? pdfRetrieveResult.chunks : []
  };
}

router.get('/suggestions', async (req, res, next) => {
  try {
    const partialQuery = String(req.query.q || '').trim();
    const requestedLimit = Number.parseInt(String(req.query.limit || '5'), 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(3, Math.min(5, requestedLimit))
      : 5;

    if (partialQuery.length < 2) {
      return res.json({ suggestions: [] });
    }

    const history = [];
    const sessionId = String(req.query.sessionId || '').trim();

    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      const session = await Session.findById(sessionId).select('disease queryHistory').lean();
      if (session?.disease) {
        history.push(`${session.disease} evidence update`);
      }
      history.push(...normalizeHistoryItems(session?.queryHistory));
    }

    if (history.length < 8) {
      const recentSessions = await Session.find({}, { disease: 1, queryHistory: 1 })
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean();

      recentSessions.forEach((session) => {
        if (session?.disease) {
          history.push(`${session.disease} research summary`);
        }

        normalizeHistoryItems(session?.queryHistory)
          .slice(-4)
          .forEach((item) => history.push(item));
      });
    }

    const suggestions = await generateSmartSuggestions({
      partialQuery,
      history: normalizeHistoryItems(history),
      commonTopics: COMMON_MEDICAL_TOPICS,
      limit
    });

    return res.json({ suggestions });
  } catch (err) {
    if (err?.response?.status === 503 || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT') {
      return res.status(503).json({ error: 'Suggestion service is currently unavailable.' });
    }

    return next(err);
  }
});

router.post('/sessions/:id/query', async (req, res, next) => {
  try {
    const requestStartedAt = Date.now();
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const rawMessage = typeof req.body?.message === 'string' ? req.body.message : '';

    if (!rawMessage.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const cleanedMessage = rawMessage.trim();

    const conversationHistory = await Message.find({ sessionId: session._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
    const chronologicalConversationHistory = [...conversationHistory].reverse();
    const hasUploadedDocs = Array.isArray(session.uploadedDocs) && session.uploadedDocs.length > 0;

    let pipelineResult = hasUploadedDocs ? null : getCachedQueryResult(session._id, cleanedMessage);
    if (pipelineResult) {
      pipelineResult.stats = {
        ...(pipelineResult.stats || {}),
        cacheHit: true,
        timeTakenMs: Date.now() - requestStartedAt
      };

      const cachedPipelineTimings = Array.isArray(pipelineResult?.trace?.pipeline_timings)
        ? pipelineResult.trace.pipeline_timings
        : [];
      pipelineResult.trace = {
        ...(pipelineResult.trace || {}),
        pipeline_timings: [
          ...cachedPipelineTimings,
          {
            stage: 'query_response_cache_hit',
            duration_ms: Date.now() - requestStartedAt
          }
        ]
      };
    } else {
      const freshPipelineResult = await runRetrievalPipeline(session, cleanedMessage, chronologicalConversationHistory);
      pipelineResult = {
        ...freshPipelineResult,
        stats: {
          ...(freshPipelineResult.stats || {}),
          cacheHit: false
        }
      };

      if (!hasUploadedDocs) {
        setCachedQueryResult(session._id, cleanedMessage, pipelineResult);
      }
    }

    const {
      responseText,
      structuredAnswer,
      contextDocs,
      evidenceDocs,
      conflicts,
      stats,
      evidenceStrength,
      intentType,
      expandedQuery,
      contextBadge,
      patientProfile,
      sourceIndex,
      trace
    } = pipelineResult;

    let finalResponseText = responseText;
    let finalStructuredAnswer = structuredAnswer;
    let pdfContextUsed = false;
    let pdfChunksUsed = [];

    if (hasUploadedDocs) {
      try {
        const fusedResult = await buildFusedQueryPayload({
          session,
          message: cleanedMessage,
          contextDocs,
          sourceIndex,
          evidenceStrength,
          patientProfile,
          conversationHistory: chronologicalConversationHistory
        });

        if (fusedResult?.pdfContextUsed && fusedResult?.structuredAnswer) {
          finalResponseText = fusedResult.responseText || finalResponseText;
          finalStructuredAnswer = fusedResult.structuredAnswer;
          pdfContextUsed = true;
          pdfChunksUsed = Array.isArray(fusedResult.pdfChunksUsed) ? fusedResult.pdfChunksUsed : [];
        }
      } catch (fusedError) {
        logger.warn(`Fused PDF generation fallback to standard path: ${fusedError?.message || fusedError}`);
      }
    }

    const createMessagesAndUpdateSession = async (dbSession = null) => {
      const writeOptions = dbSession ? { session: dbSession, ordered: true } : { ordered: true };

      const createdMessages = await Message.create(
        [
          {
            sessionId: session._id,
            role: 'user',
            text: cleanedMessage
          },
          {
            sessionId: session._id,
            role: 'assistant',
            text: finalResponseText,
            usedSourceIds: contextDocs.map((doc) => doc.id),
            sourceIndex,
            pdfContextUsed,
            pdfChunksUsed,
            retrievalStats: stats,
            intentType,
            contextBadge,
            conflicts: Array.isArray(conflicts) ? conflicts : [],
            structuredAnswer: finalStructuredAnswer,
            trace
          }
        ],
        writeOptions
      );

      await Session.findByIdAndUpdate(
        req.params.id,
        {
          $inc: { messageCount: 2 },
          $push: {
            queryHistory: {
              $each: [expandedQuery.fullQuery],
              $slice: -100
            }
          },
          updatedAt: new Date()
        },
        writeOptions
      );

      return createdMessages?.[1] || null;
    };

    let assistantMessage = null;
    const txnSession = await mongoose.startSession();
    try {
      let createdAssistantDoc = null;
      await txnSession.withTransaction(async () => {
        createdAssistantDoc = await createMessagesAndUpdateSession(txnSession);
      });

      assistantMessage = createdAssistantDoc?.toObject ? createdAssistantDoc.toObject() : createdAssistantDoc;
    } catch (txnError) {
      const unsupportedTransaction =
        /Transaction numbers are only allowed on a replica set/i.test(txnError?.message || '');

      if (!unsupportedTransaction) {
        throw txnError;
      }

      const createdAssistantDoc = await createMessagesAndUpdateSession();
      assistantMessage = createdAssistantDoc?.toObject ? createdAssistantDoc.toObject() : createdAssistantDoc;
    } finally {
      await txnSession.endSession();
    }

    invalidateInsightsCache(session._id);

    const idToCitation = Object.entries(sourceIndex || {}).reduce((acc, [citationId, sourceId]) => {
      if (sourceId) {
        acc[String(sourceId)] = String(citationId);
      }
      return acc;
    }, {});
    const confidenceByCitation = new Map(
      (assistantMessage?.structuredAnswer?.confidence_breakdown || [])
        .filter((entry) => entry?.source_id)
        .map((entry) => [String(entry.source_id).toUpperCase(), entry])
    );

    const sourceDocsForPanel = Array.isArray(evidenceDocs) && evidenceDocs.length
      ? evidenceDocs
      : (contextDocs || []);

    const sourcesWithCitations = sourceDocsForPanel.map((doc) => {
      const citationId = idToCitation[String(doc.id)] || null;
      const fallbackConfidence = {
        source_id: citationId || String(doc.id || ''),
        title: String(doc.title || citationId || doc.id || ''),
        relevance_score: Number(doc.relevanceScore ?? doc.lastRelevanceScore ?? doc.finalScore ?? 0),
        credibility_score: Number(doc.sourceCredibility ?? 0),
        recency_score: Number(doc.recencyScore ?? 0),
        composite_score: Number(doc.finalScore ?? doc.lastRelevanceScore ?? 0)
      };

      return {
        ...doc,
        citationId,
        confidence_breakdown: citationId
          ? confidenceByCitation.get(String(citationId).toUpperCase()) || fallbackConfidence
          : fallbackConfidence
      };
    });

    invalidateSessionInsightsCache(session._id);

    // Trigger brief refresh without blocking the query response path.
    generateSessionBrief(req.params.id).catch((error) => {
      logger.error(`Brief regen failed for session ${req.params.id}: ${error.message}`);
    });

    return res.json({
      message: assistantMessage,
      sources: sourcesWithCitations,
      conflicts: Array.isArray(conflicts) ? conflicts : [],
      patientProfile,
      pdfContextUsed: Boolean(assistantMessage?.pdfContextUsed),
      pdfChunksUsed: Array.isArray(assistantMessage?.pdfChunksUsed) ? assistantMessage.pdfChunksUsed : [],
      stats,
      evidenceStrength,
      sourceIndex,
      trace
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
