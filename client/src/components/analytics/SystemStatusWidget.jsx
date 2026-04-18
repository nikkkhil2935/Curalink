<<<<<<< HEAD
import { useEffect, useMemo, useState } from 'react';
import { ActivitySquare, Clock3, Database, ServerCog } from 'lucide-react';
import AnalyticsCard from '@/components/analytics/AnalyticsCard.jsx';
import AnalyticsBadge from '@/components/analytics/AnalyticsBadge.jsx';
import { api } from '@/utils/api.js';

const POLL_INTERVAL_MS = 10_000;

async function readHealthPayload() {
  // Prefer /health, then fall back to /api/health for local dev proxy compatibility.
  try {
    const rootHealth = await fetch('/health', {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (rootHealth.ok) {
      return await rootHealth.json();
    }
  } catch {
    // Ignore and fall through to API client fallback.
  }

  const { data } = await api.get('/health');
  return data;
}

function toLatencyLabel(avgLatencyMs) {
  const numeric = Number(avgLatencyMs);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 'No data';
  }

  return `${Math.round(numeric).toLocaleString()} ms`;
}

function deriveStatus(healthData) {
  if (!healthData) {
    return { tone: 'down', label: 'Down' };
  }

  const isMongoConnected = healthData.mongodb === 'connected';
  const llmState = String(healthData.llm || '').toLowerCase();
  const apiStatus = String(healthData.status || '').toLowerCase();

  if (apiStatus === 'ok' && isMongoConnected && llmState === 'online') {
    return { tone: 'operational', label: 'Operational' };
  }

  if (apiStatus === 'degraded' || llmState === 'degraded' || !isMongoConnected) {
    return { tone: 'degraded', label: 'Degraded' };
  }

  return { tone: 'down', label: 'Down' };
}

export default function SystemStatusWidget({ avgLatencyMs }) {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let canceled = false;

    const fetchHealth = async () => {
      try {
        const data = await readHealthPayload();
        if (!canceled) {
          setHealthData(data);
          setError('');
        }
      } catch (err) {
        if (!canceled) {
          setError('System status is temporarily unavailable.');
          setHealthData(null);
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    void fetchHealth();
    const timer = setInterval(() => {
      void fetchHealth();
    }, POLL_INTERVAL_MS);

    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, []);

  const status = useMemo(() => deriveStatus(healthData), [healthData]);

  return (
    <AnalyticsCard
      title="System Status"
      description="Live health check every 10 seconds"
      action={<AnalyticsBadge tone={status.tone}>{status.label}</AnalyticsBadge>}
      className="sticky top-20"
    >
      {loading ? (
        <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>Checking backend health...</p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--text-secondary)' }}>
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Clock3 className="h-3.5 w-3.5" />
                Avg latency
              </div>
              <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {toLatencyLabel(avgLatencyMs)}
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Database className="h-3.5 w-3.5" />
                Database
              </div>
              <p className="mt-1 text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                {healthData?.mongodb || 'unknown'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <ActivitySquare className="h-3.5 w-3.5" />
                API
              </div>
              <p className="mt-1 text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                {healthData?.status || 'unknown'}
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <ServerCog className="h-3.5 w-3.5" />
                LLM
              </div>
              <p className="mt-1 text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                {healthData?.llm || 'unknown'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </AnalyticsCard>
=======
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ServerCrash } from 'lucide-react';
import Card from '@/components/ui/Card.jsx';
import { api } from '@/utils/api.js';

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
      const { data } = await api.get('/health');
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
      await fetchHealth();
    };

    void run();
    const intervalId = setInterval(() => {
      void run();
    }, 10000);

    return () => {
      disposed = true;
      clearInterval(intervalId);
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
  );
}
