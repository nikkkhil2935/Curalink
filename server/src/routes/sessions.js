import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import SourceDoc from '../models/SourceDoc.js';
import Analytics from '../models/Analytics.js';
import logger from '../lib/logger.js';
import { buildInsightsPayload } from '../services/sessionInsights.js';
import { generateSessionBrief } from '../services/briefGenerator.js';
import {
  insightsResponseCache,
  invalidateInsightsCache,
  setInsightsCache
} from '../middleware/insightsCache.js';
import { invalidateSessionQueryCache } from '../services/queryResultCache.js';

const router = express.Router();
export const bookmarksRouter = express.Router();
const ALLOWED_SEX_VALUES = new Set(['Male', 'Female', 'Other']);
const LLM_SERVICE_URL = String(process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');

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

  const ageRange = normalizeText(input.ageRange);
  const conditions = (Array.isArray(input.conditions) ? input.conditions : String(input.conditions || '').split(','))
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .slice(0, 10);

  return {
    value: {
      age,
      ageRange,
      sex,
      conditions
    }
  };
}

function hasValidSessionId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncateText(value, maxLength = 180) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function buildLikeRegex(rawQuery) {
  const terms = normalizeText(rawQuery)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);

  if (!terms.length) {
    return null;
  }

  const pattern = `${terms.map((term) => `(?=.*${escapeRegExp(term)})`).join('')}.*`;
  return new RegExp(pattern, 'i');
}

function buildMessageSnippet(message) {
  if (message?.role === 'assistant') {
    const overview = normalizeText(message?.structuredAnswer?.condition_overview || '');
    if (overview) {
      return truncateText(overview, 220);
    }
  }

  return truncateText(message?.text || '', 220);
}

