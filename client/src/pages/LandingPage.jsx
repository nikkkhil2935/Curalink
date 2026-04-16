import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Clock3, Activity } from 'lucide-react';
import ContextForm from '@/components/ContextForm.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import MagicBackdrop from '@/components/ui/MagicBackdrop.jsx';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import { VercelV0Chat } from '@/components/ui/v0-ai-chat.jsx';
import { api, extractApiError } from '@/utils/api.js';

export default function LandingPage() {
  const [showForm, setShowForm] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');
  const [recentSessions, setRecentSessions] = useState([]);
  const [sessionLoadError, setSessionLoadError] = useState('');
  const [startError, setStartError] = useState('');
  const [reloadSessionsToken, setReloadSessionsToken] = useState(0);
  const [creating, setCreating] = useState(false);
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
    setCreating(true);
    try {
      const { data } = await api.post('/sessions', formData);
      navigate(`/research/${data.session._id}`);
    } catch (error) {
      const message = extractApiError(error, 'Failed to start research session.');
      setStartError(message);
      setCreating(false);
    }
  };

  const handleQuickSearch = (query) => {
    // Quickly formulate search object and bypass modal if desired,, or open modal with prefilled query
    setInitialQuery(query);
    setShowForm(true);
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
    <div className="app-shell relative min-h-screen bg-[#0E0E0E] text-[#f3f7ff]">
      <MagicBackdrop />
      <AppTopNav className="bg-[#0E0E0E]/80 border-b border-[#222222]" />

      <main className="relative mx-auto flex max-w-5xl flex-col items-center justify-center px-4 pt-20 pb-24 sm:px-6 lg:px-8 min-h-[calc(100vh-64px)]">
        
        {/* CENTER SEARCH */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full flex-1 flex flex-col justify-center -mt-16"
        >
          {startError && (
             <motion.div variants={itemVariants} className="mb-6 max-w-3xl mx-auto w-full">
               <ErrorBanner message={startError} />
             </motion.div>
          )}

          <motion.div variants={itemVariants} className="w-full z-10">
            <VercelV0Chat onSend={handleQuickSearch} loading={creating} />
          </motion.div>
        
          {/* RECENT SESSIONS STRIP */}
          <motion.div variants={itemVariants} className="w-full max-w-3xl mx-auto mt-16">
            <div className="flex items-center justify-between mb-4 border-b border-[#222222] pb-2">
               <div className="flex items-center gap-2 text-white/70 font-medium text-sm">
                 <Clock3 className="h-4 w-4" />
                 <h3>Recent Queries</h3>
               </div>
            </div>

            {sessionLoadError ? (
              <div className="my-2"><ErrorBanner message={sessionLoadError} onRetry={reloadSessions} /></div>
            ) : null}

            {recentSessions.length === 0 && !sessionLoadError ? (
              <div className="flex flex-col items-center justify-center p-6 text-[#555555]">
                <Search className="h-6 w-6 mb-2 opacity-50" />
                <p className="text-xs font-medium">No recent history.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentSessions.slice(0, 3).map((session) => (
                  <button
                    key={session._id}
                    onClick={() => navigate(`/research/${session._id}`)}
                    className="flex flex-col border border-[#333333] bg-[#1A1A1A] rounded-xl p-4 text-left transition-all hover:bg-[#222222] hover:border-[#555] group"
                  >
                    <h3 className="font-medium text-sm text-[#E0E0E0] group-hover:text-white transition-colors line-clamp-1 mb-1.5">
                      {session.title || session.disease}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[#777777]">
                      <Activity className="h-3 w-3" />
                      <span className="truncate">
                        {session.intent || 'General Inquiry'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>

        </motion.div>

      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070a12]/80 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl mx-auto border border-[#24324a] bg-[#101726] rounded-2xl shadow-2xl relative overflow-hidden"
          >
            {/* Pass the initial text from V0Chat to ContextForm */}
            <ContextForm 
               initialData={{ disease: initialQuery }} 
               onSubmit={handleStartResearch} 
               onClose={() => { setShowForm(false); setCreating(false); }} 
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
