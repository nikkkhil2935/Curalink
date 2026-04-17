import { useMemo } from 'react';
import { MapPin, ExternalLink, Calendar, Users } from 'lucide-react';

const STATUS_STYLE = {
  RECRUITING:            { text: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)'  },
  ACTIVE_NOT_RECRUITING: { text: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)'  },
  COMPLETED:             { text: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)'  },
  NOT_YET_RECRUITING:    { text: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)'  },
  TERMINATED:            { text: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
  SUSPENDED:             { text: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
};

const STATUS_COLOR_STYLE = {
  green:  { text: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
  yellow: { text: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' },
  blue:   { text: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
  orange: { text: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.25)' },
  red:    { text: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
  gray:   { text: 'var(--text-muted)', bg: 'var(--color-surface-3)', border: 'var(--color-border)' },
};

function StatusBadge({ status, statusColor }) {
  const colorStyle = STATUS_COLOR_STYLE[String(statusColor || '').toLowerCase()];
  const statusStyle = STATUS_STYLE[status];
  const s = colorStyle || statusStyle || { text: 'var(--text-muted)', bg: 'var(--color-surface-3)', border: 'var(--color-border)' };

  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: s.text, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {(status || 'UNKNOWN').replace(/_/g, ' ')}
    </span>
  );
}

function TrialCard({ trial, index }) {
  const isRecruiting = trial.status === 'RECRUITING';
  const isNear = trial.isLocationRelevant;

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all ${isRecruiting ? 'trial-recruiting' : ''} ${isNear ? 'trial-location-match' : ''}`}
      style={{
        background: 'var(--color-surface-2)',
        border: `1px solid ${isNear ? 'rgba(16,185,129,0.3)' : 'var(--color-border)'}`,
      }}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-surface-3)', color: 'var(--text-muted)' }}
          >
            [T{index + 1}]
          </span>
          <StatusBadge status={trial.status} statusColor={trial.statusColor} />
          {isNear && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-400 ml-auto">
              <MapPin className="h-3 w-3" /> Near You
            </span>
          )}
        </div>

        {/* Title */}
        <h4
          className="text-sm font-semibold leading-snug mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          {trial.title}
        </h4>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {trial.phase && trial.phase !== 'N/A' && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--text-secondary)' }}
            >
              Phase {trial.phase}
            </span>
          )}
          {trial.gender && trial.gender !== 'All' && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--text-secondary)' }}
            >
              <Users className="h-2.5 w-2.5" /> {trial.gender}
            </span>
          )}
          {trial.completionDate && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--text-secondary)' }}
            >
              <Calendar className="h-2.5 w-2.5" /> {trial.completionDate}
            </span>
          )}
        </div>

        {/* Locations */}
        {trial.locations?.length > 0 && (
          <div
            className="flex items-start gap-1.5 mb-3 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            <span>
              {trial.locations.slice(0, 2).join(' · ')}
              {trial.locations.length > 2 && ` +${trial.locations.length - 2} more`}
            </span>
          </div>
        )}

        {/* Eligibility snippet */}
        {trial.eligibility && (
          <div
            className="rounded-lg px-3 py-2 mb-3 text-xs leading-relaxed"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Eligibility: </span>
            {trial.eligibility.substring(0, 150)}
            {trial.eligibility.length > 150 ? '…' : ''}
          </div>
        )}

        {/* Contact */}
        {[trial.contacts?.[0]?.name, trial.contacts?.[0]?.email, trial.contacts?.[0]?.phone].some(Boolean) && (
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold">Contact: </span>
            {[trial.contacts?.[0]?.name, trial.contacts?.[0]?.email, trial.contacts?.[0]?.phone]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {/* Link */}
        {trial.url && (
          <a
            href={trial.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
            style={{ color: '#34d399' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#6ee7b7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#34d399'; }}
          >
            View on ClinicalTrials.gov <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function TrialsTab({ sources }) {
  const trials = useMemo(() =>
    sources
      .filter((s) => s.type === 'trial')
      .sort((a, b) => {
        if (a.status === 'RECRUITING' && b.status !== 'RECRUITING') return -1;
        if (a.status !== 'RECRUITING' && b.status === 'RECRUITING') return 1;
        if (a.isLocationRelevant && !b.isLocationRelevant) return -1;
        if (!a.isLocationRelevant && b.isLocationRelevant) return 1;
        return (b.finalScore || 0) - (a.finalScore || 0);
      }),
    [sources]
  );

  const recruitingCount = trials.filter((t) => t.status === 'RECRUITING').length;

  if (trials.length === 0) {
    return (
      <p className="text-sm text-center mt-12" style={{ color: 'var(--text-muted)' }}>
        No clinical trials found for the current query.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {recruitingCount > 0 && (
        <div
          className="flex items-center gap-2 text-xs font-semibold rounded-lg px-3 py-2"
          style={{
            background: 'rgba(52,211,153,0.06)',
            border: '1px solid rgba(52,211,153,0.15)',
            color: '#34d399',
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: '#34d399' }}
          />
          {recruitingCount} trial{recruitingCount !== 1 ? 's' : ''} currently recruiting
        </div>
      )}
      {trials.map((t, i) => (
        <TrialCard key={t.id} trial={t} index={i} />
      ))}
    </div>
  );
}
