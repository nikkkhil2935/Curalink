import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowLeft, Clock, Database, Search } from 'lucide-react';
import LoadingOverlay from '@/components/ui/LoadingOverlay.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import { api, extractApiError } from '@/utils/api.js';

const COLORS = ['var(--color-blue-500)', 'var(--color-cyan-500)', 'var(--color-green-400)', 'var(--color-amber-500)', 'var(--color-red-500)', 'var(--color-violet-700)'];

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
    trialStatus: [],
    snapshots: []
  });

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    const [overviewResult, diseasesResult, intentsResult, sourcesResult, trialStatusResult, snapshotsResult] = await Promise.allSettled([
      api.get('/analytics/overview').then((response) => response.data),
      api.get('/analytics/top-diseases').then((response) => response.data),
      api.get('/analytics/intent-breakdown').then((response) => response.data),
      api.get('/analytics/source-stats').then((response) => response.data),
      api.get('/analytics/trial-status').then((response) => response.data),
      api.get('/analytics/snapshots?limit=24').then((response) => response.data)
    ]);

    const failedResults = [overviewResult, diseasesResult, intentsResult, sourcesResult, trialStatusResult, snapshotsResult].filter(
      (result) => result.status === 'rejected'
    );

    if (failedResults.length === 6) {
      setError(extractApiError(failedResults[0].reason, 'Failed to load analytics dashboard.'));
    } else if (failedResults.length > 0) {
      setError('Some analytics sections are temporarily unavailable. Showing partial data.');
    }

    const overviewResponse = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
    const diseasesResponse = diseasesResult.status === 'fulfilled' ? diseasesResult.value : {};
    const intentsResponse = intentsResult.status === 'fulfilled' ? intentsResult.value : {};
    const sourcesResponse = sourcesResult.status === 'fulfilled' ? sourcesResult.value : {};
    const trialStatusResponse = trialStatusResult.status === 'fulfilled' ? trialStatusResult.value : {};
    const snapshotsResponse = snapshotsResult.status === 'fulfilled' ? snapshotsResult.value : {};

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
      trialStatus: trialStatusResponse.statuses || [],
      snapshots: snapshotsResponse.snapshots || []
    });
    setLoading(false);
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

  const snapshotData = useMemo(
    () =>
      (data.snapshots || []).map((snapshot) => ({
        ...snapshot,
        label: new Date(snapshot.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })),
    [data.snapshots]
  );

  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center bg-transparent px-6 text-slate-100">
        <div className="w-full max-w-xl">
          <LoadingOverlay message="Loading analytics..." steps={['Loading overview metrics', 'Compiling disease trends', 'Building source and trial charts']} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-transparent px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <AppTopNav />

        <header className="surface-panel app-enter flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-secondary rounded-lg p-2"
              aria-label="Back to home"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-black md:text-3xl">Analytics Dashboard</h1>
              <p className="text-sm text-slate-400">Curalink retrieval and evidence intelligence overview</p>
            </div>
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

        <section className="surface-panel rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">System Growth Snapshots</h2>
            <span className="text-xs text-slate-500">Hourly scheduler</span>
          </div>

          {snapshotData.length < 2 ? (
            <EmptyState text="Snapshot history will appear after scheduled analytics runs." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={snapshotData}>
                <XAxis dataKey="label" tick={{ fill: 'var(--color-slate-500)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--color-slate-500)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-slate-900)',
                    border: '1px solid var(--color-slate-700)',
                    borderRadius: 8,
                    color: 'var(--color-slate-200)'
                  }}
                />
                <Line type="monotone" dataKey="totalSessions" stroke="var(--color-blue-500)" strokeWidth={2} dot={false} name="Sessions" />
                <Line type="monotone" dataKey="totalQueries" stroke="var(--color-cyan-500)" strokeWidth={2} dot={false} name="Queries" />
                <Line type="monotone" dataKey="totalSources" stroke="var(--color-green-400)" strokeWidth={2} dot={false} name="Sources" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="surface-panel rounded-2xl p-5">
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
                    tick={{ fill: 'var(--color-slate-500)', fontSize: 11 }}
                    width={140}
                    tickFormatter={(value) =>
                      String(value).length > 18 ? `${String(value).slice(0, 18)}...` : value
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-slate-900)',
                      border: '1px solid var(--color-slate-700)',
                      borderRadius: 8,
                      color: 'var(--color-slate-200)'
                    }}
                  />
                  <Bar dataKey="count" fill="var(--color-blue-500)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="surface-panel rounded-2xl p-5">
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
                      contentStyle={{
                        background: 'var(--color-slate-900)',
                        border: '1px solid var(--color-slate-700)',
                        borderRadius: 8,
                        color: 'var(--color-slate-200)'
                      }}
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

          <div className="surface-panel rounded-2xl p-5">
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

          <div className="surface-panel rounded-2xl p-5">
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
          <section className="surface-panel rounded-2xl p-5">
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
