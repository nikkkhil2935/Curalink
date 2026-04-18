import React from 'react';

const STEPS = [
  'Query expansion',
  'PubMed fetch',
  'OpenAlex fetch',
  'ClinicalTrials fetch',
  'Re-ranking process',
  'AI synthesis'
];

export default function LoadingOverlay({ message = 'Processing request...', steps }) {
  const renderedSteps = Array.isArray(steps) && steps.length > 0 ? steps : STEPS;

  return (
    <div className="rounded-xl border token-border token-surface p-6 shadow-(--panel-shadow)">
      {message ? <p className="mb-4 text-sm font-medium token-text-muted">{message}</p> : null}

      <div className="space-y-3">
        <div className="skeleton-block h-4 w-2/3" />
        <div className="skeleton-block h-4 w-4/5" />
        <div className="skeleton-block h-4 w-3/5" />
      </div>

      <div className="mt-5 space-y-2">
        {renderedSteps.map((step) => (
          <div key={step} className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-(--accent)" />
            <span className="text-xs token-text-subtle">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
