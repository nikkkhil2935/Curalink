const INSIGHTS_CACHE_TTL_MS = Number.parseInt(process.env.SESSION_INSIGHTS_CACHE_TTL_MS || '300000', 10);
const INSIGHTS_CACHE_MAX_ENTRIES = Number.parseInt(process.env.SESSION_INSIGHTS_CACHE_MAX_ENTRIES || '200', 10);

const insightsCache = new Map();

function deepClone(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeSessionId(sessionId) {
  return String(sessionId || '').trim();
}

function pruneExpiredEntries(now = Date.now()) {
  for (const [key, entry] of insightsCache.entries()) {
    if (!entry || Number(entry.expiresAt) <= now) {
      insightsCache.delete(key);
    }
  }
}

function touchEntry(cacheKey, entry) {
  insightsCache.delete(cacheKey);
  insightsCache.set(cacheKey, entry);
}

function enforceSizeLimit() {
  while (insightsCache.size > INSIGHTS_CACHE_MAX_ENTRIES) {
    const oldestKey = insightsCache.keys().next().value;
    if (!oldestKey) {
      return;
    }

    insightsCache.delete(oldestKey);
  }
}

export function getCachedSessionInsights(sessionId) {
  const cacheKey = normalizeSessionId(sessionId);
  if (!cacheKey) {
    return null;
  }

  pruneExpiredEntries();

  const entry = insightsCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (Number(entry.expiresAt) <= Date.now()) {
    insightsCache.delete(cacheKey);
    return null;
  }

  touchEntry(cacheKey, entry);
  return deepClone(entry.value);
}

export function setCachedSessionInsights(sessionId, insights) {
  const cacheKey = normalizeSessionId(sessionId);
  if (!cacheKey || !insights || typeof insights !== 'object') {
    return;
  }

  pruneExpiredEntries();

  const cacheEntry = {
    value: deepClone(insights),
    expiresAt: Date.now() + Math.max(1000, INSIGHTS_CACHE_TTL_MS)
  };

  insightsCache.set(cacheKey, cacheEntry);
  touchEntry(cacheKey, cacheEntry);
  enforceSizeLimit();
}

export function invalidateSessionInsightsCache(sessionId) {
  const cacheKey = normalizeSessionId(sessionId);
  if (!cacheKey) {
    return;
  }

  insightsCache.delete(cacheKey);
}

export function clearSessionInsightsCache() {
  insightsCache.clear();
}
