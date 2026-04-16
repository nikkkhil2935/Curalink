import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import PublicationsTab from './PublicationsTab';
import TrialsTab from './TrialsTab';
import ResearchersTab from './ResearchersTab';
import TimelineTab from './TimelineTab';

export default function EvidencePanel() {
  const { sources, activeTab, setActiveTab } = useAppStore();
  const pubCount = sources.filter(s => s.type === 'publication').length;
  const trialCount = sources.filter(s => s.type === 'trial').length;

  return (
    <div className="flex flex-col h-full bg-gray-950 border-l border-gray-800">
      <div className="flex overflow-x-auto border-b border-gray-800 px-2 pt-2 scrollbar-none">
        <TabButton active={activeTab === 'publications'} onClick={() => setActiveTab('publications')}>
          Publications <Badge count={pubCount} color="blue" />
        </TabButton>
        <TabButton active={activeTab === 'trials'} onClick={() => setActiveTab('trials')}>
          Trials <Badge count={trialCount} color="green" />
        </TabButton>
        <TabButton active={activeTab === 'researchers'} onClick={() => setActiveTab('researchers')}>
          Researchers
        </TabButton>
        <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')}>
          Timeline
        </TabButton>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'publications' && <PublicationsTab sources={sources} />}
        {activeTab === 'trials' && <TrialsTab sources={sources} />}
        {activeTab === 'researchers' && <ResearchersTab sources={sources} />}
        {activeTab === 'timeline' && <TimelineTab sources={sources} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
        active ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ count, color }) {
  if (count === 0) return null;
  const colors = {
    blue: 'bg-blue-900 text-blue-300',
    green: 'bg-green-900 text-green-300'
  };
  return <span className={`text-xs px-1.5 py-0.5 rounded-full ${colors[color]}`}>{count}</span>;
}