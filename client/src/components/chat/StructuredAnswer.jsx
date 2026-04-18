import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, AlertCircle } from 'lucide-react';

<<<<<<< HEAD
const STRENGTH_CONFIG = {
  STRONG:   { cls: 'badge-strong',   label: 'Strong Evidence',   emoji: '🟢' },
  MODERATE: { cls: 'badge-moderate', label: 'Moderate Evidence', emoji: '🟡' },
  LIMITED:  { cls: 'badge-limited',  label: 'Limited Evidence',  emoji: '🔴' },
=======
const strengthConfig = {
  LIMITED: {
    chip: 'border-[color-mix(in_srgb,var(--danger)_38%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,var(--bg-surface))] text-(--danger)',
    label: 'Limited'
  },
  MODERATE: {
    chip: 'border-[color-mix(in_srgb,var(--warning)_38%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,var(--bg-surface))] text-(--warning)',
    label: 'Moderate'
  },
  STRONG: {
    chip: 'border-[color-mix(in_srgb,var(--success)_38%,transparent)] bg-[color-mix(in_srgb,var(--success)_12%,var(--bg-surface))] text-(--success)',
    label: 'Strong'
  }
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
};

const INSIGHT_ICONS = {
  TREATMENT:  '💊',
  DIAGNOSIS:  '🔬',
  RISK:       '⚠️',
  PREVENTION: '🛡️',
  GENERAL:    '📋',
};

const STAGE_LABELS = {
  intent: 'Intent',
  expansion: 'Expansion',
  retrieval: 'Retrieval',
  normalization: 'Normalization',
  rerank: 'Rerank',
  context: 'Context',
  llm: 'LLM',
};

function CitationTag({ id }) {
  const isTrial = id?.startsWith('T');
  return (
    <span className={isTrial ? 'cite-trial' : 'cite-pub'}>
      [{id}]
    </span>
  );
}

function SectionHeader({ children }) {
  return (
    <h4
      className="text-[10px] font-bold uppercase tracking-widest mb-3"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </h4>
  );
}

function sanitize(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/Now provide a structured JSON response following the output format\.?/gi, '')
    .replace(/SOURCES \(use ONLY these\):?/gi, '')
    .trim();
}

