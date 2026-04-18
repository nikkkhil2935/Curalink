import express from 'express';
import mongoose from 'mongoose';
import {
<<<<<<< HEAD
  getIntentBreakdown,
  getOverviewAnalytics,
  getSessionBreakdownAnalytics,
=======
  getAnalyticsOverview,
  getIntentBreakdown,
  getSessionBreakdown,
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
  getSnapshots,
  getSourceStats,
  getTopDiseases,
  getTrialStatus
} from '../services/analyticsService.js';
<<<<<<< HEAD
import { gzipCompression } from '../middleware/gzipCompression.js';
=======
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

const router = express.Router();
router.use(gzipCompression());

function parseBoundedInteger(rawValue, fallback, min, max) {
  const parsed = Number.parseInt(String(rawValue ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function hasValidSessionId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

router.get('/overview', async (req, res, next) => {
  try {
    const overview = await getAnalyticsOverview({
      days: req.query.days,
      topIntentsLimit: req.query.topIntentsLimit
    });

    return res.json(overview);
  } catch (err) {
    return next(err);
  }
});

router.get('/sessions/:id/breakdown', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const breakdown = await getSessionBreakdown(req.params.id);

    if (!breakdown) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json(breakdown);
  } catch (err) {
    return next(err);
  }
});

router.get('/top-diseases', async (req, res, next) => {
  try {
<<<<<<< HEAD
    const response = await getTopDiseases(10);
=======
    const response = await getTopDiseases(req.query.limit);
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.get('/intent-breakdown', async (req, res, next) => {
  try {
    const response = await getIntentBreakdown();
    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.get('/source-stats', async (req, res, next) => {
  try {
    const response = await getSourceStats();
    return res.json(response);
<<<<<<< HEAD
  } catch (err) {
    return next(err);
  }
});

router.get('/overview', async (req, res, next) => {
  try {
    const days = parseBoundedInteger(req.query.days, 14, 1, 90);
    const response = await getOverviewAnalytics({ days });
    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.get('/sessions/:id/breakdown', async (req, res, next) => {
  try {
    if (!hasValidSessionId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const days = parseBoundedInteger(req.query.days, 14, 1, 90);
    const response = await getSessionBreakdownAnalytics(req.params.id, { days });

    if (!response) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json(response);
=======
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
  } catch (err) {
    return next(err);
  }
});

router.get('/trial-status', async (req, res, next) => {
  try {
    const response = await getTrialStatus();
    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.get('/snapshots', async (req, res, next) => {
  try {
<<<<<<< HEAD
    const limit = parseBoundedInteger(req.query.limit, 24, 1, 168);
    const response = await getSnapshots(limit);
=======
    const response = await getSnapshots(req.query.limit);
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

export default router;
