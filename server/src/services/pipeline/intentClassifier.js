const intentKeywords = {
  TREATMENT: ['treatment', 'therapy', 'medication', 'dbs', 'drug', 'surgery'],
  DIAGNOSIS: ['diagnosis', 'diagnostic', 'symptom', 'screening', 'test'],
  SIDE_EFFECTS: ['side effect', 'adverse', 'safety', 'risk', 'toxicity'],
  RESEARCHERS: ['researcher', 'scientist', 'author', 'institution']
};

export function classifyIntent(query) {
  const normalized = (query || '').toLowerCase();

  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return intent;
    }
  }

  return 'GENERAL';
}
