import express from 'express';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { runRetrievalPipeline } from '../services/pipeline/orchestrator.js';
<<<<<<< HEAD
import { gzipCompression } from '../middleware/gzipCompression.js';
import { invalidateSessionInsightsCache } from '../services/insightsCache.js';
import { applyHealthResponseContractPatch } from '../services/healthContract.js';
=======
import { generateSmartSuggestions } from '../services/llm.js';
import { invalidateInsightsCache } from '../middleware/insightsCache.js';
import {
  getCachedQueryResult,
  setCachedQueryResult
} from '../services/queryResultCache.js';
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

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

    let pipelineResult = getCachedQueryResult(session._id, cleanedMessage);
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
      const freshPipelineResult = await runRetrievalPipeline(session, cleanedMessage, conversationHistory.reverse());
      pipelineResult = {
        ...freshPipelineResult,
        stats: {
          ...(freshPipelineResult.stats || {}),
          cacheHit: false
        }
      };

      setCachedQueryResult(session._id, cleanedMessage, pipelineResult);
    }

    const {
      responseText,
      structuredAnswer,
      contextDocs,
      stats,
      evidenceStrength,
      intentType,
      expandedQuery,
      contextBadge,
      sourceIndex,
      trace
<<<<<<< HEAD
    } = await runRetrievalPipeline(session, cleanedMessage, conversationHistory.reverse());
=======
    } = pipelineResult;
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

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
            text: responseText,
            usedSourceIds: contextDocs.map((doc) => doc.id),
            sourceIndex,
            retrievalStats: stats,
            intentType,
            contextBadge,
            structuredAnswer,
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

<<<<<<< HEAD
    const sourcesWithCitations = (contextDocs || []).map((doc) => ({
      ...doc,
      citationId: idToCitation[String(doc.id)] || null
    }));
=======
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

    invalidateSessionInsightsCache(session._id);

    return res.json({
      message: assistantMessage,
      sources: sourcesWithCitations,
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
