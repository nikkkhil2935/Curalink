import React, { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '@/utils/api.js';
import { pushToast } from '@/store/useToastStore.js';

export default function BookmarkToggle({ sessionId, message, onBookmarkUpdated }) {
  const [isSaving, setIsSaving] = useState(false);

  const messageId = useMemo(() => String(message?._id || message?.id || ''), [message]);
  const isBookmarked = Boolean(message?.isBookmarked);
  const canToggle = Boolean(sessionId) && Boolean(messageId) && message?.role === 'assistant';

  if (!canToggle) {
    return null;
  }

  const toggleBookmark = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const { data } = await api.post(`/sessions/${sessionId}/messages/${messageId}/bookmark`);
      onBookmarkUpdated?.(data);
      window.dispatchEvent(new CustomEvent('bookmarks-refresh'));
      pushToast({
        variant: 'success',
        title: data?.isBookmarked ? 'Bookmark Added' : 'Bookmark Removed',
        message: data?.isBookmarked ? 'Assistant answer saved for quick access.' : 'Bookmark removed from this answer.'
      });
    } catch {
      pushToast({
        variant: 'error',
        title: 'Bookmark Failed',
        message: 'Unable to update bookmark right now. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={isBookmarked ? 'Remove bookmark from assistant message' : 'Bookmark assistant message'}
      aria-pressed={isBookmarked}
      title={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
      onClick={toggleBookmark}
      disabled={isSaving}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${
        isBookmarked
          ? 'border-[color-mix(in_srgb,var(--warning)_55%,transparent)] bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-(--warning)'
          : 'token-border token-surface text-(--text-subtle) hover:border-(--border-strong) hover:text-(--text-primary)'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <Star className="h-3.5 w-3.5" fill={isBookmarked ? 'currentColor' : 'none'} />
    </button>
  );
}
