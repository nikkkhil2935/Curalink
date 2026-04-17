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