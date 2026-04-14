// Placeholder retriever. Source API integrations are added later.
export async function retrieveCandidates(expandedQuery) {
  return {
    expandedQuery,
    pubmed: [],
    openalex: [],
    clinicalTrials: []
  };
}
