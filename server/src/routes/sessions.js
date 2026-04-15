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
    const mode = String(req.query.mode || '').toLowerCase();

    if (mode === 'latest') {
      const latestMessage = await Message.findOne(
        {
          sessionId: req.params.id,
          role: 'assistant',
          usedSourceIds: { $exists: true, $ne: [] }
        },
        { usedSourceIds: 1, sourceIndex: 1 }
      )
        .sort({ createdAt: -1 })
        .lean();

      if (!latestMessage) {
        return res.json({ sources: [] });
      }

      const sourceIndex = latestMessage.sourceIndex || {};
      const orderedIds = [];
      const seenIds = new Set();

      const indexEntries = Object.entries(sourceIndex)
        .filter(([, sourceId]) => sourceId)
        .map(([citationId, sourceId]) => {
          const match = String(citationId).match(/^([PT])(\d+)$/i);
          return {
            citationId: String(citationId),
            sourceId: String(sourceId),
            type: match ? match[1].toUpperCase() : 'Z',
            num: match ? Number(match[2]) : Number.POSITIVE_INFINITY
          };
        });

      if (indexEntries.length) {
        const typeOrder = (type) => (type === 'P' ? 0 : type === 'T' ? 1 : 2);
        indexEntries.sort((a, b) => {
          const typeDiff = typeOrder(a.type) - typeOrder(b.type);
          if (typeDiff !== 0) return typeDiff;
          const numDiff = a.num - b.num;
          if (numDiff !== 0) return numDiff;
          return a.citationId.localeCompare(b.citationId);
        });

        indexEntries.forEach((entry) => {
          if (!seenIds.has(entry.sourceId)) {
            orderedIds.push(entry.sourceId);
            seenIds.add(entry.sourceId);
          }
        });
      }

      // Keep latest citation order first, then append any uncited used sources.
      (latestMessage.usedSourceIds || []).forEach((sourceId) => {
        const normalizedId = String(sourceId);
        if (!seenIds.has(normalizedId)) {
          orderedIds.push(normalizedId);
          seenIds.add(normalizedId);
        }
      });

      if (orderedIds.length === 0) {
        return res.json({ sources: [] });
      }

      const sourceDocs = await SourceDoc.find({ _id: { $in: orderedIds } }).lean();
      const sourceById = new Map(sourceDocs.map((doc) => [String(doc._id), doc]));

      const idToCitation = new Map(
        Object.entries(sourceIndex)
          .filter(([, sourceId]) => sourceId)
          .map(([citationId, sourceId]) => [String(sourceId), String(citationId)])
      );

      const sources = orderedIds
        .map((sourceId) => {
          const doc = sourceById.get(String(sourceId));
          if (!doc) {
            return null;
          }
          return {
            ...doc,
            id: String(doc._id),
            citationId: idToCitation.get(String(sourceId)) || null
          };
        })
        .filter(Boolean);

      return res.json({ sources });
    }

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
