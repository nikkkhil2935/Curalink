import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import ChatPanel from '@/components/chat/ChatPanel.jsx';
import EvidencePanel from '@/components/evidence/EvidencePanel.jsx';
import Sidebar from '@/components/sidebar/Sidebar.jsx';
import HistoryCommandPalette from '@/components/features/HistoryCommandPalette.jsx';
import LoadingOverlay from '@/components/ui/LoadingOverlay.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import { useAppStore } from '@/store/useAppStore.js';
import { api, extractApiError } from '@/utils/api.js';
import { clamp, cn } from '@/lib/utils.js';

const SIDEBAR_EXPANDED_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const EVIDENCE_DEFAULT_WIDTH = 420;
const EVIDENCE_MIN_WIDTH = 320;
const CHAT_MIN_WIDTH = 320;

export default function ResearchInterface() {
  const { sessionId } = useParams();
  const location = useLocation();
  const {
    messages,
    setSession,
    setMessages,
    setSources,
    setLoading,
    setSelectedAssistantMessage,
    setHighlightedMessage
  } = useAppStore();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');
  const [sourceWarning, setSourceWarning] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [mobileTab, setMobileTab] = useState('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [evidenceWidth, setEvidenceWidth] = useState(EVIDENCE_DEFAULT_WIDTH);
  const mobileTabRefs = useRef([]);
  const desktopLayoutRef = useRef(null);

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

  const getEvidenceMaxWidth = () => {
    const layoutWidth = desktopLayoutRef.current?.clientWidth || 0;
    const activeSidebarWidth = isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
    const maxByLayout = layoutWidth - activeSidebarWidth - CHAT_MIN_WIDTH - 8;
    return Math.max(EVIDENCE_MIN_WIDTH, maxByLayout || EVIDENCE_MIN_WIDTH);
  };

  const clampEvidenceWidth = (candidate) => {
    return clamp(candidate, EVIDENCE_MIN_WIDTH, getEvidenceMaxWidth());
  };

  const onEvidenceResizeKeyDown = (event) => {
    const step = event.shiftKey ? 24 : 12;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setEvidenceWidth((previous) => clampEvidenceWidth(previous + step));
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setEvidenceWidth((previous) => clampEvidenceWidth(previous - step));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setEvidenceWidth(EVIDENCE_MIN_WIDTH);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setEvidenceWidth(getEvidenceMaxWidth());
    }
  };

  const onEvidenceResizeStart = (event) => {
    if (typeof window === 'undefined' || window.innerWidth < 768) {
      return;
    }

    event.preventDefault();

    const layoutBounds = desktopLayoutRef.current?.getBoundingClientRect();
    if (!layoutBounds) {
      return;
    }

    const sidebarWidth = isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

    const onPointerMove = (moveEvent) => {
      const nextWidth = layoutBounds.right - moveEvent.clientX - sidebarWidth;
      setEvidenceWidth(clampEvidenceWidth(nextWidth));
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
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
      setHighlightedMessage(null);
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
  }, [
    retryToken,
    sessionId,
    setHighlightedMessage,
    setLoading,
    setMessages,
    setSelectedAssistantMessage,
    setSession,
    setSources
  ]);

  useEffect(() => {
    const focusMessageId = new URLSearchParams(location.search).get('focusMessage');
    if (!focusMessageId || !messages.length || !sessionId) {
      return () => {};
    }

    let cancelled = false;

    const focusMessage = async () => {
      const targetIndex = messages.findIndex((message) => String(message?._id || message?.id || '') === focusMessageId);
      if (targetIndex === -1) {
        return;
      }

      const targetMessage = messages[targetIndex];
      setHighlightedMessage(focusMessageId);

      let assistantTarget = null;
      if (targetMessage?.role === 'assistant') {
        assistantTarget = targetMessage;
      } else {
        assistantTarget = [...messages.slice(0, targetIndex)].reverse().find((message) => message.role === 'assistant');
      }

      const assistantId = assistantTarget?._id ? String(assistantTarget._id) : null;
      if (!assistantId || cancelled) {
        return;
      }

      setSelectedAssistantMessage(assistantId);

      try {
        const { data } = await api.get(`/sessions/${sessionId}/sources/${assistantId}`);
        if (!cancelled) {
          setSources(data.sources || [], assistantId);
        }
      } catch {
        if (!cancelled) {
          setSourceWarning('Evidence for the selected message could not be loaded yet.');
        }
      }
    };

    focusMessage();

    return () => {
      cancelled = true;
    };
  }, [location.search, messages, sessionId, setHighlightedMessage, setSelectedAssistantMessage, setSources]);

  useEffect(() => {
    const syncEvidenceWidth = () => {
      setEvidenceWidth((previous) => clampEvidenceWidth(previous));
    };

    syncEvidenceWidth();

    window.addEventListener('resize', syncEvidenceWidth);
    return () => window.removeEventListener('resize', syncEvidenceWidth);
  }, [isSidebarCollapsed]);

  if (isBootstrapping) {
    return (
      <div className="app-shell token-bg token-text flex h-dvh flex-col overflow-hidden">
        <AppTopNav showNav={false} showPrimaryAction={false} />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-xl">
            <LoadingOverlay message="Loading session context..." />
          </div>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="app-shell token-bg token-text flex h-dvh flex-col overflow-hidden">
        <AppTopNav showNav={false} showPrimaryAction={false} />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-xl">
            <ErrorBanner message={bootstrapError} onRetry={retryBootstrap} className="top-20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell token-bg token-text flex h-dvh flex-col overflow-hidden">
      <AppTopNav showPrimaryAction={false} />
      <HistoryCommandPalette />
      {sourceWarning ? <ErrorBanner message={sourceWarning} onRetry={retryBootstrap} className="top-20" /> : null}

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden md:hidden">
          <section
            className={cn('min-h-0 flex-1 flex-col pb-16', mobileTab === 'chat' ? 'flex' : 'hidden')}
            id="chat-mobile-panel"
            role="tabpanel"
            aria-labelledby="chat-mobile-tab"
          >
            <ChatPanel />
          </section>

          <section
            className={cn('min-h-0 flex-1 flex-col pb-16', mobileTab === 'evidence' ? 'flex' : 'hidden')}
            id="evidence-mobile-panel"
            role="tabpanel"
            aria-labelledby="evidence-mobile-tab"
          >
            <EvidencePanel />
          </section>

          <section
            className={cn('min-h-0 flex-1 flex-col pb-16', mobileTab === 'sidebar' ? 'flex' : 'hidden')}
            id="sidebar-mobile-panel"
            role="tabpanel"
            aria-labelledby="sidebar-mobile-tab"
          >
            <Sidebar />
          </section>
        </div>

        <div ref={desktopLayoutRef} className="hidden h-full min-h-0 flex-1 overflow-hidden md:flex">
          <section className="min-h-0 min-w-0 flex-1 overflow-hidden border-r token-border">
            <ChatPanel />
          </section>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize evidence panel"
            tabIndex={0}
            onPointerDown={onEvidenceResizeStart}
            onKeyDown={onEvidenceResizeKeyDown}
            className="group relative w-2 cursor-col-resize bg-[color-mix(in_srgb,var(--bg-surface-2)_70%,transparent)]"
          >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-(--border-subtle) transition-colors duration-150 ease-out group-hover:bg-(--accent)" />
          </div>

          <section
            className="min-h-0 shrink-0 overflow-hidden border-r token-border"
            style={{ width: `${evidenceWidth}px`, minWidth: `${EVIDENCE_MIN_WIDTH}px` }}
          >
            <EvidencePanel />
          </section>

          <aside
            className={cn(
              'min-h-0 shrink-0 overflow-hidden border-l token-border token-surface transition-[width] duration-150 ease-out',
              isSidebarCollapsed ? 'w-16' : 'w-70'
            )}
          >
            <Sidebar
              collapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
            />
          </aside>
        </div>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-50 flex border-t token-border token-surface md:hidden"
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
              aria-label={`Open ${tab.label} panel`}
              className={`relative flex-1 py-4 text-xs font-semibold uppercase tracking-wider duration-150 ease-out ${
                isActive ? 'text-(--text-primary)' : 'text-(--text-subtle) hover:text-(--text-muted)'
              }`}
            >
              {isActive ? <span className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-(--accent)" aria-hidden="true" /> : null}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
