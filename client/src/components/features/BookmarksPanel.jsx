import React, { useCallback, useEffect, useState } from 'react';
import { Bookmark, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, extractApiError } from '@/utils/api.js';

export default function BookmarksPanel() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);

  const fetchBookmarks = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const { data } = await api.get('/bookmarks', { params: { limit: 120 } });
      setGroups(Array.isArray(data?.groups) ? data.groups : []);
      setTotal(Number(data?.totalBookmarks || 0));
    } catch (requestError) {
      setError(extractApiError(requestError, 'Bookmarks could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  useEffect(() => {
    const refreshHandler = () => {
      fetchBookmarks();
    };

    window.addEventListener('bookmarks-refresh', refreshHandler);
    return () => window.removeEventListener('bookmarks-refresh', refreshHandler);
  }, [fetchBookmarks]);

  const openBookmark = (sessionId, messageId) => {
    navigate(`/research/${sessionId}?focusMessage=${messageId}`);
  };

  return (
    <section className="rounded-lg border token-border token-surface p-3" aria-label="Saved bookmarks panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider token-text-subtle">
          <Bookmark className="h-3.5 w-3.5" />
          Saved Bookmarks
        </h3>
        <button
          type="button"
          aria-label="Refresh bookmarks"
          onClick={fetchBookmarks}
          className="rounded-md border token-border bg-(--bg-surface-2) p-1.5 text-(--text-muted) duration-150 ease-out hover:border-(--border-strong) hover:text-(--text-primary)"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading ? <p className="text-xs token-text-muted">Loading bookmarks...</p> : null}
      {!isLoading && error ? <p className="text-xs text-(--danger)">{error}</p> : null}
      {!isLoading && !error && total === 0 ? (
        <p className="text-xs token-text-subtle">No bookmarked assistant messages yet.</p>
      ) : null}

      {!isLoading && !error && groups.length > 0 ? (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.sessionId} className="rounded-md border token-border bg-(--bg-surface-2) p-2">
              <p className="truncate text-xs font-medium token-text" title={group.sessionTitle}>
                {group.sessionTitle || group.disease || 'Untitled session'}
              </p>
              <p className="mb-2 text-[11px] token-text-subtle">{group.disease || 'Condition not specified'}</p>

              <div className="space-y-1">
                {(group.bookmarks || []).slice(0, 4).map((bookmark) => (
                  <button
                    key={bookmark.messageId}
                    type="button"
                    aria-label={`Open bookmark from ${group.sessionTitle || group.disease}`}
                    onClick={() => openBookmark(group.sessionId, bookmark.messageId)}
                    className="w-full rounded border token-border token-surface px-2 py-1.5 text-left text-xs token-text-muted duration-150 ease-out hover:border-(--accent) hover:text-(--accent)"
                  >
                    <p className="line-clamp-2 leading-relaxed">{bookmark.text}</p>
                    <p className="mt-1 text-[10px] token-text-subtle">
                      {bookmark.bookmarkedAt
                        ? new Date(bookmark.bookmarkedAt).toLocaleString()
                        : 'Saved'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
