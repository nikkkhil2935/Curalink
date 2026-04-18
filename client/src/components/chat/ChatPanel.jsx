import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../utils/api';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import PDFAbnormalAlert from '@/components/features/PDFAbnormalAlert.jsx';
import LoadingOverlay from '../ui/LoadingOverlay';
import ErrorBanner from '../ui/ErrorBanner';
import { patchToast, pushToast } from '@/store/useToastStore.js';

export default function ChatPanel() {
  const { sessionId } = useParams();
  const {
    currentSession,
    messages,
    addMessage,
    applyAssistantResponse,
    setSessionConflicts,
    setLivingBrief,
    updateMessage,
    highlightedMessageId,
    setHighlightedMessage,
    showAbnormalAlert,
    latestAbnormalFindings,
    setShowAbnormalAlert,
    isLoading,
    setLoading,
    error,
    setError
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
    if (!text.trim() || isLoading) return;

    setShowAbnormalAlert(false);
    
    const tempId = Date.now().toString();
    const userMsg = { role: 'user', text };
    
    addMessage({ ...userMsg, id: tempId });
    setLoading(true);
    setError(null);

    const loadingToastId = pushToast({
      title: 'Running Retrieval Pipeline',
      message: 'Expanding query, ranking evidence, and generating a grounded response...',
      loading: true
    });
    
    try {
      const { data } = await api.post(`/sessions/${sessionId}/query`, { message: text.trim() });
      applyAssistantResponse(data.message, data.sources, {
        conflicts: data?.conflicts,
        patientProfile: data?.patientProfile,
        brief: data?.brief
      });

      void api
        .get(`/sessions/${sessionId}/conflicts`)
        .then(({ data: conflictData }) => {
          setSessionConflicts({
            totalConflicts: Number(conflictData?.totalConflicts || 0),
            outcomeGroups: Array.isArray(conflictData?.outcomeGroups) ? conflictData.outcomeGroups : []
          });
        })
        .catch(() => {});

      void api
        .get(`/sessions/${sessionId}/brief`)
        .then(({ data: briefData }) => {
          setLivingBrief(briefData?.brief || null);
        })
        .catch(() => {});

      const conflictCount = Array.isArray(data?.conflicts) ? data.conflicts.length : 0;
      patchToast(loadingToastId, {
        loading: false,
        variant: 'success',
        title: 'Response Ready',
        message:
          conflictCount > 0
            ? `Evidence-backed answer generated with ${conflictCount} contradiction signal${conflictCount === 1 ? '' : 's'}.`
            : 'Evidence-backed answer generated successfully.'
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden token-bg">
      {error && <ErrorBanner message={error} onClose={() => setError(null)} className="top-20" />}
      
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-240 space-y-4">
          {showAbnormalAlert && messages.length === 0 ? (
            <PDFAbnormalAlert
              findings={latestAbnormalFindings}
              onDismiss={() => setShowAbnormalAlert(false)}
            />
          ) : null}

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
      </div>
    </div>
  );
}