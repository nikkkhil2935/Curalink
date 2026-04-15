import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

const cardVariants = cva('rounded-2xl border', {
  variants: {
    tone: {
      panel: 'surface-panel',
      soft: 'surface-soft',
      elevated: 'surface-soft shadow-[0_14px_40px_rgba(13,22,40,0.35)]'
    },
    padding: {
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6'
    }
  },
  defaultVariants: {
    tone: 'soft',
    padding: 'md'
  }
});

export default function Card({ className, tone, padding, ...props }) {
  return <div className={cn(cardVariants({ tone, padding }), className)} {...props} />;
}
