const QUERY_CACHE_TTL_MS = Math.max(
  30_000,
  Number.parseInt(process.env.QUERY_CACHE_TTL_MS || '300000', 10)
);
const QUERY_CACHE_MAX_ENTRIES = Math.max(
  32,
  Number.parseInt(process.env.QUERY_CACHE_MAX_ENTRIES || '500', 10)
);

const cache = new Map();

function normalizeQuery(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function buildKey(sessionId, queryText) {
  return `${String(sessionId)}::${normalizeQuery(queryText)}`;
}

function pruneExpired() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (!value || value.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function enforceCapacity() {
  while (cache.size > QUERY_CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) {
      return;
    }
    cache.delete(firstKey);
  }
}

export function getCachedQueryResult(sessionId, queryText) {
  pruneExpired();
  const key = buildKey(sessionId, queryText);
  const hit = cache.get(key);
  if (!hit) {
    return null;
  }

  // LRU refresh on read.
  cache.delete(key);
  cache.set(key, hit);
  return structuredClone(hit.payload);
}

export function setCachedQueryResult(sessionId, queryText, payload) {
  pruneExpired();
  const key = buildKey(sessionId, queryText);
  cache.set(key, {
    expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
    payload: structuredClone(payload)
  });
  enforceCapacity();
}

export function invalidateSessionQueryCache(sessionId) {
  const prefix = `${String(sessionId)}::`;
  for (const key of cache.keys()) {
    if (String(key).startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
