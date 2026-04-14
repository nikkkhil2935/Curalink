import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ContextForm from '@/components/ContextForm.jsx';

export default function LandingPage() {
  const [showForm, setShowForm] = useState(false);
  const [recentSessions, setRecentSessions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    axios
      .get('/api/sessions')
      .then(({ data }) => {
        if (isMounted) {
          setRecentSessions(data.sessions || []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setRecentSessions([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartResearch = async (formData) => {
    try {
      const { data } = await axios.post('/api/sessions', formData);
      navigate(`/research/${data.session._id}`);
    } catch (error) {
      console.error('Failed to create session', error);
    }
  };

  return (
    <div className="min-h-screen bg-transparent px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl border border-slate-800 bg-slate-950/70 px-8 py-12 shadow-2xl backdrop-blur">
          <div className="mb-5 inline-flex rounded-full border border-blue-400/40 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">
            AI Medical Research Assistant
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            Curalink turns scattered medical studies into traceable evidence answers.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
            Multi-source retrieval from PubMed, OpenAlex and ClinicalTrials.gov with source-linked responses and placeholder hooks for advanced ranking.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Start Research
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="rounded-xl border border-slate-700 px-6 py-3 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              View Analytics
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Sources" value="3 APIs" />
            <StatCard label="Candidate depth" value="300-500" />
            <StatCard label="Default model" value="Llama 3.1 8B" />
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Sessions</h2>
            <span className="text-xs text-slate-400">Latest 10</span>
          </div>

          {recentSessions.length === 0 ? (
            <p className="text-sm text-slate-400">No sessions yet. Start your first research session.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {recentSessions.map((session) => (
                <button
                  key={session._id}
                  onClick={() => navigate(`/research/${session._id}`)}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-slate-600"
                >
                  <p className="font-medium text-slate-100">{session.title || session.disease}</p>
                  <p className="mt-1 text-sm text-slate-400">{session.location?.city || 'Unknown city'}, {session.location?.country || 'Unknown country'}</p>
                  <p className="mt-2 text-xs text-slate-500">Messages: {session.messageCount || 0}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {showForm ? <ContextForm onSubmit={handleStartResearch} onClose={() => setShowForm(false)} /> : null}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-4">
      <p className="text-xl font-bold text-blue-300">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
