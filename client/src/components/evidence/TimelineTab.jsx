import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';

export default function TimelineTab({ sources }) {
  const pubs = sources.filter(s => s.type === 'publication' && s.year >= 2010);
  
  if (pubs.length === 0) {
    return <div className="text-sm text-gray-500 text-center mt-10">Publication timeline will appear after your first query.</div>;
  }

  const counts = {};
  pubs.forEach(p => counts[p.year] = (counts[p.year] || 0) + 1);

  const data = Object.keys(counts).sort().map(y => ({
    year: parseInt(y),
    count: counts[y]
  }));

  const currentYear = new Date().getFullYear();
  const recentAvg = data.filter(d => d.year >= currentYear - 3).reduce((a, b) => a + b.count, 0) / 3 || 0;
  const olderAvg = data.filter(d => d.year >= currentYear - 6 && d.year < currentYear - 3).reduce((a, b) => a + b.count, 0) / 3 || 0;
  
  let momentum = "Stable 📊";
  if (olderAvg > 0) {
    const ratio = recentAvg / olderAvg;
    if (ratio > 1.2) momentum = "Accelerating 🚀";
    if (ratio < 0.8) momentum = "Declining 📉";
  } else if (recentAvg > 0) {
    momentum = "Accelerating 🚀";
  }

  const peakYearItem = [...data].sort((a,b)=>b.count-a.count)[0];
  const post2020 = data.filter(d => d.year >= 2020).reduce((a,b)=>a+b.count,0);
  const highestFinalScorePub = [...pubs].sort((a,b)=>(b.finalScore||0)-(a.finalScore||0))[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Papers (2010+)" value={pubs.length} />
        <StatCard label="Peak Year" value={peakYearItem?.year || 'N/A'} />
        <StatCard label="Since 2020" value={post2020} />
        <StatCard label="Momentum" value={momentum} />
      </div>

      <div className="h-48 w-full bg-gray-900 border border-gray-800 rounded-xl p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: '#1f2937' }} 
              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: 8, fontSize: 12 }} 
              formatter={(value) => [value + ' papers', 'Count']}
              labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => {
                let color = '#4b5563'; // gray
                if (entry.year >= currentYear - 2) color = '#4f46e5'; // indigo
                if (highestFinalScorePub && entry.year === highestFinalScorePub.year) color = '#2563eb'; // blue
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
      <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-white text-lg font-bold">{value}</div>
    </div>
  );
}