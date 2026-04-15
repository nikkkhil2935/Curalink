/**
 * Expands user input into optimized query variants for each source API.
 */
export function expandQuery(disease, intent = '', intentType = 'GENERAL') {
  const cleanDisease = (disease || '').trim();
  const cleanIntent = (intent || '').trim();

  const fullQuery = cleanIntent ? `${cleanIntent} ${cleanDisease}` : cleanDisease;

  const pubmedQuery = cleanIntent ? `(${cleanIntent}) AND (${cleanDisease})` : cleanDisease;

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
    openalexQuery: fullQuery,
    ctCondition: cleanDisease,
    ctIntervention: cleanIntent || undefined,
    intentType
  };
}
