import React from 'react';

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numeric));
}

function formatScore(value) {
  return clampScore(value).toFixed(2);
}

export default function EvidenceConfidenceBars({ breakdown }) {
  if (!breakdown) {
    return null;
  }

  const metrics = [
    { key: 'relevance_score', label: 'Relevance' },
    { key: 'credibility_score', label: 'Credibility' },
    { key: 'recency_score', label: 'Recency' },
    { key: 'composite_score', label: 'Composite' }
  ].map((metric) => ({
    ...metric,
    value: clampScore(breakdown?.[metric.key])
  }));

  const tooltipText = metrics
    .map((metric) => `${metric.label}: ${formatScore(metric.value)}`)
    .join(' | ');

  return (
    <div
      className="rounded-md border token-border token-surface-2 p-2"
      title={tooltipText}
      aria-label="Evidence confidence breakdown"
    >
      <p className="mb-2 text-[10px] uppercase tracking-wider token-text-subtle">Confidence Breakdown</p>
      <div className="space-y-1.5">
        {metrics.map((metric) => (
          <div key={metric.key} className="grid grid-cols-[64px_1fr_36px] items-center gap-2 text-[10px]">
            <span className="token-text-subtle">{metric.label}</span>
            <div className="h-1.5 rounded-full bg-(--bg-surface-3)">
              <div
                className="h-1.5 rounded-full bg-(--accent)"
                style={{ width: `${Math.round(metric.value * 100)}%` }}
                title={`${metric.label}: ${formatScore(metric.value)}`}
              />
            </div>
            <span className="text-right font-mono token-text">{formatScore(metric.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
