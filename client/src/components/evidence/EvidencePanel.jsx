import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore.js';
import PublicationsTab from './PublicationsTab.jsx';
import TrialsTab from './TrialsTab.jsx';
import ResearchersTab from './ResearchersTab.jsx';
import TimelineTab from './TimelineTab.jsx';

const tabs = [
  { id: 'publications', label: 'Publications' },
  { id: 'trials', label: 'Trials' },
  { id: 'researchers', label: 'Researchers' },
  { id: 'timeline', label: 'Timeline' }
];

export default function EvidencePanel() {
  const { sources, activeTab, setActiveTab } = useAppStore();

  const publications = useMemo(
    () => sources.filter((source) => source.type === 'publication'),
    [sources]
  );
  const trials = useMemo(() => sources.filter((source) => source.type === 'trial'), [sources]);

  return (
    <section className="flex h-full flex-col bg-slate-950/40">
      <div className="flex gap-2 overflow-x-auto border-b border-slate-800 px-4 py-3" role="tablist" aria-label="Evidence tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            id={`${tab.id}-tab`}
            aria-controls={`${tab.id}-panel`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.id === 'publications' ? ` (${publications.length})` : ''}
            {tab.id === 'trials' ? ` (${trials.length})` : ''}
          </button>
        ))}
      </div>

      <div
        className="scrollbar-thin flex-1 overflow-y-auto p-4"
        role="tabpanel"
        id={`${activeTab}-panel`}
        aria-labelledby={`${activeTab}-tab`}
      >
        {sources.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
            Source cards appear here after you send a query.
          </div>
        ) : null}

        {activeTab === 'publications' ? <PublicationsTab sources={publications} /> : null}
        {activeTab === 'trials' ? <TrialsTab sources={trials} /> : null}
        {activeTab === 'researchers' ? <ResearchersTab sources={publications} /> : null}
        {activeTab === 'timeline' ? <TimelineTab sources={publications} /> : null}
      </div>
    </section>
  );
}
