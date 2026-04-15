import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const SOURCE_COLORS = {
  PubMed: 'border-blue-700 bg-blue-950/40 text-blue-300',
  OpenAlex: 'border-violet-700 bg-violet-950/40 text-violet-300',
  ClinicalTrials: 'border-green-700 bg-green-950/40 text-green-300'
};

function PublicationCard({ doc, index }) {
  const [expanded, setExpanded] = useState(false);
  const citationLabel = doc.citationId || `P${index + 1}`;

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-slate-700">
      <div className="mb-2 flex items-start gap-2">
        <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-500">[{citationLabel}]</span>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs ${SOURCE_COLORS[doc.source] || 'border-slate-700 bg-slate-900 text-slate-300'}`}
        >
          {doc.source || 'Unknown'}
        </span>
        {doc.year ? <span className="ml-auto shrink-0 text-xs text-slate-500">{doc.year}</span> : null}
      </div>

      <h4 className="text-sm font-medium leading-snug text-slate-100">{doc.title || 'Untitled'}</h4>

      {doc.authors?.length ? (
        <p className="mt-1 text-xs text-slate-400">
          {doc.authors.slice(0, 3).join(', ')}
          {doc.authors.length > 3 ? ' et al.' : ''}
        </p>
      ) : null}

      {(doc.finalScore || 0) > 0.7 ? <p className="mt-2 text-xs font-medium text-green-400">Highly Relevant</p> : null}

      {expanded && doc.abstract ? (
        <p className="mt-2 border-t border-slate-800 pt-2 text-xs leading-relaxed text-slate-300">{doc.abstract}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {doc.abstract ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1 rounded px-1 text-xs text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide' : 'View Abstract'}
          </button>
        ) : null}

        {doc.url ? (
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 rounded px-1 text-xs text-blue-300 transition hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Open <ExternalLink size={10} />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default function PublicationsTab({ sources }) {
  if (!sources.length) {
    return <p className="text-sm text-slate-400">No publications found.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="mb-3 text-xs text-slate-500">
        Showing top {sources.length} publications ranked by relevance and recency.
      </p>
      {sources.map((doc, index) => (
        <PublicationCard key={doc.id || doc._id || `pub-${index}`} doc={doc} index={index} />
      ))}
    </div>
  );
}
