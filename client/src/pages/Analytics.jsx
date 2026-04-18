<<<<<<< HEAD
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import OverviewMetrics from '@/components/analytics/OverviewMetrics.jsx';
import OverviewCharts from '@/components/analytics/OverviewCharts.jsx';
import SessionBreakdownPanel from '@/components/analytics/SessionBreakdownPanel.jsx';
import SystemStatusWidget from '@/components/analytics/SystemStatusWidget.jsx';
import {
  AnalyticsChartsSkeleton,
  AnalyticsMetricsSkeleton
} from '@/components/analytics/AnalyticsSkeleton.jsx';
import AnalyticsCard from '@/components/analytics/AnalyticsCard.jsx';
import {
  AnalyticsTabs,
  AnalyticsTabsContent,
  AnalyticsTabsList,
  AnalyticsTabsTrigger
} from '@/components/analytics/AnalyticsTabs.jsx';
import { api, extractApiError } from '@/utils/api.js';

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchOverview = async () => {
      setLoading(true);
      setError('');

      try {
        const { data } = await api.get('/analytics/overview');
        if (!cancelled) {
          setOverview(data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(extractApiError(err, 'Unable to load analytics overview.'));
          setOverview(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  const showEmptyOverview = useMemo(() => {
    if (!overview) {
      return false;
    }

    return Number(overview.total_sessions || 0) === 0 && Number(overview.total_queries || 0) === 0;
  }, [overview]);

  return (
    <div className="min-h-screen cl-canvas">
      <AppTopNav />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3">
          <Link
            to="/app"
            className="inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to research workspace
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Analytics Engine
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Monitor platform usage, latency trends, and per-session research behavior.
            </p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <AnalyticsTabs defaultValue="overview">
              <AnalyticsTabsList>
                <AnalyticsTabsTrigger value="overview">Overview</AnalyticsTabsTrigger>
                <AnalyticsTabsTrigger value="session">Session Drilldown</AnalyticsTabsTrigger>
              </AnalyticsTabsList>

              <AnalyticsTabsContent value="overview" className="space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    <AnalyticsMetricsSkeleton />
                    <AnalyticsChartsSkeleton />
                  </div>
                ) : null}

                {!loading && error ? (
                  <AnalyticsCard title="Analytics Unavailable">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {error}
                    </p>
                  </AnalyticsCard>
                ) : null}

                {!loading && !error && showEmptyOverview ? (
                  <AnalyticsCard title="No Analytics Data Yet">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Analytics will populate after sessions and queries are created.
                    </p>
                  </AnalyticsCard>
                ) : null}

                {!loading && !error && !showEmptyOverview && overview ? (
                  <>
                    <OverviewMetrics overview={overview} />
                    <OverviewCharts overview={overview} />
                  </>
                ) : null}
              </AnalyticsTabsContent>

              <AnalyticsTabsContent value="session">
                <SessionBreakdownPanel />
              </AnalyticsTabsContent>
            </AnalyticsTabs>
          </section>

          <aside>
            <SystemStatusWidget avgLatencyMs={overview?.avg_latency_ms} />
          </aside>
        </div>
=======
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3, Search, TimerReset, Workflow } from 'lucide-react';
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
    avg_latency_ms: Number(avgLatencyMs || 0),
    p95_latency_ms: Number(source.p95_latency_ms ?? 0),
    top_intents: topIntents,
    daily_activity: Array.isArray(source.daily_activity) ? source.daily_activity : [],
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

export default function Analytics() {
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
  }, []);

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
              to="/app"
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
              onSessionChange={setSelectedSessionId}
              breakdown={sessionBreakdown}
              loading={isLoadingBreakdown}
              error={breakdownError}
              onRetry={() => void loadSessionBreakdown(selectedSessionId)}
            />
          </div>
        )}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
      </main>
    </div>
  );
}
