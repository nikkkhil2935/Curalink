import React from 'react';

export default function ResearchersTab({ sources }) {
  const pubs = sources.filter(s => s.type === 'publication' && s.authors?.length > 0);
  
  if (pubs.length === 0) {
    return <div className="text-sm text-gray-500 text-center mt-10">Run a query to see top researchers in this field.</div>;
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
        <div key={i} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex space-x-4 items-start">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
            {r.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{r.name}</h4>
            <div className="flex items-center text-xs text-gray-500 space-x-2 mt-1">
              <span>{r.firstAuthorCount} paper{r.firstAuthorCount !== 1 && 's'}</span>
              <span>•</span>
              {r.years.length > 0 && (
                <span>{Math.min(...r.years)}–{Math.max(...r.years)}</span>
              )}
            </div>
            <div className="flex space-x-2 mt-2">
              {[...r.sources].map(s => (
                <span key={s} className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${s === 'PubMed' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                  {s}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 truncate w-full" title={r.papers[0]}>
              Most recent: {r.papers[0]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}