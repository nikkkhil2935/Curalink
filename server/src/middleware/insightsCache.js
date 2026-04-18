const INSIGHTS_TTL_MS = 5 * 60 * 1000;

const insightsCache = new Map();

function normalizeSessionId(sessionId) {
  return String(sessionId || '').trim();
}

function isFresh(entry) {
  return entry && entry.expiresAt > Date.now();
}

export function insightsResponseCache(req, res, next) {
  clearStaleInsightsCache();

  const sessionId = normalizeSessionId(req.params?.id);
  if (!sessionId) {
    return next();
  }

  const cached = insightsCache.get(sessionId);
  if (!isFresh(cached)) {
    if (cached) {
      insightsCache.delete(sessionId);
    }
    return next();
  }

  return res.json(cached.payload);
}

export function setInsightsCache(sessionId, payload) {
  const key = normalizeSessionId(sessionId);
  if (!key || !payload) {
    return;
  }

  insightsCache.set(key, {
    payload,
    expiresAt: Date.now() + INSIGHTS_TTL_MS
  });
}

export function invalidateInsightsCache(sessionId) {
  const key = normalizeSessionId(sessionId);
  if (!key) {
    return;
  }

  insightsCache.delete(key);
}

export function clearStaleInsightsCache() {
  const now = Date.now();
  for (const [key, entry] of insightsCache.entries()) {
    if (!entry || entry.expiresAt <= now) {
      insightsCache.delete(key);
    }
  }
}