export default function StructuredAnswer({ answer, stats }) {
<<<<<<< HEAD
  const [expandedInsights, setExpandedInsights] = useState({});
  const strength = STRENGTH_CONFIG[answer.evidence_strength] || STRENGTH_CONFIG.MODERATE;

  const traceSummary = useMemo(() => {
    const timings = stats?.stageTimingsMs;
    if (!timings || typeof timings !== 'object') {
      return null;
    }

    const stages = Object.entries(timings)
      .filter(([stageKey, value]) => stageKey !== 'total' && Number.isFinite(Number(value)) && Number(value) > 0)
      .map(([stageKey, value]) => ({
        stageKey,
        label: STAGE_LABELS[stageKey] || stageKey,
        ms: Number(value),
      }))
      .sort((a, b) => b.ms - a.ms);

    if (!stages.length) {
      return null;
    }

    const totalMs = Number.isFinite(Number(stats?.timeTakenMs))
      ? Number(stats.timeTakenMs)
      : Number.isFinite(Number(timings.total))
        ? Number(timings.total)
        : null;

    return {
      slowest: stages[0],
      totalMs,
    };
  }, [stats]);

  const evidenceQuality = useMemo(() => {
    const citationSet = new Set();

    const pushCitationIds = (items) => {
      (Array.isArray(items) ? items : []).forEach((item) => {
        (Array.isArray(item?.source_ids) ? item.source_ids : []).forEach((id) => {
          const normalized = String(id || '').trim().toUpperCase();
          if (normalized) citationSet.add(normalized);
        });
      });
    };

    pushCitationIds(answer?.research_insights);
    pushCitationIds(answer?.clinical_trials);

    const citedPublications = [...citationSet].filter((id) => id.startsWith('P')).length;
    const citedTrials = [...citationSet].filter((id) => id.startsWith('T')).length;
    const citedTotal = citationSet.size;
    const contextCount = Number.isFinite(stats?.rerankedTo) ? Number(stats.rerankedTo) : 0;
    const coveragePercent = contextCount > 0
      ? Math.max(0, Math.min(100, Math.round((citedTotal / contextCount) * 100)))
      : null;

    const representedTypes = [citedPublications > 0, citedTrials > 0].filter(Boolean).length;
    const diversityLabel = representedTypes === 2
      ? 'Cross-source'
      : representedTypes === 1
        ? 'Single-source'
        : 'Uncited';

    return {
      citedTotal,
      citedPublications,
      citedTrials,
      coveragePercent,
      contextCount,
      totalCandidates: Number.isFinite(stats?.totalCandidates) ? Number(stats.totalCandidates) : null,
      diversityLabel,
    };
  }, [answer, stats]);

  const toggleInsight = (i) =>
    setExpandedInsights((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="space-y-5">
      {/* ── Evidence header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${strength.cls}`}>
          {strength.emoji} {strength.label}
        </span>
        {stats && (
          <span
            className="text-[11px] font-mono"
            style={{ color: 'var(--text-muted)' }}
          >
            {stats.totalCandidates} candidates → {stats.rerankedTo} shown
=======
  const insightIcons = {
    TREATMENT: 'Tx', DIAGNOSIS: 'Dx', RISK: 'Risk', PREVENTION: 'Prev', GENERAL: 'Info'
  };
  
  const evidence = strengthConfig[answer.evidence_strength] || strengthConfig.MODERATE;

  return (
    <div className="flex flex-col space-y-4 w-full">
      <div className="flex items-center justify-between rounded-lg border token-border token-surface px-3 py-2 text-xs">
        <span className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.12em] ${evidence.chip}`}>
          {evidence.label} Evidence
        </span>
        {stats && (
          <span className="font-mono token-text-subtle">
            {stats.totalCandidates} candidates &rarr; {stats.rerankedTo} shown
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
          </span>
        )}
      </div>

      {(traceSummary || stats?.traceId) && (
        <div
          className="text-[11px] rounded-lg px-2.5 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--text-muted)',
          }}
        >
          {traceSummary?.slowest && (
            <span>
              Slowest stage: <span style={{ color: 'var(--text-secondary)' }}>{traceSummary.slowest.label}</span>{' '}
              ({Math.round(traceSummary.slowest.ms)}ms)
            </span>
          )}
          {Number.isFinite(traceSummary?.totalMs) && (
            <span>
              Total: <span style={{ color: 'var(--text-secondary)' }}>{Math.round(traceSummary.totalMs)}ms</span>
            </span>
          )}
          {stats?.traceId && (
            <span className="font-mono truncate max-w-full" title={stats.traceId}>
              Trace: {stats.traceId}
            </span>
          )}
        </div>
      )}

      {/* ── Condition Overview ── */}
      <section>
        <SectionHeader>Evidence Quality</SectionHeader>
        <div
          className="rounded-xl p-3"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div
              className="rounded-lg px-3 py-2"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                Citation Coverage
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                {evidenceQuality.citedTotal} / {evidenceQuality.contextCount || '—'}
              </p>
            </div>

            <div
              className="rounded-lg px-3 py-2"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                Source Diversity
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                {evidenceQuality.diversityLabel}
              </p>
            </div>

            <div
              className="rounded-lg px-3 py-2"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                Retrieval Breadth
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                {evidenceQuality.totalCandidates ?? '—'} candidates
              </p>
            </div>
          </div>

          {evidenceQuality.coveragePercent !== null && (
            <>
              <div
                className="mt-3 h-1.5 w-full rounded-full overflow-hidden"
                style={{ background: 'var(--color-surface-2)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${evidenceQuality.coveragePercent}%`,
                    background: 'linear-gradient(90deg, #2563eb, #34d399)',
                  }}
                />
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {evidenceQuality.coveragePercent}% of context sources are cited in the structured answer.
                ({evidenceQuality.citedPublications} publication citations, {evidenceQuality.citedTrials} trial citations)
              </p>
            </>
          )}
        </div>
      </section>

      {answer.condition_overview && (
<<<<<<< HEAD
        <section>
          <SectionHeader>Overview</SectionHeader>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--text-primary)' }}
          >
            {sanitize(answer.condition_overview)}
          </p>
=======
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider token-text-subtle">Overview</h3>
          <p className="text-sm leading-relaxed token-text">{answer.condition_overview}</p>
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
        </section>
      )}

      {/* ── Research Findings ── */}
      {answer.research_insights?.length > 0 && (
<<<<<<< HEAD
        <section>
          <SectionHeader>Research Findings</SectionHeader>
          <div className="space-y-2">
            {answer.research_insights.map((ri, i) => {
              const expanded = expandedInsights[i];
              const text = sanitize(ri.insight);
              const isLong = text.length > 200;

              return (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="flex items-start gap-3 p-3">
                    <span className="text-base shrink-0 mt-0.5">
                      {INSIGHT_ICONS[ri.type] || '📋'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-relaxed ${!expanded && isLong ? 'line-clamp-3' : ''}`}
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {text}
                      </p>

                      {/* Citation tags */}
                      {ri.source_ids?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ri.source_ids.map((id) => (
                            <CitationTag key={id} id={id} />
=======
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider token-text-subtle">Research Findings</h3>
          <ul className="space-y-3">
            {answer.research_insights.map((ri, i) => (
              <li key={i} className="flex items-start space-x-3 rounded-lg border token-border token-surface-2 p-3">
                <span className="inline-flex min-w-9 justify-center rounded-md bg-(--accent-soft) px-1 py-0.5 text-[11px] font-semibold text-(--accent)">
                  {insightIcons[ri.type] || 'Info'}
                </span>
                <div className="w-full space-y-2">
                  {(() => {
                    const parsed = parseInsightContent(ri.insight);
                    return (
                      <>
                        <p className="text-sm leading-relaxed wrap-break-word token-text">
                          {parsed.overview || sanitizeInsightText(ri.insight)}
                        </p>

                        {parsed.sources.length > 0 && (
                          <details className="rounded-md border token-border token-surface">
                            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-(--accent)">
                              View source snippets ({parsed.sources.length})
                            </summary>
                            <ul className="space-y-2 border-t token-border px-3 py-3">
                              {parsed.sources.map((source, idx) => (
                                <li key={`${source.id || 'source'}-${idx}`} className="text-xs leading-relaxed wrap-break-word token-text-muted">
                                  <span className="mr-2 font-mono text-(--accent)">[{source.id || idx + 1}]</span>
                                  {source.description}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        <div className="inline-flex flex-wrap gap-1">
                          {ri.source_ids?.map((id, j) => (
                            <span key={j} className="text-xs font-mono text-(--accent)">[{id}]</span>
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
                          ))}
                        </div>
                      )}

                      {isLong && (
                        <button
                          type="button"
                          onClick={() => toggleInsight(i)}
                          className="flex items-center gap-1 text-[11px] mt-2 transition-colors"
                          style={{ color: '#60a5fa' }}
                        >
                          {expanded ? (
                            <><ChevronUp className="h-3 w-3" />Show less</>
                          ) : (
                            <><ChevronDown className="h-3 w-3" />Show more</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Clinical Trials ── */}
      {answer.clinical_trials?.length > 0 && (
<<<<<<< HEAD
        <section>
          <SectionHeader>Clinical Trials</SectionHeader>
          <div className="space-y-2">
            {answer.clinical_trials.map((ct, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 ${ct.status === 'RECRUITING' ? 'trial-recruiting' : ''} ${ct.location_relevant ? 'trial-location-match' : ''}`}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      ct.status === 'RECRUITING'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}
                    style={ct.status !== 'RECRUITING' ? { background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' } : {}}
                  >
                    {ct.status || 'UNKNOWN'}
                  </span>
                  {ct.location_relevant && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-green-400">
                      <MapPin className="h-3 w-3" /> Near You
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {sanitize(ct.summary)}
                </p>

                {ct.contact && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Contact: {ct.contact}
                  </p>
                )}

                {ct.source_ids?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ct.source_ids.map((id) => <CitationTag key={id} id={id} />)}
                  </div>
                )}
=======
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider token-text-subtle">Clinical Trials</h3>
          <div className="space-y-2">
            {answer.clinical_trials.map((ct, i) => (
              <div key={i} className="rounded-lg border token-border token-surface p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ct.status === 'RECRUITING' ? 'bg-[color-mix(in_srgb,var(--success)_14%,var(--bg-surface))] text-(--success)' : 'token-surface-2 token-text-subtle'}`}>
                    {ct.status}
                  </span>
                  {ct.location_relevant && <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_14%,var(--bg-surface))] px-2 py-0.5 text-xs text-(--success)">Near You</span>}
                </div>
                <p className="mb-1 token-text">{ct.summary}</p>
                {ct.contact && <p className="border-t token-border pt-1 text-xs token-text-subtle">Contact: {ct.contact}</p>}
                <div className="mt-2 inline-flex flex-wrap gap-1">
                  {(ct.source_ids || []).map((id, j) => (
                    <span key={j} className="text-xs font-mono text-(--accent)">[{String(id).toUpperCase()}]</span>
                  ))}
                </div>
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Key Researchers ── */}
      {answer.key_researchers?.length > 0 && (
        <section>
          <SectionHeader>Key Researchers</SectionHeader>
          <div className="flex flex-wrap gap-1.5">
            {answer.key_researchers.map((r, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  color: '#c4b5fd',
                }}
              >
                {r}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Guidance ── */}
      {answer.recommendations && (
<<<<<<< HEAD
        <section>
          <div
            className="flex gap-3 rounded-xl p-4"
            style={{
              background: 'rgba(37,99,235,0.06)',
              border: '1px solid rgba(37,99,235,0.15)',
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#60a5fa' }} />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#60a5fa' }}>
                Clinical Guidance
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {sanitize(answer.recommendations)}
              </p>
            </div>
=======
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider token-text-subtle">Guidance</h3>
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-(--accent-soft) p-3 text-sm leading-relaxed text-(--text-secondary)">
            {answer.recommendations}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
          </div>
        </section>
      )}
    </div>
  );
}
