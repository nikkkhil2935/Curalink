import Analytics from '../models/Analytics.js';
import SourceDoc from '../models/SourceDoc.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { buildSessionInsights } from './sessionInsights.js';

const DEFAULT_ACTIVITY_DAYS = 14;
const MAX_ACTIVITY_DAYS = 90;
const MAX_LATENCY_SAMPLES = 5000;

function toNonNegativeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return numeric;
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function percentile(values, targetPercentile) {
  if (!values.length) {
    return 0;
  }

  if (values.length === 1) {
    return values[0];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const rank = (targetPercentile / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const weight = rank - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function normalizeIntentLabel(intentType) {
  const normalized = String(intentType || 'GENERAL').trim().toUpperCase();
  return normalized || 'GENERAL';
}

function toUtcDateKey(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function buildDailyActivity(days, queryRows, sessionRows) {
  const queryMap = new Map(
    (queryRows || []).map((entry) => [String(entry._id), Number(entry.queries) || 0])
  );
  const sessionMap = new Map(
    (sessionRows || []).map((entry) => [String(entry._id), Number(entry.sessions) || 0])
  );

  const dailyActivity = [];
  const end = new Date();
  const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(endUtc);
    day.setUTCDate(endUtc.getUTCDate() - offset);
    const dateKey = day.toISOString().slice(0, 10);

    dailyActivity.push({
      date: dateKey,
      queries: queryMap.get(dateKey) || 0,
      sessions: sessionMap.get(dateKey) || 0
    });
  }

  return dailyActivity;
}

function normalizeSourceId(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function extractMessageSourceIds(message) {
  const sourceIndexValues =
    message?.sourceIndex && typeof message.sourceIndex === 'object' && !Array.isArray(message.sourceIndex)
      ? Object.values(message.sourceIndex)
      : [];

  return [...(message?.usedSourceIds || []), ...sourceIndexValues]
    .map(normalizeSourceId)
    .filter(Boolean);
}

function toSourceDistribution(rows) {
  const normalizedRows = (rows || []).map((entry) => ({
    source: String(entry?._id || 'Unknown'),
    count: Number(entry?.count) || 0
  }));

  const total = normalizedRows.reduce((sum, entry) => sum + entry.count, 0);

  return normalizedRows.map((entry) => ({
    source: entry.source,
    count: entry.count,
    percentage: total > 0 ? Number(((entry.count / total) * 100).toFixed(2)) : 0
  }));
}

async function getLatencySamples(limit = MAX_LATENCY_SAMPLES) {
  const analyticsRows = await Analytics.find(
    { event: 'query' },
    {
      'metadata.stats.timeTakenMs': 1,
      'metadata.stats.stageTimingsMs.total': 1
    }
  )
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const analyticsLatencies = analyticsRows
    .map((entry) =>
      toNonNegativeNumber(entry?.metadata?.stats?.timeTakenMs ?? entry?.metadata?.stats?.stageTimingsMs?.total)
    )
    .filter((value) => value !== null);

  if (analyticsLatencies.length) {
    return analyticsLatencies;
  }

  const messageRows = await Message.find(
    { role: 'assistant' },
    { 'retrievalStats.timeTakenMs': 1, 'retrievalStats.stageTimingsMs.total': 1 }
  )
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return messageRows
    .map((entry) =>
      toNonNegativeNumber(entry?.retrievalStats?.timeTakenMs ?? entry?.retrievalStats?.stageTimingsMs?.total)
    )
    .filter((value) => value !== null);
}

export async function getTopDiseases(limit = 10) {
  const safeLimit = clampInteger(limit, 10, 1, 50);

  const results = await Analytics.aggregate([
    { $match: { event: 'query', disease: { $exists: true, $ne: null } } },
    { $group: { _id: '$disease', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: safeLimit }
  ]);

  const diseases = results.map((entry) => ({
    name: entry._id,
    count: entry.count
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
  const results = await Analytics.aggregate([
    { $match: { event: 'query', intentType: { $exists: true, $ne: null } } },
    { $group: { _id: '$intentType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const intents = results.map((entry) => ({
    name: normalizeIntentLabel(entry._id),
    count: Number(entry.count) || 0
  }));

  return {
    intents,
    top_intents: intents.map((entry) => ({
      intent_type: entry.name,
      count: entry.count
    }))
  };
}

export async function getSourceStats() {
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
    count: Number(entry.count) || 0,
    used: Number(entry.totalUsed) || 0
  }));

  const distribution = toSourceDistribution(
    results.map((entry) => ({
      _id: entry._id,
      count: Number(entry.count) || 0
    }))
  );

  return {
    sources,
    total: sources.reduce((sum, entry) => sum + entry.count, 0),
    distribution,
    source_distribution: distribution
  };
}

export async function getTrialStatus() {
  const results = await SourceDoc.aggregate([
    { $match: { type: 'trial' } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  return {
    statuses: results.map((entry) => ({
      name: entry._id || 'Unknown',
      count: Number(entry.count) || 0
    }))
  };
}

export async function getSnapshots(limit = 24) {
  const safeLimit = clampInteger(limit, 24, 1, 168);

  const records = await Analytics.find(
    { event: 'system_snapshot' },
    { metadata: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();

  const snapshots = records.reverse().map((record) => ({
    time: record.createdAt,
    totalSessions: Number(record.metadata?.totalSessions || 0),
    totalQueries: Number(record.metadata?.totalQueries || 0),
    totalSources: Number(record.metadata?.totalSources || 0)
  }));

  return { snapshots };
}

export async function getOverviewAnalytics(options = {}) {
  const days = clampInteger(options.days, DEFAULT_ACTIVITY_DAYS, 1, MAX_ACTIVITY_DAYS);

  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  const [
    totalSessions,
    totalQueries,
    intentRows,
    queryDailyRows,
    sessionDailyRows,
    sourceRows,
    avgStats,
    recentQueries,
    latencies
  ] = await Promise.all([
    Session.countDocuments(),
    Analytics.countDocuments({ event: 'query' }),
    Analytics.aggregate([
      { $match: { event: 'query' } },
      { $group: { _id: { $ifNull: ['$intentType', 'GENERAL'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]),
    Analytics.aggregate([
      {
        $match: {
          event: 'query',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'UTC'
            }
          },
          queries: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Session.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'UTC'
            }
          },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    SourceDoc.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
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
          avgReranked: { $avg: '$retrievalStats.rerankedTo' }
        }
      }
    ]),
    Analytics.find({ event: 'query' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('disease intentType metadata createdAt')
      .lean(),
    getLatencySamples()
  ]);

  const avgLatencyMs = Math.round(average(latencies));
  const p95LatencyMs = Math.round(percentile(latencies, 95));

  const topIntents = intentRows.map((entry) => ({
    intent_type: normalizeIntentLabel(entry._id),
    count: Number(entry.count) || 0
  }));

  const dailyActivity = buildDailyActivity(days, queryDailyRows, sessionDailyRows);
  const sourceDistribution = toSourceDistribution(sourceRows);

  const avgStatsEntry = avgStats[0] || {};
  const totalSources = sourceDistribution.reduce((sum, entry) => sum + entry.count, 0);

  return {
    total_sessions: totalSessions,
    total_queries: totalQueries,
    avg_latency_ms: avgLatencyMs,
    p95_latency_ms: p95LatencyMs,
    top_intents: topIntents,
    daily_activity: dailyActivity,
    source_distribution: sourceDistribution,

    // Backward compatibility for existing dashboard widgets.
    totalSessions: totalSessions,
    totalQueries: totalQueries,
    totalSources,
    avgLatencyMs,
    p95LatencyMs,
    topIntents,
    dailyActivity,
    sourceDistribution,
    avgCandidatesRetrieved: Math.round(Number(avgStatsEntry.avgCandidates) || 0),
    avgShownToUser: Math.round(Number(avgStatsEntry.avgReranked) || 0),
    avgResponseTimeSec: Number((avgLatencyMs / 1000).toFixed(2)),
    recentQueries: recentQueries.map((query) => ({
      disease: query.disease || 'Unknown',
      intentType: normalizeIntentLabel(query.intentType),
      candidates: Number(query.metadata?.stats?.totalCandidates || 0),
      time: toNonNegativeNumber(query.metadata?.stats?.timeTakenMs) || 0
    }))
  };
}

export async function getSessionBreakdownAnalytics(sessionId, options = {}) {
  const days = clampInteger(options.days, DEFAULT_ACTIVITY_DAYS, 1, MAX_ACTIVITY_DAYS);

  const session = await Session.findById(sessionId)
    .select('disease intent title queryHistory messageCount createdAt updatedAt')
    .lean();

  if (!session) {
    return null;
  }

  const [insights, assistantMessages] = await Promise.all([
    buildSessionInsights(sessionId),
    Message.find({ sessionId, role: 'assistant' })
      .select('retrievalStats.timeTakenMs retrievalStats.stageTimingsMs.total usedSourceIds sourceIndex createdAt')
      .sort({ createdAt: -1 })
      .limit(MAX_LATENCY_SAMPLES)
      .lean()
  ]);

  const latencies = [];
  const dailyQueryMap = new Map();
  const uniqueSourceIds = new Set();

  for (const message of assistantMessages) {
    const latency = toNonNegativeNumber(
      message?.retrievalStats?.timeTakenMs ?? message?.retrievalStats?.stageTimingsMs?.total
    );

    if (latency !== null) {
      latencies.push(latency);
    }

    const dateKey = toUtcDateKey(message?.createdAt);
    if (dateKey) {
      dailyQueryMap.set(dateKey, (dailyQueryMap.get(dateKey) || 0) + 1);
    }

    extractMessageSourceIds(message).forEach((sourceId) => uniqueSourceIds.add(sourceId));
  }

  const sessionDailyRows = Array.from(dailyQueryMap.entries()).map(([date, queries]) => ({
    _id: date,
    queries
  }));

  let sourceDistribution = [];
  if (uniqueSourceIds.size) {
    const sourceRows = await SourceDoc.aggregate([
      { $match: { _id: { $in: Array.from(uniqueSourceIds) } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    sourceDistribution = toSourceDistribution(sourceRows);
  }

  const intentBreakdown = Array.isArray(insights?.intent_breakdown)
    ? insights.intent_breakdown
    : (insights?.intentBreakdown || []).map((entry) => ({
        intent_type: normalizeIntentLabel(entry.intentType),
        count: Number(entry.count) || 0
      }));

  const evidenceStrengthTrend = Array.isArray(insights?.evidence_strength_trend)
    ? insights.evidence_strength_trend
    : (insights?.evidenceStrengthTrend || []).map((entry) => ({
        label: String(entry.label || '').trim().toUpperCase(),
        count: Number(entry.count) || 0
      }));

  const avgTimings = insights?.avg_timings_ms || insights?.avgTimingsMs || {
    total: 0,
    retrieval: 0,
    llm: 0
  };

  const recentTraceIds = insights?.recent_trace_ids || insights?.recentTraceIds || [];
  const dailyActivity = buildDailyActivity(days, sessionDailyRows, []);
  const avgLatencyMs = Math.round(average(latencies));
  const p95LatencyMs = Math.round(percentile(latencies, 95));

  const recentQueries = Array.isArray(session.queryHistory)
    ? [...session.queryHistory]
        .slice(-10)
        .reverse()
        .map((query, index) => ({
          position: index + 1,
          query: String(query || '').trim()
        }))
        .filter((entry) => entry.query)
    : [];

  const totalQueries = Number(insights?.totals?.queriesRun) || assistantMessages.length;

  return {
    session_id: String(session._id),
    title: session.title || '',
    disease: session.disease || '',
    intent: session.intent || '',
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    message_count: Number(session.messageCount) || Number(insights?.totals?.messages) || 0,

    total_queries: totalQueries,
    avg_latency_ms: avgLatencyMs,
    p95_latency_ms: p95LatencyMs,
    totals: insights?.totals || {},
    intent_breakdown: intentBreakdown,
    evidence_strength_trend: evidenceStrengthTrend,
    avg_timings_ms: {
      total: Number(avgTimings.total) || 0,
      retrieval: Number(avgTimings.retrieval) || 0,
      llm: Number(avgTimings.llm) || 0
    },
    daily_activity: dailyActivity,
    source_distribution: sourceDistribution,
    recent_trace_ids: recentTraceIds,
    recent_queries: recentQueries,

    // Backward compatibility aliases for camelCase consumers.
    sessionId: String(session._id),
    totalQueries,
    avgLatencyMs,
    p95LatencyMs,
    intentBreakdown: intentBreakdown,
    evidenceStrengthTrend: evidenceStrengthTrend,
    avgTimingsMs: {
      total: Number(avgTimings.total) || 0,
      retrieval: Number(avgTimings.retrieval) || 0,
      llm: Number(avgTimings.llm) || 0
    },
    dailyActivity,
    sourceDistribution,
    recentTraceIds
  };
}
