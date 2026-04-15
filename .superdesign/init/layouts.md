# Shared Layout Components

## ResearchInterface
Source: `client/src/pages/ResearchInterface.jsx`
Description: Main application shell combining sidebar, chat panel, and evidence panel.

```jsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ChatPanel from '@/components/chat/ChatPanel.jsx';
import EvidencePanel from '@/components/evidence/EvidencePanel.jsx';
import Sidebar from '@/components/sidebar/Sidebar.jsx';
import { useAppStore } from '@/store/useAppStore.js';

export default function ResearchInterface() {
  const { sessionId } = useParams();
  const { setSession, setMessages, setSources, setLoading } = useAppStore();

  useEffect(() => {
    let isMounted = true;

    if (!sessionId) {
      return () => {};
    }

    const load = async () => {
      setLoading(true);

      try {
        const [{ data: sessionData }, { data: sourceData }] = await Promise.all([
          axios.get(`/api/sessions/${sessionId}`),
          axios.get(`/api/sessions/${sessionId}/sources?mode=latest`)
        ]);

        if (!isMounted) {
          return;
        }

        setSession(sessionData.session);
        setMessages(sessionData.messages || []);
        setSources(sourceData.sources || []);
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load session data', error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [sessionId, setLoading, setMessages, setSession, setSources]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-transparent text-slate-100 lg:flex-row">
      <aside className="w-full border-b border-slate-800 bg-slate-950/80 lg:max-w-[320px] lg:border-b-0 lg:border-r lg:border-slate-800">
        <Sidebar />
      </aside>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_1fr]">
        <ChatPanel className="lg:border-r lg:border-slate-800" />
        <EvidencePanel />
      </main>
    </div>
  );
}
```

## Sidebar
Source: `client/src/components/sidebar/Sidebar.jsx`
Description: Session metadata, retrieval stats, and primary side actions.

```jsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore.js';
import ExportButton from './ExportButton.jsx';

export default function Sidebar() {
  const { currentSession, messages } = useAppStore();
  const navigate = useNavigate();

  const latestRetrievalStats = useMemo(() => {
    const assistantMessages = [...messages].reverse().filter((message) => message.role === 'assistant');
    const latest = assistantMessages.find((message) => message.retrievalStats);
    return latest?.retrievalStats || null;
  }, [messages]);

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
          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Analytics Dashboard
        </button>
      </div>
    </div>
  );
}
```
