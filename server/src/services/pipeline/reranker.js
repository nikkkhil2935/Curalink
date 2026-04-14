// Placeholder reranker. Hybrid scoring will be implemented in Day 2/3.
export function rerankSources(sourceDocs) {
  return {
    publications: sourceDocs.filter((doc) => doc.type === 'publication').slice(0, 8),
    trials: sourceDocs.filter((doc) => doc.type === 'trial').slice(0, 5)
  };
}
