import { useEffect, useRef, useState } from 'react';
<<<<<<< HEAD
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Home, MessageSquare, BookOpen, BarChart2 } from 'lucide-react';
=======
import { useLocation, useParams } from 'react-router-dom';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
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

const MOBILE_TABS = [
  { id: 'chat',     label: 'Chat',     icon: MessageSquare },
  { id: 'evidence', label: 'Evidence', icon: BookOpen      },
  { id: 'sidebar',  label: 'Stats',    icon: BarChart2     },
];

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
<<<<<<< HEAD
  const tabRefs = useRef([]);
=======
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [evidenceWidth, setEvidenceWidth] = useState(EVIDENCE_DEFAULT_WIDTH);
  const mobileTabRefs = useRef([]);
  const desktopLayoutRef = useRef(null);
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

  const onTabKeyDown = (e, idx) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % MOBILE_TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + MOBILE_TABS.length) % MOBILE_TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = MOBILE_TABS.length - 1;
    setMobileTab(MOBILE_TABS[next].id);
    tabRefs.current[next]?.focus();
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
    let mounted = true;
    if (!sessionId) { setIsBootstrapping(false); setBootstrapError('Missing session id.'); return; }

    const load = async () => {
      setIsBootstrapping(true);
      setBootstrapError('');
      setSourceWarning('');
      setLoading(false);
      setSelectedAssistantMessage(null);
      setHighlightedMessage(null);
      setSources([]);
      try {
        const { data } = await api.get(`/sessions/${sessionId}`);
        if (!mounted) return;
        setSession(data.session);
        const msgs = data.messages || [];
        setMessages(msgs);

        const latestWithSources = [...msgs].reverse().find(
          (m) =>
            m.role === 'assistant' &&
            Array.isArray(m.usedSourceIds) &&
            m.usedSourceIds.length > 0
        );

        if (latestWithSources?._id) {
          setSelectedAssistantMessage(latestWithSources._id);
          try {
            const { data: sd } = await api.get(`/sessions/${sessionId}/sources/${latestWithSources._id}`);
            if (mounted) setSources(sd.sources || [], latestWithSources._id);
          } catch {
            if (mounted) setSourceWarning('Could not load evidence for the latest answer. Retry to refresh.');
          }
        }
      } catch (err) {
        if (mounted) setBootstrapError(extractApiError(err, 'Failed to load this research session.'));
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    };

    load();
<<<<<<< HEAD
    return () => { mounted = false; };
  }, [retryToken, sessionId, setLoading, setMessages, setSelectedAssistantMessage, setSession, setSources]);

  if (isBootstrapping) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center px-6"
        style={{ background: 'var(--color-canvas)' }}
      >
        <div className="w-full max-w-xl">
          <LoadingOverlay message="Loading session context…" />
=======

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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
<<<<<<< HEAD
      <div
        className="flex min-h-dvh items-center justify-center px-6"
        style={{ background: 'var(--color-canvas)' }}
      >
        <div className="w-full max-w-xl space-y-4">
          <ErrorBanner message={bootstrapError} onRetry={() => setRetryToken((t) => t + 1)} />
          <button
            type="button"
            onClick={() => navigate('/')}
            className="cl-btn-ghost w-full flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" /> Back to Home
          </button>
=======
      <div className="app-shell token-bg token-text flex h-dvh flex-col overflow-hidden">
        <AppTopNav showNav={false} showPrimaryAction={false} />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-xl">
            <ErrorBanner message={bootstrapError} onRetry={retryBootstrap} className="top-20" />
          </div>
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
        </div>
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <div
      className="flex min-h-dvh overflow-hidden"
      style={{ background: 'var(--color-canvas)', color: 'var(--text-primary)' }}
    >
      {/* ── MAIN 3-PANEL LAYOUT ── */}
      <main className="relative flex min-h-0 flex-1 overflow-hidden">

        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="absolute left-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-strong)',
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow-card)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <ArrowLeft className="h-3 w-3" />
          Home
        </button>

        {sourceWarning && (
          <div className="absolute left-1/2 top-2 z-20 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 md:top-3">
            <ErrorBanner message={sourceWarning} onRetry={() => setRetryToken((t) => t + 1)} />
          </div>
        )}

        {/* Chat Panel */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:flex md:w-[45%] md:pb-0`}
          style={{ borderRight: '1px solid var(--color-border)' }}
          id="chat-panel"
          role="tabpanel"
          aria-labelledby="chat-tab"
        >
          <ChatPanel />
        </motion.div>

        {/* Evidence Panel */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`${mobileTab === 'evidence' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:flex md:w-[55%] md:pb-0`}
          style={{ background: 'var(--color-surface)' }}
          id="evidence-panel"
          role="tabpanel"
          aria-labelledby="evidence-tab"
        >
          <EvidencePanel />
        </motion.div>

        {/* Mobile sidebar panel */}
        <div
          className={`${mobileTab === 'sidebar' ? 'flex' : 'hidden'} w-full flex-col pb-16 md:hidden`}
          style={{ background: 'var(--color-canvas)' }}
          id="sidebar-panel"
          role="tabpanel"
          aria-labelledby="sidebar-tab"
        >
          <Sidebar />
        </div>
      </main>

      {/* ── SIDEBAR (desktop) ── */}
      <aside
        className="hidden w-75 md:flex flex-col"
        style={{
          borderLeft: '1px solid var(--color-border)',
          background: 'var(--color-canvas)',
        }}
      >
        <Sidebar />
      </aside>

      {/* ── MOBILE TAB BAR ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex md:hidden"
=======
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
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
        role="tablist"
        aria-label="Interface sections"
        style={{
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
        }}
      >
        {MOBILE_TABS.map((tab, i) => {
          const active = mobileTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(n) => { tabRefs.current[i] = n; }}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              role="tab"
<<<<<<< HEAD
              id={`${tab.id}-tab`}
              aria-controls={`${tab.id}-panel`}
              aria-selected={active}
              className="relative flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wider transition-colors"
              style={{ color: active ? '#60a5fa' : 'var(--text-muted)' }}
            >
              {active && (
                <motion.div
                  layoutId="mobile-tab-bg"
                  className="absolute inset-x-1 inset-y-1 rounded-xl"
                  style={{ background: 'rgba(59,130,246,0.08)' }}
                  transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                />
              )}
              <tab.icon className="relative z-10 h-4 w-4" />
=======
              id={`${tab.id}-mobile-tab`}
              aria-controls={`${tab.id}-mobile-panel`}
              aria-selected={isActive}
              aria-label={`Open ${tab.label} panel`}
              className={`relative flex-1 py-4 text-xs font-semibold uppercase tracking-wider duration-150 ease-out ${
                isActive ? 'text-(--text-primary)' : 'text-(--text-subtle) hover:text-(--text-muted)'
              }`}
            >
              {isActive ? <span className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-(--accent)" aria-hidden="true" /> : null}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
