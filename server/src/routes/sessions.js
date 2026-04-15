import express from 'express';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import SourceDoc from '../models/SourceDoc.js';
import Analytics from '../models/Analytics.js';

const router = express.Router();
const ALLOWED_SEX_VALUES = new Set(['Male', 'Female', 'Other']);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLocation(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    city: normalizeText(input.city),
    country: normalizeText(input.country)
  };
}

function normalizeDemographics(value) {
  const input = value && typeof value === 'object' ? value : {};

  let age = null;
  if (input.age !== undefined && input.age !== null && String(input.age).trim() !== '') {
    const parsedAge = Number(input.age);
    if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      return { error: 'Age must be a valid number between 0 and 120.' };
    }
    age = parsedAge;
  }

  let sex = null;
  const rawSex = normalizeText(input.sex);
  if (rawSex) {
    const canonicalSex = rawSex[0].toUpperCase() + rawSex.slice(1).toLowerCase();
    if (!ALLOWED_SEX_VALUES.has(canonicalSex)) {
      return { error: 'Sex must be Male, Female, or Other.' };
    }
    sex = canonicalSex;
  }

  return {
    value: {
      age,
      sex
    }
  };
}

function hasValidSessionId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function orderSourceIds(sourceIndex = {}, usedSourceIds = []) {
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

  // Keep citation order first, then append uncited used sources.
  (usedSourceIds || []).forEach((sourceId) => {
    const normalizedId = String(sourceId);
    if (!seenIds.has(normalizedId)) {
      orderedIds.push(normalizedId);
      seenIds.add(normalizedId);
    }
  });

  return orderedIds;
}

function attachCitations(orderedIds, sourceDocs, sourceIndex = {}) {
  const sourceById = new Map(sourceDocs.map((doc) => [String(doc._id), doc]));
  const idToCitation = new Map(
    Object.entries(sourceIndex)
      .filter(([, sourceId]) => sourceId)
      .map(([citationId, sourceId]) => [String(sourceId), String(citationId)])
  );

  return orderedIds
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
}

router.post('/', async (req, res, next) => {
  try {
    const disease = normalizeText(req.body?.disease);
    const intent = normalizeText(req.body?.intent);
    const location = normalizeLocation(req.body?.location);
    const demographicsResult = normalizeDemographics(req.body?.demographics);

    if (!disease) {
      return res.status(400).json({ error: 'Disease is required' });
    }

    if (demographicsResult.error) {
      return res.status(400).json({ error: demographicsResult.error });
    }

    const session = await Session.create({
      disease,
      intent,
      location,
      demographics: demographicsResult.value
    });

    try {
      await Analytics.create({
        event: 'session_start',
        disease: disease.toLowerCase(),
        sessionId: session._id
      });
    } catch (analyticsErr) {
      console.error('Analytics session_start logging error:', analyticsErr.message);
    }

    return res.status(201).json({ session });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!hasValidSessionId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

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
    if (!hasValidSessionId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

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
      const orderedIds = orderSourceIds(sourceIndex, latestMessage.usedSourceIds || []);

      if (orderedIds.length === 0) {
        return res.json({ sources: [] });
      }

      const sourceDocs = await SourceDoc.find({ _id: { $in: orderedIds } }).lean();
      const sources = attachCitations(orderedIds, sourceDocs, sourceIndex);

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

router.get('/:id/sources/:messageId', async (req, res, next) => {
  try {
    if (!hasValidSessionId(req.params.id) || !hasValidSessionId(req.params.messageId)) {
      return res.status(400).json({ error: 'Invalid session or message id' });
    }

    const message = await Message.findOne(
      {
        _id: req.params.messageId,
        sessionId: req.params.id,
        role: 'assistant'
      },
      { usedSourceIds: 1, sourceIndex: 1 }
    ).lean();

    if (!message) {
      return res.status(404).json({ error: 'Assistant message not found' });
    }

    const sourceIndex = message.sourceIndex || {};
    const orderedIds = orderSourceIds(sourceIndex, message.usedSourceIds || []);

    if (!orderedIds.length) {
      return res.json({ messageId: req.params.messageId, sources: [] });
    }

    const sourceDocs = await SourceDoc.find({ _id: { $in: orderedIds } }).lean();
    const sources = attachCitations(orderedIds, sourceDocs, sourceIndex);

    return res.json({ messageId: req.params.messageId, sources });
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
    if (!hasValidSessionId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const deletedSession = await Session.findByIdAndDelete(req.params.id);
    if (!deletedSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await Promise.all([
      Message.deleteMany({ sessionId: req.params.id }),
      Analytics.deleteMany({ sessionId: req.params.id })
    ]);

    return res.json({ message: 'Session deleted' });
  } catch (err) {
    return next(err);
  }
});

export default router;
