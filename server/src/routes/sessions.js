import express from 'express';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import SourceDoc from '../models/SourceDoc.js';
import Analytics from '../models/Analytics.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { disease, intent, location, demographics } = req.body;

    if (!disease || !disease.trim()) {
      return res.status(400).json({ error: 'Disease is required' });
    }

    const session = await Session.create({
      disease: disease.trim(),
      intent: intent?.trim() || '',
      location: location || {},
      demographics: demographics || {}
    });

    await Analytics.create({
      event: 'session_start',
      disease: disease.toLowerCase(),
      sessionId: session._id
    });

    return res.status(201).json({ session });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = await Message.find({ sessionId: req.params.id }).sort({ createdAt: 1 });

    return res.json({ session, messages });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/sources', async (req, res, next) => {
  try {
    const messages = await Message.find({ sessionId: req.params.id }, { usedSourceIds: 1 });
    const sourceIds = new Set();

    messages.forEach((msg) => {
      (msg.usedSourceIds || []).forEach((id) => sourceIds.add(id));
    });

    if (sourceIds.size === 0) {
      return res.json({ sources: [] });
    }

    const sources = await SourceDoc.find({ _id: { $in: Array.from(sourceIds) } }).sort({ updatedAt: -1 });

    return res.json({ sources });
  } catch (err) {
    return next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const sessions = await Session.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('disease intent location title messageCount createdAt updatedAt');

    return res.json({ sessions });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Session.findByIdAndDelete(req.params.id);
    await Message.deleteMany({ sessionId: req.params.id });

    return res.json({ message: 'Session deleted' });
  } catch (err) {
    return next(err);
  }
});

export default router;
