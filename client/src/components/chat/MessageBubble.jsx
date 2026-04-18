import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import StructuredAnswer from './StructuredAnswer';
import BookmarkToggle from '@/components/features/BookmarkToggle.jsx';
import { useAppStore } from '@/store/useAppStore.js';
import { api } from '@/utils/api.js';
import { patchToast, pushToast } from '@/store/useToastStore.js';

function formatAuthorList(authors = [], max = 6) {
  const list = (Array.isArray(authors) ? authors : []).map((author) => String(author || '').trim()).filter(Boolean);
  if (!list.length) {
    return 'Unknown author';
  }

  if (list.length <= max) {
    return list.join(', ');
  }

  return `${list.slice(0, max).join(', ')}, et al.`;
}

function formatApaCitation(source, index) {
  const authors = formatAuthorList(source?.authors);
  const year = source?.year ? `(${source.year}).` : '(n.d.).';
  const title = String(source?.title || 'Untitled source').replace(/\.+$/, '');
  const journal = String(source?.journal || source?.source || '').trim();
  const url = source?.url ? ` ${source.url}` : '';
  const journalPart = journal ? ` ${journal}.` : '';

  return `${index + 1}. ${authors} ${year} ${title}.${journalPart}${url}`.trim();
}

function formatVancouverCitation(source, index) {
  const authors = formatAuthorList(source?.authors);
  const title = String(source?.title || 'Untitled source').replace(/\.+$/, '');
  const journal = String(source?.journal || source?.source || '').trim();
  const year = source?.year ? `${source.year};` : '';
  const url = source?.url ? ` Available from: ${source.url}` : '';

  return `${index + 1}. ${authors}. ${title}. ${journal}${journal ? '.' : ''} ${year}${url}`.trim();
}

async function copyToClipboard(text) {
  if (!navigator?.clipboard?.writeText) {
    return false;
  }

  await navigator.clipboard.writeText(text);
  return true;
}

function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

export default function MessageBubble({ sessionId, message, isHighlighted = false, onBookmarkUpdated }) {
  const sourcesByMessageId = useAppStore((state) => state.sourcesByMessageId);
  const isUser = message.role === 'user';
  const messageId = String(message?._id || message?.id || '');

  const cachedSources = useMemo(() => {
    if (!messageId) {
      return [];
    }

    const items = sourcesByMessageId?.[messageId];
    return Array.isArray(items) ? items : [];
  }, [messageId, sourcesByMessageId]);

  const exportCitations = async () => {
    if (!sessionId || !messageId || message.role !== 'assistant') {
      return;
    }

    const toastId = pushToast({
      title: 'Preparing Citation Export',
      message: 'Collecting references from the selected answer...',
      loading: true
    });

    try {
      let sources = cachedSources;
      if (!sources.length) {
        const { data } = await api.get(`/sessions/${sessionId}/sources/${messageId}`);
        sources = Array.isArray(data?.sources) ? data.sources : [];
      }

      if (!sources.length) {
        throw new Error('No citations available for this response yet.');
      }

      const apa = sources.map((source, index) => formatApaCitation(source, index));
      const vancouver = sources.map((source, index) => formatVancouverCitation(source, index));

      const exportText = [
        'Curalink Citation Export',
        `Generated: ${new Date().toISOString()}`,
        '',
        'APA',
        ...apa,
        '',
        'Vancouver',
        ...vancouver
      ].join('\n');

      const copied = await copyToClipboard(exportText).catch(() => false);
      downloadTextFile(`curalink-citations-${messageId}.txt`, exportText);

      patchToast(toastId, {
        loading: false,
        variant: 'success',
        title: 'Citations Exported',
        message: copied
          ? 'APA/Vancouver citations copied to clipboard and downloaded as .txt.'
          : 'Citation file downloaded as .txt.'
      });
    } catch (error) {
      patchToast(toastId, {
        loading: false,
        variant: 'error',
        title: 'Citation Export Failed',
        message: error?.message || 'Unable to export citations for this answer.'
      });
    }
  };
  
  if (isUser) {
    return (
      <div className="flex justify-end mb-6" data-message-id={messageId}>
        <div className="max-w-[85%] rounded-2xl border border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-surface))] px-5 py-3 text-[15px] font-medium token-text shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col w-full mb-10 rounded-xl border px-3 py-3 transition-colors ${
        isHighlighted ? 'border-(--accent) bg-(--accent-soft)' : 'border-transparent'
      }`}
      data-message-id={messageId}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        {message.contextBadge ? (
          <div className="flex items-center gap-2 self-start rounded-full border border-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-(--accent-soft) px-3 py-1 text-xs font-semibold uppercase tracking-wider text-(--accent)">
            <span className="h-1.5 w-1.5 rounded-full bg-(--accent)"></span>
            {message.contextBadge}
          </div>
        ) : (
          <span />
        )}

        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void exportCitations();
            }}
            aria-label="Export citations as APA and Vancouver references"
            className="inline-flex h-7 items-center gap-1 rounded-full border token-border bg-(--bg-surface-2) px-2 text-xs font-semibold token-text-muted hover:border-(--accent) hover:text-(--accent)"
          >
            <Download className="h-3.5 w-3.5" />
            Export Citations
          </button>

          <BookmarkToggle
            sessionId={sessionId}
            message={message}
            onBookmarkUpdated={onBookmarkUpdated}
          />
        </div>
      </div>
      <div className="w-full text-sm token-text">
        {message.structuredAnswer ? (
          <StructuredAnswer answer={message.structuredAnswer} stats={message.retrievalStats} />
        ) : (
          <div className="rounded-xl border token-border token-surface p-4">{message.text}</div>
        )}
      </div>
      {message.structuredAnswer?.follow_up_suggestions?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {message.structuredAnswer.follow_up_suggestions.map((chip, i) => (
            <button
              key={i}
              aria-label={`Use follow up suggestion ${i + 1}`}
              onClick={() => window.dispatchEvent(new CustomEvent('set-chat-input', { detail: chip }))}
              className="rounded-full border token-border bg-(--bg-surface-2) px-3 py-1.5 text-xs text-(--accent) hover:border-(--accent)"
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}