const DEFAULT_STEPS = [
  'Expanding query with intent context',
  'Fetching PubMed publications',
  'Retrieving OpenAlex research works',
  'Searching clinical trials database',
  'Re-ranking by relevance and recency',
  'Generating evidence-backed synthesis'
];

export default function LoadingOverlay({ message = 'Researching...', steps = DEFAULT_STEPS }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <div
            className="absolute left-2 top-2 h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"
            style={{ animationDirection: 'reverse' }}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-100">{message}</p>
          <p className="text-xs text-slate-500">Searching PubMed, OpenAlex, and ClinicalTrials.gov</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" style={{ animationDelay: `${index * 0.25}s` }} />
            <span className="text-xs text-slate-500">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
