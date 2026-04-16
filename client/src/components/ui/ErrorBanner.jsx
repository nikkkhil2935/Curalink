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
    >
      <div className="rounded-xl border border-red-800 bg-red-950 shadow-lg p-4 flex items-start justify-between">
        <div className="flex-1">
          <p className="font-bold text-red-400 mb-1">Error</p>
          <p className="text-red-300 text-sm leading-relaxed">{resolvedMessage}</p>

          {typeof onRetry === 'function' ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center rounded-md border border-red-700 px-2 py-1 text-xs font-medium text-red-200 transition-colors hover:bg-red-900/70"
            >
              Retry
            </button>
          ) : null}
        </div>
        <button
          onClick={handleDismiss}
          className="ml-4 text-red-500 hover:text-red-300 transition-colors p-1"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
