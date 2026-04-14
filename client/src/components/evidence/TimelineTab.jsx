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

  return (
    <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
