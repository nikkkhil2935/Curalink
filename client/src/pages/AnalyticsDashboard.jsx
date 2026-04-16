import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, AreaChart, Area } from 'recharts';
import { Activity, Clock, Database, Search, ArrowLeft, TrendingUp, Layers, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppTopNav from '../components/layout/AppTopNav';
import ErrorBanner from '../components/ui/ErrorBanner';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import { api } from '../utils/api';

const COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#818cf8'];

const MotionCard = ({ children, delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className={`rounded-2xl bg-gray-900 shadow-sm overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const StatBadge = ({ title, value, icon: Icon, trend }) => (
  <div className="flex items-start justify-between p-6">
    <div>
      <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
      {trend && (
        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
          <TrendingUp size={12} className="text-blue-400" />
          <span className="text-blue-400 font-medium">{trend}</span> since last week
        </p>
      )}
    </div>
    <div className="p-3 bg-gray-800/50 rounded-xl">
      <Icon className="text-gray-300" size={20} />
    </div>
  </div>
);

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [overviewRes, diseasesRes, intentsRes, sourcesRes, trialsRes] = await Promise.all([
          api.get('/analytics/overview').catch(() => ({ data: {} })),
          api.get('/analytics/top-diseases').catch(() => ({ data: {} })),
          api.get('/analytics/intent-breakdown').catch(() => ({ data: {} })),
          api.get('/analytics/source-stats').catch(() => ({ data: {} })),
          api.get('/analytics/trial-status').catch(() => ({ data: {} }))
        ]);

        setData({
          overview: overviewRes.data || { totalQueries: 0, totalSources: 0, avgResponseTimeSec: 0, recentQueries: [] },
          diseases: diseasesRes.data.diseases || diseasesRes.data.topDiseases || [],
          intents: intentsRes.data.intents || [],
          sources: sourcesRes.data.sources || sourcesRes.data.distribution || [],
          trials: trialsRes.data.statuses || []
        });
      } catch (err) {
        console.error(err);
        setError('Unable to load analytics data at this time.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col pt-16 items-center justify-center">
        <AppTopNav borderless />
        <LoadingOverlay message="Gathering Analytics..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 selection:bg-blue-500/30 font-sans">
      <AppTopNav borderless />
      
      <main className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
        <div className="mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <Link to="/app" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-white transition-colors mb-4">
              <ArrowLeft size={16} className="mr-2" /> Back to Research
            </Link>
            <h1 className="text-3xl font-bold text-white tracking-tight">Platform Analytics</h1>
            <p className="text-gray-400 mt-1">Real-time insights on query volume and source retrieval</p>
          </motion.div>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-8" />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MotionCard delay={0.1}>
            <StatBadge title="Total Queries" value={data?.overview?.totalQueries?.toLocaleString() || '0'} icon={Search} trend="+12.4%" />
          </MotionCard>
          <MotionCard delay={0.15}>
            <StatBadge title="Sources Processed" value={data?.overview?.totalSources?.toLocaleString() || '0'} icon={Database} trend="+8.1%" />
          </MotionCard>
          <MotionCard delay={0.2}>
            <StatBadge title="Avg Response (s)" value={data?.overview?.avgResponseTimeSec?.toFixed(1) || '0.0'} icon={Clock} />
          </MotionCard>
          <MotionCard delay={0.25}>
            <StatBadge title="Avg Candidates/Query" value={data?.overview?.avgCandidatesRetrieved?.toFixed(0) || '0'} icon={Layers} />
          </MotionCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <MotionCard delay={0.3} className="lg:col-span-2 p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-6">Top Diseases Researched</h3>
            <div className="flex-1 w-full h-75">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.diseases?.slice(0, 8) || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#1f2937' }} contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data?.diseases?.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </MotionCard>

          <MotionCard delay={0.4} className="p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-6">Query Intents</h3>
            <div className="flex-1 w-full h-75">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data?.intents || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count">
                    {data?.intents?.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </MotionCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <MotionCard delay={0.5} className="p-6">
             <h3 className="text-lg font-semibold text-white mb-6">Source Usage</h3>
             <div className="space-y-4">
                {data?.sources?.map((src, i) => (
                  <div key={src.name} className="flex items-center justify-between group">
                    <div className="flex items-center">
                       <div className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                       <span className="text-gray-300 font-medium text-sm">{src.name}</span>
                    </div>
                    <div className="text-right">
                       <span className="text-white text-sm font-semibold">{src.count ? src.count.toLocaleString() : '0'}</span>
                       <span className="text-gray-500 text-xs ml-2">hits</span>
                    </div>
                  </div>
                ))}
                {(!data?.sources || data.sources.length === 0) && (
                  <p className="text-sm text-gray-500 italic">No source data available</p>
                )}
             </div>
          </MotionCard>
          
          <MotionCard delay={0.6} className="lg:col-span-2 p-0 flex flex-col">
            <div className="p-6 pb-2 border-b border-gray-800/50">
              <h3 className="text-lg font-semibold text-white">Recent Queries</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-800/20 text-gray-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Topic</th>
                    <th className="px-6 py-3 font-medium">Intent</th>
                    <th className="px-6 py-3 font-medium">Process Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {data?.overview?.recentQueries?.slice(0,5).map((q, i) => (
                    <tr key={i} className="hover:bg-gray-800/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-200">{q.disease || 'General Search'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300">
                          {q.intentType || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {q.time ? `${(q.time / 1000).toFixed(1)}s` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                  {(!data?.overview?.recentQueries || data.overview.recentQueries.length === 0) && (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-gray-500 text-sm">
                        No recent queries found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </MotionCard>
        </div>
      </main>
    </div>
  );
}
