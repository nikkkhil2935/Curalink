<<<<<<< HEAD
import { useMemo, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
=======
import React, { useMemo, useState } from 'react';
import EvidenceConfidenceBars from '@/components/features/EvidenceConfidenceBars.jsx';
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

const DEFAULT_LIMIT = 8;
const PAGE_SIZE = 20;

function SourceBadge({ source }) {
  const cls = source === 'PubMed' ? 'badge-pubmed' : 'badge-openalex';
  return <span className={cls}>{source}</span>;
}

function ScoreDot({ score }) {
  if (!score || score <= 0.7) return null;
  const color = '#34d399';

  return (
    <span
      className="text-[10px] font-medium flex items-center gap-1"
      style={{ color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      🟢 Highly Relevant
    </span>
  );
}

function PublicationCard({ pub, index }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-0">
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: 'var(--color-surface-3)', color: 'var(--text-muted)' }}
        >
          [P{index + 1}]
        </span>
        <SourceBadge source={pub.source} />
        {pub.isOpenAccess && (
          <span className="text-[10px] font-medium" style={{ color: '#34d399' }}>
            Open Access
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ScoreDot score={pub.finalScore} />
          {pub.year && (
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {pub.year}
            </span>
          )}
        </div>
      </div>

      <div className="px-3 py-2">
        <h4
          className="text-sm font-semibold leading-snug mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {pub.title}
        </h4>

        {pub.authors?.length > 0 && (
          <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
            {pub.authors.slice(0, 3).join(', ')}
            {pub.authors.length > 3 ? ' et al.' : ''}
          </p>
        )}

        {pub.journal && (
          <p className="text-[11px] italic mb-2" style={{ color: 'var(--text-muted)' }}>
            {pub.journal}
          </p>
        )}

        {pub.citedByCount > 0 && (
          <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
            Cited by {pub.citedByCount.toLocaleString()}
          </p>
        )}

        {/* Abstract toggle */}
        {pub.abstract && (
          <>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1 text-[11px] mb-2 transition-colors"
              style={{ color: open ? 'var(--text-secondary)' : '#60a5fa' }}
            >
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {open ? 'Hide Abstract' : 'View Abstract'}
            </button>
            {open && (
              <p
                className="text-xs leading-relaxed rounded-lg px-3 py-2.5 mb-2"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {pub.abstract}
              </p>
            )}
          </>
        )}

        {/* External link */}
        {pub.url && (
          <a
            href={pub.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
            style={{ color: '#60a5fa' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#93c5fd'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#60a5fa'; }}
          >
            Open in {pub.source} <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function PublicationsTab({ sources }) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const pubs = useMemo(() =>
    sources.filter((s) => s.type === 'publication')
           .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0)),
    [sources]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pubs;
    return pubs.filter((p) =>
      p.title?.toLowerCase().includes(q) ||
      p.authors?.join(' ').toLowerCase().includes(q) ||
      p.journal?.toLowerCase().includes(q)
    );
  }, [pubs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pg = Math.min(page, totalPages);
  const visible = showAll
    ? filtered.slice((pg - 1) * PAGE_SIZE, pg * PAGE_SIZE)
    : filtered.slice(0, DEFAULT_LIMIT);

  if (pubs.length === 0) {
    return (
<<<<<<< HEAD
      <p className="text-sm text-center mt-12" style={{ color: 'var(--text-muted)' }}>
        No publications found. Run a query to start.
      </p>
=======
      <div className="mt-10 rounded-xl border token-border token-surface p-6 text-center">
        <p className="text-sm token-text">No publications found yet.</p>
        <p className="mt-1 text-xs token-text-subtle">Ask your first clinical question to retrieve publication evidence.</p>
      </div>
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    );
  }

  return (
<<<<<<< HEAD
    <div className="space-y-3">
      {/* Controls bar */}
      <div
        className="flex flex-col gap-2 rounded-xl px-3 py-3"
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {visible.length} of {filtered.length} papers
=======
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border token-border token-surface px-3 py-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="token-text-muted">
            Showing {visiblePubs.length} of {filteredPubs.length} papers
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
          </span>
          {pubs.length > DEFAULT_LIMIT && (
            <button
              type="button"
              onClick={() => { setShowAll(!showAll); setPage(1); }}
              className="text-xs rounded-lg px-2.5 py-1 transition-all"
              style={{
                background: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
                color: '#60a5fa',
              }}
<<<<<<< HEAD
=======
              className="rounded-md border token-border px-2 py-1 text-(--accent) hover:border-(--accent)"
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
            >
              {showAll ? `Top ${DEFAULT_LIMIT}` : `All (${pubs.length})`}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
<<<<<<< HEAD
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by title, author, journal…"
            className="cl-input pl-8 pr-8 py-1.5 text-xs"
=======
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            aria-label="Search publications by title or author"
            placeholder="Search by title or author"
            className="w-full rounded-md border token-border token-surface px-2 py-1.5 text-xs token-text placeholder:text-(--text-subtle) focus:border-(--accent) focus:outline-none"
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
          />
          {search && (
            <button
<<<<<<< HEAD
              type="button"
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-2.5"
=======
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              className="rounded-md border token-border px-2 py-1 token-text-muted hover:border-(--border-strong)"
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
            >
              <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      {visible.map((pub, i) => (
        <PublicationCard
          key={pub.id}
          pub={pub}
          index={showAll ? (pg - 1) * PAGE_SIZE + i : i}
        />
      ))}

<<<<<<< HEAD
      {/* Pagination */}
      {showAll && filtered.length > PAGE_SIZE && (
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pg === 1}
            className="text-xs rounded-lg px-2.5 py-1 disabled:opacity-40"
            style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--text-secondary)' }}
          >
            Previous
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {pg} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pg >= totalPages}
            className="text-xs rounded-lg px-2.5 py-1 disabled:opacity-40"
            style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--text-secondary)' }}
=======
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
          >
            Next
          </button>
        </div>
      )}

<<<<<<< HEAD
      {filtered.length === 0 && (
        <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
=======
      {filteredPubs.length === 0 && (
        <div className="rounded-lg border token-border token-surface px-3 py-6 text-center text-sm token-text-subtle">
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
          No papers match your search.
        </p>
      )}
    </div>
  );
}
<<<<<<< HEAD
=======

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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
