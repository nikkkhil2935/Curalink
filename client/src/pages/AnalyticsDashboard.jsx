import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const pieColors = ['#2563eb', '#0ea5e9', '#16a34a', '#ca8a04', '#dc2626'];

export default function AnalyticsDashboard() {
  const [topDiseases, setTopDiseases] = useState([]);
  const [sourceStats, setSourceStats] = useState([]);
  const [totalSources, setTotalSources] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [{ data: diseaseData }, { data: sourceData }] = await Promise.all([
          axios.get('/api/analytics/top-diseases'),
          axios.get('/api/analytics/source-stats')
        ]);

        if (!isMounted) {
          return;
        }

        setTopDiseases(diseaseData.topDiseases || []);
        setSourceStats(sourceData.distribution || []);
        setTotalSources(sourceData.total || 0);
      } catch (error) {
        if (isMounted) {
          setTopDiseases([]);
          setSourceStats([]);
          setTotalSources(0);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const diseaseChartData = useMemo(
    () => topDiseases.map((item) => ({ disease: item.disease, count: item.count })),
    [topDiseases]
  );

  return (
    <div className="min-h-screen bg-transparent px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">Query Analytics Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">Placeholder analytics based on currently captured Day 1 events and cached sources.</p>
          </div>
          <Link
            to="/"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Back to home
          </Link>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard label="Tracked diseases" value={String(topDiseases.length)} />
          <MetricCard label="Cached sources" value={String(totalSources)} />
          <MetricCard label="Source types" value={String(sourceStats.length)} />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <h2 className="mb-3 text-lg font-semibold">Top searched diseases</h2>
            {diseaseChartData.length === 0 ? (
              <EmptyState text="No query events yet." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diseaseChartData}>
                    <XAxis dataKey="disease" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <h2 className="mb-3 text-lg font-semibold">Source distribution</h2>
            {sourceStats.length === 0 ? (
              <EmptyState text="No source documents cached yet." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceStats}
                      dataKey="count"
                      nameKey="source"
                      outerRadius={100}
                      label={(item) => `${item.source}: ${item.count}`}
                    >
                      {sourceStats.map((entry, index) => (
                        <Cell key={entry.source} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-blue-300">{value}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="mt-10 text-center text-sm text-slate-400">{text}</p>;
}
