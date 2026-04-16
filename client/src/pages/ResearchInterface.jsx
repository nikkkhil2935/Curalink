import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="flex min-h-dvh overflow-hidden bg-gray-950 text-gray-100">
      <main className="relative flex min-h-0 flex-1 overflow-hidden bg-gray-950">
        {sourceWarning ? (
          <div className="absolute left-1/2 top-2 z-20 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 md:top-3">
            <ErrorBanner message={sourceWarning} onRetry={retryBootstrap} />
          </div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:flex md:w-[45%] md:pb-0 bg-gray-950 z-10`}
          id="chat-mobile-panel"
          role="tabpanel"
          aria-labelledby="chat-mobile-tab"
        >
          <ChatPanel />
        </motion.div>

        <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`${mobileTab === 'evidence' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:flex md:w-[55%] md:pb-0 bg-gray-900 shadow-xl shadow-black/20 z-20`}
          id="evidence-mobile-panel"
          role="tabpanel"
          aria-labelledby="evidence-mobile-tab"
        >
          <EvidencePanel />
        </motion.div>

        <div
          className={`${mobileTab === 'sidebar' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:hidden bg-gray-950`}
          id="sidebar-mobile-panel"
          role="tabpanel"
          aria-labelledby="sidebar-mobile-tab"
        >
          <Sidebar />
        </div>
      </main>

      <aside className="hidden w-[320px] bg-gray-950 md:block z-10 shadow-lg shadow-black/10 border-l border-gray-800">
        <Sidebar />
      </aside>

      <div
        className="fixed inset-x-0 bottom-0 z-50 flex bg-gray-900 md:hidden"
        role="tablist"
        aria-label="Research interface sections"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        {mobileTabs.map((tab, index) => {
          const isActive = mobileTab === tab.id;
          return (
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
              aria-selected={isActive}
              className={`relative flex-1 py-4 text-xs font-semibold uppercase tracking-wider transition-colors ${
                isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-mobile-tab"
                  className="absolute inset-x-2 inset-y-1 rounded-lg bg-gray-800 z-0"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  );
}
