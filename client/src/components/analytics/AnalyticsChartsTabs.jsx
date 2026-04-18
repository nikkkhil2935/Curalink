import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import Card from '@/components/ui/Card.jsx';
import AnalyticsStateNotice from '@/components/analytics/AnalyticsStateNotice.jsx';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#f97316', '#06b6d4', '#eab308'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border token-border token-surface px-3 py-2 text-xs token-text shadow-xl">
      {label ? <p className="mb-1 token-text-subtle">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsChartsTabs({ overview }) {
  const [activeTab, setActiveTab] = useState('activity');

  const tabs = useMemo(
    () => [
      { id: 'activity', label: 'Daily Activity' },
      { id: 'conflicts', label: 'Contradictions' },
      { id: 'intents', label: 'Top Intents' },
      { id: 'sources', label: 'Source Distribution' }
    ],
    []
  );

  const dailyActivity = Array.isArray(overview?.daily_activity) ? overview.daily_activity : [];
  const dailyConflicts = Array.isArray(overview?.daily_conflicts) && overview.daily_conflicts.length
    ? overview.daily_conflicts
    : dailyActivity.map((item) => ({
        date: item.date,
        conflicts: Number(item.conflicts || 0),
        conflict_rate: Number(item.conflict_rate || 0)
      }));
  const topIntents = Array.isArray(overview?.top_intents) ? overview.top_intents : [];
  const sourceDistribution = Array.isArray(overview?.source_distribution) ? overview.source_distribution : [];

  return (
    <Card className="token-border token-surface" padding="lg">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] token-text-subtle">Analytics Trends</p>
        <div className="inline-flex rounded-xl border token-border token-surface-2 p-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-(--accent) text-white'
                    : 'token-text-muted hover:bg-(--bg-surface-3) hover:text-(--text-primary)'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'activity' ? (
        dailyActivity.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyActivity} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dailyQueries" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dailySessions" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#6d84a1', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#6d84a1', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="queries" name="Queries" stroke="#3b82f6" fill="url(#dailyQueries)" strokeWidth={2} />
                <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#22c55e" fill="url(#dailySessions)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <AnalyticsStateNotice
            title="No activity yet"
            description="Run at least one session query to start generating activity trends."
          />
        )
      ) : null}

      {activeTab === 'intents' ? (
        topIntents.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topIntents.slice(0, 8)} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <XAxis dataKey="intent" tick={{ fill: '#6d84a1', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#6d84a1', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Queries" radius={[6, 6, 0, 0]}>
                  {topIntents.slice(0, 8).map((item, index) => (
                    <Cell key={`intent-${item.intent}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <AnalyticsStateNotice
            title="Intent metrics unavailable"
            description="Top intents will appear after user queries are classified by the retrieval pipeline."
          />
        )
      ) : null}

      {activeTab === 'conflicts' ? (
        dailyConflicts.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyConflicts} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dailyConflicts" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#6d84a1', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#6d84a1', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="conflicts" name="Conflict Signals" stroke="#f59e0b" fill="url(#dailyConflicts)" strokeWidth={2} />
                <Area type="monotone" dataKey="conflict_rate" name="Conflict Rate %" stroke="#ef4444" fillOpacity={0} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <AnalyticsStateNotice
            title="No contradiction signals yet"
            description="Conflict trend data appears once evidence contradiction events are logged."
          />
        )
      ) : null}

      {activeTab === 'sources' ? (
        sourceDistribution.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceDistribution}
                    dataKey="count"
                    nameKey="source"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {sourceDistribution.map((item, index) => (
                      <Cell key={`source-${item.source}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {sourceDistribution.map((entry, index) => (
                <div key={entry.source} className="flex items-center justify-between rounded-lg border token-border token-surface-2 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-sm token-text">{entry.source}</span>
                  </div>
                  <span className="text-sm font-semibold token-text">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <AnalyticsStateNotice
            title="No source distribution yet"
            description="Source distribution will appear after evidence documents are cached."
          />
        )
      ) : null}
    </Card>
  );
}
