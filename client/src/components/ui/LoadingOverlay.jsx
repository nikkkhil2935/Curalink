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
          </div>
        ))}
      </div>
    </div>
  );
}
