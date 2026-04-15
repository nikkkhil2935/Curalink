import express from 'express';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { runRetrievalPipeline } from '../services/pipeline/orchestrator.js';

const router = express.Router();

router.post('/sessions/:id/query', async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const cleanedMessage = message.trim();

    const conversationHistory = await Message.find({ sessionId: session._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    await Message.create({
      sessionId: session._id,
      role: 'user',
      text: cleanedMessage
    });

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

    const assistantMessage = await Message.create({
      sessionId: session._id,
      role: 'assistant',
      text: responseText,
      usedSourceIds: contextDocs.map((doc) => doc.id),
      sourceIndex,
      retrievalStats: stats,
      intentType,
      contextBadge,
      structuredAnswer
    });

    await Session.findByIdAndUpdate(req.params.id, {
      $inc: { messageCount: 2 },
      $push: { queryHistory: expandedQuery.fullQuery },
      updatedAt: new Date()
    });

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
