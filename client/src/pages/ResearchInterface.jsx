import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ChatPanel from '@/components/chat/ChatPanel.jsx';
import EvidencePanel from '@/components/evidence/EvidencePanel.jsx';
import Sidebar from '@/components/sidebar/Sidebar.jsx';
import LoadingOverlay from '@/components/ui/LoadingOverlay.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import { useAppStore } from '@/store/useAppStore.js';
import { api, extractApiError } from '@/utils/api.js';

export default function ResearchInterface() {
  const { sessionId } = useParams();
  const { setSession, setMessages, setSources, setLoading } = useAppStore();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [mobileTab, setMobileTab] = useState('chat');

  const retryBootstrap = () => {
    setRetryToken((previous) => previous + 1);
  };

  useEffect(() => {
    let isMounted = true;

    if (!sessionId) {
      setIsBootstrapping(false);
      setBootstrapError('Missing session id in route.');
      return () => {};
    }

    const load = async () => {
      setIsBootstrapping(true);
      setBootstrapError('');
      setLoading(false);

      try {
        const [{ data: sessionData }, { data: sourceData }] = await Promise.all([
          api.get(`/sessions/${sessionId}`),
          api.get(`/sessions/${sessionId}/sources?mode=latest`)
        ]);

        if (!isMounted) {
          return;
        }

        setSession(sessionData.session);
        setMessages(sessionData.messages || []);
        setSources(sourceData.sources || []);
      } catch (error) {
        if (isMounted) {
          setBootstrapError(extractApiError(error, 'Failed to load this research session.'));
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [retryToken, sessionId, setLoading, setMessages, setSession, setSources]);

  if (isBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent px-6 text-slate-100">
        <div className="w-full max-w-xl">
          <LoadingOverlay message="Loading session context..." />
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent px-6 text-slate-100">
        <div className="w-full max-w-xl">
          <ErrorBanner message={bootstrapError} onRetry={retryBootstrap} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-slate-100">
      <aside className="hidden w-[320px] border-r border-slate-800 bg-slate-950/80 md:block">
        <Sidebar />
      </aside>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:flex md:w-[45%] md:border-r md:border-slate-800 md:pb-0`}>
          <ChatPanel />
        </div>

        <div className={`${mobileTab === 'evidence' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:flex md:w-[55%] md:pb-0`}>
          <EvidencePanel />
        </div>

        <div className={`${mobileTab === 'sidebar' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:hidden`}>
          <Sidebar />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 flex border-t border-slate-800 bg-slate-950/95 md:hidden">
        {[
          { id: 'chat', label: 'Chat' },
          { id: 'evidence', label: 'Evidence' },
          { id: 'sidebar', label: 'Stats' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition ${
              mobileTab === tab.id ? 'text-blue-400' : 'text-slate-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
