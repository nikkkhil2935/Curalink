// Placeholder normalizer. Real normalization logic is planned for later implementation.
export function normalizeCandidates(candidates) {
  const { pubmed = [], openalex = [], clinicalTrials = [] } = candidates || {};

  return [...pubmed, ...openalex, ...clinicalTrials];
}
