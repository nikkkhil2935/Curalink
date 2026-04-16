/**
 * Hybrid re-ranker using keyword, recency, location, and source credibility.
 */
function computeKeywordScore(doc, queryTerms) {
  if (!queryTerms.length) {
    return 0;
  }

  const title = (doc.title || '').toLowerCase();
  const abstract = (doc.abstract || '').toLowerCase();
  let score = 0;

  for (const term of queryTerms) {
    const termLower = term.toLowerCase();
    const titleMatches = title.split(termLower).length - 1;
    const abstractMatches = abstract.split(termLower).length - 1;

    score += titleMatches * 3;
    score += abstractMatches;
  }

  return Math.min(1, score / (queryTerms.length * 4));
}

function computeCitationBoost(doc) {
  if (doc.source !== 'OpenAlex' || !doc.citedByCount) {
    return 0;
  }

  return Math.min(0.2, doc.citedByCount / 1000);
}

export function rerankCandidates(candidates, queryTerms, intentType, userLocation = null) {
  const WEIGHTS = {
    TREATMENT: { relevance: 0.5, recency: 0.3, location: 0.1, credibility: 0.1 },
    CLINICAL_TRIALS: { relevance: 0.35, recency: 0.2, location: 0.3, credibility: 0.15 },
    RESEARCHERS: { relevance: 0.6, recency: 0.2, location: 0.05, credibility: 0.15 },
    DIAGNOSIS: { relevance: 0.55, recency: 0.25, location: 0.05, credibility: 0.15 },
    PREVENTION: { relevance: 0.5, recency: 0.3, location: 0.05, credibility: 0.15 },
    SIDE_EFFECTS: { relevance: 0.55, recency: 0.2, location: 0.1, credibility: 0.15 },
    GENERAL: { relevance: 0.45, recency: 0.3, location: 0.1, credibility: 0.15 }
  };

  const weights = WEIGHTS[intentType] || WEIGHTS.GENERAL;

  const scored = candidates.map((doc) => {
    const keywordScore = computeKeywordScore(doc, queryTerms);

    let locationScore = doc.locationScore || 0;
    if (userLocation?.country && doc.type === 'trial' && doc.locations?.length) {
      const country = userLocation.country.toLowerCase();
      const city = userLocation.city ? userLocation.city.toLowerCase() : null;
      const matchesCountry = doc.locations.some((location) => location.toLowerCase().includes(country));
      const matchesCity = city
        ? doc.locations.some((location) => location.toLowerCase().includes(city))
        : false;
      locationScore = matchesCity ? 1 : matchesCountry ? 0.8 : 0;
    }

    const citationBoost = computeCitationBoost(doc);
    const recruitingBoost = doc.type === 'trial' && doc.status === 'RECRUITING' ? 0.1 : 0;

    const finalScore =
      weights.relevance * keywordScore +
      weights.recency * (doc.recencyScore || 0) +
      weights.location * locationScore +
      weights.credibility * (doc.sourceCredibility || 0) +
      citationBoost +
      recruitingBoost;

    return {
      ...doc,
      relevanceScore: keywordScore,
      locationScore,
      finalScore
    };
  });

  return scored.sort((a, b) => b.finalScore - a.finalScore);
}

function getDocKey(doc) {
  return String(doc?.id || doc?._id || `${doc?.type || 'unknown'}:${doc?.title || ''}`);
}

export function selectForContext(rankedDocs, maxPubs = 8, maxTrials = 5, options = {}) {
  const minTrials = Math.max(0, Number(options.minTrials || 0));

  const rankedPublications = rankedDocs.filter((doc) => doc.type === 'publication');
  const rankedTrials = rankedDocs.filter((doc) => doc.type === 'trial');

  const publications = rankedPublications.slice(0, maxPubs);
  const guaranteedTrials = Math.min(maxTrials, Math.max(minTrials, 0));
  const trials = rankedTrials.slice(0, Math.max(guaranteedTrials, Math.min(maxTrials, rankedTrials.length)));

  const selectedKeys = new Set([...publications, ...trials].map(getDocKey));

  // Keep original ranked order while still guaranteeing trial coverage.
  return rankedDocs.filter((doc) => selectedKeys.has(getDocKey(doc)));
}

export function computeEvidenceStrength(sources) {
  const count = sources.length;
  const currentYear = new Date().getFullYear();
  const avgYear = sources.reduce((sum, doc) => sum + (doc.year || currentYear - 10), 0) / (count || 1);
  const recencyScore = Math.max(0, Math.min(1, (avgYear - (currentYear - 10)) / 10));
  const sourceVariety = new Set(sources.map((source) => source.source)).size;

  const score = (Math.min(count, 15) / 15) * 0.4 + recencyScore * 0.4 + (sourceVariety / 3) * 0.2;

  if (score >= 0.65) {
    return {
      label: 'STRONG',
      emoji: '🟢',
      description: 'Strong evidence from multiple recent sources'
    };
  }

  if (score >= 0.35) {
    return {
      label: 'MODERATE',
      emoji: '🟡',
      description: 'Moderate evidence, consider consulting a specialist'
    };
  }

  return {
    label: 'LIMITED',
    emoji: '🔴',
    description: 'Limited evidence, emerging research area'
  };
}
