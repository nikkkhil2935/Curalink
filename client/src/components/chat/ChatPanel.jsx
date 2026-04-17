import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Microscope } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore.js';
import { api, extractApiError } from '@/utils/api.js';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import LoadingOverlay from '../ui/LoadingOverlay';
import ErrorBanner from '../ui/ErrorBanner';

export default function ChatPanel() {
  const { sessionId } = useParams();
  const {
    currentSession, messages, addMessage, applyAssistantResponse,
    isLoading, setLoading, error, setError,
  } = useAppStore();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (text) => {
    if (!text.trim() || isLoading || !sessionId) return;
    addMessage({ role: 'user', text, id: Date.now().toString() });
    setLoading(true);
    setError(null);
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
    } finally {
      setLoading(false);
    }
  };

  return (
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
