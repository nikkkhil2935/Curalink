import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react';
import { useToastStore, dismissToast } from '@/store/useToastStore.js';

function getToastTone(toast) {
  if (toast.loading) {
    return {
      icon: LoaderCircle,
      iconClass: 'animate-spin text-(--accent)',
      container: 'border-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-surface))]'
    };
  }

  if (toast.variant === 'success') {
    return {
      icon: CheckCircle2,
      iconClass: 'text-(--success)',
      container: 'border-[color-mix(in_srgb,var(--success)_32%,transparent)] bg-[color-mix(in_srgb,var(--success)_12%,var(--bg-surface))]'
    };
  }

  if (toast.variant === 'error') {
    return {
      icon: AlertCircle,
      iconClass: 'text-(--danger)',
      container: 'border-[color-mix(in_srgb,var(--danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,var(--bg-surface))]'
    };
  }

  return {
    icon: Info,
    iconClass: 'text-(--accent)',
    container: 'border token-border token-surface'
  };
}

export default function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);

  useEffect(() => {
    const timers = toasts
      .filter((toast) => !toast.loading)
      .map((toast) => {
        const timeout = Number(toast.ttlMs || 4000);
        return setTimeout(() => dismissToast(toast.id), timeout);
      });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts]);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-70 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const tone = getToastTone(toast);
        const Icon = tone.icon;
        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto rounded-xl border px-3 py-3 shadow-(--panel-shadow) ${tone.container}`}
          >
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 ${tone.iconClass}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {toast.title ? <p className="text-sm font-semibold token-text">{toast.title}</p> : null}
                {toast.message ? <p className="text-sm token-text-muted">{toast.message}</p> : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(toast.id)}
                className="rounded-md p-1 token-text-subtle hover:bg-(--bg-surface-2) hover:text-(--text-primary)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
