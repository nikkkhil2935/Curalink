import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCcw, ServerCog } from 'lucide-react';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import Button from '@/components/ui/Button.jsx';
import Card from '@/components/ui/Card.jsx';
import LoadingOverlay from '@/components/ui/LoadingOverlay.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import { api, extractApiError } from '@/utils/api.js';

export default function StatusPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);

  const loadHealth = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/health');
      setHealth(data || null);
    } catch (requestError) {
      setError(extractApiError(requestError, 'Unable to load platform status.'));
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div className="app-shell min-h-screen px-6 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <AppTopNav />

        <section className="surface-panel rounded-3xl p-8">
          <div className="mb-3 flex items-center gap-2 text-cyan-300">
            <ServerCog size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider">Live Platform Status</span>
          </div>

          <h1 className="text-3xl font-black sm:text-4xl">Operational Readiness Snapshot</h1>
          <p className="mt-2 text-sm text-slate-300">
            Use this page to quickly verify API health, database connectivity, and LLM quality mode before demos or deployment checks.
          </p>

          <div className="mt-5">
            <Button variant="secondary" onClick={loadHealth} className="inline-flex items-center gap-2">
              <RefreshCcw size={14} />
              Refresh Status
            </Button>
          </div>
        </section>

        {loading ? (
          <LoadingOverlay message="Checking services..." steps={['Reading API health', 'Verifying database mode', 'Evaluating LLM quality']} />
        ) : null}

        {error ? <ErrorBanner message={error} onRetry={loadHealth} title="Status Check Failed" /> : null}

        {!loading && !error && health ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <HealthCard
              title="API Status"
              value={health.status || 'unknown'}
              detail={`Timestamp: ${health.timestamp || 'n/a'}`}
              ok={health.status === 'ok'}
              Icon={ServerCog}
            />
            <HealthCard
              title="Database"
              value={`${health.mongodb || 'unknown'} (${health.mongodbMode || 'n/a'})`}
              detail={health.mongodb === 'connected' ? 'Primary data layer is reachable' : 'Database is unavailable'}
              ok={health.mongodb === 'connected'}
              Icon={Database}
            />
            <HealthCard
              title="LLM Quality"
              value={`${health.llmQuality || 'unknown'}${health.llmProvider ? ` via ${health.llmProvider}` : ''}`}
              detail={
                health.llm === 'online'
                  ? 'Generation quality path is operational'
                  : health.llm === 'degraded'
                    ? 'Fallback mode active'
                    : 'Generation path offline'
              }
              ok={health.llm === 'online'}
              Icon={health.llm === 'online' ? CheckCircle2 : AlertTriangle}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function HealthCard({ title, value, detail, ok, Icon }) {
  return (
    <Card tone="soft" className="rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-slate-500">{title}</p>
        <Icon size={16} className={ok ? 'text-emerald-400' : 'text-amber-400'} />
      </div>
      <p className={`text-lg font-semibold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-400">{detail}</p>
    </Card>
  );
}
