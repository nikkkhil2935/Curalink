import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils.js';

export function AnalyticsTabs({ className = '', ...props }) {
  return <Tabs.Root className={cn('w-full', className)} {...props} />;
}

export function AnalyticsTabsList({ className = '', ...props }) {
  return (
    <Tabs.List
      className={cn(
        'inline-flex h-10 items-center rounded-xl border p-1',
        'bg-[color:var(--color-surface-2)]',
        'border-[color:var(--color-border)]',
        className
      )}
      {...props}
    />
  );
}

export function AnalyticsTabsTrigger({ className = '', ...props }) {
  return (
    <Tabs.Trigger
      className={cn(
        'inline-flex min-w-28 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        'text-[color:var(--text-secondary)]',
        'data-[state=active]:bg-[color:var(--color-surface-3)]',
        'data-[state=active]:text-[color:var(--text-primary)]',
        className
      )}
      {...props}
    />
  );
}

export function AnalyticsTabsContent({ className = '', ...props }) {
  return <Tabs.Content className={cn('mt-5 focus:outline-none', className)} {...props} />;
}
