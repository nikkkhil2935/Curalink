import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore.js';
import PublicationsTab from './PublicationsTab';
import TrialsTab from './TrialsTab';
import ResearchersTab from './ResearchersTab';
import TimelineTab from './TimelineTab';

const TABS = [
  { id: 'publications', label: 'Publications', emoji: '📄' },
  { id: 'trials',       label: 'Trials',       emoji: '🧪' },
  { id: 'researchers',  label: 'Researchers',  emoji: '👤' },
  { id: 'timeline',     label: 'Timeline',     emoji: '📈' },
];

function sourceMatchesKeyword(source, keyword) {
  if (!keyword) return true;

  const contactText = (Array.isArray(source.contacts) ? source.contacts : [])
    .map((contact) => `${contact?.name || ''} ${contact?.email || ''}`.trim())
    .filter(Boolean)
    .join(' ');

  const searchable = [
    source.title,
    source.abstract,
    source.journal,
    source.source,
    source.status,
    source.phase,
    source.eligibility,
    source.url,
    ...(Array.isArray(source.authors) ? source.authors : []),
    ...(Array.isArray(source.locations) ? source.locations : []),
    contactText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchable.includes(keyword);
}

export default function EvidencePanel() {
  const { sources, messages, activeTab, setActiveTab } = useAppStore();
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const autoSwitchedMessageIdRef = useRef(null);

  const latestAssistantIntent = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant' && message.intentType),
    [messages]
  );

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredSources = useMemo(
    () =>
      sources.filter((source) => {
        if (sourceTypeFilter !== 'all' && source.type !== sourceTypeFilter) {
          return false;
        }
        return sourceMatchesKeyword(source, normalizedKeyword);
      }),
    [sources, sourceTypeFilter, normalizedKeyword]
  );

  const pubCount = filteredSources.filter((s) => s.type === 'publication').length;
  const trialCount = filteredSources.filter((s) => s.type === 'trial').length;
  const hasActiveFilters = sourceTypeFilter !== 'all' || normalizedKeyword.length > 0;

  const getCount = (id) => (id === 'publications' ? pubCount : id === 'trials' ? trialCount : null);

  useEffect(() => {
    const latestIntent = String(latestAssistantIntent?.intentType || '').toUpperCase();
    const latestMessageId = String(latestAssistantIntent?._id || latestAssistantIntent?.id || '');

    if (latestIntent !== 'CLINICAL_TRIALS' || sources.length === 0) {
      return;
    }

    if (latestMessageId && autoSwitchedMessageIdRef.current === latestMessageId) {
      return;
    }

    if (activeTab !== 'trials') {
      setActiveTab('trials');
    }

    autoSwitchedMessageIdRef.current = latestMessageId || '__latest__';
  }, [activeTab, latestAssistantIntent, setActiveTab, sources.length]);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-surface)', color: 'var(--text-primary)' }}
    >
      {/* ── Tab strip ── */}
      <div
        className="shrink-0 flex overflow-x-auto scrollbar-none border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {TABS.map((tab) => {
          const count = getCount(tab.id);
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`ev-tab ${active ? 'active' : ''}`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
              {count !== null && count > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background:
                      tab.id === 'trials'
                        ? active
                          ? 'rgba(52,211,153,0.2)'
                          : 'rgba(52,211,153,0.12)'
                        : active
                          ? 'rgba(59,130,246,0.2)'
                          : 'rgba(59,130,246,0.12)',
                    color:
                      tab.id === 'trials'
                        ? active
                          ? '#6ee7b7'
                          : '#34d399'
                        : active
                          ? '#93c5fd'
                          : '#60a5fa',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Quick filters ── */}
      <div
        className="shrink-0 px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              value={sourceTypeFilter}
              onChange={(event) => setSourceTypeFilter(event.target.value)}
              className="cl-input text-xs"
              style={{ maxWidth: 150 }}
              aria-label="Filter evidence by source type"
            >
              <option value="all">All sources</option>
              <option value="publication">Publications</option>
              <option value="trial">Trials</option>
            </select>

            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Quick search across all evidence tabs"
                className="cl-input w-full pl-8 pr-8 py-1.5 text-xs"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  aria-label="Clear evidence search"
                >
                  <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {filteredSources.length} of {sources.length} sources match current filters
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSourceTypeFilter('all');
                  setKeyword('');
                }}
                className="text-[11px] rounded-lg px-2 py-1 transition-all"
                style={{
                  background: 'var(--color-surface-3)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {filteredSources.length === 0 ? (
          <EmptyEvidence hasSources={sources.length > 0} hasActiveFilters={hasActiveFilters} />
        ) : (
          <>
            {activeTab === 'publications' && <PublicationsTab sources={filteredSources} />}
            {activeTab === 'trials'       && <TrialsTab sources={filteredSources} />}
            {activeTab === 'researchers'  && <ResearchersTab sources={filteredSources} />}
            {activeTab === 'timeline'     && <TimelineTab sources={filteredSources} />}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyEvidence({ hasSources, hasActiveFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-2xl"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
      >
        📚
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
        {hasActiveFilters ? 'No matches for current filters' : 'No evidence yet'}
      </p>
      <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
        {hasActiveFilters
          ? 'Try broadening your keyword or source type filter.'
          : hasSources
            ? 'Sources are loaded, but this tab has no matching records.'
            : 'Research sources will appear here after you submit your first query'}
      </p>
    </div>
  );
}
