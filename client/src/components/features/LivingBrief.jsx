import { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore.js';
import { usePatientProfile } from '@/hooks/usePatientProfile.js';
import { extractApiError } from '@/utils/api.js';

function Section({ title, content }) {
  if (!String(content || '').trim()) {
    return null;
  }

  return (
    <section className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.13em] token-text-subtle">{title}</h4>
      <p className="text-sm leading-6 token-text">{content}</p>
    </section>
  );
}

export default function LivingBrief({ sessionId, compact = false }) {
  const livingBrief = useAppStore((state) => state.livingBrief);
  const { isLoadingBrief, refreshLivingBrief, regenerateLivingBrief } = usePatientProfile(sessionId);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    void refreshLivingBrief();
  }, [refreshLivingBrief, sessionId]);

  const generatedLabel = useMemo(() => {
    if (!livingBrief?.generatedAt) {
      return 'Not generated yet';
    }

    const date = new Date(livingBrief.generatedAt);
    if (Number.isNaN(date.getTime())) {
      return String(livingBrief.generatedAt);
    }

    return date.toLocaleString();
  }, [livingBrief?.generatedAt]);

  const handleRegenerate = async () => {
    setError('');
    try {
      await regenerateLivingBrief();
    } catch (requestError) {
      setError(extractApiError(requestError, 'Unable to generate session brief.'));
    }
  };

  return (
    <section className="rounded-2xl border token-border token-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] token-text-subtle">
            <FileText className="h-3.5 w-3.5 text-(--accent)" />
            Living Research Brief
          </h3>
          <p className="mt-1.5 text-xs token-text-muted">{generatedLabel}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleRegenerate();
          }}
          disabled={isLoadingBrief}
          className="inline-flex items-center gap-1.5 rounded-lg border token-border bg-(--bg-surface-2) px-3 py-1.5 text-xs font-semibold token-text-muted hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoadingBrief ? 'animate-spin' : ''}`} />
          {livingBrief?.generatedAt ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {error ? (
        <p className="mb-2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,var(--bg-surface))] px-3 py-2.5 text-sm leading-5 text-(--danger)">
          {error}
        </p>
      ) : null}

      {!livingBrief?.generatedAt ? (
        <p className="rounded-lg border token-border token-surface-2 px-3 py-3.5 text-sm leading-6 token-text-muted">
          The brief will summarize background, current evidence, conflicts, and open questions once enough assistant turns are available.
        </p>
      ) : (
        <div className={`space-y-3.5 ${compact ? 'max-h-104 overflow-y-auto pr-1' : ''}`}>
          <Section title="Background" content={livingBrief.background} />
          <Section title="Current Evidence" content={livingBrief.currentEvidence} />
          <Section title="Conflicts" content={livingBrief.conflicts} />
          <Section title="Open Questions" content={livingBrief.openQuestions} />

          {Array.isArray(livingBrief.keySources) && livingBrief.keySources.length > 0 ? (
            <section className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.13em] token-text-subtle">Key Sources</h4>
              <ul className="space-y-2 text-sm token-text-muted">
                {livingBrief.keySources.slice(0, 6).map((source, index) => (
                  <li key={`${source?.id || 'source'}-${index}`} className="rounded-lg border token-border token-surface-2 px-3 py-2 leading-6">
                    <span className="font-semibold token-text">{source?.title || source?.id || 'Untitled source'}</span>
                    {source?.year ? <span className="ml-1">({source.year})</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}
