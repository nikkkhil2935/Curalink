import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import PublicationsTab from './PublicationsTab';
import TrialsTab from './TrialsTab';
import ResearchersTab from './ResearchersTab';
import TimelineTab from './TimelineTab';
import { cn } from '@/lib/utils.js';
import EvidenceConfidenceHeatmap from '@/components/features/EvidenceConfidenceHeatmap.jsx';
import { api } from '@/utils/api.js';

export default function EvidencePanel() {
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
      </div>
    </div>
  );
}

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