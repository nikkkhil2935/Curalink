import cron from 'node-cron';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Analytics from '../models/Analytics.js';
import SourceDoc from '../models/SourceDoc.js';
import logger from '../lib/logger.js';

let snapshotJob = null;
let snapshotInProgress = false;
let connectedSnapshotListener = null;

async function captureAnalyticsSnapshot(reason = 'scheduled') {
  if (snapshotInProgress) {
    return;
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    snapshotInProgress = true;

    const [totalSessions, totalQueries, totalSources] = await Promise.all([
      Session.countDocuments(),
      Analytics.countDocuments({ event: 'query' }),
      SourceDoc.countDocuments()
    ]);

    await Analytics.create({
      event: 'system_snapshot',
      metadata: {
        totalSessions,
        totalQueries,
        totalSources,
        reason
      }
    });
  } catch (error) {
    logger.error('Analytics snapshot scheduler error:', error.message);
  } finally {
    snapshotInProgress = false;
  }
}

export function startAnalyticsScheduler() {
  const schedulerEnabled = (process.env.ANALYTICS_SCHEDULER_ENABLED || 'true').toLowerCase() !== 'false';
  if (!schedulerEnabled || snapshotJob) {
    return;
  }

  const cronExpr = process.env.ANALYTICS_SNAPSHOT_CRON || '0 * * * *';
  
  if (!cron.validate(cronExpr)) {
    logger.error(`Invalid ANALYTICS_SNAPSHOT_CRON: ${cronExpr}`);
    return;
  }

  snapshotJob = cron.schedule(cronExpr, () => {
    void captureAnalyticsSnapshot('scheduled');
  }, {
    timezone: process.env.TZ || 'UTC'
  });

  if (mongoose.connection.readyState === 1) {
    void captureAnalyticsSnapshot('startup');
    return;
  }

  if (!connectedSnapshotListener) {
    connectedSnapshotListener = () => {
      void captureAnalyticsSnapshot('startup_connected');
    };
    mongoose.connection.once('connected', connectedSnapshotListener);
  }
}

export function stopAnalyticsScheduler() {
  if (!snapshotJob) {
    return;
  }

  snapshotJob.stop();
  snapshotJob.destroy();
  snapshotJob = null;

  if (connectedSnapshotListener) {
    mongoose.connection.off('connected', connectedSnapshotListener);
    connectedSnapshotListener = null;
  }
}
