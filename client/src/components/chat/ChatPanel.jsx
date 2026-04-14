import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/useAppStore.js';
import ChatInput from './ChatInput.jsx';
import MessageBubble from './MessageBubble.jsx';

export default function ChatPanel({ className = '' }) {
  const { sessionId } = useParams();
  const { currentSession, messages, addMessage, isLoading, setLoading, setSources } = useAppStore();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) {
      return;
    }

    addMessage({
      _id: `local-user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      createdAt: new Date().toISOString()
    });

    setLoading(true);

    try {
      const { data } = await axios.post(`/api/sessions/${sessionId}/query`, { message: trimmed });
      addMessage(data.message);
      setSources(data.sources || []);
    } catch (error) {
      addMessage({
        _id: `local-assistant-${Date.now()}`,
        role: 'assistant',
        text: 'Something failed while sending your message. Please retry.',
        createdAt: new Date().toISOString()
      });
    } finally {
      setLoading(false);
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
          <MessageBubble key={message._id || `${message.role}-${index}`} message={message} />
        ))}

        {isLoading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-400">
            Fetching and ranking research candidates (placeholder mode)...
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </section>
  );
}
