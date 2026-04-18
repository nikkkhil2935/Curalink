import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet.jsx';
import { useAppStore } from '@/store/useAppStore.js';
import { api, extractApiError } from '@/utils/api.js';

function severityClass(severity) {
  const normalized = String(severity || 'low').toLowerCase();

  if (normalized === 'high') {
    return 'text-(--danger) bg-[color-mix(in_srgb,var(--danger)_14%,var(--bg-surface))]';
  }

  if (normalized === 'medium') {
    return 'text-(--warning) bg-[color-mix(in_srgb,var(--warning)_14%,var(--bg-surface))]';
  }

  return 'text-(--accent) bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg-surface))]';
}

export default function ConflictExplorerSheet({ sessionId, open, onOpenChange }) {
  const { sessionConflicts, setSessionConflicts } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const sortedGroups = useMemo(() => {
    const groups = Array.isArray(sessionConflicts?.outcomeGroups) ? sessionConflicts.outcomeGroups : [];
    return [...groups].sort((left, right) => Number(right?.count || 0) - Number(left?.count || 0));
  }, [sessionConflicts?.outcomeGroups]);

  const loadConflicts = async () => {
    if (!sessionId) {
      setSessionConflicts({ totalConflicts: 0, outcomeGroups: [] });
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/sessions/${sessionId}/conflicts`);
      setSessionConflicts({
        totalConflicts: Number(data?.totalConflicts || 0),
        outcomeGroups: Array.isArray(data?.outcomeGroups) ? data.outcomeGroups : []
      });
    } catch (requestError) {
      setError(extractApiError(requestError, 'Unable to load conflict breakdown.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadConflicts();
  }, [open, sessionId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l token-border token-surface p-0 sm:max-w-2xl"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b token-border px-6 py-5">
            <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-(--text-primary)">
              <AlertTriangle className="h-5 w-5 text-(--warning)" />
              Evidence Contradiction Explorer
            </SheetTitle>
            <SheetDescription className="text-sm leading-6 text-(--text-muted)">
              Review where studies disagree, grouped by contested clinical outcome.
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-between border-b token-border px-6 py-3.5 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] token-text-subtle">Total conflicts</p>
              <p className="mt-1 text-xl font-semibold token-text">{Number(sessionConflicts?.totalConflicts || 0)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadConflicts();
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border token-border bg-(--bg-surface-2) px-3 py-2 text-xs font-semibold token-text-muted hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="scrollbar-thin flex-1 space-y-3.5 overflow-y-auto px-6 py-5">
            {error ? (
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_9%,var(--bg-surface))] px-4 py-3 text-sm leading-6 text-(--danger)">
                {error}
              </div>
            ) : null}

            {!error && !isLoading && sortedGroups.length === 0 ? (
              <div className="rounded-xl border token-border token-surface-2 px-4 py-5 text-center text-sm leading-6 token-text-muted">
                No contradictions detected yet for this session.
              </div>
            ) : null}

            {sortedGroups.map((group) => {
              const sources = Array.isArray(group?.sources) ? group.sources : [];
              const topSamples = sources.slice(0, 5);

              return (
                <article key={group.outcomePhrase} className="rounded-2xl border token-border token-surface p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold leading-5 token-text">{group.outcomePhrase}</h4>
                    <span className="rounded-full bg-(--bg-surface-2) px-2.5 py-1 text-[11px] font-semibold token-text-muted">
                      {Number(group.count || 0)} pairs
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${severityClass(group.maxSeverity)}`}
                    >
                      {String(group.maxSeverity || 'low')}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {topSamples.map((item, index) => (
                      <div key={`${group.outcomePhrase}-${index}`} className="rounded-lg border token-border token-surface-2 px-3 py-2.5 text-sm leading-6">
                        <p className="token-text">
                          <span className="font-semibold token-text-subtle">A</span>
                          <span className="mx-1.5 token-text-subtle">-</span>
                          <span>{item?.sourceA || 'Unknown source'}</span>
                        </p>
                        <p className="mt-1 token-text">
                          <span className="font-semibold token-text-subtle">B</span>
                          <span className="mx-1.5 token-text-subtle">-</span>
                          <span>{item?.sourceB || 'Unknown source'}</span>
                        </p>
                        <p className="mt-1 text-xs token-text-muted">
                          Score: {Number(item?.conflictScore || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
