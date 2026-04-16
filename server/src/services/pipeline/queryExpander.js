/**
 * Expands user input into optimized query variants for each source API.
 */
export function expandQuery(disease, intent = '', intentType = 'GENERAL') {
  const cleanDisease = normalizeDisease((disease || '').trim());
  const cleanIntent = (intent || '').trim();
  const focusedTerms = extractFocusedTerms(cleanIntent, cleanDisease);
  const focusedQuery = focusedTerms.join(' ');

  const fullQuery = [focusedQuery || cleanIntent, cleanDisease].filter(Boolean).join(' ').trim();

  const pubmedIntentClause = focusedTerms.length ? `(${focusedTerms.join(' OR ')})` : '';
  const pubmedQuery = pubmedIntentClause ? `(${cleanDisease}) AND ${pubmedIntentClause}` : cleanDisease;

  const meshSuffixes = {
    TREATMENT: ' AND (therapy[MeSH] OR treatment[Title/Abstract])',
    DIAGNOSIS: ' AND (diagnosis[MeSH] OR diagnostic[Title/Abstract])',
    SIDE_EFFECTS: ' AND (adverse effects[MeSH])',
    PREVENTION: ' AND (prevention[MeSH] OR preventive[Title/Abstract])',
    CLINICAL_TRIALS: ' AND (clinical trial[pt])',
    RESEARCHERS: '',
    GENERAL: ''
  };

  const pubmedQueryEnhanced = pubmedQuery + (meshSuffixes[intentType] || '');

  return {
    fullQuery,
    pubmedQuery: pubmedQueryEnhanced,
    openalexQuery: fullQuery || cleanDisease,
    ctCondition: cleanDisease,
    ctIntervention: focusedQuery || cleanIntent || undefined,
    intentType
  };
}

const DISEASE_ALIASES = {
  tb: 'tuberculosis',
  copd: 'chronic obstructive pulmonary disease',
  mi: 'myocardial infarction'
};

const COMMON_TYPO_FIXES = {
  occuer: 'occur',
  accure: 'occur',
  yong: 'young'
};

const STOP_WORDS = new Set([
  'how',
  'does',
  'do',
  'is',
  'are',
  'what',
  'why',
  'when',
  'where',
  'in',
  'on',
  'at',
  'for',
  'to',
  'of',
  'the',
  'a',
  'an',
  'and',
  'or',
  'with',
  'about',
  'occur',
  'occurs',
  'occuring',
  'happens'
]);

function normalizeDisease(value) {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  return DISEASE_ALIASES[lower] || raw;
}

function extractFocusedTerms(text, disease) {
  const diseaseTerms = new Set(String(disease || '').toLowerCase().split(/\s+/).filter(Boolean));

  const terms = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => COMMON_TYPO_FIXES[token] || token)
    .filter((token) => token.length > 2)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !diseaseTerms.has(token));

  return [...new Set(terms)].slice(0, 6);
}
