import React from 'react';

const strengthConfig = {
  LIMITED: { bg: 'bg-red-950', text: 'text-red-400', emoji: '🔴' },
  MODERATE: { bg: 'bg-yellow-950', text: 'text-yellow-400', emoji: '🟡' },
  STRONG: { bg: 'bg-green-950', text: 'text-green-400', emoji: '🟢' }
};

export default function StructuredAnswer({ answer, stats }) {
  const insightIcons = {
    TREATMENT: '💊', DIAGNOSIS: '🔬', RISK: '⚠️', PREVENTION: '🛡️', GENERAL: '📋'
  };
  
  const evidence = strengthConfig[answer.evidence_strength] || strengthConfig.MODERATE;

  return (
    <div className="flex flex-col space-y-4 w-full">
      <div className="flex items-center justify-between text-xs py-2 px-3 bg-gray-900 border border-gray-800 rounded-lg">
        <span className={`font-medium px-2 py-0.5 rounded ${evidence.bg} ${evidence.text}`}>
          {evidence.emoji} {answer.evidence_strength} EVIDENCE
        </span>
        {stats && (
          <span className="text-gray-500 font-mono">
            {stats.totalCandidates} candidates &rarr; {stats.rerankedTo} shown
          </span>
        )}
      </div>

      {answer.condition_overview && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Overview</h3>
          <p className="text-sm text-gray-200 leading-relaxed">{answer.condition_overview}</p>
        </section>
      )}

      {answer.research_insights?.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Research Findings</h3>
          <ul className="space-y-3">
            {answer.research_insights.map((ri, i) => (
              <li key={i} className="flex space-x-3 items-start">
                <span className="text-base">{insightIcons[ri.type] || '📋'}</span>
                <div>
                  <p className="text-sm text-gray-200">
                    {ri.insight}
                    <span className="ml-2 inline-flex gap-1">
                      {ri.source_ids?.map((id, j) => (
                        <span key={j} className="text-xs font-mono text-blue-400">[{id}]</span>
                      ))}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {answer.clinical_trials?.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Clinical Trials</h3>
          <div className="space-y-2">
            {answer.clinical_trials.map((ct, i) => (
              <div key={i} className="p-3 border border-gray-800 bg-gray-900 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ct.status === 'RECRUITING' ? 'bg-green-950 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                    {ct.status}
                  </span>
                  {ct.location_relevant && <span className="text-xs text-green-400 bg-green-950 px-2 py-0.5 rounded-full">📍 Near You</span>}
                </div>
                <p className="text-gray-200 mb-1">{ct.summary}</p>
                {ct.contact && <p className="text-xs text-gray-500 border-t border-gray-800 pt-1">Contact: {ct.contact}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {answer.recommendations && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Guidance</h3>
          <div className="bg-blue-950/30 border border-blue-900 p-3 rounded-lg text-sm text-blue-200 leading-relaxed">
            {answer.recommendations}
          </div>
        </section>
      )}
    </div>
  );
}