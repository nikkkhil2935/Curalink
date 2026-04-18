import React, { useMemo, useState } from 'react';
import EvidenceConfidenceBars from '@/components/features/EvidenceConfidenceBars.jsx';

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
    return (
      <div className="mt-10 rounded-xl border token-border token-surface p-6 text-center">
        <p className="text-sm token-text">No publications found yet.</p>
        <p className="mt-1 text-xs token-text-subtle">Ask your first clinical question to retrieve publication evidence.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border token-border token-surface px-3 py-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="token-text-muted">
            Showing {visiblePubs.length} of {filteredPubs.length} papers
          </span>
          {pubs.length > DEFAULT_VISIBLE_PAPERS && (
            <button
              onClick={() => {
                setShowAll((prev) => !prev);
                setPage(1);
              }}
              className="rounded-md border token-border px-2 py-1 text-(--accent) hover:border-(--accent)"
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
            aria-label="Search publications by title or author"
            placeholder="Search by title or author"
            className="w-full rounded-md border token-border token-surface px-2 py-1.5 text-xs token-text placeholder:text-(--text-subtle) focus:border-(--accent) focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              className="rounded-md border token-border px-2 py-1 token-text-muted hover:border-(--border-strong)"
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
        <div className="flex items-center justify-between rounded-lg border token-border token-surface px-3 py-2 text-xs">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={normalizedPage === 1}
            className="rounded-md border token-border px-2 py-1 token-text-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="token-text-subtle">Page {normalizedPage} of {totalPages}</span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={normalizedPage >= totalPages}
            className="rounded-md border token-border px-2 py-1 token-text-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {filteredPubs.length === 0 && (
        <div className="rounded-lg border token-border token-surface px-3 py-6 text-center text-sm token-text-subtle">
          No papers match your search.
        </div>
      )}
    </div>
  );
}

function PublicationCard({ pub, index }) {
  const [open, setOpen] = useState(false);
  const citationLabel = String(pub.citationId || `P${index + 1}`).toUpperCase();
  const badgeColors = pub.source === 'PubMed' 
    ? 'bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg-surface))] text-(--accent) border-[color-mix(in_srgb,var(--accent)_30%,transparent)]' 
    : 'bg-[color-mix(in_srgb,var(--success)_14%,var(--bg-surface))] text-(--success) border-[color-mix(in_srgb,var(--success)_30%,transparent)]';

  return (
    <div className="space-y-2 rounded-xl border token-border token-surface p-4">
      <div className="flex items-center justify-between text-xs">
        <div className="flex space-x-2 items-center">
          <span className="rounded bg-(--bg-surface-2) px-1 font-mono token-text">[{citationLabel}]</span>
          <span className={`border px-1.5 py-0.5 rounded ${badgeColors}`}>{pub.source}</span>
          {pub.finalScore > 0.7 && <span className="text-(--success)">Highly Relevant</span>}
        </div>
        <span className="token-text-subtle">{pub.year || 'N/A'}</span>
      </div>
      
      <h4 className="text-sm font-bold leading-snug token-text">{pub.title}</h4>
      
      <p className="text-xs token-text-subtle">
        {pub.authors?.slice(0, 3).join(', ')} {pub.authors?.length > 3 ? 'et al.' : ''}
      </p>

      {pub.abstract && (
        <div className="pt-2">
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Hide publication abstract' : 'View publication abstract'}
            className="flex items-center text-xs token-text-subtle hover:text-(--text-primary)"
          >
            {open ? 'Hide Abstract' : 'View Abstract'}
          </button>
          {open && (
            <p className="mt-2 rounded-lg bg-(--bg-surface-2) p-2 text-xs leading-relaxed token-text-muted">
              {pub.abstract}
            </p>
          )}
        </div>
      )}

      <EvidenceConfidenceBars breakdown={pub.confidence_breakdown} />

      {pub.url && (
        <a
          href={pub.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${citationLabel} in ${pub.source}`}
          className="mt-2 inline-block text-xs text-(--accent) hover:text-(--accent-hover)"
        >
          Open in {pub.source} →
        </a>
      )}
    </div>
  );
}