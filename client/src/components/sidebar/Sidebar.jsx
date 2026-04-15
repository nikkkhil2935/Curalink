import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore.js';
import ThemeToggle from '@/components/ui/ThemeToggle.jsx';
import ExportButton from './ExportButton.jsx';

export default function Sidebar() {
  const { currentSession, messages, selectedAssistantMessageId } = useAppStore();
  const navigate = useNavigate();

  const selectedAssistant = useMemo(() => {
    if (selectedAssistantMessageId) {
      return messages.find((message) => String(message._id || '') === String(selectedAssistantMessageId));
    }

    const assistantMessages = [...messages].reverse().filter((message) => message.role === 'assistant');
    return assistantMessages.find((message) => message.retrievalStats) || null;
  }, [messages, selectedAssistantMessageId]);

  const latestRetrievalStats = selectedAssistant?.retrievalStats || null;

  return (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-4">
        <div className="mb-2 flex items-center justify-end">
          <ThemeToggle />
        </div>

        <div className="surface-soft rounded-xl p-4">
          <h3 className="text-xs uppercase tracking-wider text-slate-400">Session</h3>
          <p className="mt-2 text-sm font-semibold text-slate-100">{currentSession?.title || 'Untitled session'}</p>
          <div className="mt-3 space-y-1 text-xs text-slate-300">
            <p>Disease: {currentSession?.disease || 'N/A'}</p>
            <p>Intent: {currentSession?.intent || 'General'}</p>
            <p>
              Location: {currentSession?.location?.city || 'Unknown city'}, {currentSession?.location?.country || 'Unknown country'}
            </p>
            <p>Messages: {messages.length}</p>
          </div>
        </div>

        <div className="surface-soft rounded-xl p-4">
          <h3 className="text-xs uppercase tracking-wider text-slate-400">Retrieval stats</h3>
          {selectedAssistant?.createdAt ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Linked answer: {new Date(selectedAssistant.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          ) : null}

          {latestRetrievalStats ? (
            <div className="mt-3 space-y-1 text-xs text-slate-300">
              <p>Total candidates: {latestRetrievalStats.totalCandidates ?? 0}</p>
              <p>PubMed fetched: {latestRetrievalStats.pubmedFetched ?? 0}</p>
              <p>OpenAlex fetched: {latestRetrievalStats.openalexFetched ?? 0}</p>
              <p>ClinicalTrials fetched: {latestRetrievalStats.ctFetched ?? 0}</p>
              <p>Shown to you: {latestRetrievalStats.rerankedTo ?? 0}</p>
              {latestRetrievalStats.timeTakenMs ? (
                <p className="border-t border-slate-800 pt-1 text-slate-500">
                  Retrieved in {(latestRetrievalStats.timeTakenMs / 1000).toFixed(1)}s
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No retrieval stats yet. Ask a research question to populate metrics.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <ExportButton />
        <button
          type="button"
          onClick={() => navigate('/analytics')}
          className="btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Analytics Dashboard
        </button>
      </div>
    </div>
  );
}
