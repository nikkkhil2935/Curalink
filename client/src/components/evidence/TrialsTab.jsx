import React from 'react';

export default function TrialsTab({ sources }) {
  const trials = sources.filter(s => s.type === 'trial').sort((a, b) => {
    if (a.status === 'RECRUITING' && b.status !== 'RECRUITING') return -1;
    if (a.status !== 'RECRUITING' && b.status === 'RECRUITING') return 1;
    return 0;
  });

  if (trials.length === 0) {
    return <div className="text-sm text-gray-500 text-center mt-10">No clinical trials found for the current query.</div>;
  }

  const recruitingCount = trials.filter(t => t.status === 'RECRUITING').length;

  return (
    <div className="space-y-4">
      {recruitingCount > 0 && (
        <div className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">
          🟢 Currently Recruiting ({recruitingCount})
        </div>
      )}
      {trials.map((trial, i) => <TrialCard key={trial.id} trial={trial} index={i} />)}
    </div>
  );
}

function TrialCard({ trial, index }) {
  const isNear = trial.isLocationRelevant;
  const statusColors = {
    green: 'bg-green-900 text-green-300',
    yellow: 'bg-yellow-900 text-yellow-300',
    blue: 'bg-blue-900 text-blue-300',
    orange: 'bg-orange-900 text-orange-300',
    red: 'bg-red-900 text-red-300',
    gray: 'bg-gray-800 text-gray-300'
  };

  const statusStyle = statusColors[trial.statusColor] || statusColors.gray;

  return (
    <div className={`bg-gray-900 border p-4 rounded-xl space-y-3 ${isNear ? 'border-green-600/50' : 'border-gray-800'}`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex space-x-2 items-center">
          <span className="font-mono bg-gray-800 text-gray-300 px-1 rounded">[T{index + 1}]</span>
          <span className={`px-2 py-0.5 rounded-full font-medium ${statusStyle}`}>{trial.status}</span>
        </div>
        {isNear && <span className="text-green-400 bg-green-950 px-2 py-0.5 rounded-full border border-green-800">📍 Near You</span>}
      </div>

      <h4 className="text-white font-bold leading-snug text-sm">{trial.title}</h4>
      
      <div className="flex flex-wrap gap-2 text-xs text-gray-400">
        {trial.phase && trial.phase !== 'N/A' && <span className="bg-gray-800 px-2 py-0.5 rounded">Phase: {trial.phase}</span>}
        {trial.locations?.length > 0 && (
          <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300 truncate max-w-xs">
            {trial.locations.slice(0, 2).join(' | ')}
            {trial.locations.length > 2 && ` + ${trial.locations.length - 2} more`}
          </span>
        )}
      </div>

      {trial.eligibility && (
        <p className="text-xs text-gray-400 leading-relaxed bg-gray-950 p-2 rounded">
          {trial.eligibility.substring(0, 150)}...
        </p>
      )}

      {trial.contacts?.length > 0 && (
        <div className="text-xs text-gray-500 border-t border-gray-800 pt-2 flex flex-col space-y-1">
          <span className="font-semibold">Contact:</span>
          <span>{trial.contacts[0].name} {trial.contacts[0].email ? ` - ${trial.contacts[0].email}` : ''}</span>
        </div>
      )}

      {trial.url && (
        <a href={trial.url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:text-green-300 inline-block mt-1">
          View on ClinicalTrials.gov →
        </a>
      )}
    </div>
  );
}