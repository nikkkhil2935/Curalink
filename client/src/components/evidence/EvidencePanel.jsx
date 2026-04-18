<<<<<<< HEAD
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore.js';
=======
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
import PublicationsTab from './PublicationsTab';
import TrialsTab from './TrialsTab';
import ResearchersTab from './ResearchersTab';
import TimelineTab from './TimelineTab';
import { cn } from '@/lib/utils.js';
import EvidenceConfidenceHeatmap from '@/components/features/EvidenceConfidenceHeatmap.jsx';
import { api } from '@/utils/api.js';

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
<<<<<<< HEAD
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
=======
  const { sessionId } = useParams();
  const {
    sources,
    activeTab,
    setActiveTab,
    messages,
    selectedAssistantMessageId,
    sourcesByMessageId,
    setSources,
    setSelectedAssistantMessage,
    setHighlightedMessage
  } = useAppStore();
  const [timelineLoadingId, setTimelineLoadingId] = useState('');

  const pubCount = sources.filter(s => s.type === 'publication').length;
  const trialCount = sources.filter(s => s.type === 'trial').length;
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

  const selectedAssistantIntent = useMemo(() => {
    const selectedMessage = selectedAssistantMessageId
      ? messages.find((message) => String(message?._id || message?.id || '') === selectedAssistantMessageId)
      : null;

    if (selectedMessage?.role === 'assistant' && selectedMessage?.intentType) {
      return selectedMessage.intentType;
    }

    const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    return latestAssistant?.intentType || null;
  }, [messages, selectedAssistantMessageId]);

  useEffect(() => {
    if (selectedAssistantIntent === 'CLINICAL_TRIALS' && trialCount > 0 && activeTab !== 'trials') {
      setActiveTab('trials');
    }
  }, [activeTab, selectedAssistantIntent, setActiveTab, trialCount]);

  const selectTimelineMessage = async (assistantMessageId) => {
    const normalizedId = String(assistantMessageId || '');
    if (!normalizedId || !sessionId) {
      return;
    }

    setSelectedAssistantMessage(normalizedId);
    setHighlightedMessage(normalizedId);

    const cached = sourcesByMessageId?.[normalizedId];
    if (Array.isArray(cached) && cached.length) {
      setSources(cached, normalizedId);
      return;
    }

    setTimelineLoadingId(normalizedId);
    try {
      const { data } = await api.get(`/sessions/${sessionId}/sources/${normalizedId}`);
      setSources(data?.sources || [], normalizedId);
    } catch {
      setSources([], normalizedId);
    } finally {
      setTimelineLoadingId('');
    }
  };

  return (
<<<<<<< HEAD
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
=======
    <div className="flex h-full min-h-0 flex-col overflow-hidden token-surface">
      <div className="border-b token-border px-3 pt-3">
        <div className="scrollbar-thin flex overflow-x-auto" role="tablist" aria-label="Evidence tabs">
          <TabButton
            id="publications"
            active={activeTab === 'publications'}
            onClick={() => setActiveTab('publications')}
          >
            Publications <Badge count={pubCount} tone="publication" />
          </TabButton>
          <TabButton id="trials" active={activeTab === 'trials'} onClick={() => setActiveTab('trials')}>
            Trials <Badge count={trialCount} tone="trial" />
          </TabButton>
          <TabButton id="researchers" active={activeTab === 'researchers'} onClick={() => setActiveTab('researchers')}>
            Researchers
          </TabButton>
          <TabButton id="timeline" active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')}>
            Timeline
          </TabButton>
        </div>
      </div>
      
      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <EvidenceConfidenceHeatmap sources={sources} />

        {activeTab === 'publications' ? (
          <div id="evidence-panel-publications" role="tabpanel" aria-labelledby="evidence-tab-publications">
            <PublicationsTab sources={sources} />
          </div>
        ) : null}
        {activeTab === 'trials' ? (
          <div id="evidence-panel-trials" role="tabpanel" aria-labelledby="evidence-tab-trials">
            <TrialsTab sources={sources} />
          </div>
        ) : null}
        {activeTab === 'researchers' ? (
          <div id="evidence-panel-researchers" role="tabpanel" aria-labelledby="evidence-tab-researchers">
            <ResearchersTab sources={sources} />
          </div>
        ) : null}
        {activeTab === 'timeline' ? (
          <div id="evidence-panel-timeline" role="tabpanel" aria-labelledby="evidence-tab-timeline">
            <TimelineTab
              messages={messages}
              selectedAssistantMessageId={selectedAssistantMessageId}
              loadingMessageId={timelineLoadingId}
              onSelectMessage={selectTimelineMessage}
            />
          </div>
        ) : null}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
      </div>
    </div>
  );
}

<<<<<<< HEAD
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
=======
function TabButton({ active, onClick, children, id }) {
  return (
    <button
      id={`evidence-tab-${id}`}
      role="tab"
      aria-selected={active}
      aria-controls={`evidence-panel-${id}`}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap',
        'duration-150 ease-out',
        active
          ? 'border-(--accent) text-(--accent)'
          : 'border-transparent text-(--text-muted) hover:text-(--text-primary)'
      )}
    >
      {children}
    </button>
  );
}

function Badge({ count, tone }) {
  if (count === 0) return null;

  const toneClasses = {
    publication: 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-(--accent)',
    trial: 'bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-(--success)'
  };

  return <span className={cn('rounded-full px-1.5 py-0.5 text-xs', toneClasses[tone] || toneClasses.publication)}>{count}</span>;
}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
