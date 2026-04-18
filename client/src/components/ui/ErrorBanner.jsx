import React from 'react';
import { useAppStore } from '../../store/useAppStore.js';

export default function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  onClose,
  className = ''
}) {
  const { error, setError } = useAppStore();
  const resolvedMessage = message || error;

  if (!resolvedMessage) return null;

  const handleDismiss = () => {
    if (typeof onClose === 'function') {
      onClose();
      return;
    }

    if (typeof onDismiss === 'function') {
      onDismiss();
      return;
    }

    setError(null);
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 w-full max-w-md ${className}`.trim()}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start justify-between rounded-xl border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--bg-surface))] p-4 shadow-(--panel-shadow)">
        <div className="flex-1">
          <p className="mb-1 text-sm font-semibold text-(--danger)">Error</p>
          <p className="text-sm leading-relaxed token-text">{resolvedMessage}</p>

          {typeof onRetry === 'function' ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] px-2 py-1 text-xs font-medium token-text transition duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--danger)_18%,transparent)]"
            >
              Retry
            </button>
          ) : null}
        </div>
        <button
          onClick={handleDismiss}
          className="ml-4 rounded-md p-1 text-(--danger) hover:bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] hover:text-(--danger)"
          aria-label="Dismiss error message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
