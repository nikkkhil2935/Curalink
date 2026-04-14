import express from 'express';
import Analytics from '../models/Analytics.js';
import SourceDoc from '../models/SourceDoc.js';

const router = express.Router();

router.get('/top-diseases', async (req, res, next) => {
  try {
    const topDiseases = await Analytics.aggregate([
      { $match: { event: 'query', disease: { $exists: true, $ne: null } } },
      { $group: { _id: '$disease', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return res.json({
      topDiseases: topDiseases.map((entry) => ({
        disease: entry._id,
        count: entry.count
      }))
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/source-stats', async (req, res, next) => {
  try {
    const sourceDistribution = await SourceDoc.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    const total = sourceDistribution.reduce((sum, entry) => sum + entry.count, 0);

    return res.json({
      total,
      distribution: sourceDistribution.map((entry) => ({
        source: entry._id,
        count: entry.count,
        percentage: total > 0 ? Number(((entry.count / total) * 100).toFixed(2)) : 0
      }))
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
