import React from 'react';

const STEPS = [
  'Query expansion',
  'PubMed fetch',
  'OpenAlex fetch',
  'ClinicalTrials fetch',
  'Re-ranking process',
  'AI synthesis'
];

export default function LoadingOverlay() {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-xl border border-gray-800">
      <div className="relative mb-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-800 border-t-blue-500" />
        <div 
          className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-cyan-400" 
          style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} 
        />
      </div>
      
      <div className="space-y-3 w-full max-w-xs">
        {STEPS.map((step, idx) => (
          <div key={step} className="flex items-center space-x-3">
            <div 
              className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" 
              style={{ animationDelay: idx * 150 + 'ms' }}
            />
            <span className="text-sm text-gray-400 font-medium tracking-wide">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
