import { useEffect, useRef, useState } from 'react';
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
  const { setSession, setMessages, setSources, setLoading, setSelectedAssistantMessage } = useAppStore();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');
  const [sourceWarning, setSourceWarning] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [mobileTab, setMobileTab] = useState('chat');
  const mobileTabRefs = useRef([]);

  const mobileTabs = [
    { id: 'chat', label: 'Chat' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'sidebar', label: 'Stats' }
  ];

  const onMobileTabKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();

    let nextIndex = index;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % mobileTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + mobileTabs.length) % mobileTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = mobileTabs.length - 1;
    }

    const nextTab = mobileTabs[nextIndex];
    if (!nextTab) {
      return;
    }

    setMobileTab(nextTab.id);
    mobileTabRefs.current[nextIndex]?.focus();
  };

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
      setSourceWarning('');
      setLoading(false);
      setSelectedAssistantMessage(null);
      setSources([]);

      try {
        const { data: sessionData } = await api.get(`/sessions/${sessionId}`);

        if (!isMounted) {
          return;
        }

        setSession(sessionData.session);
        const messages = sessionData.messages || [];
        setMessages(messages);

        const latestAssistantWithSources = [...messages]
          .reverse()
          .find(
            (message) =>
              message.role === 'assistant' &&
              ((Array.isArray(message.usedSourceIds) && message.usedSourceIds.length > 0) ||
                Object.keys(message.sourceIndex || {}).length > 0)
          );

        if (latestAssistantWithSources?._id) {
          setSelectedAssistantMessage(latestAssistantWithSources._id);
          try {
            const { data: sourceData } = await api.get(
              `/sessions/${sessionId}/sources/${latestAssistantWithSources._id}`
            );
            if (isMounted) {
              setSources(sourceData.sources || [], latestAssistantWithSources._id);
            }
          } catch {
            if (isMounted) {
              setSourceWarning('Evidence for the latest answer could not be loaded yet. Retry to refresh sources.');
            }
          }
        }
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
  }, [retryToken, sessionId, setLoading, setMessages, setSelectedAssistantMessage, setSession, setSources]);

  if (isBootstrapping) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center bg-transparent px-6 text-slate-100">
        <div className="w-full max-w-xl">
          <LoadingOverlay message="Loading session context..." />
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center bg-transparent px-6 text-slate-100">
        <div className="w-full max-w-xl">
          <ErrorBanner message={bootstrapError} onRetry={retryBootstrap} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex min-h-dvh overflow-hidden bg-transparent text-slate-100">
      <aside className="hidden w-[320px] border-r border-slate-800 bg-slate-950/80 md:block">
        <Sidebar />
      </aside>

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        {sourceWarning ? (
          <div className="absolute left-1/2 top-2 z-20 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 md:top-3">
            <ErrorBanner message={sourceWarning} onRetry={retryBootstrap} />
          </div>
        ) : null}

        <div
          className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:flex md:w-[45%] md:border-r md:border-slate-800 md:pb-0`}
          id="chat-mobile-panel"
          role="tabpanel"
          aria-labelledby="chat-mobile-tab"
        >
          <ChatPanel />
        </div>

        <div
          className={`${mobileTab === 'evidence' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:flex md:w-[55%] md:pb-0`}
          id="evidence-mobile-panel"
          role="tabpanel"
          aria-labelledby="evidence-mobile-tab"
        >
          <EvidencePanel />
        </div>

        <div
          className={`${mobileTab === 'sidebar' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:hidden`}
          id="sidebar-mobile-panel"
          role="tabpanel"
          aria-labelledby="sidebar-mobile-tab"
        >
          <Sidebar />
        </div>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-slate-800 bg-slate-950/95 md:hidden"
        role="tablist"
        aria-label="Research interface sections"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        {mobileTabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              mobileTabRefs.current[index] = node;
            }}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            onKeyDown={(event) => onMobileTabKeyDown(event, index)}
            role="tab"
            id={`${tab.id}-mobile-tab`}
            aria-controls={`${tab.id}-mobile-panel`}
            aria-selected={mobileTab === tab.id}
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
