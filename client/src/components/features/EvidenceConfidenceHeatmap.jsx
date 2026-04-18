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

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getSourceConflictSeverity(source, conflicts = []) {
  const normalizedTitle = normalizeText(source?.title || source?.citationId || source?.id);
  if (!normalizedTitle) {
    return null;
  }

  const priority = { low: 1, medium: 2, high: 3 };
  let severity = null;

  (Array.isArray(conflicts) ? conflicts : []).forEach((entry) => {
    const sourceA = normalizeText(entry?.sourceA);
    const sourceB = normalizeText(entry?.sourceB);
    if (!sourceA && !sourceB) {
      return;
    }

    if (sourceA.includes(normalizedTitle) || sourceB.includes(normalizedTitle) || normalizedTitle.includes(sourceA) || normalizedTitle.includes(sourceB)) {
      const candidate = String(entry?.severity || 'low').toLowerCase();
      if (!severity || (priority[candidate] || 1) > (priority[severity] || 1)) {
        severity = candidate;
      }
    }
  });

  return severity;
}

function conflictClass(severity) {
  if (severity === 'high') {
    return 'text-(--danger) bg-[color-mix(in_srgb,var(--danger)_16%,var(--bg-surface))]';
  }

  if (severity === 'medium') {
    return 'text-(--warning) bg-[color-mix(in_srgb,var(--warning)_16%,var(--bg-surface))]';
  }

  if (severity === 'low') {
    return 'text-(--accent) bg-[color-mix(in_srgb,var(--accent)_16%,var(--bg-surface))]';
  }

  return 'token-text-subtle token-surface-2';
}

export default function EvidenceConfidenceHeatmap({ sources = [], conflicts = [] }) {
  const rows = (Array.isArray(sources) ? sources : [])
    .filter((source) => source?.citationId || source?.id)
    .slice(0, 10)
    .map((source) => ({
      key: String(source.id || source.citationId),
      citation: source.citationId || source.id,
      title: String(source.title || source.citationId || source.id || 'Source').trim(),
      scores: getEntryBreakdown(source),
      conflictSeverity: getSourceConflictSeverity(source, conflicts)
    }));

  if (!rows.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border token-border token-surface p-4" aria-label="Evidence confidence heatmap">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] token-text-subtle">Evidence Confidence Heatmap</h3>
        <span className="text-[11px] token-text-muted">Top {rows.length} evidence chunks</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-130 border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr className="token-text-subtle">
              <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em]">Citation</th>
              <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em]">Source</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.08em]">Relevance</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.08em]">Credibility</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.08em]">Recency</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.08em]">Composite</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.08em]">Conflict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="token-surface-2">
                <td className="rounded-l-md px-2 py-2.5 font-mono text-(--accent)">{row.citation}</td>
                <td className="max-w-55 truncate px-2 py-2.5 token-text" title={row.title}>{row.title}</td>
                <td className={`px-2 py-2.5 text-center font-mono ${scoreColor(row.scores.relevance_score)}`}>{formatScore(row.scores.relevance_score)}</td>
                <td className={`px-2 py-2.5 text-center font-mono ${scoreColor(row.scores.credibility_score)}`}>{formatScore(row.scores.credibility_score)}</td>
                <td className={`px-2 py-2.5 text-center font-mono ${scoreColor(row.scores.recency_score)}`}>{formatScore(row.scores.recency_score)}</td>
                <td className={`px-2 py-2.5 text-center font-mono ${scoreColor(row.scores.composite_score)}`}>{formatScore(row.scores.composite_score)}</td>
                <td className={`rounded-r-md px-2 py-2 text-center text-[11px] font-semibold uppercase ${conflictClass(row.conflictSeverity)}`}>
                  {row.conflictSeverity || '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
