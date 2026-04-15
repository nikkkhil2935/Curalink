import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore.js';
import ChatInput from './ChatInput.jsx';
import MessageBubble from './MessageBubble.jsx';
import LoadingOverlay from '@/components/ui/LoadingOverlay.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import { api, extractApiError } from '@/utils/api.js';

export default function ChatPanel({ className = '' }) {
  const { sessionId } = useParams();
  const {
    currentSession,
    messages,
    addMessage,
    applyAssistantResponse,
    isLoading,
    setLoading,
    sourcesByMessageId,
    selectedAssistantMessageId,
    setSelectedAssistantMessage,
    setSources,
    setActiveTab
  } = useAppStore();
  const bottomRef = useRef(null);
  const [panelError, setPanelError] = useState(null);
  const [lastUserMessage, setLastUserMessage] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, panelError]);

  const sendMessage = async (text, { retry = false } = {}) => {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) {
      return;
    }

    setPanelError(null);
    setLastUserMessage(trimmed);

    if (!retry) {
      addMessage({
        _id: `local-user-${Date.now()}`,
        role: 'user',
        text: trimmed,
        createdAt: new Date().toISOString()
      });
    }

    setLoading(true);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/query`, { message: trimmed });
      applyAssistantResponse(data.message, data.sources);
    } catch (error) {
      setPanelError({
        type: 'query',
        message: extractApiError(error, 'Unable to retrieve research evidence right now.')
      });
    } finally {
      setLoading(false);
    }
  };

  const retryLastMessage = () => {
    if (isLoading) {
      return;
    }

    if (panelError?.type === 'sources' && panelError.assistantMessageId) {
      const selectedMessage = messages.find(
        (message) => String(message._id || '') === String(panelError.assistantMessageId)
      );

      if (selectedMessage) {
        selectAssistantMessage(selectedMessage, panelError.citationId || null);
        return;
      }
    }

    if (!lastUserMessage) {
      return;
    }

    sendMessage(lastUserMessage, { retry: true });
  };

  const selectAssistantMessage = async (message, citationId = null) => {
    if (!sessionId || message.role !== 'assistant' || !message._id) {
      return;
    }

    const messageId = String(message._id);
  setPanelError(null);
    setSelectedAssistantMessage(messageId);

    if (citationId?.startsWith('T')) {
      setActiveTab('trials');
    } else if (citationId?.startsWith('P')) {
      setActiveTab('publications');
    }

    const cachedSources = sourcesByMessageId[messageId];
    if (Array.isArray(cachedSources)) {
      setSources(cachedSources, messageId);
      return;
    }

    try {
      const { data } = await api.get(`/sessions/${sessionId}/sources/${messageId}`);
      setSources(data.sources || [], messageId);
    } catch (error) {
      setPanelError({
        type: 'sources',
        assistantMessageId: messageId,
        citationId,
        message: extractApiError(error, 'Unable to load evidence for this answer.')
      });
    }
  };

  return (
    <section className={`flex h-full flex-col ${className}`}>
      <header className="border-b border-slate-800 px-4 py-4">
        <h2 className="text-base font-semibold text-slate-100">{currentSession?.disease || 'Research chat'}</h2>
        <p className="mt-1 text-xs text-slate-400">
          {(currentSession?.location?.city || 'Unknown city')}, {(currentSession?.location?.country || 'Unknown country')}
        </p>
      </header>

      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
            Ask about treatments, diagnostic methods, side effects, or recruiting trials.
          </div>
        ) : null}

        {messages.map((message, index) => (
          <MessageBubble
            key={message._id || `${message.role}-${index}`}
            message={message}
            isSelected={Boolean(selectedAssistantMessageId && selectedAssistantMessageId === String(message._id || ''))}
            onSelectAssistantMessage={() => selectAssistantMessage(message)}
            onCitationClick={(citationId) => selectAssistantMessage(message, citationId)}
          />
        ))}

        {panelError?.message ? <ErrorBanner message={panelError.message} onRetry={retryLastMessage} /> : null}

        {isLoading ? (
          <LoadingOverlay message="Searching 300+ research sources..." />
        ) : null}

        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </section>
  );
}
