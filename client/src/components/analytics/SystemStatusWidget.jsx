import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ServerCrash } from 'lucide-react';
import Card from '@/components/ui/Card.jsx';
import { getSystemHealth } from '@/utils/api.js';

const STATUS_POLL_INTERVAL_MS = 30000;

function normalizeStatus(healthPayload) {
  if (!healthPayload || typeof healthPayload !== 'object') {
    return {
      label: 'Down',
      badgeClass: 'bg-red-950/40 text-red-300 border-red-900/60',
      detail: 'Health endpoint is unavailable.'
    };
  }

  const globalStatus = String(healthPayload.status || '').toLowerCase();
  const dbStatus = String(healthPayload?.db || healthPayload?.services?.db || healthPayload.mongodb || 'offline').toLowerCase();
  const llmStatus = String(healthPayload?.services?.llm || healthPayload.llm || 'offline').toLowerCase();

  if (globalStatus === 'ok' || (dbStatus === 'connected' && llmStatus === 'online')) {
    return {
      label: 'Operational',
      badgeClass: 'bg-[color-mix(in_srgb,var(--success)_12%,var(--bg-surface))] text-(--success) border-[color-mix(in_srgb,var(--success)_35%,transparent)]',
      detail: 'All core services are responding normally.'
    };
  }

  if (globalStatus === 'degraded' || dbStatus === 'degraded' || llmStatus === 'degraded' || dbStatus === 'connected' || llmStatus === 'online') {
    return {
      label: 'Degraded',
      badgeClass: 'bg-[color-mix(in_srgb,var(--warning)_12%,var(--bg-surface))] text-(--warning) border-[color-mix(in_srgb,var(--warning)_35%,transparent)]',
      detail: 'At least one dependency is responding slower than expected.'
    };
  }

  return {
    label: 'Down',
    badgeClass: 'bg-[color-mix(in_srgb,var(--danger)_12%,var(--bg-surface))] text-(--danger) border-[color-mix(in_srgb,var(--danger)_35%,transparent)]',
    detail: 'One or more core services are unreachable.'
  };
}

function formatLatency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 'N/A';
  }
  return `${Math.round(numeric)} ms`;
}

export default function SystemStatusWidget({ avgLatencyMs = 0 }) {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await getSystemHealth();
      setHealth(data || null);
      setError('');
      setLastCheckedAt(new Date());
    } catch (err) {
      setHealth(null);
      setError('Unable to refresh system health. Retrying automatically.');
      setLastCheckedAt(new Date());
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

      await fetchHealth();
    };

    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void run();
      }
    };

    void run();
    const intervalId = setInterval(() => {
      void run();
    }, STATUS_POLL_INTERVAL_MS);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      disposed = true;
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [fetchHealth]);

  const status = useMemo(() => normalizeStatus(health), [health]);

  return (
    <Card className="token-border token-surface" padding="md">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] token-text-subtle">System Status</p>
          <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${status.badgeClass}`}>
            {status.label === 'Operational' ? <Activity className="h-3.5 w-3.5" /> : null}
            {status.label === 'Degraded' ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
            {status.label === 'Down' ? <ServerCrash className="h-3.5 w-3.5" /> : null}
            <span>{status.label}</span>
          </div>
          <p className="text-sm token-text-muted">{status.detail}</p>
          <p className="text-xs token-text-subtle">Avg latency: {formatLatency(avgLatencyMs)}</p>
          {lastCheckedAt ? (
            <p className="text-[11px] token-text-subtle">Last checked: {lastCheckedAt.toLocaleTimeString()}</p>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-(--warning)">{error}</p> : null}
    </Card>
  );
}
