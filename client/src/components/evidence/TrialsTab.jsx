export default function TrialsTab({ sources }) {
  if (!sources.length) {
    return <p className="text-sm text-slate-400">No trial cards available yet.</p>;
  }

  return (
    <div className="space-y-3">
      {sources.map((trial, index) => (
        <article key={trial._id || `trial-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs text-slate-400">[T{index + 1}] ClinicalTrials {trial.year || 'N/A'}</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">{trial.title || 'Untitled trial'}</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-2">
            <p>Status: {trial.status || 'Unknown'}</p>
            <p>Phase: {trial.phase || 'N/A'}</p>
            <p className="sm:col-span-2">Locations: {trial.locations?.join(', ') || 'Not provided'}</p>
          </div>
          {trial.eligibility ? (
            <p className="mt-3 text-xs leading-relaxed text-slate-300">Eligibility: {trial.eligibility.slice(0, 280)}</p>
          ) : null}
          {trial.url ? (
            <a
              href={trial.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs font-semibold text-blue-300 hover:text-blue-200"
            >
              Open trial details
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}
