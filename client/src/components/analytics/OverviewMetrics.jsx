import { Activity, Layers, Timer, Gauge } from 'lucide-react';
import AnalyticsCard from '@/components/analytics/AnalyticsCard.jsx';
import AnalyticsBadge from '@/components/analytics/AnalyticsBadge.jsx';

function formatInteger(value) {
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

const METRICS = [
  {
    key: 'total_sessions',
    label: 'Total Sessions',
    icon: Activity,
    formatter: formatInteger,
    helper: 'Research sessions created'
  },
  {
    key: 'total_queries',
    label: 'Total Queries',
    icon: Layers,
    formatter: formatInteger,
    helper: 'Assistant queries executed'
  },
  {
    key: 'avg_latency_ms',
    label: 'Average Latency',
    icon: Timer,
    formatter: formatMilliseconds,
    helper: 'End-to-end response time'
  },
  {
    key: 'p95_latency_ms',
    label: 'P95 Latency',
    icon: Gauge,
    formatter: formatMilliseconds,
    helper: '95th percentile response time'
  }
];

export default function OverviewMetrics({ overview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {METRICS.map((metric) => {
        const Icon = metric.icon;
        return (
          <AnalyticsCard key={metric.key} className="min-h-28">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {metric.formatter(overview?.[metric.key])}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {metric.helper}
                </p>
              </div>
              <div className="rounded-lg border p-2" style={{ borderColor: 'var(--color-border)' }}>
                <Icon className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </div>
            </div>
          </AnalyticsCard>
        );
      })}

      <AnalyticsCard
        title="Intent Focus"
        description="Top intent categories by query volume"
        action={<AnalyticsBadge tone="info">Top 3</AnalyticsBadge>}
        className="sm:col-span-2 xl:col-span-4"
      >
        <div className="flex flex-wrap gap-2">
          {(overview?.top_intents || []).slice(0, 3).map((intent) => (
            <AnalyticsBadge key={intent.intent_type} tone="neutral" className="normal-case tracking-normal">
              {intent.intent_type}: {formatInteger(intent.count)}
            </AnalyticsBadge>
          ))}
          {!overview?.top_intents?.length ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No intent analytics available yet.
            </p>
          ) : null}
        </div>
      </AnalyticsCard>
    </div>
  );
}
