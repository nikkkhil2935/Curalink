import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'btn-primary text-white',
        secondary: 'btn-secondary text-slate-200',
        ghost: 'text-slate-300 hover:bg-slate-900/70 hover:text-white',
        success: 'border border-emerald-700 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-6 text-sm'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export default function Button({ className, variant, size, type = 'button', ...props }) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
