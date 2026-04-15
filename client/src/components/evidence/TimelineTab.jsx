import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function TimelineTab({ sources }) {
  const chartData = useMemo(() => {
    const countsByYear = new Map();

    sources.forEach((source) => {
      if (!source.year) {
        return;
      }

      countsByYear.set(source.year, (countsByYear.get(source.year) || 0) + 1);
    });

    return Array.from(countsByYear.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);
  }, [sources]);

  if (!chartData.length) {
    return <p className="text-sm text-slate-400">Timeline will render once publication years are available.</p>;
  }

  const currentYear = new Date().getFullYear();
  const recentYears = chartData.filter((entry) => entry.year >= currentYear - 3);
  const olderYears = chartData.filter((entry) => entry.year < currentYear - 3 && entry.year >= currentYear - 6);
  const recentAverage = recentYears.reduce((sum, entry) => sum + entry.count, 0) / Math.max(recentYears.length, 1);
  const olderAverage = olderYears.reduce((sum, entry) => sum + entry.count, 0) / Math.max(olderYears.length, 1);
  const momentum = recentAverage > olderAverage * 1.2 ? 'Accelerating' : recentAverage > olderAverage * 0.8 ? 'Stable' : 'Cooling';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-100">Publication Timeline</h3>
        <span className="text-xs text-slate-500">Momentum: {momentum}</span>
      </div>

      <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(value) => [`${value} papers`, 'Publications']}
            />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total papers', value: sources.length },
          {
            label: 'Peak year',
            value: chartData.reduce((best, entry) => (entry.count > (best?.count || 0) ? entry : best), null)?.year || 'N/A'
          },
          { label: 'Since 2020', value: sources.filter((source) => (source.year || 0) >= 2020).length }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center">
            <p className="text-lg font-semibold text-blue-400">{item.value}</p>
            <p className="text-[11px] text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
