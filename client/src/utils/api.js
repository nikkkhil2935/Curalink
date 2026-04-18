import axios from 'axios';

const RENDER_API_FALLBACK = 'https://curalink-api-cavd.onrender.com/api';
const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedHealthPayload = null;
let healthCacheExpiresAt = 0;
let healthInFlightPromise = null;

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isReadOnlyMethod(method) {
  return ['get', 'head', 'options'].includes(String(method || 'get').toLowerCase());
}

function isOfflineNetworkError(error) {
  return !error?.response && typeof navigator !== 'undefined' && navigator.onLine === false;
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

    if (isOfflineNetworkError(error)) {
      error.isOffline = true;
      throw error;
    }

    const shouldRetryWithFallback =
      requestConfig &&
      !error?.response &&
      !requestConfig._retryWithFallback &&
      isReadOnlyMethod(requestConfig.method) &&
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
  if (error?.isOffline) {
    return 'You appear to be offline. Check your network connection and try again.';
  }

  return error?.response?.data?.error || error?.message || fallbackMessage;
}

async function requestData(config, { offlineFallback } = {}) {
  try {
    const response = await api.request(config);
    return response?.data;
  } catch (error) {
    if (isOfflineNetworkError(error) && offlineFallback !== undefined) {
      return typeof offlineFallback === 'function' ? offlineFallback() : offlineFallback;
    }

    throw error;
  }
}

export const apiEndpoints = {
  sessions: {
    list: (params = {}) => requestData({ url: '/sessions', method: 'get', params }, { offlineFallback: { sessions: [] } }),
    create: (payload) => requestData({ url: '/sessions', method: 'post', data: payload }),
    getById: (sessionId) => requestData({ url: `/sessions/${sessionId}`, method: 'get' }),
    update: (sessionId, payload) => requestData({ url: `/sessions/${sessionId}`, method: 'patch', data: payload }),
    query: (sessionId, message) => requestData({
      url: `/sessions/${sessionId}/query`,
      method: 'post',
      data: { message }
    }),
    getSources: (sessionId, messageId) => requestData({
      url: `/sessions/${sessionId}/sources/${messageId}`,
      method: 'get'
    }, { offlineFallback: { sources: [] } }),
    getConflicts: (sessionId) => requestData({
      url: `/sessions/${sessionId}/conflicts`,
      method: 'get'
    }, {
      offlineFallback: {
        totalConflicts: 0,
        outcomeGroups: []
      }
    }),
    getBrief: (sessionId) => requestData({ url: `/sessions/${sessionId}/brief`, method: 'get' }),
    generateBrief: (sessionId) => requestData({ url: `/sessions/${sessionId}/brief/generate`, method: 'post' }),
    searchHistory: (query, limit = 20) => requestData({
      url: '/sessions/history/search',
      method: 'get',
      params: { q: query, limit }
    }, { offlineFallback: { query: String(query || ''), limit, results: [] } }),
    exportAsPdf: (sessionId) => requestData({
      url: `/sessions/${sessionId}/export/pdf`,
      method: 'get',
      responseType: 'arraybuffer'
    }),
    exportAsCsv: (sessionId) => requestData({
      url: `/sessions/${sessionId}/export/csv`,
      method: 'get',
      responseType: 'text'
    })
  },
  suggestions: {
    list: (query, { limit = 5, sessionId = '' } = {}) => requestData({
      url: '/suggestions',
      method: 'get',
      params: {
        q: query,
        limit,
        sessionId
      }
    }, { offlineFallback: { suggestions: [] } })
  },
  bookmarks: {
    list: () => requestData({ url: '/bookmarks', method: 'get' }, { offlineFallback: { bookmarks: [] } }),
    toggle: (sessionId, messageId) => requestData({
      url: `/sessions/${sessionId}/messages/${messageId}/bookmark`,
      method: 'post'
    })
  },
  analytics: {
    overview: (params = {}) => requestData({ url: '/analytics/overview', method: 'get', params }),
    intentBreakdown: () => requestData({ url: '/analytics/intent-breakdown', method: 'get' }, {
      offlineFallback: { intents: [] }
    }),
    sessionBreakdown: (sessionId) => requestData({ url: `/analytics/sessions/${sessionId}/breakdown`, method: 'get' }),
    sourceStats: () => requestData({ url: '/analytics/source-stats', method: 'get' }, {
      offlineFallback: { sources: [] }
    }),
    topDiseases: (limit = 10) => requestData({
      url: '/analytics/top-diseases',
      method: 'get',
      params: { limit }
    }, { offlineFallback: { diseases: [] } }),
    trialStatus: () => requestData({ url: '/analytics/trial-status', method: 'get' }, {
      offlineFallback: { statuses: [] }
    }),
    snapshots: (limit = 10) => requestData({
      url: '/analytics/snapshots',
      method: 'get',
      params: { limit }
    }, { offlineFallback: { snapshots: [] } })
  },
  health: {
    get: (options) => getSystemHealth(options)
  }
};

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
    .catch((error) => {
      if (cachedHealthPayload) {
        return cachedHealthPayload;
      }

      if (isOfflineNetworkError(error)) {
        error.isOffline = true;
      }

      throw error;
    })
    .finally(() => {
      healthInFlightPromise = null;
    });

  return healthInFlightPromise;
}

export const uploadPDF = (sessionId, file, onProgress) => {
  const formData = new FormData();
  formData.append('pdf', file);

  return api.post(`/sessions/${sessionId}/pdf/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: typeof onProgress === 'function' ? onProgress : undefined
  });
};

export const getSessionPDFDocs = (sessionId) => api.get(`/sessions/${sessionId}/pdf/docs`);

export const deletePDFDoc = (sessionId, docId) => api.delete(`/sessions/${sessionId}/pdf/docs/${docId}`);

export const getPDFStats = (sessionId) => api.get(`/sessions/${sessionId}/pdf/stats`);
