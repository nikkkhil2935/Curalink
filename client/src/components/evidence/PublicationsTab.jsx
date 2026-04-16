import React, { useState } from 'react';

export default function PublicationsTab({ sources }) {
  const pubs = sources.filter(s => s.type === 'publication');

  if (pubs.length === 0) {
    return <div className="text-sm text-gray-500 text-center mt-10">No publications found. Run a query to start.</div>;
  }

  return (
    <div className="space-y-4">
      {pubs.map((pub, index) => (
        <PublicationCard key={pub.id} pub={pub} index={index} />
      ))}
    </div>
  );
}

function PublicationCard({ pub, index }) {
  const [open, setOpen] = useState(false);
  const badgeColors = pub.source === 'PubMed' 
    ? 'bg-blue-900 text-blue-300 border-blue-700' 
    : 'bg-purple-900 text-purple-300 border-purple-700';

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex space-x-2 items-center">
          <span className="font-mono bg-gray-800 text-gray-300 px-1 rounded">[P{index + 1}]</span>
          <span className={`border px-1.5 py-0.5 rounded ${badgeColors}`}>{pub.source}</span>
          {pub.finalScore > 0.7 && <span className="text-green-400">🟢 Highly Relevant</span>}
        </div>
        <span className="text-gray-500">{pub.year || 'N/A'}</span>
      </div>
      
      <h4 className="text-white font-bold leading-snug text-sm">{pub.title}</h4>
      
      <p className="text-gray-400 text-xs">
        {pub.authors?.slice(0, 3).join(', ')} {pub.authors?.length > 3 ? 'et al.' : ''}
      </p>

      {pub.abstract && (
        <div className="pt-2">
          <button onClick={() => setOpen(!open)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center">
            {open ? 'Hide Abstract' : 'View Abstract'}
          </button>
          {open && (
            <p className="text-xs text-gray-400 mt-2 bg-gray-950 p-2 rounded-lg leading-relaxed mix-blend-screen">
              {pub.abstract}
            </p>
          )}
        </div>
      )}

      {pub.url && (
        <a href={pub.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 inline-block mt-2">
          Open in {pub.source} →
        </a>
      )}
    </div>
  );
}