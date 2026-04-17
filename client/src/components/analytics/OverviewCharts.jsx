import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import AnalyticsCard from '@/components/analytics/AnalyticsCard.jsx';

const CHART_COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

function EmptyChartMessage({ text }) {
  return (
    <p className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
      {text}
    </p>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        color: 'var(--text-primary)'
      }}
    >
      <p className="font-semibold">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color || 'var(--text-secondary)' }}>
          {entry.name}: {Number(entry.value || 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export default function OverviewCharts({ overview }) {
  const dailyActivity = Array.isArray(overview?.daily_activity) ? overview.daily_activity : [];
  const topIntents = Array.isArray(overview?.top_intents) ? overview.top_intents : [];
  const sourceDistribution = Array.isArray(overview?.source_distribution) ? overview.source_distribution : [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <AnalyticsCard
        title="Daily Activity"
        description="Session and query counts over time"
        className="lg:col-span-2"
      >
        <div className="h-72">
          {dailyActivity.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyActivity} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickFormatter={(value) => String(value).slice(5)}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="queries" name="Queries" stroke="#3b82f6" strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#14b8a6" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage text="No daily activity data is available yet." />
          )}
        </div>
      </AnalyticsCard>

      <AnalyticsCard title="Top Intents" description="Most frequent intent classifications">
        <div className="h-72">
          {topIntents.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topIntents} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis
                  type="category"
                  dataKey="intent_type"
                  width={100}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Queries" radius={[0, 4, 4, 0]}>
                  {topIntents.map((entry, index) => (
                    <Cell key={`${entry.intent_type}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage text="No intent data is available yet." />
          )}
        </div>
      </AnalyticsCard>

      <AnalyticsCard title="Source Distribution" description="Indexed source mix" className="lg:col-span-3">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72">
            {sourceDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceDistribution}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={3}
                  >
                    {sourceDistribution.map((entry, index) => (
                      <Cell key={`${entry.source}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartMessage text="No source distribution data is available yet." />
            )}
          </div>

          <div className="space-y-2">
            {sourceDistribution.map((entry, index) => (
              <div
                key={entry.source}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {entry.source}
                </span>
                <span style={{ color: CHART_COLORS[index % CHART_COLORS.length] }}>
                  {Number(entry.count || 0).toLocaleString()} ({Number(entry.percentage || 0).toFixed(1)}%)
                </span>
              </div>
            ))}
            {!sourceDistribution.length ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Source usage will appear after retrieval results are stored.
              </p>
            ) : null}
          </div>
        </div>
      </AnalyticsCard>
    </div>
  );
}
