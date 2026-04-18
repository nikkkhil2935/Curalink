import { useMemo } from 'react';
import { BookOpen, TrendingUp } from 'lucide-react';

<<<<<<< HEAD
function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
=======
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#2563eb,#7c3aed)',
  'linear-gradient(135deg,#0891b2,#2563eb)',
  'linear-gradient(135deg,#7c3aed,#db2777)',
  'linear-gradient(135deg,#059669,#0891b2)',
  'linear-gradient(135deg,#d97706,#dc2626)',
  'linear-gradient(135deg,#7c3aed,#2563eb)',
  'linear-gradient(135deg,#db2777,#7c3aed)',
  'linear-gradient(135deg,#0891b2,#059669)',
];

function ResearcherCard({ researcher, index, maxPapers }) {
  const pct = Math.round((researcher.paperCount / maxPapers) * 100);
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const yearRange =
    researcher.years.length > 1
      ? `${Math.min(...researcher.years)}–${Math.max(...researcher.years)}`
      : researcher.years[0] || null;

  return (
<<<<<<< HEAD
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ background: gradient }}
        >
          {initials(researcher.name)}
=======
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {researcher.name}
            </h4>
            <span
              className="text-[11px] font-bold shrink-0"
              style={{ color: '#60a5fa' }}
            >
              #{index + 1}
            </span>
          </div>

          <div
            className="flex items-center gap-2 text-[11px] mb-2 flex-wrap"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {researcher.paperCount} paper{researcher.paperCount !== 1 ? 's' : ''}
            </span>
            {yearRange && (
              <>
                <span>·</span>
                <span>{yearRange}</span>
              </>
            )}
          </div>

          {/* Source badges */}
          <div className="flex gap-1.5 mb-3">
            {[...researcher.sources].map((s) => (
              <span
                key={s}
                className={s === 'PubMed' ? 'badge-pubmed' : 'badge-openalex'}
              >
                {s}
              </span>
            ))}
          </div>

          {/* Paper bar */}
          <div
            className="w-full rounded-full overflow-hidden"
            style={{
              height: 4,
              background: 'var(--color-surface-3)',
            }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: gradient }}
            />
          </div>

          {/* Latest paper title */}
          {researcher.latestPaper && (
            <p
              className="text-[11px] mt-2 line-clamp-1"
              style={{ color: 'var(--text-muted)' }}
              title={researcher.latestPaper}
            >
              {researcher.latestPaper}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResearchersTab({ sources }) {
  const researchers = useMemo(() => {
    const pubs = sources.filter(
      (s) => s.type === 'publication' && s.authors?.length > 0
    );
    if (pubs.length === 0) return [];

    const map = {};
    pubs.forEach((p) => {
      p.authors.forEach((author, idx) => {
        if (!author) return;
        if (!map[author]) {
          map[author] = {
            name: author,
            paperCount: 0,
            firstAuthorCount: 0,
            years: [],
            sources: new Set(),
            latestPaper: null,
            latestPaperYear: 0,
          };
        }

        const pubYear = Number.isFinite(p.year) ? Number(p.year) : 0;

        map[author].paperCount++;
        if (idx === 0) {
          map[author].firstAuthorCount++;
        }
        if (pubYear > 0) {
          map[author].years.push(pubYear);
        }

        if ((pubYear || 0) >= (map[author].latestPaperYear || 0)) {
          map[author].latestPaper = p.title;
          map[author].latestPaperYear = pubYear || map[author].latestPaperYear;
        }

        if (p.source) map[author].sources.add(p.source);
      });
    });

    return Object.values(map)
      .sort(
        (a, b) =>
          b.firstAuthorCount - a.firstAuthorCount ||
          b.paperCount - a.paperCount ||
          b.latestPaperYear - a.latestPaperYear
      )
      .slice(0, 8);
  }, [sources]);

  if (researchers.length === 0) {
    return (
      <p className="text-sm text-center mt-12" style={{ color: 'var(--text-muted)' }}>
        Run a query to see top researchers in this field.
      </p>
    );
  }

  const maxPapers = researchers[0]?.paperCount || 1;
  const totalPapers = researchers.reduce((a, r) => a + r.paperCount, 0);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          color: 'var(--text-muted)',
        }}
      >
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" style={{ color: '#60a5fa' }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            {researchers.length} researchers · {totalPapers} papers
          </span>
        </span>
        <span>Sorted by lead-author frequency</span>
      </div>

      {researchers.map((r, i) => (
        <ResearcherCard
          key={r.name}
          researcher={r}
          index={i}
          maxPapers={maxPapers}
        />
      ))}
    </div>
  );
}
