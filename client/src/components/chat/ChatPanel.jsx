import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Microscope } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore.js';
import { api, extractApiError } from '@/utils/api.js';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import LoadingOverlay from '../ui/LoadingOverlay';
import ErrorBanner from '../ui/ErrorBanner';
import { patchToast, pushToast } from '@/store/useToastStore.js';

export default function ChatPanel() {
  const { sessionId } = useParams();
  const {
<<<<<<< HEAD
    currentSession, messages, addMessage, applyAssistantResponse,
    isLoading, setLoading, error, setError,
=======
    currentSession,
    messages,
    addMessage,
    applyAssistantResponse,
    updateMessage,
    highlightedMessageId,
    setHighlightedMessage,
    isLoading,
    setLoading,
    error,
    setError
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
  } = useAppStore();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!highlightedMessageId) {
      return () => {};
    }

    const selector = `[data-message-id="${highlightedMessageId}"]`;
    const target = document.querySelector(selector);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const timeout = window.setTimeout(() => {
      setHighlightedMessage(null);
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [highlightedMessageId, messages, setHighlightedMessage]);

  const handleBookmarkUpdated = (bookmarkUpdate) => {
    if (!bookmarkUpdate?.messageId) {
      return;
    }

    updateMessage(bookmarkUpdate.messageId, {
      isBookmarked: Boolean(bookmarkUpdate.isBookmarked),
      bookmarkedAt: bookmarkUpdate.bookmarkedAt || null
    });
  };

  const handleSend = async (text) => {
    if (!text.trim() || isLoading || !sessionId) return;
    addMessage({ role: 'user', text, id: Date.now().toString() });
    setLoading(true);
    setError(null);
<<<<<<< HEAD
    try {
      const { data } = await api.post(`/sessions/${sessionId}/query`, { message: text.trim() });
      const assistantMessage = data?.message || {};
      const retrievalStats = {
        ...(data?.stats || {}),
        ...(assistantMessage?.retrievalStats || {}),
      };

      applyAssistantResponse(
        {
          ...assistantMessage,
          retrievalStats,
        },
        Array.isArray(data?.sources) ? data.sources : []
      );
    } catch (err) {
      setError(extractApiError(err, 'Failed to get answer'));
=======

    const loadingToastId = pushToast({
      title: 'Running Retrieval Pipeline',
      message: 'Expanding query, ranking evidence, and generating a grounded response...',
      loading: true
    });
    
    try {
      const { data } = await api.post(`/sessions/${sessionId}/query`, { message: text.trim() });
      applyAssistantResponse(data.message, data.sources);
      patchToast(loadingToastId, {
        loading: false,
        variant: 'success',
        title: 'Response Ready',
        message: 'Evidence-backed answer generated successfully.'
      });
    } catch (err) {
      const apiError = err?.response?.data?.error;
      const errorMessage = apiError || err.message || 'Failed to get answer';
      setError(errorMessage);
      patchToast(loadingToastId, {
        loading: false,
        variant: 'error',
        title: 'Query Failed',
        message: errorMessage
      });
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    } finally {
      setLoading(false);
    }
  };

  return (
<<<<<<< HEAD
    <div
      className="flex flex-col h-full relative"
      style={{ background: 'var(--color-canvas)' }}
    >
      {/* Session header */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #2563eb22, #3b82f633)' }}
        >
          <Microscope className="h-3.5 w-3.5" style={{ color: '#60a5fa' }} />
        </div>
        <div className="min-w-0">
          <h2
            className="text-sm font-semibold truncate leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {currentSession?.disease || 'Research Session'}
          </h2>
          {currentSession?.intent && (
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {currentSession.intent}
            </p>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 pt-3">
          <ErrorBanner message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 space-y-2">
        {messages.length === 0 ? (
          <EmptyState disease={currentSession?.disease} />
        ) : (
          messages.map((m, i) => <MessageBubble key={m._id || m.id || i} message={m} />)
        )}
        {isLoading && (
          <div className="pb-2">
            <LoadingOverlay />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-4 pb-4 pt-2"
        style={{
          background: 'linear-gradient(to top, var(--color-canvas) 80%, transparent)',
        }}
      >
        <ChatInput onSend={handleSend} disabled={isLoading} />
=======
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden token-bg">
      {error && <ErrorBanner message={error} onClose={() => setError(null)} className="top-20" />}
      
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-240 space-y-4">
          {messages?.length === 0 ? (
            <div className="flex h-full min-h-75 flex-col items-center justify-center space-y-3 text-center">
              <h2 className="text-xl font-semibold token-text">Ask anything about {currentSession?.disease || 'this topic'}</h2>
              <p className="max-w-md text-sm token-text-muted">
                Research retrieved in real-time from PubMed, OpenAlex, and ClinicalTrials.gov
              </p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('set-chat-input', { detail: 'What are the strongest current treatment recommendations?' }))}
                className="btn-secondary rounded-lg px-3 py-2 text-xs font-semibold"
              >
                Ask your first clinical question →
              </button>
            </div>
          ) : (
            messages.map((message, index) => {
              const messageId = String(message?._id || message?.id || `message-${index}`);
              return (
                <MessageBubble
                  key={messageId}
                  sessionId={sessionId}
                  message={message}
                  isHighlighted={highlightedMessageId === messageId}
                  onBookmarkUpdated={handleBookmarkUpdated}
                />
              );
            })
          )}
          
          {isLoading ? <LoadingOverlay /> : null}
          <div ref={bottomRef} />
        </div>
      </div>
      
      <div className="z-10 border-t token-border bg-[color-mix(in_srgb,var(--bg-surface)_92%,transparent)] p-4 backdrop-blur-sm md:p-6">
        <div className="mx-auto w-full max-w-240">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
      </div>
    </div>
  );
}

function EmptyState({ disease }) {
  const suggestions = [
    disease ? `What are the latest treatments for ${disease}?` : 'What treatments are available?',
    'Are there any recruiting clinical trials near me?',
    'Who are the leading researchers in this field?',
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-full text-center py-12 px-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
      >
        <Microscope className="h-7 w-7" style={{ color: '#60a5fa' }} />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        Ask anything about{' '}
        <span style={{ color: '#60a5fa' }}>{disease || 'this condition'}</span>
      </h3>
      <p className="text-sm mb-8 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
        Research is retrieved in real-time from PubMed, OpenAlex &amp; ClinicalTrials.gov
        and synthesized by a local AI model.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {suggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('set-chat-input', { detail: s }))}
            className="text-left text-xs px-3.5 py-2.5 rounded-xl transition-all"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
