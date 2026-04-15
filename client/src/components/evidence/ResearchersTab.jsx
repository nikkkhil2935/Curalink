import { useMemo } from 'react';

export default function ResearchersTab({ sources }) {
  const researcherRows = useMemo(() => {
    const researchers = new Map();

    sources.forEach((source) => {
      (source.authors || []).forEach((author, index) => {
        const name = author?.trim();
        if (!name) {
          return;
        }

        const entry = researchers.get(name) || {
          name,
          papers: [],
          firstAuthorCount: 0,
          sources: new Set(),
          years: []
        };

        entry.papers.push(source.title || 'Untitled');
        if (source.year) {
          entry.years.push(source.year);
        }
        if (source.source) {
          entry.sources.add(source.source);
        }
        entry.firstAuthorCount += index === 0 ? 2 : 1;

        researchers.set(name, entry);
      });
    });

    return Array.from(researchers.values())
      .sort((a, b) => b.firstAuthorCount - a.firstAuthorCount || b.papers.length - a.papers.length)
      .slice(0, 8);
  }, [sources]);

  if (!researcherRows.length) {
    return <p className="text-sm text-slate-400">Run a query to surface recurring authors and research leaders.</p>;
  }

  return (
    <div className="space-y-3">
      {researcherRows.map((row) => (
        <div key={row.name} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white">
              {row.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-slate-100">{row.name}</h4>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>{row.papers.length} papers</span>
                {row.years.length ? <span>{Math.min(...row.years)}–{Math.max(...row.years)}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...row.sources].map((sourceName) => (
                  <span key={sourceName} className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-400">
                    {sourceName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
