import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Clock3, Activity, Microscope, FlaskConical, MapPin, Brain,
  BarChart3, FileText, Sparkles, ArrowRight, BookOpen, ChevronRight,
  Dna, Pill, Users, TrendingUp
} from 'lucide-react';
import ContextForm from '@/components/ContextForm.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import { api, extractApiError } from '@/utils/api.js';

const QUICK_SEARCHES = [
  "Parkinson's Disease treatment options",
  "Lung cancer clinical trials",
  "Alzheimer's Disease latest research",
  "Diabetes Type 2 prevention",
  "Multiple Sclerosis breakthrough",
];

const FEATURES = [
  {
    icon: Brain,
    color: '#3b82f6',
    title: 'Smart Intent Classification',
    desc: 'Automatically detects whether you need treatments, diagnoses, trials, or researchers.',
  },
  {
    icon: FlaskConical,
    color: '#8b5cf6',
    title: '500+ Research Candidates',
    desc: 'Parallel retrieval from PubMed, OpenAlex & ClinicalTrials.gov in seconds.',
  },
  {
    icon: MapPin,
    color: '#10b981',
    title: 'Location-Aware Trials',
    desc: 'Clinical trials near you are highlighted with a "Near You" badge automatically.',
  },
  {
    icon: BarChart3,
    color: '#f59e0b',
    title: 'Evidence Strength Meter',
    desc: 'Every answer shows a 🟢 STRONG / 🟡 MODERATE / 🔴 LIMITED evidence rating.',
  },
  {
    icon: Users,
    color: '#06b6d4',
    title: 'Researcher Spotlight',
    desc: 'Identify the top scientists driving research in any medical field.',
  },
  {
    icon: FileText,
    color: '#ec4899',
    title: 'Research Brief Export',
    desc: 'Download a professional PDF research brief with sources and citations.',
  },
];

