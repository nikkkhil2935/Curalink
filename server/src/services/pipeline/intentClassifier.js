const INTENT_PATTERNS = {
  TREATMENT: [
    'treatment',
    'therapy',
    'medication',
    'drug',
    'medicine',
    'surgery',
    'procedure',
    'intervention',
    'cure',
    'manage',
    'heal',
    'treat',
    'deep brain stimulation',
    'chemotherapy',
    'immunotherapy',
    'radiation'
  ],
  DIAGNOSIS: [
    'diagnos',
    'detect',
    'test',
    'screening',
    'biomarker',
    'symptom',
    'sign',
    'identify',
    'confirm',
    'early detection',
    'scan',
    'mri',
    'ct scan'
  ],
  SIDE_EFFECTS: [
    'side effect',
    'adverse',
    'risk',
    'complication',
    'danger',
    'harm',
    'toxicity',
    'interaction',
    'contraindication',
    'warning'
  ],
  PREVENTION: [
    'prevent',
    'reduce risk',
    'avoid',
    'protection',
    'vaccine',
    'lifestyle',
    'diet',
    'exercise',
    'supplement',
    'vitamin'
  ],
  RESEARCHERS: [
    'researcher',
    'expert',
    'specialist',
    'doctor',
    'scientist',
    'who is',
    'top researcher',
    'leading',
    'pioneer',
    'institution'
  ],
  CLINICAL_TRIALS: [
    'clinical trial',
    'study',
    'recruiting',
    'enroll',
    'participate',
    'trial near',
    'ongoing study',
    'phase',
    'experimental'
  ]
};

export function classifyIntent(query, intent = '') {
  const combined = `${query || ''} ${intent || ''}`.toLowerCase();
  const scores = {};

  for (const [intentType, keywords] of Object.entries(INTENT_PATTERNS)) {
    scores[intentType] = keywords.reduce((score, keyword) => {
      return combined.includes(keyword.toLowerCase()) ? score + 1 : score;
    }, 0);
  }

  const [topIntent, topScore] = Object.entries(scores).sort(([, a], [, b]) => b - a)[0] || ['GENERAL', 0];
  return topScore > 0 ? topIntent : 'GENERAL';
}

export function getRetrievalStrategy(intentType) {
  const strategies = {
    TREATMENT: { boostPublications: true, boostRecruiting: true, pubmedSort: 'relevance' },
    DIAGNOSIS: { boostPublications: true, boostCompleted: true, pubmedSort: 'relevance' },
    SIDE_EFFECTS: {
      boostPublications: true,
      pubmedFilters: 'adverse effects',
      pubmedSort: 'relevance'
    },
    PREVENTION: { boostPublications: true, pubmedSort: 'pub date' },
    RESEARCHERS: { boostPublications: true, fetchAuthorData: true, pubmedSort: 'relevance' },
    CLINICAL_TRIALS: { boostTrials: true, boostRecruiting: true, pubmedSort: 'pub date' },
    GENERAL: { balanced: true, pubmedSort: 'pub date' }
  };

  return strategies[intentType] || strategies.GENERAL;
}
