import axios from 'axios';

const RENDER_API_FALLBACK = 'https://curalink-api-cavd.onrender.com/api';
const HEALTH_CACHE_TTL_MS = 15000;

let cachedHealthPayload = null;
let healthCacheExpiresAt = 0;
let healthInFlightPromise = null;

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isLoopbackUrl(url) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/.*)?$/i.test(String(url || ''));
}

function isPlaceholderUrl(url) {
  return /your-backend\.railway\.app/i.test(String(url || ''));
}

function resolveApiBaseUrl() {
  const configured = normalizeBaseUrl(import.meta.env.VITE_API_URL);

  if (!configured) {
    return '/api';
  }

  if (isPlaceholderUrl(configured)) {
    return RENDER_API_FALLBACK;
  }

  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && isLoopbackUrl(configured)) {
    return RENDER_API_FALLBACK;
  }

  return configured;
}

const baseURL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL,
  timeout: 60000
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestConfig = error?.config;
    const shouldRetryWithFallback =
      requestConfig &&
      !error?.response &&
      !requestConfig._retryWithFallback &&
      ['get', 'head', 'options'].includes(String(requestConfig.method || 'get').toLowerCase()) &&
      normalizeBaseUrl(requestConfig.baseURL) !== normalizeBaseUrl(RENDER_API_FALLBACK);

    if (!shouldRetryWithFallback) {
      throw error;
    }

    requestConfig._retryWithFallback = true;
    requestConfig.baseURL = RENDER_API_FALLBACK;
    return api.request(requestConfig);
  }
);

export function extractApiError(error, fallbackMessage = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error || error?.message || fallbackMessage;
}

export async function getSystemHealth({ forceRefresh = false, timeout = 8000 } = {}) {
  const now = Date.now();

  if (!forceRefresh && cachedHealthPayload && healthCacheExpiresAt > now) {
    return cachedHealthPayload;
  }

  if (healthInFlightPromise) {
    return healthInFlightPromise;
  }

  healthInFlightPromise = api
    .get('/health', { timeout })
    .then(({ data }) => {
      cachedHealthPayload = data || null;
      healthCacheExpiresAt = Date.now() + HEALTH_CACHE_TTL_MS;
      return cachedHealthPayload;
    })
    .finally(() => {
      healthInFlightPromise = null;
    });

  return healthInFlightPromise;
}
