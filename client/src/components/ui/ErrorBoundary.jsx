import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      // Surface full crash details in dev while keeping production UI clean.
      console.error('Unhandled UI error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell token-bg token-text flex min-h-screen items-center justify-center px-6">
          <div className="surface-panel w-full max-w-xl rounded-2xl p-6 md:p-8">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-(--danger)">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>

            <h1 className="text-xl font-semibold token-text">Something went wrong</h1>
            <p className="mt-2 text-sm token-text-muted">
              The interface hit an unexpected error. You can retry this view or return to the start page.
            </p>

            {import.meta.env.DEV && this.state.error?.message ? (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg border token-border token-surface-2 p-3 text-xs token-text-muted">
                {this.state.error.message}
              </pre>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </button>

              <a
                href="/"
                className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
              >
                <Home className="h-4 w-4" />
                Go to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
