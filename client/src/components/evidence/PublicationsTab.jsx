import React, { useMemo, useState } from 'react';

const DEFAULT_VISIBLE_PAPERS = 8;
const ALL_VIEW_PAGE_SIZE = 20;

export default function PublicationsTab({ sources }) {
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const pubs = useMemo(() => sources
    .filter((s) => s.type === 'publication')
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0)), [sources]);

  const filteredPubs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return pubs;
    }

    return pubs.filter((pub) => {
      const title = String(pub.title || '').toLowerCase();
      const authors = Array.isArray(pub.authors) ? pub.authors.join(' ').toLowerCase() : '';
      return title.includes(query) || authors.includes(query);
    });
  }, [pubs, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPubs.length / ALL_VIEW_PAGE_SIZE));
  const normalizedPage = Math.min(page, totalPages);
  const visiblePubs = showAll
    ? filteredPubs.slice((normalizedPage - 1) * ALL_VIEW_PAGE_SIZE, normalizedPage * ALL_VIEW_PAGE_SIZE)
    : filteredPubs.slice(0, DEFAULT_VISIBLE_PAPERS);

  if (pubs.length === 0) {
    return <div className="text-sm text-gray-500 text-center mt-10">No publications found. Run a query to start.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-300">
            Showing {visiblePubs.length} of {filteredPubs.length} papers
          </span>
          {pubs.length > DEFAULT_VISIBLE_PAPERS && (
            <button
              onClick={() => {
                setShowAll((prev) => !prev);
                setPage(1);
              }}
              className="rounded-md border border-gray-700 px-2 py-1 text-blue-300 hover:border-blue-700 hover:text-blue-200"
            >
              {showAll ? `Show Top ${DEFAULT_VISIBLE_PAPERS}` : `Show All (${pubs.length})`}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search by title or author"
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:border-blue-700 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              className="rounded-md border border-gray-700 px-2 py-1 text-gray-300 hover:border-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {visiblePubs.map((pub, index) => (
        <PublicationCard
          key={pub.id}
          pub={pub}
          index={showAll ? ((normalizedPage - 1) * ALL_VIEW_PAGE_SIZE) + index : index}
        />
      ))}

      {showAll && filteredPubs.length > ALL_VIEW_PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={normalizedPage === 1}
            className="rounded-md border border-gray-700 px-2 py-1 text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-400">Page {normalizedPage} of {totalPages}</span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={normalizedPage >= totalPages}
            className="rounded-md border border-gray-700 px-2 py-1 text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {filteredPubs.length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-6 text-center text-sm text-gray-400">
          No papers match your search.
        </div>
      )}
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