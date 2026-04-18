import React from 'react';
import EvidenceConfidenceBars from '@/components/features/EvidenceConfidenceBars.jsx';

export default function TrialsTab({ sources }) {
  const trials = sources.filter(s => s.type === 'trial').sort((a, b) => {
    if (a.status === 'RECRUITING' && b.status !== 'RECRUITING') return -1;
    if (a.status !== 'RECRUITING' && b.status === 'RECRUITING') return 1;
    return 0;
  });

  if (trials.length === 0) {
    return (
      <div className="mt-10 rounded-xl border token-border token-surface p-6 text-center">
        <p className="text-sm token-text">No clinical trials found for this question.</p>
        <p className="mt-1 text-xs token-text-subtle">Try adding location context or focusing on recruiting studies.</p>
      </div>
    );
  }

  const recruitingCount = trials.filter(t => t.status === 'RECRUITING').length;

  return (
    <div className="space-y-4">
      {recruitingCount > 0 && (
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--success)">
          Currently Recruiting ({recruitingCount})
        </div>
      )}
      {trials.map((trial, i) => <TrialCard key={trial.id} trial={trial} index={i} />)}
    </div>
  );
}

function TrialCard({ trial, index }) {
  const isNear = trial.isLocationRelevant;
  const citationLabel = String(trial.citationId || `T${index + 1}`).toUpperCase();
  const normalizedStatus = String(trial.status || '').trim().toUpperCase();
  const statusTone =
    normalizedStatus === 'RECRUITING'
      ? 'success'
      : normalizedStatus === 'NOT_YET_RECRUITING' || normalizedStatus === 'ACTIVE_NOT_RECRUITING'
        ? 'warning'
        : normalizedStatus === 'COMPLETED' || normalizedStatus === 'TERMINATED' || normalizedStatus === 'WITHDRAWN'
          ? 'danger'
          : 'neutral';

  const statusClasses = {
    success: 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_14%,var(--bg-surface))] text-(--success)',
    warning: 'border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_14%,var(--bg-surface))] text-(--warning)',
    danger: 'border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--bg-surface))] text-(--danger)',
    neutral: 'token-border token-surface-2 token-text-muted'
  };

  const statusClass = statusClasses[statusTone] || statusClasses.neutral;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isNear ? 'border-[color-mix(in_srgb,var(--success)_45%,transparent)] token-surface-2' : 'token-border token-surface'}`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex space-x-2 items-center">
          <span className="rounded bg-(--bg-surface-2) px-1 font-mono token-text">[{citationLabel}]</span>
          <span
            className={`rounded-full border px-2 py-0.5 font-medium ${statusClass}`}
            aria-label={`Trial status: ${trial.status || 'unknown'}`}
          >
            {trial.status}
          </span>
        </div>
        {isNear && <span className="rounded-full border border-[color-mix(in_srgb,var(--success)_38%,transparent)] bg-[color-mix(in_srgb,var(--success)_14%,var(--bg-surface))] px-2 py-0.5 text-(--success)">Near You</span>}
      </div>

      <h4 className="text-sm font-bold leading-snug token-text">{trial.title}</h4>
      
      <div className="flex flex-wrap gap-2 text-xs token-text-muted">
        {trial.phase && trial.phase !== 'N/A' && <span className="rounded bg-(--bg-surface-2) px-2 py-0.5">Phase: {trial.phase}</span>}
        {trial.locations?.length > 0 && (
          <span className="max-w-xs truncate rounded bg-(--bg-surface-2) px-2 py-0.5 token-text">
            {trial.locations.slice(0, 2).join(' | ')}
            {trial.locations.length > 2 && ` + ${trial.locations.length - 2} more`}
          </span>
        )}
      </div>

      {trial.eligibility && (
        <p className="rounded bg-(--bg-surface-2) p-2 text-xs leading-relaxed token-text-muted">
          {trial.eligibility.substring(0, 150)}...
        </p>
      )}

      {trial.contacts?.length > 0 && (
        <div className="flex flex-col space-y-1 border-t token-border pt-2 text-xs token-text-subtle">
          <span className="font-semibold">Contact:</span>
          <span>{trial.contacts[0].name} {trial.contacts[0].email ? ` - ${trial.contacts[0].email}` : ''}</span>
        </div>
      )}

      <EvidenceConfidenceBars breakdown={trial.confidence_breakdown} />

      {trial.url && (
        <a
          href={trial.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${citationLabel} on ClinicalTrials.gov`}
          className="mt-1 inline-block text-xs text-(--success) hover:brightness-90"
        >
          View on ClinicalTrials.gov →
        </a>
      )}
    </div>
  );
}