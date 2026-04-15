import express from 'express';
import Analytics from '../models/Analytics.js';
import SourceDoc from '../models/SourceDoc.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';

const router = express.Router();

router.get('/top-diseases', async (req, res, next) => {
  try {
    const results = await Analytics.aggregate([
      { $match: { event: 'query', disease: { $exists: true, $ne: null } } },
      { $group: { _id: '$disease', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const diseases = results.map((entry) => ({
      name: entry._id,
      count: entry.count
    }));

    return res.json({
      diseases,
      // Backward compatibility for existing dashboard shape.
      topDiseases: diseases.map((entry) => ({
        disease: entry.name,
        count: entry.count
      }))
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/intent-breakdown', async (req, res, next) => {
  try {
    const results = await Analytics.aggregate([
      { $match: { event: 'query', intentType: { $exists: true, $ne: null } } },
      { $group: { _id: '$intentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return res.json({
      intents: results.map((entry) => ({
        name: entry._id,
        count: entry.count
      }))
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/source-stats', async (req, res, next) => {
  try {
    const results = await SourceDoc.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          totalUsed: { $sum: { $ifNull: ['$timesUsed', 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const sources = results.map((entry) => ({
      name: entry._id,
      count: entry.count,
      used: entry.totalUsed || 0
    }));

    const total = sources.reduce((sum, entry) => sum + entry.count, 0);

    return res.json({
      sources,
      total,
      // Backward compatibility for existing dashboard shape.
      distribution: sources.map((entry) => ({
        source: entry.name,
        count: entry.count,
        percentage: total > 0 ? Number(((entry.count / total) * 100).toFixed(2)) : 0
      }))
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/overview', async (req, res, next) => {
  try {
    const [totalSessions, totalQueries, totalSources, recentQueries, avgStats] = await Promise.all([
      Session.countDocuments(),
      Analytics.countDocuments({ event: 'query' }),
      SourceDoc.countDocuments(),
      Analytics.find({ event: 'query' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('disease intentType metadata createdAt')
        .lean(),
      Message.aggregate([
        {
          $match: {
            role: 'assistant',
            'retrievalStats.totalCandidates': { $gt: 0 }
          }
        },
        {
          $group: {
            _id: null,
            avgCandidates: { $avg: '$retrievalStats.totalCandidates' },
            avgReranked: { $avg: '$retrievalStats.rerankedTo' },
            avgTimeMs: { $avg: '$retrievalStats.timeTakenMs' }
          }
        }
      ])
    ]);

    const stats = avgStats[0] || {};

    return res.json({
      totalSessions,
      totalQueries,
      totalSources,
      avgCandidatesRetrieved: Math.round(stats.avgCandidates || 0),
      avgShownToUser: Math.round(stats.avgReranked || 0),
      avgResponseTimeSec: ((stats.avgTimeMs || 0) / 1000).toFixed(1),
      recentQueries: recentQueries.map((query) => ({
        disease: query.disease || 'Unknown',
        intentType: query.intentType || 'GENERAL',
        candidates: query.metadata?.stats?.totalCandidates || 0,
        time: query.createdAt
      }))
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/trial-status', async (req, res, next) => {
  try {
    const results = await SourceDoc.aggregate([
      { $match: { type: 'trial' } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return res.json({
      statuses: results.map((entry) => ({
        name: entry._id || 'Unknown',
        count: entry.count
      }))
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
