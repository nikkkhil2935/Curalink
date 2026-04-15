export default function ErrorBanner({ message, onRetry, title = 'Something went wrong' }) {
  if (!message) {
    return null;
  }

  return (
    <div role="alert" aria-live="assertive" className="rounded-xl border border-red-900 bg-red-950/60 p-4 text-sm">
      <p className="mb-1 font-medium text-red-300">{title}</p>
      <p className="text-xs text-red-400">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-xs text-red-300 underline transition hover:text-red-200"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
