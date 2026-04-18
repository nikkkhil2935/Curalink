import Analytics from '../models/Analytics.js';
import SourceDoc from '../models/SourceDoc.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import {
  buildDateRange,
  buildInsightsPayload,
  buildLatencySummary,
  buildSourceDistribution,
  normalizeIntentLabel,
  toDayKey
} from './sessionInsights.js';

function parseInteger(value, { fallback, min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(parsed, max));
}

async function fetchLatencyValues(match = {}) {
  const rows = await Message.find(
    {
      role: 'assistant',
      'retrievalStats.timeTakenMs': { $gte: 0 },
      ...match
    },
    {
      'retrievalStats.timeTakenMs': 1
    }
  ).lean();

  return rows
    .map((row) => Number(row?.retrievalStats?.timeTakenMs))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

async function fetchTopIntents(limit = 5) {
  const safeLimit = parseInteger(limit, { fallback: 5, min: 1, max: 20 });

  const analyticsRows = await Analytics.aggregate([
    { $match: { event: 'query', intentType: { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$intentType', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: safeLimit }
  ]);

  if (analyticsRows.length > 0) {
    return analyticsRows.map((row) => ({
      intent: normalizeIntentLabel(row._id),
      count: Number(row.count || 0)
    }));
  }

  const messageRows = await Message.aggregate([
    { $match: { role: 'assistant', intentType: { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$intentType', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: safeLimit }
  ]);

  return messageRows.map((row) => ({
    intent: normalizeIntentLabel(row._id),
    count: Number(row.count || 0)
  }));
}

async function fetchDailyActivity(days = 14) {
  const { keys, startDate } = buildDateRange(days);

  const [sessionRows, queryRows] = await Promise.all([
    Session.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          sessions: { $sum: 1 }
        }
      }
    ]),
    Analytics.aggregate([
      { $match: { event: 'query', createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          queries: { $sum: 1 }
        }
      }
    ])
  ]);

  const queryCounts = new Map(queryRows.map((row) => [String(row._id), Number(row.queries || 0)]));
  if (queryCounts.size === 0) {
    const fallbackRows = await Message.aggregate([
      { $match: { role: 'assistant', createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          queries: { $sum: 1 }
        }
      }
    ]);

    fallbackRows.forEach((row) => {
      queryCounts.set(String(row._id), Number(row.queries || 0));
    });
  }

  const sessionCounts = new Map(sessionRows.map((row) => [String(row._id), Number(row.sessions || 0)]));

  return keys.map((date) => ({
    date,
    sessions: sessionCounts.get(date) || 0,
    queries: queryCounts.get(date) || 0
  }));
}

async function fetchSourceDistribution() {
  const rows = await SourceDoc.aggregate([
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        totalUsed: { $sum: { $ifNull: ['$timesUsed', 0] } }
      }
    }
  ]);

  return buildSourceDistribution(
    rows.map((row) => ({
      source: row._id || 'Unknown',
      count: Number(row.count || 0),
      used: Number(row.totalUsed || 0)
    }))
  );
}

async function fetchLegacyCandidateAverages() {
  const rows = await Message.aggregate([
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
        avgReranked: { $avg: '$retrievalStats.rerankedTo' }
      }
    }
  ]);

  return rows[0] || {};
}