const STATS = [
  { value: '3', label: 'Research APIs', sub: 'PubMed · OpenAlex · ClinicalTrials' },
  { value: '500+', label: 'Candidates Retrieved', sub: 'Per query, re-ranked by AI' },
  { value: 'Local LLM', label: 'Zero Hallucination', sub: 'Every claim is source-backed' },
  { value: 'Real-time', label: 'Live Research Data', sub: 'Fresh results every query' },
];

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export default function LandingPage() {
  const [showForm, setShowForm] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [recentSessions, setRecentSessions] = useState([]);
  const [sessionLoadError, setSessionLoadError] = useState('');
  const [startError, setStartError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [creating, setCreating] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const navigate = useNavigate();

  // Cycle through placeholder suggestions
  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % QUICK_SEARCHES.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    api.get('/sessions')
      .then(({ data }) => { if (mounted) setRecentSessions(data.sessions || []); })
      .catch((err) => {
        if (mounted) setSessionLoadError(extractApiError(err, ''));
      });
    return () => { mounted = false; };
  }, [reloadToken]);

  const openForm = (q = '') => {
    setInitialQuery(q || inputValue);
    setShowForm(true);
  };

  const handleStartResearch = async (formData) => {
    setStartError('');
    setCreating(true);
    try {
      const { data } = await api.post('/sessions', formData);
      navigate(`/research/${data.session._id}`);
    } catch (err) {
      setStartError(extractApiError(err, 'Failed to start research session.'));
      setCreating(false);
    }
  };

  return (
    <div
      className="min-h-screen hero-gradient"
      style={{ color: 'var(--text-primary)' }}
    >
      <AppTopNav />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-24">

        {/* ── HERO ── */}
        <motion.section
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="pt-20 pb-16 text-center flex flex-col items-center"
        >
          {/* Label */}
          <motion.div variants={fadeUp} className="mb-5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: 'rgba(59,130,246,0.1)',
                color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <Sparkles className="h-3 w-3" />
              AI-Powered Medical Research Intelligence
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 max-w-3xl leading-[1.12]"
            style={{ color: 'var(--text-primary)' }}
          >
            Research any condition.{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
            >
              Backed by evidence.
            </span>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={fadeUp}
            className="text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            500+ candidates retrieved from PubMed, OpenAlex & ClinicalTrials.gov —
            re-ranked by a local AI model. Every insight cites a real source.
          </motion.p>

          {/* Search bar */}
          <motion.div variants={fadeUp} className="w-full max-w-2xl mx-auto">
            <div
              className="flex items-center gap-2 rounded-2xl p-2"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-panel)',
              }}
            >
              <div className="flex-1 flex items-center gap-3 px-3">
                <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && inputValue.trim() && openForm()}
                  placeholder={QUICK_SEARCHES[placeholderIdx]}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <button
                type="button"
                onClick={() => openForm()}
                className="cl-btn-primary h-10 px-5 text-sm shrink-0"
                disabled={creating}
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="pipeline-dot" /> Preparing…
                  </span>
                ) : (
                  <>Start Research <ArrowRight className="h-3.5 w-3.5" /></>
                )}
              </button>
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {['Parkinson\'s', 'Lung Cancer', 'Diabetes', 'Alzheimer\'s', 'Heart Disease'].map((d) => (
                <button
                  key={d}
                  onClick={() => openForm(d)}
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </motion.div>

          {startError && (
            <motion.div variants={fadeUp} className="mt-4 w-full max-w-2xl">
              <ErrorBanner message={startError} />
            </motion.div>
          )}
        </motion.section>

        {/* ── STATS STRIP ── */}
        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-20"
        >
          {STATS.map((s) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              className="stat-card text-center"
            >
              <p className="text-2xl font-bold mb-1" style={{ color: '#60a5fa' }}>{s.value}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
            </motion.div>
          ))}
        </motion.section>

        {/* ── FEATURES ── */}
        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <motion.div variants={fadeUp} className="text-center mb-10">
            <h2
              className="text-2xl sm:text-3xl font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              What makes Curalink unique
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Not another chatbot — a research intelligence engine
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="feature-card">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}
                >
                  <f.icon className="h-4.5 w-4.5" style={{ color: f.color }} />
                </div>
                <h3
                  className="text-sm font-semibold mb-1.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── RECENT SESSIONS ── */}
        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-30px' }}
        >
          <motion.div variants={fadeUp} className="flex items-center justify-between mb-4">
            <div
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Clock3 className="h-4 w-4" />
              Recent Research Sessions
            </div>
            {recentSessions.length > 0 && (
              <button
                type="button"
                onClick={() => setReloadToken((t) => t + 1)}
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                Refresh
              </button>
            )}
          </motion.div>

          {sessionLoadError ? (
            <motion.div variants={fadeUp}>
              <ErrorBanner message={sessionLoadError} onRetry={() => setReloadToken((t) => t + 1)} />
            </motion.div>
          ) : recentSessions.length === 0 ? (
            <motion.div
              variants={fadeUp}
              className="flex flex-col items-center justify-center py-10 rounded-xl"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Microscope className="h-7 w-7 mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Start your first research session above
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentSessions.slice(0, 6).map((session, i) => (
                <motion.button
                  key={session._id}
                  variants={fadeUp}
                  onClick={() => navigate(`/research/${session._id}`)}
                  className="group text-left rounded-xl p-4 transition-all"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: `hsl(${(i * 47 + 200) % 360}, 60%, 20%)`,
                        border: `1px solid hsl(${(i * 47 + 200) % 360}, 60%, 35%)`,
                      }}
                    >
                      <Dna className="h-3.5 w-3.5" style={{ color: `hsl(${(i * 47 + 200) % 360}, 80%, 70%)` }} />
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  </div>
                  <h3
                    className="font-semibold text-sm line-clamp-1 mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {session.title || session.disease}
                  </h3>
                  <div
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Activity className="h-3 w-3" />
                    <span className="truncate">{session.intent || 'General Research'}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </motion.section>

      </main>

      {/* ── CONTEXT FORM MODAL ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="form-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
          >
            <motion.div
              key="form-modal"
              initial={{ opacity: 0, scale: 0.93, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="w-full max-w-xl"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '1.25rem',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              }}
            >
              <ContextForm
                initialData={{ disease: initialQuery }}
                onSubmit={handleStartResearch}
                onClose={() => { setShowForm(false); setCreating(false); }}
                loading={creating}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
