function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton-block ${className}`.trim()} />;
}

export default function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`metric-skeleton-${index}`} className="rounded-2xl border token-border token-surface p-5">
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="mt-4 h-9 w-24" />
            <SkeletonBlock className="mt-4 h-3 w-40" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border token-border token-surface p-5 xl:col-span-2">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="mt-4 h-64 w-full" />
        </div>
        <div className="rounded-2xl border token-border token-surface p-5">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="mt-4 h-64 w-full" />
        </div>
      </div>

      <div className="rounded-2xl border token-border token-surface p-5">
        <SkeletonBlock className="h-4 w-44" />
        <SkeletonBlock className="mt-4 h-44 w-full" />
      </div>
    </div>
  );
}
