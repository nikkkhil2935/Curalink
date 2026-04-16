import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../utils/api';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import LoadingOverlay from '../ui/LoadingOverlay';
import ErrorBanner from '../ui/ErrorBanner';

export default function ChatPanel() {
  const { id } = useParams();
  const { currentSession, messages, addMessage, setSources, isLoading, setLoading, error, setError } = useAppStore();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (text) => {
    if (!text.trim() || isLoading) return;
    
    const tempId = Date.now().toString();
    const userMsg = { role: 'user', text };
    
    addMessage({ ...userMsg, id: tempId });
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await api.post(`/sessions/${id}/query`, { message: userMsg });
      addMessage(data.message);
      if (data.sources) setSources(data.sources);
    } catch (err) {
      setError(err.message || 'Failed to get answer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 relative">
      {error && <ErrorBanner error={error} onClose={() => setError(null)} />}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <h2 className="text-xl font-bold text-white">Ask anything about {currentSession?.disease || 'this topic'}</h2>
            <p className="text-sm text-gray-400 max-w-md">Research retrieved in real-time from PubMed, OpenAlex & ClinicalTrials.gov</p>
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={m.id || i} message={m} />)
        )}
        
        {isLoading && <LoadingOverlay />}
        <div ref={bottomRef} />
      </div>
      
      <div className="p-4 border-t border-gray-800 bg-gray-900">
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}