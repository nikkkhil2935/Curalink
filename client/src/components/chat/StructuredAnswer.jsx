import React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card.jsx';
import { useAppStore } from '@/store/useAppStore.js';

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
};

function sanitizeInsightText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/Now provide a structured JSON response following the output format\.?/gi, '')
    .trim();
}

function parseInsightContent(rawInsight) {
  const insight = sanitizeInsightText(rawInsight);
  if (!insight) {
    return { overview: '', sources: [] };
  }

  const firstSourceIndex = insight.search(/\[(P\d+|T\d+)\]/i);
  if (firstSourceIndex === -1) {
    return { overview: insight, sources: [] };
  }

  const overview = insight
    .slice(0, firstSourceIndex)
    .replace(/SOURCES \(use ONLY these\):?/i, '')
    .trim();

  const rawSourceChunk = insight
    .slice(firstSourceIndex)
    .replace(/---/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sources = rawSourceChunk
    .split(/\s(?=\[(?:P|T)\d+\])/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^\[((?:P|T)\d+)\]\s*/i);
      return {
        id: match?.[1]?.toUpperCase() || null,
        description: part.replace(/^\[((?:P|T)\d+)\]\s*/i, '').trim()
      };
    })
    .filter((entry) => entry.description);

  return { overview, sources };
}

export default function StructuredAnswer({ answer, stats }) {
  const sessionUploadedDocs = useAppStore((state) => state.sessionUploadedDocs);
  const firstDoc = Array.isArray(sessionUploadedDocs) ? sessionUploadedDocs[0] : null;

  const insightIcons = {
    TREATMENT: 'Tx', DIAGNOSIS: 'Dx', RISK: 'Risk', PREVENTION: 'Prev', GENERAL: 'Info'
  };

  const demographicFlags = Array.isArray(answer?.demographicFlags)
    ? answer.demographicFlags.map((flag) => String(flag || '').trim()).filter(Boolean)
    : [];
  
  const evidence = strengthConfig[answer.evidence_strength] || strengthConfig.MODERATE;

  const renderCitation = (citationId, key) => {
    const normalized = String(citationId || '').toUpperCase();
    if (normalized === 'DOC') {
      return (
        <HoverCard key={key}>
          <HoverCardTrigger asChild>
            <span className="cursor-help rounded-md border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_15%,var(--bg-surface))] px-2 py-0.5 text-xs font-mono text-(--warning)">
              [DOC]
            </span>
          </HoverCardTrigger>
          <HoverCardContent className="w-72 border token-border token-surface p-3 text-xs token-text">
            <p className="mb-1 font-semibold token-text">From your uploaded document</p>
            <p className="token-text-muted">
              {firstDoc?.filename ? `${firstDoc.filename}` : 'Uploaded PDF document'}
              {firstDoc?.document_type ? ` (${String(firstDoc.document_type).replace(/_/g, ' ')})` : ''}
            </p>
          </HoverCardContent>
        </HoverCard>
      );
    }

    return (
      <span key={key} className="text-xs font-mono text-(--accent)">
        [{normalized}]
      </span>
    );
  };

  return (
    <div className="flex flex-col space-y-4 w-full">
      <div className="flex items-center justify-between rounded-lg border token-border token-surface px-3 py-2 text-xs">
        <span className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.12em] ${evidence.chip}`}>
          {evidence.label} Evidence
        </span>
        {stats && (
          <span className="font-mono token-text-subtle">
            {stats.totalCandidates} candidates &rarr; {stats.rerankedTo} shown
          </span>
        )}
      </div>

      {answer.condition_overview && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider token-text-subtle">Overview</h3>
          <p className="text-sm leading-relaxed token-text">{answer.condition_overview}</p>
        </section>
      )}

      {demographicFlags.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider token-text-subtle">Evidence Gaps Flagged</h3>
          <div className="flex flex-wrap gap-1.5">
            {demographicFlags.map((flag) => (
              <span
                key={flag}
                className="rounded-full border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,var(--bg-surface))] px-2 py-0.5 text-[11px] font-medium text-(--warning)"
              >
                {flag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {answer.research_insights?.length > 0 && (
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
                            renderCitation(id, `${id}-${j}`)
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {answer.clinical_trials?.length > 0 && (
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
                    renderCitation(id, `trial-${id}-${j}`)
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {answer.recommendations && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider token-text-subtle">Guidance</h3>
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-(--accent-soft) p-3 text-sm leading-relaxed text-(--text-secondary)">
            {answer.recommendations}
          </div>
        </section>
      )}
    </div>
  );
}