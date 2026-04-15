import express from 'express';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { runRetrievalPipeline } from '../services/pipeline/orchestrator.js';

const router = express.Router();

router.post('/sessions/:id/query', async (req, res, next) => {
  try {
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

    const {
      responseText,
      structuredAnswer,
      contextDocs,
      stats,
      evidenceStrength,
      intentType,
      expandedQuery,
      contextBadge,
      sourceIndex
    } = await runRetrievalPipeline(session, cleanedMessage, conversationHistory.reverse());

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
            structuredAnswer
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

    const idToCitation = Object.entries(sourceIndex || {}).reduce((acc, [citationId, sourceId]) => {
      if (sourceId) {
        acc[String(sourceId)] = String(citationId);
      }
      return acc;
    }, {});

    const sourcesWithCitations = (contextDocs || []).map((doc) => ({
      ...doc,
      citationId: idToCitation[String(doc.id)] || null
    }));

    return res.json({
      message: assistantMessage,
      sources: sourcesWithCitations,
      stats,
      evidenceStrength,
      sourceIndex
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
