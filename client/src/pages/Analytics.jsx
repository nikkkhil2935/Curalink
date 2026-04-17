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
      </main>
    </div>
  );
}
