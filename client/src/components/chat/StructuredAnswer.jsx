import {
  Activity,
  AlertTriangle,
  FileText,
  Microscope,
  Pill,
  Shield,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

const EVIDENCE_STYLES = {
  STRONG: { color: 'text-emerald-400', bg: 'bg-emerald-950 border-emerald-800', Icon: ShieldCheck },
  MODERATE: { color: 'text-amber-400', bg: 'bg-amber-950 border-amber-800', Icon: Shield },
  LIMITED: { color: 'text-rose-400', bg: 'bg-rose-950 border-rose-800', Icon: ShieldAlert }
};

const INSIGHT_ICONS = {
  TREATMENT: Pill,
  DIAGNOSIS: Microscope,
  RISK: AlertTriangle,
  PREVENTION: Shield,
  GENERAL: FileText
};

function CitationTag({ id, onClick }) {
  const isPublication = id?.startsWith('P');
  const className = `rounded px-1.5 py-0.5 font-mono text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
    isPublication
      ? 'border border-blue-700 bg-blue-950 text-blue-300'
      : 'border border-emerald-700 bg-emerald-950 text-emerald-300'
  }`;

  if (!onClick) {
    return <span className={className}>[{id}]</span>;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick(id);
      }}
      className={className}
    >
      [{id}]
    </button>
  );
}

export default function StructuredAnswer({ answer, retrievalStats, onCitationClick }) {
  const evidenceStyle = EVIDENCE_STYLES[answer?.evidence_strength] || EVIDENCE_STYLES.MODERATE;
  const EvidenceIcon = evidenceStyle.Icon || Activity;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className={`flex items-center justify-between border-b border-slate-800 px-4 py-2 ${evidenceStyle.bg}`}>
        <span className={`inline-flex items-center gap-2 text-xs font-medium ${evidenceStyle.color}`}>
          <EvidenceIcon className="h-4 w-4" aria-hidden="true" />
          {answer?.evidence_strength || 'MODERATE'} evidence
        </span>
        {retrievalStats ? (
          <span className="text-[11px] text-slate-400">
            {retrievalStats.totalCandidates ?? 0} candidates → {retrievalStats.rerankedTo ?? 0} shown
          </span>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        {answer?.condition_overview ? (
          <section>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Overview</p>
            <p className="text-sm leading-relaxed text-slate-100">{answer.condition_overview}</p>
          </section>
        ) : null}

        {answer?.research_insights?.length ? (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Research findings</p>
            <div className="space-y-2">
              {answer.research_insights.map((insight, index) => (
                <div key={`${insight.insight}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-slate-300">
                      {(() => {
                        const Icon = INSIGHT_ICONS[insight.type] || FileText;
                        return <Icon className="h-4 w-4" aria-hidden="true" />;
                      })()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-slate-100">{insight.insight}</p>
                      {insight.source_ids?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {insight.source_ids.map((id) => (
                            <CitationTag key={id} id={id} onClick={onCitationClick} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {answer?.clinical_trials?.length ? (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Clinical trials</p>
            <div className="space-y-2">
              {answer.clinical_trials.map((trial, index) => (
                <div
                  key={`${trial.summary}-${index}`}
                  className={`rounded-xl border p-3 ${trial.location_relevant ? 'border-emerald-800 bg-emerald-950/30' : 'border-slate-800 bg-slate-950/40'}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">
                      {trial.status || 'UNKNOWN'}
                    </span>
                    {trial.location_relevant ? (
                      <span className="rounded-full border border-emerald-700 bg-emerald-950 px-2 py-0.5 text-[11px] text-emerald-300">
                        Near you
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-100">{trial.summary}</p>
                  {trial.contact ? <p className="mt-1 text-xs text-slate-400">Contact: {trial.contact}</p> : null}
                  {trial.source_ids?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {trial.source_ids.map((id) => (
                        <CitationTag key={id} id={id} onClick={onCitationClick} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {answer?.key_researchers?.length ? (
          <section>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Key researchers</p>
            <div className="flex flex-wrap gap-2">
              {answer.key_researchers.map((researcher) => (
                <span key={researcher} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                  {researcher}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {answer?.recommendations ? (
          <section className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-400">Guidance</p>
            <p className="text-sm leading-relaxed text-slate-200">{answer.recommendations}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}