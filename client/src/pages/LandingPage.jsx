import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ContextForm from '@/components/ContextForm.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import Button from '@/components/ui/Button.jsx';
import Card from '@/components/ui/Card.jsx';
import MagicBackdrop from '@/components/ui/MagicBackdrop.jsx';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import { api, extractApiError } from '@/utils/api.js';

export default function LandingPage() {
  const [showForm, setShowForm] = useState(false);
  const [recentSessions, setRecentSessions] = useState([]);
  const [sessionLoadError, setSessionLoadError] = useState('');
  const [startError, setStartError] = useState('');
  const [reloadSessionsToken, setReloadSessionsToken] = useState(0);
  const navigate = useNavigate();

  const reloadSessions = () => {
    setReloadSessionsToken((previous) => previous + 1);
  };

  useEffect(() => {
    let isMounted = true;

    setSessionLoadError('');

    api
      .get('/sessions')
      .then(({ data }) => {
        if (isMounted) {
          setRecentSessions(data.sessions || []);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setSessionLoadError(extractApiError(error, 'Unable to load recent sessions.'));
          setRecentSessions([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [reloadSessionsToken]);

  const handleStartResearch = async (formData) => {
    setStartError('');

    try {
      const { data } = await api.post('/sessions', formData);
      navigate(`/research/${data.session._id}`);
    } catch (error) {
      const message = extractApiError(error, 'Failed to start research session.');
      setStartError(message);
      throw error;
    }
  };

  return (
    <div className="app-shell relative min-h-screen bg-transparent px-6 py-10 text-slate-100">
      <MagicBackdrop />

      <div className="relative mx-auto max-w-6xl">
        <AppTopNav className="mb-6" />

        <motion.header
          className="surface-panel rounded-3xl px-8 py-12 backdrop-blur"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div className="mb-5">
            <div className="brand-badge inline-flex rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
              AI Medical Research Assistant
            </div>
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            Curalink turns scattered medical studies into traceable evidence answers.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
            Multi-source retrieval from PubMed, OpenAlex and ClinicalTrials.gov with source-linked responses and placeholder hooks for advanced ranking.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setStartError('');
                setShowForm(true);
              }}
              size="lg"
              variant="primary"
              className="px-6"
            >
              Start Research
            </Button>
            <Button
              onClick={() => navigate('/analytics')}
              size="lg"
              variant="secondary"
              className="px-6"
            >
              View Analytics
            </Button>
            <Button
              onClick={() => navigate('/platform')}
              size="lg"
              variant="ghost"
              className="px-6"
            >
              Explore Platform
            </Button>
            <Button
              onClick={() => navigate('/status')}
              size="lg"
              variant="ghost"
              className="px-6"
            >
              Live Status
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard index={0} label="Sources" value="3 APIs" />
            <StatCard index={1} label="Candidate depth" value="300-500" />
            <StatCard index={2} label="Default model" value="Llama 3.1 8B" />
          </div>

          {startError ? <div className="mt-6"><ErrorBanner message={startError} /></div> : null}
        </motion.header>

        <motion.section
          className="surface-soft mt-8 rounded-2xl p-6"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Sessions</h2>
            <span className="text-xs text-slate-400">Latest 10</span>
          </div>

          {sessionLoadError ? <div className="mb-4"><ErrorBanner message={sessionLoadError} onRetry={reloadSessions} /></div> : null}

          {recentSessions.length === 0 ? (
            <p className="text-sm text-slate-400">No sessions yet. Start your first research session.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {recentSessions.map((session) => (
                <button
                  key={session._id}
                  onClick={() => navigate(`/research/${session._id}`)}
                  className="surface-soft rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-600"
                >
                  <p className="font-medium text-slate-100">{session.title || session.disease}</p>
                  <p className="mt-1 text-sm text-slate-400">{session.location?.city || 'Unknown city'}, {session.location?.country || 'Unknown country'}</p>
                  <p className="mt-2 text-xs text-slate-500">Messages: {session.messageCount || 0}</p>
                </button>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {showForm ? <ContextForm onSubmit={handleStartResearch} onClose={() => setShowForm(false)} /> : null}
    </div>
  );
}

function StatCard({ label, value, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12 + index * 0.06, ease: 'easeOut' }}
    >
      <Card tone="soft" padding="sm" className="rounded-xl">
        <p className="text-xl font-bold text-blue-300">{value}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</p>
      </Card>
    </motion.div>
  );
}
