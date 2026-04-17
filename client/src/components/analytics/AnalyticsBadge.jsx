import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em]',
  {
    variants: {
      tone: {
        neutral: 'cl-border cl-text-2 bg-[color:var(--color-surface-2)]',
        operational: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400',
        degraded: 'border-amber-500/35 bg-amber-500/10 text-amber-400',
        down: 'border-rose-500/35 bg-rose-500/10 text-rose-400',
        info: 'border-blue-500/35 bg-blue-500/10 text-blue-400'
      }
    },
    defaultVariants: {
      tone: 'neutral'
    }
  }
);

export default function AnalyticsBadge({ tone = 'neutral', className = '', children }) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>;
}
