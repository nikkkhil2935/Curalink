import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Database, Layers, ArrowRight, Clock, Clock3, Activity } from 'lucide-react';
import ContextForm from '@/components/ContextForm.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import Button from '@/components/ui/Button.jsx';
import MagicBackdrop from '@/components/ui/MagicBackdrop.jsx';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import { api, extractApiError } from '@/utils/api.js';
import { cn } from '@/lib/utils.js';

export default function LandingPage() {
  const [showForm, setShowForm] = useState(false);
  const [recentSessions, setRecentSessions] = useState([]);
  const [sessionLoadError, setSessionLoadError] = useState('');
  const [startError, setStartError] = useState('');
  const [reloadSessionsToken, setReloadSessionsToken] = useState(0);
  const navigate = useNavigate();

  const reloadSessions = () => setReloadSessionsToken((prev) => prev + 1);

  useEffect(() => {
    let isMounted = true;
    setSessionLoadError('');
    api.get('/sessions')
      .then(({ data }) => {
        if (isMounted) setRecentSessions(data.sessions || []);
      })
      .catch((error) => {
        if (isMounted) {
          setSessionLoadError(extractApiError(error, 'Unable to load recent sessions.'));
          setRecentSessions([]);
        }
      });
    return () => { isMounted = false; };
  }, [reloadSessionsToken]);

  const handleStartResearch = async (formData) => {
    setStartError('');
    try {
      const { data } = await api.post('/sessions', formData);
      navigate(`/research/${data.session._id}`);
    } catch (error) {
      const message = extractApiError(error, 'Failed to start research session.');
      setStartError(message);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  };

  return (
    <div className="app-shell relative min-h-screen bg-[#070a12] text-[#f3f7ff]">
      <MagicBackdrop />
      <AppTopNav className="bg-[#101726]/80" />

      <main className="relative mx-auto flex max-w-7xl flex-col px-4 pt-16 pb-24 sm:px-6 lg:px-8">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16"
        >
          {/* Left Column: Hero */}
          <div className="flex flex-col justify-center pt-8">
            <motion.div variants={itemVariants} className="mb-6 inline-flex border border-blue-900/50 bg-blue-900/20 px-3 py-1 rounded-full items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-400 w-max">
              <Activity className="h-4 w-4" />
              AI Medical Intelligence
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl text-balance leading-[1.1]">
              Traceable evidence for clinical curations.
            </motion.h1>
            
            <motion.p variants={itemVariants} className="mt-6 text-lg leading-relaxed text-[#8ea1c2] max-w-2xl">
              Curalink turns scattered medical studies into highly structured, actionable intelligence. Multi-source retrieval from PubMed, OpenAlex and ClinicalTrials.gov directly mapped to source citations.
            </motion.p>
            
            <motion.div variants={itemVariants} className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button
                onClick={() => { setStartError(''); setShowForm(true); }}
                size="lg"
                variant="primary"
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base px-8 h-14 rounded-xl flex items-center justify-center gap-2 border-none shadow-[0_0_20px_rgba(37,99,235,0.2)]"
              >
                Start Research
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                onClick={() => navigate('/platform')}
                size="lg"
                variant="secondary"
                className="bg-[#131d2d] text-[#c6d3eb] border-[#24324a] hover:bg-[#1a263a] hover:text-white px-8 h-14 rounded-xl flex items-center justify-center font-medium"
              >
                Platform Specs
              </Button>
            </motion.div>
            
            {startError && (
              <motion.div variants={itemVariants} className="mt-6">
                <ErrorBanner message={startError} />
              </motion.div>
            )}
          </div>

          {/* Right Column: Key Stats / Features & Recent Sessions */}
          <div className="flex flex-col gap-6 lg:pt-16">
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
              <div className="flex flex-col border border-[#24324a] bg-[#101726]/60 backdrop-blur rounded-2xl p-5 shadow-sm">
                <Database className="h-6 w-6 text-blue-400 mb-4 opacity-80" />
                <span className="text-2xl font-bold text-white mb-1">3 APIs</span>
                <span className="text-xs uppercase tracking-wider text-[#8ea1c2] mt-auto">Source Diversity</span>
              </div>
              <div className="flex flex-col border border-[#24324a] bg-[#101726]/60 backdrop-blur rounded-2xl p-5 shadow-sm">
                <Layers className="h-6 w-6 text-blue-400 mb-4 opacity-80" />
                <span className="text-2xl font-bold text-white mb-1">500+</span>
                <span className="text-xs uppercase tracking-wider text-[#8ea1c2] mt-auto">Candidates Scored</span>
              </div>
            </motion.div>

            <motion.section variants={itemVariants} className="border border-[#24324a] bg-[#0a0f1e]/80 backdrop-blur rounded-2xl p-6 mt-2 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#24324a]">
                <div className="flex items-center gap-2 text-white font-semibold flex-1">
                  <Clock3 className="h-5 w-5 text-[#8ea1c2]" />
                  <h2>Recent Queries</h2>
                </div>
                <span className="text-xs font-medium text-[#8ea1c2] bg-[#131d2d] px-2 py-1 rounded-md">
                  History
                </span>
              </div>

              {sessionLoadError ? (
                <div className="mb-4"><ErrorBanner message={sessionLoadError} onRetry={reloadSessions} /></div>
              ) : null}

              {recentSessions.length === 0 && !sessionLoadError ? (
                <div className="flex flex-col items-center justify-center text-center p-8 m-auto text-[#8ea1c2] border border-dashed border-[#24324a] rounded-xl bg-[#101726]/50">
                  <Search className="h-8 w-8 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No sessions found.</p>
                  <p className="text-xs mt-1 text-[#8ea1c2]/70">Initiate your first query to build history.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 overflow-y-auto pr-2 scrollbar-thin max-h-[350px]">
                  {recentSessions.map((session) => (
                    <button
                      key={session._id}
                      onClick={() => navigate(`/research/${session._id}`)}
                      className="group flex flex-col border border-[#1a263a] bg-[#131d2d]/80 rounded-xl p-4 text-left transition-all hover:bg-[#1a263a] hover:border-blue-500/40"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                          {session.title || session.disease}
                        </h3>
                        <span className="text-xs text-[#8ea1c2] whitespace-nowrap bg-[#070a12] px-2 py-0.5 rounded">
                          {session.messageCount || 0} msg
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#8ea1c2]">
                        <span className="truncate max-w-[180px]">
                          {session.location?.city || 'Unknown'}, {session.location?.country || 'Unknown'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-[#24324a]"></span>
                        <span className="text-blue-400">
                          {session.intent || 'General Inquiry'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.section>
          </div>
        </motion.div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070a12]/80 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl mx-auto border border-[#24324a] bg-[#101726] rounded-2xl shadow-2xl relative overflow-hidden"
          >
            <ContextForm onSubmit={handleStartResearch} onClose={() => setShowForm(false)} />
          </motion.div>
        </div>
      )}
    </div>
  );
}
