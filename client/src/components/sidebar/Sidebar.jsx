import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, MapPin, Tag, Clock, ChevronRight, Copy, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore.js';
import ThemeToggle from '../ui/ThemeToggle.jsx';
import ExportButton from './ExportButton.jsx';

const STAGE_TIMING_ORDER = [
  ['intent', 'Intent'],
  ['expansion', 'Expansion'],
  ['retrieval', 'Retrieval'],
  ['normalization', 'Normalization'],
  ['rerank', 'Rerank'],
  ['context', 'Context'],
  ['llm', 'LLM'],
  ['total', 'Total']
];

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        className="text-[11px] font-medium text-right"
        style={{ color: 'var(--text-secondary)' }}
      >
        {value}
      </span>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="text-[11px] font-bold tabular-nums" style={{ color: color || 'var(--text-secondary)' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function formatStageMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)}ms` : '—';
}

function PipelineDot({ active, label }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="pipeline-dot"
        style={active ? { background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.6)' } : {}}
      />
      <span className="text-[10px]" style={{ color: active ? '#34d399' : 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

export default function Sidebar() {
  const { currentSession, messages, sources, isLoading } = useAppStore();
  const navigate = useNavigate();
  const [copiedTrace, setCopiedTrace] = useState(false);

  const stats = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.retrievalStats)?.retrievalStats || null,
    [messages]
  );

  const location = [currentSession?.location?.city, currentSession?.location?.country]
    .filter(Boolean)
    .join(', ');

  const demographics = [
    Number.isFinite(Number(currentSession?.demographics?.age))
      ? `${Number(currentSession?.demographics?.age)} years`
      : null,
    currentSession?.demographics?.sex || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const pubCount = sources.filter((s) => s.type === 'publication').length;
  const trialCount = sources.filter((s) => s.type === 'trial').length;

  const copyTraceId = async () => {
    if (!stats?.traceId || !navigator?.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(stats.traceId);
      setCopiedTrace(true);
      window.setTimeout(() => setCopiedTrace(false), 1600);
    } catch {
      setCopiedTrace(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}
        >
          Session
        </span>
        <ThemeToggle />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-3">

        {/* Session info card */}
        <div
          className="rounded-xl px-3 py-3"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
          }}
        >
          {currentSession ? (
            <div
              className="divide-y"
              style={{ '--tw-divide-opacity': 1, borderColor: 'var(--color-border)' }}
            >
              <InfoRow label="Disease" value={currentSession.disease} />
              <InfoRow label="Intent" value={currentSession.intent} />
              {location && <InfoRow label={<span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />Location</span>} value={location} />}
              {demographics && (
                <InfoRow
                  label={<span className="flex items-center gap-1"><Tag className="h-2.5 w-2.5" />Demographics</span>}
                  value={demographics}
                />
              )}
            </div>
          ) : (
            <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
              No active session
            </p>
          )}
        </div>

        {/* Pipeline status */}
        <div
          className="rounded-xl px-3 py-3"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Pipeline
          </p>
          <div className="space-y-1.5">
            <PipelineDot active={!!currentSession} label="Session active" />
            <PipelineDot active={pubCount > 0} label={`PubMed / OpenAlex (${pubCount})`} />
            <PipelineDot active={trialCount > 0} label={`ClinicalTrials (${trialCount})`} />
            <PipelineDot active={isLoading} label={isLoading ? 'LLM generating…' : 'LLM ready'} />
          </div>
        </div>

        {/* Retrieval stats */}
        {stats && (
          <div
            className="rounded-xl px-3 py-3"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Last Retrieval
            </p>
            <div className="space-y-0.5">
              <StatRow label="Total candidates" value={stats.totalCandidates} color="#60a5fa" />
              <StatRow label="PubMed" value={stats.pubmedFetched} color="#93c5fd" />
              <StatRow label="OpenAlex" value={stats.openalexFetched} color="#c4b5fd" />
              <StatRow label="ClinicalTrials" value={stats.ctFetched} color="#6ee7b7" />
              <div className="my-1.5" style={{ borderTop: '1px solid var(--color-border)' }} />
              <StatRow label="Shown to you" value={stats.rerankedTo} color="#fbbf24" />
              <StatRow
                label={<span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Time</span>}
                value={stats.timeTakenMs ? `${(stats.timeTakenMs / 1000).toFixed(1)}s` : '—'}
              />

              {stats.traceId && (
                <div className="pt-1.5 mt-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-2 py-1">
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Trace ID
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="text-[10px] font-mono text-right break-all"
                        style={{ color: 'var(--text-secondary)' }}
                        title={stats.traceId}
                      >
                        {stats.traceId}
                      </span>
                      <button
                        type="button"
                        onClick={copyTraceId}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-md"
                        style={{
                          color: copiedTrace ? '#34d399' : 'var(--text-muted)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface-3)',
                        }}
                        aria-label="Copy trace ID"
                      >
                        {copiedTrace ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {stats.stageTimingsMs && (
                <div className="pt-1.5 mt-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Stage Trace (ms)
                  </p>
                  <div className="space-y-0.5">
                    {STAGE_TIMING_ORDER.map(([stageKey, label]) => (
                      <StatRow
                        key={stageKey}
                        label={label}
                        value={formatStageMs(stats.stageTimingsMs?.[stageKey])}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Source count pills */}
        {(pubCount > 0 || trialCount > 0) && (
          <div className="flex gap-2">
            {pubCount > 0 && (
              <div
                className="flex-1 rounded-lg px-2 py-2 text-center"
                style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}
              >
                <p className="text-lg font-bold" style={{ color: '#60a5fa' }}>{pubCount}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Papers</p>
              </div>
            )}
            {trialCount > 0 && (
              <div
                className="flex-1 rounded-lg px-2 py-2 text-center"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
              >
                <p className="text-lg font-bold" style={{ color: '#34d399' }}>{trialCount}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Trials</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        className="shrink-0 px-3 py-3 space-y-2 border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/analytics')}
          className="w-full flex items-center justify-between text-xs rounded-xl px-3 py-2.5 transition-all"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(96,165,250,0.3)';
            e.currentTarget.style.color = '#60a5fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <span className="flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5" />
            Analytics Dashboard
          </span>
          <ChevronRight className="h-3 w-3" />
        </button>
        <ExportButton />
      </div>
    </div>
  );
}
