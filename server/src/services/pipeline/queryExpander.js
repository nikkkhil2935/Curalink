import { classifyIntent } from './intentClassifier.js';

export function expandQuery({ disease, intent, location }) {
  const cleanDisease = (disease || '').trim();
  const cleanIntent = (intent || '').trim();

  return {
    full_query: `${cleanIntent} ${cleanDisease}`.trim(),
    pubmed_query: cleanIntent ? `${cleanIntent} AND ${cleanDisease}` : cleanDisease,
    openalex_query: `${cleanIntent} ${cleanDisease}`.trim(),
    ct_cond: cleanDisease,
    ct_intr: cleanIntent,
    intent_type: classifyIntent(cleanIntent || cleanDisease),
    location_hint: location || {}
  };
}
