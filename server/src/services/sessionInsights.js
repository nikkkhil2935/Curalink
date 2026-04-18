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
