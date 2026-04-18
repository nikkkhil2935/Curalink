<<<<<<< HEAD
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
=======
import {
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
<<<<<<< HEAD
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
=======
import Card from '@/components/ui/Card.jsx';
import AnalyticsMetricCard from '@/components/analytics/AnalyticsMetricCard.jsx';
import AnalyticsStateNotice from '@/components/analytics/AnalyticsStateNotice.jsx';
import { Activity, Clock3, MessagesSquare } from 'lucide-react';

function formatLatency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return '0 ms';
  }

  return `${Math.round(numeric)} ms`;
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
}

function BreakdownTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
<<<<<<< HEAD
    <div
      className="rounded-lg border px-3 py-2 text-xs"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--text-primary)' }}
    >
      <p className="font-semibold">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color || 'var(--text-secondary)' }}>
          {entry.name}: {formatNumber(entry.value)}
=======
    <div className="rounded-md border token-border token-surface px-3 py-2 text-xs token-text shadow-xl">
      <p className="mb-1 token-text-subtle">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
        </p>
      ))}
    </div>
  );
}

<<<<<<< HEAD
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
=======
export default function SessionBreakdownPanel({
  sessions,
  selectedSessionId,
  onSessionChange,
  breakdown,
  loading,
  error,
  onRetry
}) {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const safeBreakdown = breakdown && typeof breakdown === 'object' ? breakdown : null;

  return (
    <Card className="token-border token-surface" padding="lg">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] token-text-subtle">Session Drill-down</p>
          <p className="mt-1 text-sm token-text-muted">Inspect per-session latency, intent, and evidence behavior.</p>
        </div>
        <div className="w-full md:w-80">
          <label htmlFor="session-selector" className="sr-only">
            Select session
          </label>
          <select
            id="session-selector"
            value={selectedSessionId || ''}
            onChange={(event) => onSessionChange?.(event.target.value)}
            className="w-full rounded-lg border token-border token-surface px-3 py-2 text-sm token-text outline-none focus:border-(--accent)"
          >
            {safeSessions.length === 0 ? <option value="">No sessions available</option> : null}
            {safeSessions.map((session) => (
              <option key={session._id} value={session._id}>
                {session.title || session.disease || 'Untitled session'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {safeSessions.length === 0 ? (
        <AnalyticsStateNotice
          title="No sessions to inspect"
          description="Create a research session and run a query to unlock session-level analytics."
        />
      ) : null}

      {safeSessions.length > 0 && loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`session-skeleton-${index}`} className="skeleton-block h-24 rounded-xl" />
            ))}
          </div>
          <div className="skeleton-block h-64 rounded-xl" />
        </div>
      ) : null}

      {safeSessions.length > 0 && !loading && error ? (
        <AnalyticsStateNotice
          variant="error"
          title="Unable to load session breakdown"
          description={error}
          actionLabel="Retry"
          onAction={onRetry}
        />
      ) : null}

      {safeSessions.length > 0 && !loading && !error && safeBreakdown ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AnalyticsMetricCard
              title="Queries"
              value={safeBreakdown?.totals?.queries || 0}
              subtitle={`User messages: ${safeBreakdown?.totals?.user_messages || 0}`}
              icon={MessagesSquare}
              accent="blue"
            />
            <AnalyticsMetricCard
              title="Avg Session Latency"
              value={formatLatency(safeBreakdown?.latency?.avg_latency_ms)}
              subtitle={`P95: ${formatLatency(safeBreakdown?.latency?.p95_latency_ms)}`}
              icon={Clock3}
              accent="amber"
            />
            <AnalyticsMetricCard
              title="Intent Types"
              value={safeBreakdown?.intents?.length || 0}
              subtitle={safeBreakdown?.intents?.[0] ? `Top: ${safeBreakdown.intents[0].intent}` : 'No intents recorded'}
              icon={Activity}
              accent="green"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-xl border token-border token-surface-2 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] token-text-subtle">Latency Over Session</p>
              {Array.isArray(safeBreakdown.query_activity) && safeBreakdown.query_activity.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={safeBreakdown.query_activity} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fill: '#6d84a1', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#6d84a1', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<BreakdownTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="latency_ms"
                        name="Latency (ms)"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <AnalyticsStateNotice
                  title="No latency samples"
                  description="Latency data appears after assistant messages include retrieval metrics."
                />
              )}
            </div>

            <div className="rounded-xl border token-border token-surface-2 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] token-text-subtle">Intent Breakdown</p>
              {Array.isArray(safeBreakdown.intents) && safeBreakdown.intents.length > 0 ? (
                <div className="space-y-3">
                  {safeBreakdown.intents.map((intent) => {
                    const base = safeBreakdown.intents[0]?.count || 1;
                    const widthPct = Math.max(8, Math.round((intent.count / base) * 100));
                    return (
                      <div key={intent.intent}>
                        <div className="mb-1 flex items-center justify-between text-xs token-text-muted">
                          <span>{intent.intent}</span>
                          <span>{intent.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-(--bg-surface-3)">
                          <div className="h-2 rounded-full bg-(--accent)" style={{ width: `${widthPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <AnalyticsStateNotice
                  title="No intent data"
                  description="Intent counts are generated after classified assistant responses are stored."
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
  );
}
