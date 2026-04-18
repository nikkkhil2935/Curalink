const STEPS = [
  'Query expansion',
  'PubMed fetch',
  'OpenAlex fetch',
  'ClinicalTrials fetch',
  'Re-ranking',
  'AI synthesis',
];

export default function LoadingOverlay({ message = 'Processing…', steps }) {
  const rendered = Array.isArray(steps) && steps.length > 0 ? steps : STEPS;

  return (
<<<<<<< HEAD
    <div
      className="flex flex-col items-center justify-center p-6 rounded-xl"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
    >
      <div className="relative mb-5">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-transparent" style={{ borderTopColor: '#3b82f6' }} />
        <div
          className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-4 border-transparent"
          style={{ borderTopColor: '#22d3ee', animationDirection: 'reverse', animationDuration: '1.4s' }}
        />
      </div>
      {message && (
        <p className="text-sm mb-4 font-medium" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>
      )}
      <div className="space-y-2 w-full max-w-[220px]">
        {rendered.map((step, idx) => (
          <div key={step} className="flex items-center gap-2.5">
            <span
              className="pipeline-dot animate-pulse"
              style={{ animationDelay: `${idx * 140}ms` }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {step}
            </span>
=======
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
          </div>
        ))}
      </div>
    </div>
  );
}