export async function getAnalyticsOverview(options = {}) {
  const days = parseInteger(options.days, { fallback: 14, min: 1, max: 90 });
  const topIntentsLimit = parseInteger(options.topIntentsLimit, { fallback: 5, min: 1, max: 20 });

  const [
    totalSessions,
    totalQueries,
    totalSources,
    topIntents,
    dailyActivity,
    sourceDistribution,
    recentQueries,
    latencyValues,
    legacyCandidateAverages
  ] = await Promise.all([
    Session.countDocuments(),
    Analytics.countDocuments({ event: 'query' }),
    SourceDoc.countDocuments(),
    fetchTopIntents(topIntentsLimit),
    fetchDailyActivity(days),
    fetchSourceDistribution(),
    Analytics.find({ event: 'query' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('disease intentType metadata createdAt')
      .lean(),
    fetchLatencyValues(),
    fetchLegacyCandidateAverages()
  ]);

  const latency = buildLatencySummary(latencyValues);

  return {
    total_sessions: totalSessions,
    total_queries: totalQueries,
    avg_latency_ms: latency.avg_latency_ms,
    p95_latency_ms: latency.p95_latency_ms,
    top_intents: topIntents,
    daily_activity: dailyActivity,
    source_distribution: sourceDistribution.map((entry) => ({
      source: entry.source,
      count: entry.count,
      percentage: entry.percentage
    })),

    // Legacy shape maintained for existing analytics page consumers.
    totalSessions: totalSessions,
    totalQueries: totalQueries,
    totalSources: totalSources,
    avgCandidatesRetrieved: Math.round(Number(legacyCandidateAverages?.avgCandidates || 0)),
    avgShownToUser: Math.round(Number(legacyCandidateAverages?.avgReranked || 0)),
    avgResponseTimeSec: Number((latency.avg_latency_ms / 1000).toFixed(1)),
    recentQueries: recentQueries.map((query) => ({
      disease: query.disease || 'Unknown',
      intentType: normalizeIntentLabel(query.intentType),
      candidates: Number(query?.metadata?.stats?.totalCandidates || 0),
      time: query.createdAt
    }))
  };
}

export async function getTopDiseases(limit = 10) {
  const safeLimit = parseInteger(limit, { fallback: 10, min: 1, max: 25 });
  const rows = await Analytics.aggregate([
    { $match: { event: 'query', disease: { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$disease', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: safeLimit }
  ]);

  const diseases = rows.map((row) => ({
    name: String(row._id || 'Unknown'),
    count: Number(row.count || 0)
  }));

  return {
    diseases,
    topDiseases: diseases.map((entry) => ({
      disease: entry.name,
      count: entry.count
    }))
  };
}

export async function getIntentBreakdown() {
  const topIntents = await fetchTopIntents(20);

  return {
    intents: topIntents.map((entry) => ({
      name: entry.intent,
      count: entry.count
    })),
    top_intents: topIntents
  };
}

export async function getSourceStats() {
  const distribution = await fetchSourceDistribution();
  const total = distribution.reduce((sum, entry) => sum + entry.count, 0);

  const sources = distribution.map((entry) => ({
    name: entry.source,
    count: entry.count,
    used: entry.used
  }));

  return {
    sources,
    total,
    distribution: distribution.map((entry) => ({
      source: entry.source,
      count: entry.count,
      percentage: entry.percentage
    }))
  };
}

export async function getTrialStatus() {
  const rows = await SourceDoc.aggregate([
    { $match: { type: 'trial' } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } }
  ]);

  return {
    statuses: rows.map((row) => ({
      name: row._id || 'Unknown',
      count: Number(row.count || 0)
    }))
  };
}

export async function getSnapshots(limit = 24) {
  const safeLimit = parseInteger(limit, { fallback: 24, min: 1, max: 168 });

  const records = await Analytics.find(
    { event: 'system_snapshot' },
    { metadata: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();

  return {
    snapshots: records
      .reverse()
      .map((record) => ({
        time: record.createdAt,
        totalSessions: Number(record?.metadata?.totalSessions || 0),
        totalQueries: Number(record?.metadata?.totalQueries || 0),
        totalSources: Number(record?.metadata?.totalSources || 0)
      }))
  };
}

export async function getSessionBreakdown(sessionId) {
  const session = await Session.findById(sessionId)
    .select('disease intent title location demographics messageCount createdAt updatedAt')
    .lean();

  if (!session) {
    return null;
  }

  const [messages, queryEvents] = await Promise.all([
    Message.find(
      { sessionId },
      {
        role: 1,
        text: 1,
        intentType: 1,
        structuredAnswer: 1,
        retrievalStats: 1,
        sourceIndex: 1,
        usedSourceIds: 1,
        trace: 1,
        createdAt: 1
      }
    )
      .sort({ createdAt: 1 })
      .lean(),
    Analytics.find(
      { event: 'query', sessionId },
      {
        intentType: 1,
        metadata: 1,
        createdAt: 1
      }
    )
      .sort({ createdAt: 1 })
      .lean()
  ]);

  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  const userMessages = messages.filter((message) => message.role === 'user');

  const latencies = assistantMessages
    .map((message) => Number(message?.retrievalStats?.timeTakenMs))
    .filter((value) => Number.isFinite(value) && value >= 0);

  const latency = buildLatencySummary(latencies);

  const intentCounts = new Map();
  const intentSamples = queryEvents.length > 0
    ? queryEvents.map((event) => event.intentType)
    : assistantMessages.map((message) => message.intentType);

  intentSamples.forEach((intentType) => {
    const key = normalizeIntentLabel(intentType);
    intentCounts.set(key, (intentCounts.get(key) || 0) + 1);
  });

  const intents = Array.from(intentCounts.entries())
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count || a.intent.localeCompare(b.intent));

  const sourceIdSet = new Set();
  assistantMessages.forEach((message) => {
    (message.usedSourceIds || []).forEach((sourceId) => {
      if (sourceId) {
        sourceIdSet.add(String(sourceId));
      }
    });

    Object.values(message.sourceIndex || {}).forEach((sourceId) => {
      if (sourceId) {
        sourceIdSet.add(String(sourceId));
      }
    });
  });

  let sourceDistribution = [];
  if (sourceIdSet.size > 0) {
    const rows = await SourceDoc.aggregate([
      { $match: { _id: { $in: Array.from(sourceIdSet) } } },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);

    sourceDistribution = buildSourceDistribution(
      rows.map((row) => ({
        source: row._id || 'Unknown',
        count: Number(row.count || 0)
      }))
    ).map((entry) => ({
      source: entry.source,
      count: entry.count,
      percentage: entry.percentage
    }));
  }

  const queryActivity = assistantMessages
    .map((message) => ({
      timestamp: message.createdAt,
      day: toDayKey(message.createdAt),
      latency_ms: Number(message?.retrievalStats?.timeTakenMs || 0),
      intent: normalizeIntentLabel(message.intentType),
      candidates: Number(message?.retrievalStats?.totalCandidates || 0)
    }))
    .slice(-20);

  const latestAssistantWithStructured = [...assistantMessages]
    .reverse()
    .find((message) => message.structuredAnswer && typeof message.structuredAnswer === 'object');

  return {
    session: {
      ...session,
      _id: String(session._id)
    },
    totals: {
      queries: queryEvents.length || assistantMessages.length,
      assistant_messages: assistantMessages.length,
      user_messages: userMessages.length
    },
    latency: {
      avg_latency_ms: latency.avg_latency_ms,
      p95_latency_ms: latency.p95_latency_ms
    },
    intents,
    source_distribution: sourceDistribution,
    query_activity: queryActivity,
    latest_insights: buildInsightsPayload(String(session._id), latestAssistantWithStructured || null)
  };
}
