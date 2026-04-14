import { useMemo } from 'react';

export default function ResearchersTab({ sources }) {
  const researcherRows = useMemo(() => {
    const counts = new Map();

    sources.forEach((source) => {
      (source.authors || []).forEach((author) => {
        const key = author.trim();
        if (!key) {
          return;
        }
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [sources]);

  if (!researcherRows.length) {
    return <p className="text-sm text-slate-400">Researcher spotlight will populate after source retrieval is connected.</p>;
  }

  return (
    <div className="space-y-2">
      {researcherRows.map((row) => (
        <div key={row.name} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
          <p className="text-sm text-slate-200">{row.name}</p>
          <span className="text-xs text-blue-300">{row.count} papers</span>
        </div>
      ))}
    </div>
  );
}
