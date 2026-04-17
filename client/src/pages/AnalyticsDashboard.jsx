import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import {
  Activity, Clock, Database, Search, ArrowLeft, TrendingUp, Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AppTopNav from '../components/layout/AppTopNav';
import ErrorBanner from '../components/ui/ErrorBanner';
import { api } from '../utils/api';

const COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#818cf8'];

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
};

function Card({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
    >
      {children}
    </motion.div>
  );
}

function StatCard({ title, value, icon: Icon, trend, delay }) {
  return (
    <Card delay={delay}>
      <div className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
            {title}
          </p>
          <h3 className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {value}
          </h3>
          {trend && (
            <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: '#34d399' }}>
              <TrendingUp className="h-3 w-3" />
              {trend}
            </p>
          )}
        </div>
        <div
          className="p-2.5 rounded-xl"
          style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}
        >
          <Icon className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-xl"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
    >
      <p className="font-semibold mb-0.5">{label}</p>
      <p style={{ color: COLORS[0] }}>{payload[0].value}</p>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
      {children}
    </h3>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const [overviewRes, diseasesRes, intentsRes, sourcesRes, trialsRes] = await Promise.all([
          api.get('/analytics/overview').catch(() => ({ data: {} })),
          api.get('/analytics/top-diseases').catch(() => ({ data: {} })),
          api.get('/analytics/intent-breakdown').catch(() => ({ data: {} })),
          api.get('/analytics/source-stats').catch(() => ({ data: {} })),
          api.get('/analytics/trial-status').catch(() => ({ data: {} })),
        ]);
        setData({
          overview: overviewRes.data || {},
          diseases: diseasesRes.data.diseases || diseasesRes.data.topDiseases || [],
          intents: intentsRes.data.intents || [],
          sources: sourcesRes.data.sources || sourcesRes.data.distribution || [],
          trials: trialsRes.data.statuses || [],
        });
      } catch (err) {
        setError('Unable to load analytics data.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-canvas)', color: 'var(--text-primary)' }}>
      <AppTopNav />

      <main className="max-w-6xl mx-auto px-5 py-20 lg:py-24">
        {/* Page header */}
        <motion.div {...fadeUp} className="mb-8">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 text-xs font-medium mb-4 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Research
          </Link>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Platform Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Real-time insights on query volume and source retrieval
          </p>
        </motion.div>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl h-24 animate-pulse"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard delay={0.05} title="Total Queries" value={(data?.overview?.totalQueries || 0).toLocaleString()} icon={Search} trend="+12.4%" />
              <StatCard delay={0.10} title="Sources Processed" value={(data?.overview?.totalSources || 0).toLocaleString()} icon={Database} trend="+8.1%" />
              <StatCard delay={0.15} title="Avg Response (s)" value={(data?.overview?.avgResponseTimeSec || 0).toFixed(1)} icon={Clock} />
              <StatCard delay={0.20} title="Avg Candidates" value={(data?.overview?.avgCandidatesRetrieved || 0).toFixed(0)} icon={Layers} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* Bar chart */}
              <Card delay={0.25} className="lg:col-span-2 p-5">
                <SectionTitle>Top Diseases Researched</SectionTitle>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.diseases?.slice(0, 8) || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        dy={6}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(96,165,250,0.06)' }} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {data?.diseases?.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Donut chart */}
              <Card delay={0.30} className="p-5">
                <SectionTitle>Query Intents</SectionTitle>
                <div style={{ height: 200 }}>
                  {data?.intents?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.intents}
                          cx="50%"
                          cy="45%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={4}
                          dataKey="count"
                        >
                          {data.intents.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend
                          iconType="circle"
                          iconSize={7}
                          wrapperStyle={{ fontSize: 10, color: 'var(--text-muted)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--color-surface-2)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8,
                            fontSize: 12,
                            color: 'var(--text-primary)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-center mt-10" style={{ color: 'var(--text-muted)' }}>No intent data</p>
                  )}
                </div>
              </Card>
            </div>

            {/* Sources + Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Source bars */}
              <Card delay={0.35} className="p-5">
                <SectionTitle>Source Usage</SectionTitle>
                <div className="space-y-3">
                  {data?.sources?.length > 0 ? data.sources.map((src, i) => {
                    const max = Math.max(...data.sources.map((s) => s.count || 0));
                    const pct = max > 0 ? Math.round(((src.count || 0) / max) * 100) : 0;
                    return (
                      <div key={src.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {src.name}
                          </span>
                          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            {(src.count || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'var(--color-surface-3)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No source data available</p>
                  )}
                </div>
              </Card>

              {/* Recent queries table */}
              <Card delay={0.40} className="lg:col-span-2">
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Recent Queries
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead style={{ background: 'var(--color-surface-3)' }}>
                      <tr>
                        {['Topic', 'Intent', 'Time'].map((h) => (
                          <th key={h} className="px-5 py-2.5 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data?.overview?.recentQueries?.slice(0, 5).map((q, i) => (
                        <tr
                          key={i}
                          className="border-t transition-colors"
                          style={{ borderColor: 'var(--color-border)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-3)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                            {q.disease || 'General'}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
                            >
                              {q.intentType || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                            {q.time ? `${(q.time / 1000).toFixed(1)}s` : '—'}
                          </td>
                        </tr>
                      ))}
                      {(!data?.overview?.recentQueries?.length) && (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                            No recent queries
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
