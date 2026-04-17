import Card from '@/components/ui/Card.jsx';
import { cn } from '@/lib/utils.js';

export default function AnalyticsCard({
  title,
  description,
  action,
  className,
  bodyClassName,
  children
}) {
  return (
    <Card tone="soft" padding="md" className={cn('cl-border border shadow-none', className)}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className={cn((title || description || action) ? 'mt-4' : '', bodyClassName)}>{children}</div>
    </Card>
  );
}
