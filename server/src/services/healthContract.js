import express from 'express';

const HEALTH_CONTRACT_PATCHED = Symbol.for('curalink.healthContract.v1');

function toServiceStatus(value, fallback = 'unknown') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizeHealthPayload(body = {}) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  return {
    ...payload,
    status: typeof payload.status === 'string' ? payload.status : 'degraded',
    version: String(payload.version || process.env.APP_VERSION || process.env.npm_package_version || '1.0.0'),
    uptime_ms: Number.isFinite(Number(payload.uptime_ms))
      ? Number(payload.uptime_ms)
      : Math.round(process.uptime() * 1000),
    services: {
      llm: toServiceStatus(payload.services?.llm ?? payload.llm, 'unknown'),
      db: toServiceStatus(payload.services?.db ?? payload.mongodb ?? payload.db, 'disconnected')
    },
    timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString()
  };
}

export function applyHealthResponseContractPatch() {
  if (express.response[HEALTH_CONTRACT_PATCHED]) {
    return;
  }

  const originalJson = express.response.json;

  express.response.json = function patchedJson(body) {
    const requestPath = String(this.req?.path || '');
    const isHealthRoute = this.req?.method === 'GET' && (requestPath === '/health' || requestPath === '/api/health');

    if (isHealthRoute) {
      return originalJson.call(this, normalizeHealthPayload(body));
    }

    return originalJson.call(this, body);
  };

  express.response[HEALTH_CONTRACT_PATCHED] = true;
}