function buildConfidenceByCitationMap(confidenceBreakdown = []) {
  const map = new Map();

  (Array.isArray(confidenceBreakdown) ? confidenceBreakdown : []).forEach((entry) => {
    const citationId = normalizeText(entry?.source_id).toUpperCase();
    if (!citationId || map.has(citationId)) {
      return;
    }

    map.set(citationId, {
      source_id: citationId,
      title: normalizeText(entry?.title),
      relevance_score: Number(entry?.relevance_score || 0),
      credibility_score: Number(entry?.credibility_score || 0),
      recency_score: Number(entry?.recency_score || 0),
      composite_score: Number(entry?.composite_score || 0)
    });
  });

  return map;
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

function attachCitations(orderedIds, sourceDocs, sourceIndex = {}, confidenceBreakdown = []) {
  const sourceById = new Map(sourceDocs.map((doc) => [String(doc._id), doc]));
  const idToCitation = new Map(
    Object.entries(sourceIndex)
      .filter(([, sourceId]) => sourceId)
      .map(([citationId, sourceId]) => [String(sourceId), String(citationId)])
  );
  const confidenceByCitation = buildConfidenceByCitationMap(confidenceBreakdown);

  return orderedIds
    .map((sourceId) => {
      const doc = sourceById.get(String(sourceId));
      if (!doc) {
        return null;
      }

      const citationId = idToCitation.get(String(sourceId)) || null;
      const fallbackConfidence = {
        source_id: citationId || String(doc._id),
        title: doc.title || citationId || String(doc._id),
        relevance_score: Number(doc.relevanceScore ?? doc.lastRelevanceScore ?? doc.finalScore ?? 0),
        credibility_score: Number(doc.sourceCredibility ?? 0),
        recency_score: Number(doc.recencyScore ?? 0),
        composite_score: Number(doc.finalScore ?? doc.lastRelevanceScore ?? 0)
      };

      return {
        ...doc,
        id: String(doc._id),
        citationId,
        confidence_breakdown: citationId
          ? confidenceByCitation.get(String(citationId).toUpperCase()) || fallbackConfidence
          : fallbackConfidence
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
      logger.error(`Analytics session_start logging error: ${analyticsErr.message}`);
    }

    return res.status(201).json({ session });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!hasValidSessionId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const existingSession = await Session.findById(req.params.id);
    if (!existingSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updates = {};

    if (req.body?.intent !== undefined) {
      updates.intent = normalizeText(req.body.intent);
    }

    if (req.body?.location !== undefined) {
      const incomingLocation = req.body.location && typeof req.body.location === 'object'
        ? req.body.location
        : {};
      const mergedLocation = {
        ...(existingSession.location || {}),
        ...incomingLocation
      };
      updates.location = normalizeLocation(mergedLocation);
    }

    if (req.body?.demographics !== undefined) {
      const incomingDemographics = req.body.demographics && typeof req.body.demographics === 'object'
        ? req.body.demographics
        : {};
      const mergedDemographics = {
        ...(existingSession.demographics || {}),
        ...incomingDemographics
      };
      const demographicsResult = normalizeDemographics(mergedDemographics);
      if (demographicsResult.error) {
        return res.status(400).json({ error: demographicsResult.error });
      }

      updates.demographics = demographicsResult.value;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid session fields provided for update.' });
    }

    updates.updatedAt = new Date();

    if (updates.intent !== undefined) {
      updates.title = `${existingSession.disease}${updates.intent ? ` - ${updates.intent}` : ''}`;
    }

    const session = await Session.findByIdAndUpdate(req.params.id, updates, { new: true });

    invalidateInsightsCache(req.params.id);
    invalidateSessionQueryCache(req.params.id);

    return res.json({ session });
  } catch (err) {
    return next(err);
  }
});

router.get('/history/search', async (req, res, next) => {
  try {
    const query = normalizeText(req.query.q);
    const requestedLimit = Number.parseInt(String(req.query.limit || '20'), 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(50, requestedLimit))
      : 20;

    if (!query) {
      return res.json({ query: '', limit, results: [] });
    }

    const likeRegex = buildLikeRegex(query);
    if (!likeRegex) {
      return res.json({ query, limit, results: [] });
    }

    const rawMatches = await Message.aggregate([
      {
        $match: {
          $or: [
            { text: likeRegex },
            { 'structuredAnswer.condition_overview': likeRegex },
            { 'structuredAnswer.recommendations': likeRegex },
            { 'structuredAnswer.research_insights.insight': likeRegex },
            { 'structuredAnswer.clinical_trials.summary': likeRegex }
          ]
        }
      },
      {
        $lookup: {
          from: 'sessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'session'
        }
      },
      { $unwind: '$session' },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          sessionId: 1,
          role: 1,
          text: 1,
          structuredAnswer: 1,
          createdAt: 1,
          sessionTitle: '$session.title',
          disease: '$session.disease'
        }
      }
    ]);

    const results = rawMatches.map((entry) => ({
      sessionId: String(entry.sessionId),
      sessionTitle: entry.sessionTitle || '',
      disease: entry.disease || '',
      messageId: String(entry._id),
      role: entry.role,
      text: buildMessageSnippet(entry),
      createdAt: entry.createdAt
    }));

    return res.json({ query, limit, results });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/messages/:msgId/bookmark', async (req, res, next) => {
  try {
    if (!hasValidSessionId(req.params.id) || !hasValidSessionId(req.params.msgId)) {
      return res.status(400).json({ error: 'Invalid session or message id' });
    }

    const message = await Message.findOne({
      _id: req.params.msgId,
      sessionId: req.params.id,
      role: 'assistant'
    });

    if (!message) {
      return res.status(404).json({ error: 'Assistant message not found' });
    }

    message.isBookmarked = !Boolean(message.isBookmarked);
    message.bookmarkedAt = message.isBookmarked ? new Date() : null;
    await message.save();

    return res.json({
      messageId: String(message._id),
      sessionId: String(message.sessionId),
      isBookmarked: message.isBookmarked,
      bookmarkedAt: message.bookmarkedAt
    });
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

router.get('/:id/conflicts', async (req, res, next) => {
  try {
    if (!hasValidSessionId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const sessionExists = await Session.exists({ _id: req.params.id });
    if (!sessionExists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const assistantMessages = await Message.find(
      {
        sessionId: req.params.id,
        role: 'assistant',
        conflicts: { $exists: true, $ne: [] }
      },
      { conflicts: 1, createdAt: 1 }
    )
      .sort({ createdAt: 1 })
      .lean();

    const severityPriority = { low: 1, medium: 2, high: 3 };
    const outcomeMap = new Map();
    let totalConflicts = 0;

    assistantMessages.forEach((message) => {
      (message?.conflicts || []).forEach((conflict) => {
        const outcomePhrase = normalizeText(conflict?.outcomePhrase);
        if (!outcomePhrase) {
          return;
        }

        totalConflicts += 1;

        if (!outcomeMap.has(outcomePhrase)) {
          outcomeMap.set(outcomePhrase, {
            outcomePhrase,
            count: 0,
            sources: [],
            maxSeverity: 'low',
            maxConflictScore: 0
          });
        }

        const group = outcomeMap.get(outcomePhrase);
        group.count += 1;
        group.maxConflictScore = Math.max(group.maxConflictScore, Number(conflict?.conflictScore || 0));

        if (
          severityPriority[String(conflict?.severity || 'low')] >
          severityPriority[group.maxSeverity]
        ) {
          group.maxSeverity = String(conflict?.severity || 'low');
        }

        const sourceA =
          conflict?.sourceA && typeof conflict.sourceA === 'object'
            ? conflict.sourceA
            : { title: String(conflict?.sourceA || '') };
        const sourceB =
          conflict?.sourceB && typeof conflict.sourceB === 'object'
            ? conflict.sourceB
            : { title: String(conflict?.sourceB || '') };

        group.sources.push({
          sourceA: sourceA.title || null,
          sourceB: sourceB.title || null,
          conflictScore: Number(conflict?.conflictScore || 0),
          severity: String(conflict?.severity || 'low'),
          timestamp: message?.createdAt || null
        });
      });
    });

    const outcomeGroups = Array.from(outcomeMap.values())
      .sort((left, right) => right.maxConflictScore - left.maxConflictScore)
      .map((group) => ({
        outcomePhrase: group.outcomePhrase,
        count: group.count,
        sources: group.sources,
        maxSeverity: group.maxSeverity
      }));

    return res.json({ totalConflicts, outcomeGroups });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/brief/generate', async (req, res, next) => {
  try {
    if (!hasValidSessionId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const brief = await generateSessionBrief(req.params.id);
    return res.json({ brief, version: Number(brief?.version || 0) });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/brief', async (req, res, next) => {
  try {
    if (!hasValidSessionId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const session = await Session.findById(req.params.id).select('brief').lean();
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session?.brief?.generatedAt) {
      return res.status(404).json({ error: 'Brief has not been generated yet.' });
    }

    return res.json({ brief: session.brief });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/insights', insightsResponseCache, async (req, res, next) => {
  try {
    if (!hasValidSessionId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const session = await Session.findById(req.params.id).select('_id').lean();
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const latestAssistant = await Message.findOne(
      {
        sessionId: req.params.id,
        role: 'assistant',
        structuredAnswer: { $ne: null }
      },
      {
        structuredAnswer: 1,
        trace: 1,
        retrievalStats: 1,
        createdAt: 1
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    const payload = buildInsightsPayload(req.params.id, latestAssistant);

    setInsightsCache(req.params.id, payload);
    return res.json(payload);
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
        { usedSourceIds: 1, sourceIndex: 1, 'structuredAnswer.confidence_breakdown': 1 }
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
      const sources = attachCitations(
        orderedIds,
        sourceDocs,
        sourceIndex,
        latestMessage.structuredAnswer?.confidence_breakdown || []
      );

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
      { usedSourceIds: 1, sourceIndex: 1, 'structuredAnswer.confidence_breakdown': 1 }
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
    const sources = attachCitations(
      orderedIds,
      sourceDocs,
      sourceIndex,
      message.structuredAnswer?.confidence_breakdown || []
    );

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

    invalidateInsightsCache(req.params.id);
    invalidateSessionQueryCache(req.params.id);

    void axios
      .delete(`${LLM_SERVICE_URL}/pdf/session/${req.params.id}`, { timeout: 15000 })
      .catch((error) => {
        logger.warn(`Session ${req.params.id} deleted but PDF store cleanup failed: ${error?.message || error}`);
      });

    return res.json({ message: 'Session deleted' });
  } catch (err) {
    return next(err);
  }
});

bookmarksRouter.get('/bookmarks', async (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(String(req.query.limit || '200'), 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(500, requestedLimit))
      : 200;

    const [totalBookmarks, bookmarkedMessages] = await Promise.all([
      Message.countDocuments({ role: 'assistant', isBookmarked: true }),
      Message.find(
        { role: 'assistant', isBookmarked: true },
        {
          _id: 1,
          sessionId: 1,
          role: 1,
          text: 1,
          structuredAnswer: 1,
          createdAt: 1,
          bookmarkedAt: 1
        }
      )
        .sort({ bookmarkedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean()
    ]);

    if (!bookmarkedMessages.length) {
      return res.json({ totalBookmarks, groups: [] });
    }

    const sessionIds = Array.from(new Set(bookmarkedMessages.map((message) => String(message.sessionId))));
    const sessions = await Session.find(
      { _id: { $in: sessionIds } },
      { _id: 1, title: 1, disease: 1, updatedAt: 1 }
    ).lean();
    const sessionById = new Map(sessions.map((session) => [String(session._id), session]));

    const groupsMap = new Map();
    bookmarkedMessages.forEach((message) => {
      const sessionId = String(message.sessionId);
      const session = sessionById.get(sessionId);

      if (!session) {
        return;
      }

      if (!groupsMap.has(sessionId)) {
        groupsMap.set(sessionId, {
          sessionId,
          sessionTitle: session.title || session.disease || 'Untitled session',
          disease: session.disease || '',
          updatedAt: session.updatedAt || null,
          latestBookmarkAt: message.bookmarkedAt || message.createdAt || null,
          bookmarks: []
        });
      }

      const group = groupsMap.get(sessionId);
      const bookmarkDate = message.bookmarkedAt || message.createdAt || null;

      if (bookmarkDate && (!group.latestBookmarkAt || bookmarkDate > group.latestBookmarkAt)) {
        group.latestBookmarkAt = bookmarkDate;
      }

      group.bookmarks.push({
        messageId: String(message._id),
        role: message.role,
        text: buildMessageSnippet(message),
        createdAt: message.createdAt || null,
        bookmarkedAt: message.bookmarkedAt || null
      });
    });

    const groups = Array.from(groupsMap.values())
      .map((group) => ({
        sessionId: group.sessionId,
        sessionTitle: group.sessionTitle,
        disease: group.disease,
        updatedAt: group.updatedAt,
        bookmarks: group.bookmarks.sort((a, b) => {
          const aTime = new Date(a.bookmarkedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.bookmarkedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        })
      }))
      .sort((a, b) => {
        const aTime = new Date(a.bookmarks[0]?.bookmarkedAt || a.updatedAt || 0).getTime();
        const bTime = new Date(b.bookmarks[0]?.bookmarkedAt || b.updatedAt || 0).getTime();
        return bTime - aTime;
      });

    return res.json({ totalBookmarks, groups });
  } catch (err) {
    return next(err);
  }
});

export default router;
