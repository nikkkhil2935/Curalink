import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.js';
import ThemeToggle from '../ui/ThemeToggle.jsx';
import ExportButton from './ExportButton.jsx';
import Card from '../ui/Card.jsx';

export default function Sidebar() {
  const { currentSession, messages } = useAppStore();
  const navigate = useNavigate();

  const selectedAssistant = useMemo(() => {
    return [...messages].reverse().find((m) => m.role === 'assistant' && m.retrievalStats);
  }, [messages]);

  const stats = selectedAssistant?.retrievalStats || null;

  return (
    <div className="flex h-full flex-col justify-between p-4 space-y-4">
      <div className="space-y-4 flex-1 overflow-y-auto w-full">
        
        <Card noPadding className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Session Info</h3>
             <ThemeToggle />
          </div>
          
          <div className="space-y-2 mt-4 text-sm text-gray-200 leading-relaxed">
            {currentSession ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Disease</span>
                  <span className="font-medium text-white">{currentSession.disease || 'N/A'}</span>
                </div>
                {currentSession.intent && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Intent</span>
                    <span className="font-medium text-white">{currentSession.intent}</span>
                  </div>
                )}
                {(currentSession.location?.city || currentSession.location?.country) && (
                  <div className="flex justify-between text-right">
                    <span className="text-gray-500 mr-2">Location</span>
                    <span className="font-medium text-white">
                      {[currentSession.location.city, currentSession.location.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-gray-500 italic block mt-2 text-center text-xs">No active session</span>
            )}
          </div>
        </Card>

        {stats && (
          <Card noPadding className="p-4 bg-gray-900 border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Retrieval Stats</h3>
            <div className="space-y-2 text-sm text-gray-200 leading-relaxed">
              <div className="flex justify-between text-blue-400 font-medium">
                <span>Total Candidates</span>
                <span>{stats.totalCandidates || 0}</span>
              </div>
              <div className="flex justify-between text-blue-300 text-xs">
                <span>PubMed fetched</span>
                <span>{stats.pubmedFetched || 0}</span>
              </div>
              <div className="flex justify-between text-purple-300 text-xs">
                <span>OpenAlex fetched</span>
                <span>{stats.openalexFetched || 0}</span>
              </div>
              <div className="flex justify-between text-green-300 text-xs">
                <span>ClinicalTrials fetched</span>
                <span>{stats.ctFetched || 0}</span>
              </div>
              <div className="flex justify-between text-yellow-400 mt-2 font-medium">
                <span>Shown to You</span>
                <span>{stats.rerankedTo || 0}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs mt-2 border-t border-gray-800 pt-2">
                <span>Retrieved in</span>
                <span>{stats.timeTakenMs ? (stats.timeTakenMs / 1000).toFixed(1) + 's' : '0.0s'}</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-3 pt-4 border-t border-gray-800 w-full">
        <button 
          onClick={() => navigate('/analytics')}
          className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border border-transparent hover:border-gray-700"
        >
          View Analytics Dashboard →
        </button>
        <ExportButton />
      </div>
    </div>
  );
}
