/**
 * Normalize and deduplicate results from all sources into a unified SourceDoc shape.
 */
export function normalizeAndDeduplicate(pubmedResults = [], openalexResults = [], ctResults = []) {
  const all = [...pubmedResults, ...openalexResults, ...ctResults];
  const seen = new Set();
  const deduped = [];

  for (const doc of all) {
    if (!doc?.id) {
      continue;
    }

    if (seen.has(doc.id)) {
      continue;
    }

    const titleKey = doc.title
      ? doc.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50)
      : '';

    if (titleKey && seen.has(`title:${titleKey}`)) {
      continue;
    }

    seen.add(doc.id);
    if (titleKey) {
      seen.add(`title:${titleKey}`);
    }

    deduped.push({
      ...doc,
      title: doc.title || 'Untitled',
      abstract: doc.abstract || '',
      authors: doc.authors || [],
      year: doc.year || null,
      url: doc.url || '#',
      relevanceScore: 0,
      recencyScore: computeRecencyScore(doc.year),
      locationScore: doc.isLocationRelevant ? 1 : 0,
      sourceCredibility: getSourceCredibility(doc.source),
      finalScore: 0
    });
  }

  return deduped;
}

function computeRecencyScore(year) {
  if (!year) {
    return 0;
  }

  const minYear = 2000;
  const maxYear = new Date().getFullYear();
  const normalized = (year - minYear) / Math.max(1, maxYear - minYear);
  return Math.max(0, Math.min(1, normalized));
}

function getSourceCredibility(source) {
  const credibility = {
    PubMed: 0.95,
    OpenAlex: 0.85,
    ClinicalTrials: 0.9
  };

  return credibility[source] || 0.8;
}
