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
          axios.get(`/api/sessions/${sessionId}/sources`)
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
    <div className="flex h-screen overflow-hidden bg-transparent text-slate-100">
      <aside className="w-full max-w-[320px] border-r border-slate-800 bg-slate-950/80">
        <Sidebar />
      </aside>

      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_1fr]">
        <ChatPanel className="border-r border-slate-800" />
        <EvidencePanel />
      </main>
    </div>
  );
}
