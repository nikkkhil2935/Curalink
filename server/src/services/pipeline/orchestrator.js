import { expandQuery } from './queryExpander.js';
import { retrieveCandidates } from './retriever.js';
import { normalizeCandidates } from './normalizer.js';
import { rerankSources } from './reranker.js';
import { packageContext } from './contextPackager.js';

// Placeholder orchestrator. End-to-end generation is intentionally deferred.
export async function runPipeline(input) {
  const expanded = expandQuery(input);
  const candidates = await retrieveCandidates(expanded);
  const normalized = normalizeCandidates(candidates);
  const reranked = rerankSources(normalized);
  const context = packageContext(reranked);

  return {
    expanded,
    candidates,
    normalized,
    reranked,
    context
  };
}
