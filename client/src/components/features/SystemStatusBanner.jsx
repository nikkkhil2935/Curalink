import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, CircleX, X } from 'lucide-react';
import { getSystemHealth } from '@/utils/api.js';

const STATUS_POLL_INTERVAL_MS = 60000;

function normalizeServiceStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (['connected', 'online', 'ok'].includes(normalized)) {
    return 'green';
  }

  if (normalized === 'degraded') {
    return 'amber';
  }

  return 'red';
}

function toLabel(status) {
  if (status === 'green') return 'Operational';
  if (status === 'amber') return 'Degraded';
  return 'Offline';
}

function StatusDot({ status }) {
  if (status === 'green') {
    return <CheckCircle2 className="h-4 w-4 text-(--success)" aria-hidden="true" />;
  }

  if (status === 'amber') {
    return <CircleAlert className="h-4 w-4 text-(--warning)" aria-hidden="true" />;
  }

  return <CircleX className="h-4 w-4 text-(--danger)" aria-hidden="true" />;
}

export default function SystemStatusBanner() {
  const [serviceState, setServiceState] = useState({ api: 'amber', db: 'amber', llm: 'amber' });
  const [dismissed, setDismissed] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await getSystemHealth({ timeout: 8000 });

      const dbState = normalizeServiceStatus(data?.db || data?.services?.db);
      const llmState = normalizeServiceStatus(data?.llm || data?.services?.llm);
      const apiState = 'green';

      setServiceState({ api: apiState, db: dbState, llm: llmState });
    } catch {
      setServiceState({ api: 'red', db: 'red', llm: 'red' });
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    const run = async () => {
      if (disposed) {
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      await refreshStatus();
    };

    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void run();
      }
    };

    void run();
    const timer = setInterval(() => {
      void run();
    }, STATUS_POLL_INTERVAL_MS);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      disposed = true;
      clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [refreshStatus]);

  const allGreen = useMemo(
    () => serviceState.api === 'green' && serviceState.db === 'green' && serviceState.llm === 'green',
    [serviceState]
  );

  useEffect(() => {
    if (!allGreen) {
      setDismissed(false);
      return;
    }

    const timer = setTimeout(() => setDismissed(true), 2500);
    return () => clearTimeout(timer);
  }, [allGreen]);

  if (dismissed) {
    return null;
  }

  const toneClass = allGreen
    ? 'border-[color-mix(in_srgb,var(--success)_40%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,var(--bg-surface))]'
    : 'border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,var(--bg-surface))]';

  return (
    <div className={`border-b px-4 py-2 ${toneClass}`} role="status" aria-live="polite">
      <div className="mx-auto flex w-full max-w-300 items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium token-text">
          <span className="uppercase tracking-[0.12em] token-text-subtle">System Status</span>

          <div className="inline-flex items-center gap-1.5">
            <StatusDot status={serviceState.api} />
            <span>API: {toLabel(serviceState.api)}</span>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <StatusDot status={serviceState.db} />
            <span>DB: {toLabel(serviceState.db)}</span>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <StatusDot status={serviceState.llm} />
            <span>LLM: {toLabel(serviceState.llm)}</span>
          </div>
        </div>

        <button
          type="button"
          aria-label="Dismiss status banner"
          onClick={() => setDismissed(true)}
          className="rounded-md p-1 token-text-subtle hover:bg-(--bg-surface-2) hover:text-(--text-primary)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
