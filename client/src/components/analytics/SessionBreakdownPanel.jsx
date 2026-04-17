import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Search } from 'lucide-react';
import { api, extractApiError } from '@/utils/api.js';
import AnalyticsBadge from '@/components/analytics/AnalyticsBadge.jsx';
import AnalyticsCard from '@/components/analytics/AnalyticsCard.jsx';
import {
  AnalyticsChartsSkeleton,
  AnalyticsListSkeleton,
  AnalyticsMetricsSkeleton
} from '@/components/analytics/AnalyticsSkeleton.jsx';

const CHART_COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6'];

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }

  return Math.round(numeric).toLocaleString();
}

function formatMilliseconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 'No data';
  }

  return `${Math.round(numeric).toLocaleString()} ms`;
}

function BreakdownTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--text-primary)' }}
    >
      <p className="font-semibold">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color || 'var(--text-secondary)' }}>
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function SessionBreakdownPanel() {
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const metrics = useMemo(() => {
    if (!breakdown) {
      return [];
    }

    const totals = breakdown.totals || {};
    return [
      { label: 'Queries', value: formatNumber(breakdown.total_queries) },
      { label: 'Avg Latency', value: formatMilliseconds(breakdown.avg_latency_ms) },
      { label: 'P95 Latency', value: formatMilliseconds(breakdown.p95_latency_ms) },
      { label: 'Unique Sources', value: formatNumber(totals.uniqueSources) }
    ];
  }, [breakdown]);

  async function onSubmit(event) {
    event.preventDefault();

    const sessionId = sessionIdInput.trim();
    if (!sessionId) {
      setError('Session ID is required to load breakdown analytics.');
      setBreakdown(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.get(`/analytics/sessions/${encodeURIComponent(sessionId)}/breakdown`);
      setBreakdown(data || null);
    } catch (err) {
      setBreakdown(null);
      setError(extractApiError(err, 'Unable to load session breakdown.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <AnalyticsCard
        title="Session Drilldown"
        description="Load a session by ID to inspect per-session intents, latencies, and source usage"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="session-breakdown-id">
            Session ID
          </label>
          <input
            id="session-breakdown-id"
            name="session-breakdown-id"
            className="cl-input"
            placeholder="Enter session id"
            value={sessionIdInput}
            onChange={(event) => setSessionIdInput(event.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="cl-btn-primary h-10 px-4 text-sm">
            <Search className="h-4 w-4" />
            Load Breakdown
          </button>
        </form>
        {error ? (
          <p className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--text-secondary)' }}>
            {error}
          </p>
        ) : null}
      </AnalyticsCard>

      {loading ? (
        <div className="space-y-4">
          <AnalyticsMetricsSkeleton />
          <AnalyticsChartsSkeleton />
          <AnalyticsListSkeleton rows={4} />
        </div>
      ) : null}

      {!loading && !breakdown && !error ? (
        <AnalyticsCard>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Session-level analytics will appear here after you load a valid session ID.
          </p>
        </AnalyticsCard>
      ) : null}

      {!loading && breakdown ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <AnalyticsCard key={metric.label}>
                <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
                  {metric.label}
                </p>
                <p className="mt-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {metric.value}
                </p>
              </AnalyticsCard>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AnalyticsCard title="Intent Breakdown" description="Per-session intent classification counts">
              <div className="h-64">
                {breakdown.intent_breakdown?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdown.intent_breakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="intent_type"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip content={<BreakdownTooltip />} />
                      <Bar dataKey="count" name="Queries" radius={[4, 4, 0, 0]}>
                        {breakdown.intent_breakdown.map((entry, index) => (
                          <Cell key={`${entry.intent_type}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No intent breakdown data is available for this session.
                  </p>
                )}
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="Daily Query Activity" description="Assistant query volume by day">
              <div className="h-64">
                {breakdown.daily_activity?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={breakdown.daily_activity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        tickFormatter={(value) => String(value).slice(5)}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip content={<BreakdownTooltip />} />
                      <Line type="monotone" dataKey="queries" name="Queries" stroke="#3b82f6" strokeWidth={2.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No daily activity data is available for this session.
                  </p>
                )}
              </div>
            </AnalyticsCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AnalyticsCard title="Evidence Strength" description="Evidence labels generated for this session">
              <div className="flex flex-wrap gap-2">
                {(breakdown.evidence_strength_trend || []).map((entry) => {
                  const tone = entry.label === 'STRONG' ? 'operational' : entry.label === 'MODERATE' ? 'degraded' : 'down';
                  return (
                    <AnalyticsBadge key={entry.label} tone={tone} className="normal-case tracking-normal">
                      {entry.label}: {formatNumber(entry.count)}
                    </AnalyticsBadge>
                  );
                })}
                {!breakdown.evidence_strength_trend?.length ? (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No evidence strength data is available for this session.
                  </p>
                ) : null}
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="Source Distribution" description="Unique source providers cited in this session">
              <div className="space-y-2">
                {(breakdown.source_distribution || []).map((entry) => (
                  <div
                    key={entry.source}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <span style={{ color: 'var(--text-primary)' }}>{entry.source}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {formatNumber(entry.count)} ({Number(entry.percentage || 0).toFixed(1)}%)
                    </span>
                  </div>
                ))}
                {!breakdown.source_distribution?.length ? (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No source distribution data is available for this session.
                  </p>
                ) : null}
              </div>
            </AnalyticsCard>
          </div>

          <AnalyticsCard title="Recent Queries" description="Latest session queries captured in history">
            <div className="space-y-2">
              {(breakdown.recent_queries || []).map((entry) => (
                <div
                  key={`${entry.position}-${entry.query}`}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--text-secondary)' }}
                >
                  {entry.query}
                </div>
              ))}
              {!breakdown.recent_queries?.length ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No query history is available for this session.
                </p>
              ) : null}
            </div>
          </AnalyticsCard>
        </>
      ) : null}
    </div>
  );
}
