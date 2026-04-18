import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, Search, TimerReset, Workflow, AlertTriangle } from 'lucide-react';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import AnalyticsMetricCard from '@/components/analytics/AnalyticsMetricCard.jsx';
import AnalyticsChartsTabs from '@/components/analytics/AnalyticsChartsTabs.jsx';
import AnalyticsLoadingSkeleton from '@/components/analytics/AnalyticsLoadingSkeleton.jsx';
import AnalyticsStateNotice from '@/components/analytics/AnalyticsStateNotice.jsx';
import SessionBreakdownPanel from '@/components/analytics/SessionBreakdownPanel.jsx';
import SystemStatusWidget from '@/components/analytics/SystemStatusWidget.jsx';
import { api, extractApiError } from '@/utils/api.js';

function normalizeOverview(rawOverview) {
  const source = rawOverview && typeof rawOverview === 'object' ? rawOverview : {};
  const avgLatencyMs = source.avg_latency_ms ?? (Number(source.avgResponseTimeSec || 0) * 1000);

  const topIntents = Array.isArray(source.top_intents)
    ? source.top_intents
    : Array.isArray(source.intents)
      ? source.intents.map((intent) => ({
          intent: String(intent?.name || intent?.intent || 'GENERAL'),
          count: Number(intent?.count || 0)
        }))
      : [];

  const sourceDistribution = Array.isArray(source.source_distribution)
    ? source.source_distribution
    : Array.isArray(source.distribution)
      ? source.distribution.map((entry) => ({
          source: String(entry?.source || entry?.name || 'Unknown'),
          count: Number(entry?.count || 0),
          percentage: Number(entry?.percentage || 0)
        }))
      : [];

  return {
    total_sessions: Number(source.total_sessions ?? source.totalSessions ?? 0),
    total_queries: Number(source.total_queries ?? source.totalQueries ?? 0),
    total_conflicts: Number(source.total_conflicts ?? source.totalConflicts ?? 0),
    conflict_rate: Number(source.conflict_rate ?? source.conflictRate ?? 0),
    avg_latency_ms: Number(avgLatencyMs || 0),
    p95_latency_ms: Number(source.p95_latency_ms ?? 0),
    top_intents: topIntents,
    daily_activity: Array.isArray(source.daily_activity) ? source.daily_activity : [],
    daily_conflicts: Array.isArray(source.daily_conflicts) ? source.daily_conflicts : [],
    source_distribution: sourceDistribution
  };
}

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  return numeric.toLocaleString();
}

function formatLatency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return '0 ms';
  }
  return `${Math.round(numeric)} ms`;
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return '0%';
  }

  return `${numeric.toFixed(1)}%`;
}

