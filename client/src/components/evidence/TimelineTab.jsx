import React, { useMemo } from 'react';
import { Clock3, RefreshCcw } from 'lucide-react';

function normalizeMessageId(message) {
  return String(message?._id || message?.id || '');
}

function buildTimeline(messages = []) {
  const ordered = (Array.isArray(messages) ? messages : [])
    .slice()
    .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
  const timeline = [];
  let pendingUser = null;

  ordered.forEach((message) => {
    if (message?.role === 'user') {
      pendingUser = message;
      return;
    }

    if (message?.role === 'assistant') {
      timeline.push({
        assistant: message,
        user: pendingUser,
        timestamp: message?.createdAt || pendingUser?.createdAt || null
      });
      pendingUser = null;
    }
  });

  return timeline.sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());
}

export default function TimelineTab({
  messages,
  selectedAssistantMessageId,
  loadingMessageId,
  onSelectMessage
}) {
  const timeline = useMemo(() => buildTimeline(messages), [messages]);

  if (!timeline.length) {
    return (
      <div className="rounded-xl border token-border token-surface p-6 text-center">
        <p className="text-sm token-text">No timeline entries yet.</p>
        <p className="mt-1 text-xs token-text-subtle">Ask your first clinical question to populate the session timeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {timeline.map((entry, index) => {
        const assistantId = normalizeMessageId(entry.assistant);
        const isSelected = assistantId && assistantId === String(selectedAssistantMessageId || '');
        const isLoading = loadingMessageId && assistantId === loadingMessageId;
        const retrievalStats = entry.assistant?.retrievalStats || {};

        return (
          <button
            key={assistantId || `timeline-${index}`}
            type="button"
            onClick={() => {
              if (assistantId) {
                void onSelectMessage?.(assistantId);
              }
            }}
            className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
              isSelected
                ? 'border-(--accent) bg-(--accent-soft)'
                : 'token-border token-surface hover:border-(--border-strong) hover:bg-(--bg-surface-2)'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1 rounded-full border token-border bg-(--bg-surface-2) px-2 py-0.5 text-[11px] font-semibold token-text-subtle">
                <Clock3 className="h-3 w-3" />
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Timestamp unavailable'}
              </span>
              {isLoading ? (
                <span className="inline-flex items-center gap-1 text-xs token-text-muted">
                  <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                  Loading cached evidence...
                </span>
              ) : null}
            </div>

            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] token-text-subtle">Query</p>
            <p className="text-sm font-semibold token-text">
              {entry.user?.text || 'Assistant response'}
            </p>

            <p className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] token-text-subtle">Response Summary</p>
            <p className="line-clamp-2 text-xs leading-relaxed token-text-muted">
              {entry.assistant?.structuredAnswer?.condition_overview || entry.assistant?.text || 'No response preview available.'}
            </p>

            <div className="mt-2 flex flex-wrap gap-3 text-xs token-text-subtle">
              <span>Latency: {retrievalStats.timeTakenMs ? `${Math.round(retrievalStats.timeTakenMs)} ms` : 'N/A'}</span>
              <span>Sources: {(entry.assistant?.usedSourceIds || []).length}</span>
              <span>Candidates: {retrievalStats.totalCandidates || 0}</span>
              <span>Shown: {retrievalStats.rerankedTo || 0}</span>
              <span>Intent: {entry.assistant?.intentType || 'GENERAL'}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}