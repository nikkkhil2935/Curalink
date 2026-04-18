<<<<<<< HEAD
import Message from '../models/Message.js';
import SourceDoc from '../models/SourceDoc.js';

const MAX_RECENT_TRACE_IDS = 5;
const ALLOWED_EVIDENCE_LABELS = new Set(['LIMITED', 'MODERATE', 'STRONG']);

function normalizeSourceId(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

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

  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function extractSourceIds(message) {
  const usedSourceIds = Array.isArray(message?.usedSourceIds)
    ? message.usedSourceIds.map(normalizeSourceId).filter(Boolean)
    : [];

  const sourceIndexValues =
    message?.sourceIndex && typeof message.sourceIndex === 'object' && !Array.isArray(message.sourceIndex)
      ? Object.values(message.sourceIndex).map(normalizeSourceId).filter(Boolean)
      : [];

  return Array.from(new Set([...sourceIndexValues, ...usedSourceIds]));
}

function toSortedBreakdown(countMap, keyName) {
  return Array.from(countMap.entries())
    .map(([label, count]) => ({ [keyName]: label, count }))
    .sort((a, b) => b.count - a.count || String(a[keyName]).localeCompare(String(b[keyName])));
}

export async function buildSessionInsights(sessionId) {
  const [messageCount, assistantMessages] = await Promise.all([
    Message.countDocuments({ sessionId }),
    Message.find({ sessionId, role: 'assistant' })
      .select('intentType structuredAnswer.evidence_strength retrievalStats usedSourceIds sourceIndex createdAt')
      .sort({ createdAt: -1 })
      .lean()
  ]);

  const intentCounts = new Map();
  const evidenceCounts = new Map();
  const uniqueSourceIds = new Set();
  const seenTraceIds = new Set();

  const recentTraceIds = [];
  const totalTimings = [];
  const retrievalTimings = [];
  const llmTimings = [];

  let citedSources = 0;

  for (const message of assistantMessages) {
    const intentType = String(message?.intentType || 'GENERAL').trim().toUpperCase() || 'GENERAL';
    intentCounts.set(intentType, (intentCounts.get(intentType) || 0) + 1);

    const evidenceStrength = String(message?.structuredAnswer?.evidence_strength || '')
      .trim()
      .toUpperCase();
    if (ALLOWED_EVIDENCE_LABELS.has(evidenceStrength)) {
      evidenceCounts.set(evidenceStrength, (evidenceCounts.get(evidenceStrength) || 0) + 1);
    }

    const sourceIds = extractSourceIds(message);
    citedSources += sourceIds.length;
    sourceIds.forEach((sourceId) => uniqueSourceIds.add(sourceId));

    const traceId = String(message?.retrievalStats?.traceId || '').trim();
    if (traceId && !seenTraceIds.has(traceId) && recentTraceIds.length < MAX_RECENT_TRACE_IDS) {
      seenTraceIds.add(traceId);
      recentTraceIds.push(traceId);
    }

    const stageTimings = message?.retrievalStats?.stageTimingsMs || {};
    const totalTiming = toNonNegativeNumber(stageTimings.total ?? message?.retrievalStats?.timeTakenMs);
    const retrievalTiming = toNonNegativeNumber(stageTimings.retrieval);
    const llmTiming = toNonNegativeNumber(stageTimings.llm);

    if (totalTiming !== null) {
      totalTimings.push(totalTiming);
    }
    if (retrievalTiming !== null) {
      retrievalTimings.push(retrievalTiming);
    }
    if (llmTiming !== null) {
      llmTimings.push(llmTiming);
    }
  }

  const uniqueSourceIdsList = Array.from(uniqueSourceIds);
  let publications = 0;
  let trials = 0;

  if (uniqueSourceIdsList.length) {
    const sourceTypeCounts = await SourceDoc.aggregate([
      { $match: { _id: { $in: uniqueSourceIdsList } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    sourceTypeCounts.forEach((entry) => {
      if (entry._id === 'publication') {
        publications = Number(entry.count) || 0;
      }

      if (entry._id === 'trial') {
        trials = Number(entry.count) || 0;
      }
    });
  }

  const intentBreakdown = toSortedBreakdown(intentCounts, 'intentType');
  const evidenceStrengthTrend = toSortedBreakdown(evidenceCounts, 'label');
  const avgTimingsMs = {
    total: Math.round(average(totalTimings)),
    retrieval: Math.round(average(retrievalTimings)),
    llm: Math.round(average(llmTimings))
  };

  return {
    sessionId: String(sessionId),
    totals: {
      messages: messageCount,
      assistantMessages: assistantMessages.length,
      queriesRun: assistantMessages.length,
      citedSources,
      uniqueSources: uniqueSourceIdsList.length,
      publications,
      trials
    },
    intentBreakdown,
    evidenceStrengthTrend,
    avgTimingsMs,
    recentTraceIds,

    // Compatibility aliases for snake_case analytics endpoints.
    intent_breakdown: intentBreakdown.map((entry) => ({
      intent_type: entry.intentType,
      count: entry.count
    })),
    evidence_strength_trend: evidenceStrengthTrend.map((entry) => ({
      label: entry.label,
      count: entry.count
    })),
    avg_timings_ms: {
      total: avgTimingsMs.total,
      retrieval: avgTimingsMs.retrieval,
      llm: avgTimingsMs.llm
    },
    recent_trace_ids: [...recentTraceIds],
    source_ids: uniqueSourceIdsList
  };
}
=======
function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeIntentLabel(intentType) {
  const normalized = String(intentType || '').trim();
  return normalized || 'GENERAL';
}

export function computePercentile(values, percentileRank = 95) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length === 1) {
    return sorted[0];
  }

  const normalizedRank = Math.max(0, Math.min(100, Number(percentileRank)));
  const index = (normalizedRank / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const weight = index - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
}

export function buildLatencySummary(latencyValues = []) {
  const values = (Array.isArray(latencyValues) ? latencyValues : [])
    .map((value) => toFiniteNumber(value))
    .filter((value) => value !== null && value >= 0);

  if (values.length === 0) {
    return {
      avg_latency_ms: 0,
      p95_latency_ms: 0,
      sample_size: 0
    };
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    avg_latency_ms: Math.round(average),
    p95_latency_ms: Math.round(computePercentile(values, 95)),
    sample_size: values.length
  };
}

export function toDayKey(dateValue) {
  if (!dateValue) {
    return '';
  }

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

export function buildDateRange(days = 14, now = new Date()) {
  const requested = Number.parseInt(String(days), 10);
  const totalDays = Number.isFinite(requested) ? Math.max(1, Math.min(requested, 90)) : 14;

  const baseDate = now instanceof Date ? now : new Date(now);
  const endDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - (totalDays - 1));

  const keys = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    keys,
    startDate,
    endDate
  };
}

export function buildSourceDistribution(items = []) {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => ({
      source: String(item?.source || 'Unknown'),
      count: Number(item?.count || 0),
      used: Number(item?.used || 0)
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  const total = normalized.reduce((sum, item) => sum + item.count, 0);

  return normalized.map((item) => ({
    source: item.source,
    count: item.count,
    used: item.used,
    percentage: total > 0 ? Number(((item.count / total) * 100).toFixed(2)) : 0
  }));
}

export function buildInsightsPayload(sessionId, latestAssistant) {
  const answer = latestAssistant?.structuredAnswer || {};
  const pipelineTimings = Array.isArray(latestAssistant?.trace?.pipeline_timings)
    ? latestAssistant.trace.pipeline_timings
    : Array.isArray(latestAssistant?.retrievalStats?.pipeline_timings)
      ? latestAssistant.retrievalStats.pipeline_timings
      : [];

  return {
    sessionId,
    sourceGeneratedAt: latestAssistant?.createdAt || null,
    condition_overview: answer.condition_overview || '',
    evidence_strength: answer.evidence_strength || null,
    insights: Array.isArray(answer.research_insights) ? answer.research_insights : [],
    clinical_trials: Array.isArray(answer.clinical_trials) ? answer.clinical_trials : [],
    key_researchers: Array.isArray(answer.key_researchers) ? answer.key_researchers : [],
    recommendations: answer.recommendations || '',
    follow_up_suggestions: Array.isArray(answer.follow_up_suggestions)
      ? answer.follow_up_suggestions
      : [],
    trace: {
      pipeline_timings: pipelineTimings
    },
    timestamp: new Date().toISOString()
  };
}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
