import Card from '@/components/ui/Card.jsx';

export default function AnalyticsMetricCard({ title, value, subtitle, icon: Icon, accent = 'blue' }) {
  const accentMap = {
    blue: 'text-(--accent) border-[color-mix(in_srgb,var(--accent)_36%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-surface))]',
    green: 'text-(--success) border-[color-mix(in_srgb,var(--success)_36%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,var(--bg-surface))]',
    amber: 'text-(--warning) border-[color-mix(in_srgb,var(--warning)_36%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,var(--bg-surface))]',
    slate: 'token-text border token-border token-surface'
  };

  const accentClass = accentMap[accent] || accentMap.slate;

  return (
    <Card className={`border ${accentClass}`} padding="md">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] token-text-subtle">{title}</p>
          <p className="text-2xl font-semibold token-text">{value}</p>
          {subtitle ? <p className="text-xs token-text-muted">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--bg-surface-2)_88%,transparent)]">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </Card>
  );
}
