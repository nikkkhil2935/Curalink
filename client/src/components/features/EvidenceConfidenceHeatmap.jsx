function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numeric));
}

function scoreColor(value) {
  const score = clampScore(value);

  if (score >= 0.75) {
    return 'bg-[color-mix(in_srgb,var(--success)_32%,var(--bg-surface))] text-(--text-primary)';
  }

  if (score >= 0.5) {
    return 'bg-[color-mix(in_srgb,var(--warning)_28%,var(--bg-surface))] text-(--text-primary)';
  }

  return 'bg-[color-mix(in_srgb,var(--danger)_24%,var(--bg-surface))] text-(--text-primary)';
}

function formatScore(value) {
  return clampScore(value).toFixed(2);
}

function getEntryBreakdown(entry) {
  const breakdown = entry?.confidence_breakdown || {};

  return {
    relevance_score: clampScore(breakdown.relevance_score),
    credibility_score: clampScore(breakdown.credibility_score),
    recency_score: clampScore(breakdown.recency_score),
    composite_score: clampScore(breakdown.composite_score)
  };
}

export default function EvidenceConfidenceHeatmap({ sources = [] }) {
  const rows = (Array.isArray(sources) ? sources : [])
    .filter((source) => source?.citationId || source?.id)
    .slice(0, 10)
    .map((source) => ({
      key: String(source.id || source.citationId),
      citation: source.citationId || source.id,
      title: String(source.title || source.citationId || source.id || 'Source').trim(),
      scores: getEntryBreakdown(source)
    }));

  if (!rows.length) {
    return null;
  }

  return (
    <section className="rounded-xl border token-border token-surface p-3" aria-label="Evidence confidence heatmap">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] token-text-subtle">Evidence Confidence Heatmap</h3>
        <span className="text-[11px] token-text-muted">Top {rows.length} evidence chunks</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-130 border-separate border-spacing-y-1 text-xs">
          <thead>
            <tr className="token-text-subtle">
              <th className="px-2 py-1 text-left font-semibold">Citation</th>
              <th className="px-2 py-1 text-left font-semibold">Source</th>
              <th className="px-2 py-1 text-center font-semibold">Relevance</th>
              <th className="px-2 py-1 text-center font-semibold">Credibility</th>
              <th className="px-2 py-1 text-center font-semibold">Recency</th>
              <th className="px-2 py-1 text-center font-semibold">Composite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="token-surface-2">
                <td className="rounded-l-md px-2 py-2 font-mono text-(--accent)">{row.citation}</td>
                <td className="max-w-55 truncate px-2 py-2 token-text" title={row.title}>{row.title}</td>
                <td className={`px-2 py-2 text-center font-mono ${scoreColor(row.scores.relevance_score)}`}>{formatScore(row.scores.relevance_score)}</td>
                <td className={`px-2 py-2 text-center font-mono ${scoreColor(row.scores.credibility_score)}`}>{formatScore(row.scores.credibility_score)}</td>
                <td className={`px-2 py-2 text-center font-mono ${scoreColor(row.scores.recency_score)}`}>{formatScore(row.scores.recency_score)}</td>
                <td className={`rounded-r-md px-2 py-2 text-center font-mono ${scoreColor(row.scores.composite_score)}`}>{formatScore(row.scores.composite_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
