export function getLlmRequestHeaders(baseHeaders = {}) {
  const token = String(process.env.LLM_SERVICE_TOKEN || '').trim();
  const mergedHeaders = { ...(baseHeaders || {}) };

  if (!token) {
    return mergedHeaders;
  }

  if (!('Authorization' in mergedHeaders) && !('authorization' in mergedHeaders)) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  return mergedHeaders;
}