import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowLeft, Clock, Database, Search } from 'lucide-react';
import LoadingOverlay from '@/components/ui/LoadingOverlay.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import { api, extractApiError } from '@/utils/api.js';

const COLORS = ['#2563eb', '#0ea5e9', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed'];

function StatCard({ icon: Icon, label, value, subtitle, tone = 'blue' }) {
  const toneMap = {
    blue: 'border-blue-800 bg-blue-950/50 text-blue-300',
    green: 'border-green-800 bg-green-950/50 text-green-300',
    cyan: 'border-cyan-800 bg-cyan-950/50 text-cyan-300',
    amber: 'border-amber-800 bg-amber-950/50 text-amber-300'
  };

  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone] || toneMap.blue}`}>
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <p className="text-2xl font-black">{value}</p>
      {subtitle ? <p className="mt-1 text-xs opacity-70">{subtitle}</p> : null}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    overview: null,
    diseases: [],
    intents: [],
    sources: [],
    trialStatus: []
  });

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const [overviewResponse, diseasesResponse, intentsResponse, sourcesResponse, trialStatusResponse] = await Promise.all([
        api.get('/analytics/overview').then((response) => response.data),
        api.get('/analytics/top-diseases').then((response) => response.data),
        api.get('/analytics/intent-breakdown').then((response) => response.data),
        api.get('/analytics/source-stats').then((response) => response.data),
        api.get('/analytics/trial-status').then((response) => response.data)
      ]);

      const diseases = diseasesResponse.diseases ||
        (diseasesResponse.topDiseases || []).map((entry) => ({
          name: entry.disease,
          count: entry.count
        }));

      const sources = sourcesResponse.sources ||
        (sourcesResponse.distribution || []).map((entry) => ({
          name: entry.source,
          count: entry.count,
          used: Math.round(entry.count)
        }));

      setData({
        overview: overviewResponse || null,
        diseases,
        intents: intentsResponse.intents || [],
        sources,
        trialStatus: trialStatusResponse.statuses || []
      });
    } catch (requestError) {
      setError(extractApiError(requestError, 'Failed to load analytics dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const overview = useMemo(
    () =>
      data.overview || {
        totalSessions: 0,
        totalQueries: 0,
        totalSources: 0,
        avgCandidatesRetrieved: 0,
        avgShownToUser: 0,
        avgResponseTimeSec: '0.0',
        recentQueries: []
      },
    [data.overview]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent px-6 text-slate-100">
        <div className="w-full max-w-xl">
          <LoadingOverlay message="Loading analytics..." steps={['Loading overview metrics', 'Compiling disease trends', 'Building source and trial charts']} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-white"
            aria-label="Back to home"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black md:text-3xl">Analytics Dashboard</h1>
            <p className="text-sm text-slate-400">Curalink retrieval and evidence intelligence overview</p>
          </div>
        </header>

        {error ? <ErrorBanner message={error} onRetry={loadDashboard} /> : null}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={Search} label="Total Sessions" value={overview.totalSessions.toLocaleString()} tone="blue" />
          <StatCard icon={Activity} label="Queries Run" value={overview.totalQueries.toLocaleString()} tone="cyan" />
          <StatCard
            icon={Database}
            label="Avg Candidates"
            value={overview.avgCandidatesRetrieved.toLocaleString()}
            subtitle={`-> ${overview.avgShownToUser.toLocaleString()} shown`}
            tone="green"
          />
          <StatCard icon={Clock} label="Avg Response" value={`${overview.avgResponseTimeSec}s`} tone="amber" />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Top Searched Diseases</h2>
            {data.diseases.length === 0 ? (
              <EmptyState text="No disease analytics yet. Run a few queries to populate this chart." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.diseases} layout="vertical" margin={{ left: 72, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    width={140}
                    tickFormatter={(value) =>
                      String(value).length > 18 ? `${String(value).slice(0, 18)}...` : value
                    }
                  />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                  />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Research Source Distribution</h2>
            {data.sources.length === 0 ? (
              <EmptyState text="No source documents are cached yet." />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.sources} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={84}>
                      {data.sources.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-2">
                  {data.sources.map((source, index) => {
                    const total = data.sources.reduce((sum, item) => sum + item.count, 0);
                    const percentage = total ? Math.round((source.count / total) * 100) : 0;

                    return (
                      <div key={source.name} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-slate-300">{source.name}</span>
                        <span className="ml-auto text-slate-500">{source.count.toLocaleString()} ({percentage}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Query Intent Types</h2>
            {data.intents.length === 0 ? (
              <EmptyState text="No intent classification data available yet." />
            ) : (
              <div className="space-y-3">
                {data.intents.slice(0, 6).map((intent, index) => {
                  const baseline = data.intents[0]?.count || 1;
                  const width = Math.max(6, Math.round((intent.count / baseline) * 100));
                  return (
                    <div key={intent.name}>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                        <span>{intent.name}</span>
                        <span className="text-slate-500">{intent.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${width}%`, background: COLORS[index % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Clinical Trial Status Mix</h2>
            {data.trialStatus.length === 0 ? (
              <EmptyState text="No trial data available yet." />
            ) : (
              <div className="space-y-2">
                {data.trialStatus.slice(0, 8).map((status) => (
                  <div key={status.name} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="flex-1 text-slate-300">{String(status.name || 'Unknown').replace(/_/g, ' ')}</span>
                    <span className="font-mono text-slate-500">{status.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {overview.recentQueries?.length ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Recent Queries</h2>
            <div className="space-y-2">
              {overview.recentQueries.map((query, index) => (
                <div key={`${query.disease}-${index}`} className="flex flex-wrap items-center gap-3 border-b border-slate-800 py-2 text-sm last:border-b-0">
                  <span className="font-medium text-slate-100">{query.disease}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{query.intentType}</span>
                  <span className="text-xs text-slate-500">{query.candidates || 0} candidates</span>
                  <span className="ml-auto text-xs text-slate-600">{new Date(query.time).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="py-8 text-center text-sm text-slate-500">{text}</p>;
}
