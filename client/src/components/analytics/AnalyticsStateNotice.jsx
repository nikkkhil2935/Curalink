export default function AnalyticsStateNotice({
  title,
  description,
  actionLabel,
  onAction,
  variant = 'empty',
  className = ''
}) {
  const palette =
    variant === 'error'
      ? 'border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,var(--bg-surface))] text-(--danger)'
      : 'token-border token-surface token-text-muted';

  return (
    <div className={`rounded-xl border px-4 py-5 ${palette} ${className}`.trim()} role={variant === 'error' ? 'alert' : 'status'}>
      <p className="text-sm font-semibold token-text">{title}</p>
      {description ? <p className="mt-1 text-sm token-text-muted">{description}</p> : null}
      {actionLabel && typeof onAction === 'function' ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 inline-flex items-center rounded-md border token-border px-3 py-1.5 text-xs font-semibold token-text transition-colors hover:border-(--border-strong) hover:bg-(--bg-surface-2)"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
