function getStrengthBadge(score) {
  if (score >= 0.7) {
    return { label: 'Strong', className: 'border-green-500/30 bg-green-500/10 text-green-300' };
  }
  if (score >= 0.4) {
    return { label: 'Moderate', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' };
  }
  return { label: 'Limited', className: 'border-red-500/30 bg-red-500/10 text-red-300' };
}

export default function SourceCard({ source, prefix }) {
  const badge = getStrengthBadge(Number(source.finalScore || 0));

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          [{prefix}] {source.source} {source.year || 'N/A'}
        </p>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-slate-100">{source.title || 'Untitled source'}</h3>

      {source.authors?.length ? (
        <p className="mt-1 text-xs text-slate-400">{source.authors.slice(0, 4).join(', ')}</p>
      ) : null}

      {source.abstract ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-300">{source.abstract.slice(0, 360)}</p>
      ) : null}

      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-xs font-semibold text-blue-300 hover:text-blue-200"
        >
          Open source link
        </a>
      ) : null}
    </article>
  );
}
