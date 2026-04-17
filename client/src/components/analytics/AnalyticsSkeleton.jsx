import { cn } from '@/lib/utils.js';

function SkeletonBlock({ className = '' }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg border', className)}
      style={{
        background: 'color-mix(in srgb, var(--color-surface-3) 70%, transparent)',
        borderColor: 'var(--color-border)'
      }}
    />
  );
}

export function AnalyticsMetricsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SkeletonBlock className="h-28" />
      <SkeletonBlock className="h-28" />
      <SkeletonBlock className="h-28" />
      <SkeletonBlock className="h-28" />
    </div>
  );
}

export function AnalyticsChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SkeletonBlock className="h-72 lg:col-span-2" />
      <SkeletonBlock className="h-72" />
    </div>
  );
}

export function AnalyticsListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock key={`row-${index}`} className="h-10" />
      ))}
    </div>
  );
}
