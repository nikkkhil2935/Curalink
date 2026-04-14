import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/useAppStore.js';

export default function Sidebar() {
  const { sessionId } = useParams();
  const { currentSession, messages } = useAppStore();

  const latestRetrievalStats = useMemo(() => {
    const assistantMessages = [...messages].reverse().filter((message) => message.role === 'assistant');
    const latest = assistantMessages.find((message) => message.retrievalStats);
    return latest?.retrievalStats || null;
  }, [messages]);

  const exportPlaceholder = async () => {
    if (!sessionId) {
      return;
    }

    try {
      await axios.post(`/api/export/${sessionId}`);
      window.alert('Export placeholder triggered. PDF generation is scheduled for a later phase.');
    } catch (error) {
      window.alert('Export request failed.');
    }
  };

  return (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
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

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-xs uppercase tracking-wider text-slate-400">Retrieval stats</h3>

          {latestRetrievalStats ? (
            <div className="mt-3 space-y-1 text-xs text-slate-300">
              <p>Total candidates: {latestRetrievalStats.totalCandidates ?? 0}</p>
              <p>PubMed fetched: {latestRetrievalStats.pubmedFetched ?? 0}</p>
              <p>OpenAlex fetched: {latestRetrievalStats.openalexFetched ?? 0}</p>
              <p>ClinicalTrials fetched: {latestRetrievalStats.ctFetched ?? 0}</p>
              <p>Reranked to: {latestRetrievalStats.rerankedTo ?? 0}</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No retrieval stats yet. Placeholder until Day 2 pipeline.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={exportPlaceholder}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
      >
        Export Research Brief (placeholder)
      </button>
    </div>
  );
}
