<<<<<<< HEAD
import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';

function StatCard({ label, value, sub }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        color: 'var(--text-primary)',
      }}
    >
      <p className="font-semibold mb-0.5">{label}</p>
      <p style={{ color: '#60a5fa' }}>{payload[0].value} papers</p>
=======
import React, { useMemo } from 'react';
import { Clock3, RefreshCcw } from 'lucide-react';

function normalizeMessageId(message) {
  return String(message?._id || message?.id || '');
}

function buildTimeline(messages = []) {
  const ordered = (Array.isArray(messages) ? messages : [])
    .slice()
    .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
  const timeline = [];
  let pendingUser = null;

  ordered.forEach((message) => {
    if (message?.role === 'user') {
      pendingUser = message;
      return;
    }

    if (message?.role === 'assistant') {
      timeline.push({
        assistant: message,
        user: pendingUser,
        timestamp: message?.createdAt || pendingUser?.createdAt || null
      });
      pendingUser = null;
    }
  });

  return timeline.sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());
}

export default function TimelineTab({
  messages,
  selectedAssistantMessageId,
  loadingMessageId,
  onSelectMessage
}) {
  const timeline = useMemo(() => buildTimeline(messages), [messages]);

  if (!timeline.length) {
    return (
      <div className="rounded-xl border token-border token-surface p-6 text-center">
        <p className="text-sm token-text">No timeline entries yet.</p>
        <p className="mt-1 text-xs token-text-subtle">Ask your first clinical question to populate the session timeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {timeline.map((entry, index) => {
        const assistantId = normalizeMessageId(entry.assistant);
        const isSelected = assistantId && assistantId === String(selectedAssistantMessageId || '');
        const isLoading = loadingMessageId && assistantId === loadingMessageId;
        const retrievalStats = entry.assistant?.retrievalStats || {};

        return (
          <button
            key={assistantId || `timeline-${index}`}
            type="button"
            onClick={() => {
              if (assistantId) {
                void onSelectMessage?.(assistantId);
              }
            }}
            className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
              isSelected
                ? 'border-(--accent) bg-(--accent-soft)'
                : 'token-border token-surface hover:border-(--border-strong) hover:bg-(--bg-surface-2)'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1 rounded-full border token-border bg-(--bg-surface-2) px-2 py-0.5 text-[11px] font-semibold token-text-subtle">
                <Clock3 className="h-3 w-3" />
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Timestamp unavailable'}
              </span>
              {isLoading ? (
                <span className="inline-flex items-center gap-1 text-xs token-text-muted">
                  <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                  Loading cached evidence...
                </span>
              ) : null}
            </div>

            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] token-text-subtle">Query</p>
            <p className="text-sm font-semibold token-text">
              {entry.user?.text || 'Assistant response'}
            </p>

            <p className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] token-text-subtle">Response Summary</p>
            <p className="line-clamp-2 text-xs leading-relaxed token-text-muted">
              {entry.assistant?.structuredAnswer?.condition_overview || entry.assistant?.text || 'No response preview available.'}
            </p>

            <div className="mt-2 flex flex-wrap gap-3 text-xs token-text-subtle">
              <span>Latency: {retrievalStats.timeTakenMs ? `${Math.round(retrievalStats.timeTakenMs)} ms` : 'N/A'}</span>
              <span>Sources: {(entry.assistant?.usedSourceIds || []).length}</span>
              <span>Candidates: {retrievalStats.totalCandidates || 0}</span>
              <span>Shown: {retrievalStats.rerankedTo || 0}</span>
              <span>Intent: {entry.assistant?.intentType || 'GENERAL'}</span>
            </div>
          </button>
        );
      })}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    </div>
  );
}

export default function TimelineTab({ sources }) {
  const { pubs, data, stats } = useMemo(() => {
    const pubs = sources.filter(
      (s) => s.type === 'publication' && Number.isFinite(Number(s.year)) && Number(s.year) >= 2010
    );
    if (pubs.length === 0) return { pubs: [], data: [], stats: null };

    const counts = {};
    const maxScoreByYear = {};

    pubs.forEach((p) => {
      const year = Number(p.year);
      counts[year] = (counts[year] || 0) + 1;
      maxScoreByYear[year] = Math.max(maxScoreByYear[year] || 0, Number(p.finalScore) || 0);
    });

    const data = Object.keys(counts)
      .map((year) => Number(year))
      .sort((a, b) => a - b)
      .map((year) => ({ year, count: counts[year] }));

    const currentYear = new Date().getFullYear();
    const recent = data.filter((d) => d.year >= currentYear - 2);
    const older = data.filter((d) => d.year >= currentYear - 5 && d.year < currentYear - 2);
    const recentAvg = recent.reduce((a, b) => a + b.count, 0) / Math.max(recent.length, 1);
    const olderAvg = older.reduce((a, b) => a + b.count, 0) / Math.max(older.length, 1);

    let trend = 'stable';
    if (olderAvg > 0) {
      const ratio = recentAvg / olderAvg;
      if (ratio > 1.2) trend = 'up';
      else if (ratio < 0.8) trend = 'down';
    } else if (recentAvg > 0) {
      trend = 'up';
    }

    const peakYearItem = [...data].sort((a, b) => b.count - a.count)[0];
    const post2020 = data.filter((d) => d.year >= 2020).reduce((a, b) => a + b.count, 0);
    const topScoreYear = Object.entries(maxScoreByYear)
      .sort((a, b) => Number(b[1]) - Number(a[1]) || Number(b[0]) - Number(a[0]))?.[0]?.[0];

    return {
      pubs,
      data,
      stats: {
        trend,
        peakYear: peakYearItem?.year,
        peakCount: peakYearItem?.count,
        post2020,
        topScoreYear: Number(topScoreYear) || null,
        currentYear,
      },
    };
  }, [sources]);

  if (pubs.length === 0) {
    return (
      <p className="text-sm text-center mt-12" style={{ color: 'var(--text-muted)' }}>
        Publication timeline will appear after your first query.
      </p>
    );
  }

  const TrendIcon =
    stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    stats.trend === 'up' ? '#34d399' : stats.trend === 'down' ? '#f87171' : '#94a3b8';
  const trendLabel =
    stats.trend === 'up' ? 'Accelerating 🚀' : stats.trend === 'down' ? 'Declining 📉' : 'Stable 📊';

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total Papers" value={pubs.length} sub="2010+" />
        <StatCard label="Peak Year" value={stats.peakYear || 'N/A'} sub={stats.peakCount ? `${stats.peakCount} papers` : undefined} />
        <StatCard label="Since 2020" value={stats.post2020} />
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
            Momentum
          </p>
          <p className="text-lg font-bold flex items-center justify-center gap-1.5" style={{ color: trendColor }}>
            <TrendIcon className="h-4 w-4" />
            {trendLabel}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div
        className="rounded-xl px-3 pt-4 pb-2"
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2 mb-3 px-1">
          <BarChart2 className="h-3.5 w-3.5" style={{ color: '#60a5fa' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Publications per Year
          </span>
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="year"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(96,165,250,0.06)' }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {data.map((entry) => {
                  let color = 'var(--color-surface-3)';
                  if (entry.year >= stats.currentYear - 1) color = '#6366f1';
                  if (entry.year === stats.topScoreYear) color = '#3b82f6';
                  return <Cell key={entry.year} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 px-1">
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#6366f1' }} />
            Last 2 years
          </span>
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#3b82f6' }} />
            Highest relevance year
          </span>
        </div>
      </div>
    </div>
  );
}
