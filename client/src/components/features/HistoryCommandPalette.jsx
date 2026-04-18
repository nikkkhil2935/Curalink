import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, extractApiError } from '@/utils/api.js';

const MAX_RESULTS = 20;

export default function HistoryCommandPalette() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState('');

  const hasQuery = useMemo(() => query.trim().length > 0, [query]);

  useEffect(() => {
    const onGlobalKeyDown = (event) => {
      const openPalette = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!openPalette) {
        return;
      }

      event.preventDefault();
      setIsOpen((previous) => !previous);
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return () => {};
    }

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return () => {};
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError('');
      setIsLoading(false);
      return () => {};
    }

    let cancelled = false;
    setIsLoading(true);
    setError('');

    const timeout = setTimeout(async () => {
      try {
        const { data } = await api.get('/sessions/history/search', {
          params: {
            q: trimmed,
            limit: MAX_RESULTS
          }
        });

        if (cancelled) {
          return;
        }

        const nextResults = Array.isArray(data?.results) ? data.results : [];
        setResults(nextResults);
        setActiveIndex(0);
      } catch (requestError) {
        if (!cancelled) {
          setResults([]);
          setError(extractApiError(requestError, 'Search failed.'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen, query]);

  useEffect(() => {
    if (!isOpen || !listRef.current) {
      return;
    }

    const activeElement = listRef.current.querySelector(`[data-result-index="${activeIndex}"]`);
    activeElement?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const closePalette = () => {
    setIsOpen(false);
  };

  const selectResult = (result) => {
    if (!result?.sessionId || !result?.messageId) {
      return;
    }

    navigate(`/research/${result.sessionId}?focusMessage=${result.messageId}`);
    setIsOpen(false);
  };

  const onInputKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length === 0) {
        return;
      }
      setActiveIndex((previous) => Math.min(results.length - 1, previous + 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) {
        return;
      }
      setActiveIndex((previous) => Math.max(0, previous - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (results[activeIndex]) {
        selectResult(results[activeIndex]);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[color-mix(in_srgb,var(--bg-canvas)_72%,transparent)] px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Query history command palette"
    >
      <div className="w-full max-w-240 overflow-hidden rounded-xl border token-border token-surface shadow-(--panel-shadow)">
        <div className="flex items-center gap-2 border-b token-border px-4 py-3">
          <Search className="h-4 w-4 token-text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search message history..."
            aria-label="Search query history"
            role="combobox"
            aria-expanded={Boolean(hasQuery && results.length > 0)}
            aria-controls="history-results-list"
            aria-activedescendant={results[activeIndex] ? `history-result-${activeIndex}` : undefined}
            className="w-full bg-transparent text-sm token-text outline-none placeholder:text-(--text-subtle)"
          />
          <button
            type="button"
            aria-label="Close command palette"
            onClick={closePalette}
            className="rounded border token-border px-2 py-1 text-xs token-text-muted hover:bg-(--bg-surface-2) hover:text-(--text-primary)"
          >
            Esc
          </button>
        </div>

        <div id="history-results-list" ref={listRef} role="listbox" className="scrollbar-thin max-h-[50vh] overflow-y-auto p-2">
          {!hasQuery ? <p className="px-2 py-8 text-center text-sm token-text-subtle">Type to search prior messages.</p> : null}
          {hasQuery && isLoading ? <p className="px-2 py-8 text-center text-sm token-text-muted">Searching...</p> : null}
          {hasQuery && !isLoading && error ? <p className="px-2 py-8 text-center text-sm text-(--danger)">{error}</p> : null}
          {hasQuery && !isLoading && !error && results.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm token-text-subtle">No matching messages found.</p>
          ) : null}

          {results.map((result, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={`${result.sessionId}-${result.messageId}`}
                type="button"
                id={`history-result-${index}`}
                role="option"
                aria-selected={isActive}
                data-result-index={index}
                aria-label={`Open result from session ${result.sessionTitle || result.disease}`}
                onClick={() => selectResult(result)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`mb-1 w-full rounded-md border px-3 py-2 text-left duration-150 ease-out ${
                  isActive
                    ? 'border-(--accent) bg-(--accent-soft) text-(--text-primary)'
                    : 'border-(--border-subtle) bg-(--bg-surface-2) text-(--text-primary) hover:border-(--border-strong)'
                }`}
              >
                <p className="text-xs token-text-subtle">{result.sessionTitle || result.disease || 'Session'}</p>
                <p className="mt-1 text-sm leading-relaxed">{result.text || 'No preview available'}</p>
                <p className="mt-1 text-[11px] token-text-subtle">{new Date(result.createdAt).toLocaleString()}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
