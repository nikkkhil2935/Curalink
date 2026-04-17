import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Home, MessageSquare, BookOpen, BarChart2 } from 'lucide-react';
import ChatPanel from '@/components/chat/ChatPanel.jsx';
import EvidencePanel from '@/components/evidence/EvidencePanel.jsx';
import Sidebar from '@/components/sidebar/Sidebar.jsx';
import LoadingOverlay from '@/components/ui/LoadingOverlay.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import { useAppStore } from '@/store/useAppStore.js';
import { api, extractApiError } from '@/utils/api.js';

const MOBILE_TABS = [
  { id: 'chat',     label: 'Chat',     icon: MessageSquare },
  { id: 'evidence', label: 'Evidence', icon: BookOpen      },
  { id: 'sidebar',  label: 'Stats',    icon: BarChart2     },
];

export default function ResearchInterface() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { setSession, setMessages, setSources, setLoading, setSelectedAssistantMessage } = useAppStore();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');
  const [sourceWarning, setSourceWarning] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [mobileTab, setMobileTab] = useState('chat');
  const tabRefs = useRef([]);

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

  useEffect(() => {
    let mounted = true;
    if (!sessionId) { setIsBootstrapping(false); setBootstrapError('Missing session id.'); return; }

    const load = async () => {
      setIsBootstrapping(true);
      setBootstrapError('');
      setSourceWarning('');
      setLoading(false);
      setSelectedAssistantMessage(null);
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
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
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
        </div>
      </div>
    );
  }

  return (
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
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
