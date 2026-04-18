import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
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
}

function BreakdownTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border token-border token-surface px-3 py-2 text-xs token-text shadow-xl">
      <p className="mb-1 token-text-subtle">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

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
  );
}
