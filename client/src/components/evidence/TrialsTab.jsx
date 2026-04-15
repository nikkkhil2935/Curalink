import { ExternalLink, MapPin } from 'lucide-react';

const STATUS_STYLES = {
  RECRUITING: 'border-green-800 bg-green-950 text-green-400',
  ACTIVE_NOT_RECRUITING: 'border-yellow-800 bg-yellow-950 text-yellow-400',
  COMPLETED: 'border-blue-800 bg-blue-950 text-blue-400',
  NOT_YET_RECRUITING: 'border-orange-800 bg-orange-950 text-orange-400',
  TERMINATED: 'border-red-800 bg-red-950 text-red-400'
};

function TrialCard({ doc, index }) {
  const statusStyle =
    STATUS_STYLES[doc.status] || 'border-slate-700 bg-slate-900 text-slate-300';
  const citationLabel = doc.citationId || `T${index + 1}`;
  const eligibilityPreview = doc.eligibility ? doc.eligibility.substring(0, 150) : '';
  const isEligibilityTruncated = Boolean(doc.eligibility && doc.eligibility.length > 150);

  return (
    <article
      className={`rounded-xl border p-4 transition ${
        doc.isLocationRelevant
          ? 'border-green-800 bg-slate-900/80 shadow-sm shadow-green-950'
          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
      }`}
    >
      <div className="mb-2 flex items-start gap-2">
        <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-500">[{citationLabel}]</span>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-xs ${statusStyle}`}>
          {(doc.status || 'UNKNOWN').replace(/_/g, ' ')}
        </span>
        {doc.isLocationRelevant ? (
          <span className="ml-auto shrink-0 text-xs font-medium text-green-400">Near You</span>
        ) : null}
      </div>

      <h4 className="mb-2 text-sm font-medium leading-snug text-slate-100">{doc.title || 'Untitled trial'}</h4>

      {doc.phase && doc.phase !== 'N/A' ? <p className="mb-1 text-xs text-slate-400">Phase: {doc.phase}</p> : null}

      {doc.locations?.length ? (
        <p className="mb-1 flex items-center gap-1 text-xs text-slate-400">
          <MapPin size={10} />
          {doc.locations.slice(0, 2).join(' | ')}
          {doc.locations.length > 2 ? ` +${doc.locations.length - 2} more` : ''}
        </p>
      ) : null}

      {doc.contacts?.[0] ? (
        <p className="mb-2 text-xs text-slate-500">
          Contact: {doc.contacts[0].name}
          {doc.contacts[0].email ? ` - ${doc.contacts[0].email}` : ''}
        </p>
      ) : null}

      {doc.eligibility ? (
        <p className="mt-2 line-clamp-2 text-xs text-slate-400">
          Eligibility: {eligibilityPreview}
          {isEligibilityTruncated ? '...' : ''}
        </p>
      ) : null}

      {doc.url ? (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1 rounded px-1 text-xs text-green-300 transition hover:text-green-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          View on ClinicalTrials.gov <ExternalLink size={10} />
        </a>
      ) : null}
    </article>
  );
}

export default function TrialsTab({ sources }) {
  if (!sources.length) {
    return <p className="text-sm text-slate-400">No clinical trials found.</p>;
  }

  return (
    <div className="space-y-3">
      {sources.map((doc, index) => (
        <TrialCard key={doc.id || doc._id || `trial-${index}`} doc={doc} index={index} />
      ))}
    </div>
  );
}
