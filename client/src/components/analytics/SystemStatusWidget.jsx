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
  );
}
