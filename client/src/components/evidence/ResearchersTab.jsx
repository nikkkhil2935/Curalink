import React from 'react';

export default function ResearchersTab({ sources }) {
  const pubs = sources.filter(s => s.type === 'publication' && s.authors?.length > 0);
  
  if (pubs.length === 0) {
    return (
      <div className="mt-10 rounded-xl border token-border token-surface p-6 text-center">
        <p className="text-sm token-text">No researcher data yet.</p>
        <p className="mt-1 text-xs token-text-subtle">Run a query with publication evidence to identify top authors.</p>
      </div>
    );
  }

  const map = {};
  pubs.forEach(p => {
    const author = p.authors[0]; // simplistic top author extraction
    if (!author) return;
    if (!map[author]) {
      map[author] = { name: author, papers: [], years: [], sources: new Set(), firstAuthorCount: 0 };
    }
    map[author].papers.push(p.title);
    if (p.year) map[author].years.push(p.year);
    map[author].sources.add(p.source);
    map[author].firstAuthorCount++;
  });

  const researchers = Object.values(map)
    .sort((a, b) => b.firstAuthorCount - a.firstAuthorCount)
    .slice(0, 8);

  return (
    <div className="grid grid-cols-1 gap-4">
      {researchers.map((r, i) => (
        <div key={i} className="flex items-start space-x-4 rounded-xl border token-border token-surface p-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_20%,var(--bg-surface))] font-bold text-(--accent)">
            {r.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="truncate text-sm font-bold token-text">{r.name}</h4>
            <div className="mt-1 flex items-center space-x-2 text-xs token-text-subtle">
              <span>{r.firstAuthorCount} paper{r.firstAuthorCount !== 1 && 's'}</span>
              <span>•</span>
              {r.years.length > 0 && (
                <span>{Math.min(...r.years)}–{Math.max(...r.years)}</span>
              )}
            </div>
            <div className="flex space-x-2 mt-2">
              {[...r.sources].map(s => (
                <span key={s} className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${s === 'PubMed' ? 'bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg-surface))] text-(--accent)' : 'bg-[color-mix(in_srgb,var(--success)_14%,var(--bg-surface))] text-(--success)'}`}>
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-2 w-full truncate text-xs token-text-muted" title={r.papers[0]}>
              Most recent: {r.papers[0]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}