import express from 'express';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import Analytics from '../models/Analytics.js';

const router = express.Router();

// Day 1 stub. Real retrieval + ranking pipeline will be added in Day 2/3.
router.post('/sessions/:id/query', async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await Message.create({
      sessionId: session._id,
      role: 'user',
      text: message.trim()
    });

    const assistantMessage = await Message.create({
      sessionId: session._id,
      role: 'assistant',
      text: `Research pipeline placeholder: received \"${message.trim()}\" for ${session.disease}. Full multi-source retrieval will be plugged in next.`,
      retrievalStats: {
        totalCandidates: 0,
        pubmedFetched: 0,
        openalexFetched: 0,
        ctFetched: 0,
        rerankedTo: 0,
        timeTakenMs: 0
      }
    });

    session.messageCount += 2;
    session.queryHistory = [...(session.queryHistory || []), message.trim()].slice(-10);
    session.updatedAt = new Date();
    await session.save();

    await Analytics.create({
      event: 'query',
      disease: session.disease.toLowerCase(),
      intentType: 'GENERAL',
      sessionId: session._id,
      metadata: {
        query: message.trim(),
        totalCandidates: 0
      }
    });

    return res.json({ message: assistantMessage, sources: [] });
  } catch (err) {
    return next(err);
  }
});

export default router;