export default function Analytics() {
  const navigate = useNavigate();
  const { sessionId: routeSessionIdParam } = useParams();
  const routeSessionId = String(routeSessionIdParam || '').trim();

  const [overview, setOverview] = useState(() => normalizeOverview({}));
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionBreakdown, setSessionBreakdown] = useState(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [breakdownError, setBreakdownError] = useState('');

  const loadOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    setOverviewError('');

    try {
      const [overviewResponse, sessionsResponse] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/sessions')
      ]);

      const normalizedOverview = normalizeOverview(overviewResponse?.data);
      const fetchedSessions = Array.isArray(sessionsResponse?.data?.sessions)
        ? sessionsResponse.data.sessions
        : [];

      setOverview(normalizedOverview);
      setSessions(fetchedSessions);

      if (fetchedSessions.length === 0) {
        setSelectedSessionId('');
        setSessionBreakdown(null);
      } else {
        setSelectedSessionId((previous) => {
          if (routeSessionId && fetchedSessions.some((session) => session._id === routeSessionId)) {
            return routeSessionId;
          }

          if (previous && fetchedSessions.some((session) => session._id === previous)) {
            return previous;
          }
          return fetchedSessions[0]._id;
        });
      }
    } catch (error) {
      setOverviewError(extractApiError(error, 'Unable to load analytics overview.'));
      setOverview(normalizeOverview({}));
      setSessions([]);
      setSelectedSessionId('');
      setSessionBreakdown(null);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [routeSessionId]);

  const loadSessionBreakdown = useCallback(async (sessionId) => {
    if (!sessionId) {
      setSessionBreakdown(null);
      setBreakdownError('');
      return;
    }

    setIsLoadingBreakdown(true);
    setBreakdownError('');

    try {
      const { data } = await api.get(`/analytics/sessions/${sessionId}/breakdown`);
      setSessionBreakdown(data || null);
    } catch (error) {
      setBreakdownError(extractApiError(error, 'Unable to load session drill-down data.'));
      setSessionBreakdown(null);
    } finally {
      setIsLoadingBreakdown(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadSessionBreakdown(selectedSessionId);
  }, [loadSessionBreakdown, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      if (routeSessionId) {
        navigate('/analytics', { replace: true });
      }
      return;
    }

    if (routeSessionId !== selectedSessionId) {
      navigate(`/analytics/${selectedSessionId}`, { replace: true });
    }
  }, [navigate, routeSessionId, selectedSessionId]);

  const handleSessionChange = useCallback((nextSessionId) => {
    const normalizedSessionId = String(nextSessionId || '').trim();
    setSelectedSessionId(normalizedSessionId);

    if (normalizedSessionId) {
      navigate(`/analytics/${normalizedSessionId}`, { replace: true });
      return;
    }

    navigate('/analytics', { replace: true });
  }, [navigate]);

  const topIntentSummary = useMemo(() => {
    const topIntent = Array.isArray(overview.top_intents) ? overview.top_intents[0] : null;
    if (!topIntent) {
      return 'No intent data yet';
    }

    return `${topIntent.intent} (${topIntent.count})`;
  }, [overview.top_intents]);

  return (
    <div className="min-h-screen token-bg token-text">
      <AppTopNav borderless />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              to={selectedSessionId ? `/research/${selectedSessionId}` : '/app'}
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium token-text-subtle transition-colors hover:text-(--text-primary)"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Research
            </Link>
            <h1 className="text-3xl font-semibold token-text">Analytics Engine</h1>
            <p className="mt-1 text-sm token-text-muted">
              Unified operational and usage analytics across sessions, intents, and evidence retrieval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border token-border token-surface px-4 py-2 text-sm font-semibold token-text transition-colors hover:border-(--accent)"
          >
            <TimerReset className="h-4 w-4" />
            Refresh Overview
          </button>
        </div>

        {overviewError ? (
          <div className="mb-6">
            <AnalyticsStateNotice
              variant="error"
              title="Overview unavailable"
              description={overviewError}
              actionLabel="Retry"
              onAction={() => void loadOverview()}
            />
          </div>
        ) : null}

        {isLoadingOverview ? (
          <AnalyticsLoadingSkeleton />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <AnalyticsMetricCard
                title="Total Sessions"
                value={formatNumber(overview.total_sessions)}
                subtitle="Sessions created"
                icon={Workflow}
                accent="blue"
              />
              <AnalyticsMetricCard
                title="Total Queries"
                value={formatNumber(overview.total_queries)}
                subtitle="Query events captured"
                icon={Search}
                accent="green"
              />
              <AnalyticsMetricCard
                title="Avg Latency"
                value={formatLatency(overview.avg_latency_ms)}
                subtitle="Assistant retrieval response"
                icon={Clock3}
                accent="amber"
              />
              <AnalyticsMetricCard
                title="P95 Latency"
                value={formatLatency(overview.p95_latency_ms)}
                subtitle="Tail latency"
                icon={Clock3}
                accent="slate"
              />
              <AnalyticsMetricCard
                title="Conflict Rate"
                value={formatPercent(overview.conflict_rate)}
                subtitle={`${formatNumber(overview.total_conflicts)} contradiction signals`}
                icon={AlertTriangle}
                accent="amber"
              />
              <SystemStatusWidget avgLatencyMs={overview.avg_latency_ms} />
            </div>

            {overview.total_sessions === 0 && overview.total_queries === 0 ? (
              <AnalyticsStateNotice
                title="No analytics data yet"
                description="Start a research session and run a query to populate this dashboard."
              />
            ) : null}

            <AnalyticsChartsTabs overview={overview} />

            <div className="rounded-2xl border token-border token-surface px-4 py-3 text-sm token-text-muted">
              <span className="font-semibold token-text">Top Intent:</span> {topIntentSummary}
            </div>

            <SessionBreakdownPanel
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              onSessionChange={handleSessionChange}
              breakdown={sessionBreakdown}
              loading={isLoadingBreakdown}
              error={breakdownError}
              onRetry={() => void loadSessionBreakdown(selectedSessionId)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
