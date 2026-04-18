const MIN_CONFLICT_CREDIBILITY = 0.65;

const OUTCOME_LEXICON = [
  { outcomePhrase: 'mortality', keywords: ['mortality', 'death rate', 'fatality'] },
  { outcomePhrase: 'overall survival', keywords: ['overall survival', 'os', 'survival benefit'] },
  { outcomePhrase: 'progression-free survival', keywords: ['progression-free survival', 'pfs'] },
  { outcomePhrase: 'disease-free survival', keywords: ['disease-free survival', 'dfs'] },
  { outcomePhrase: 'response rate', keywords: ['response rate', 'objective response', 'or rate'] },
  { outcomePhrase: 'remission rate', keywords: ['remission', 'complete remission', 'partial remission'] },
  { outcomePhrase: 'hospitalization', keywords: ['hospitalization', 'hospital admission'] },
  { outcomePhrase: 'readmission', keywords: ['readmission', 're-hospitalization'] },
  { outcomePhrase: 'symptom improvement', keywords: ['symptom improvement', 'symptom relief'] },
  { outcomePhrase: 'pain reduction', keywords: ['pain reduction', 'pain score'] },
  { outcomePhrase: 'quality of life', keywords: ['quality of life', 'qol'] },
  { outcomePhrase: 'functional status', keywords: ['functional status', 'functional outcome'] },
  { outcomePhrase: 'adverse events', keywords: ['adverse event', 'side effect'] },
  { outcomePhrase: 'serious adverse events', keywords: ['serious adverse event', 'grade 3', 'grade 4'] },
  { outcomePhrase: 'treatment discontinuation', keywords: ['treatment discontinuation', 'stopped treatment'] },
  { outcomePhrase: 'contraindication', keywords: ['contraindicated', 'contraindication'] },
  { outcomePhrase: 'drug interaction risk', keywords: ['drug interaction', 'interaction risk'] },
  { outcomePhrase: 'renal function', keywords: ['renal function', 'kidney function', 'egfr'] },
  { outcomePhrase: 'hepatic function', keywords: ['hepatic function', 'liver function', 'alt', 'ast'] },
  { outcomePhrase: 'cardiovascular events', keywords: ['cardiovascular event', 'cardiac event'] },
  { outcomePhrase: 'stroke risk', keywords: ['stroke risk', 'cerebrovascular event'] },
  { outcomePhrase: 'myocardial infarction risk', keywords: ['myocardial infarction', 'heart attack'] },
  { outcomePhrase: 'infection risk', keywords: ['infection risk', 'infection rate'] },
  { outcomePhrase: 'bleeding risk', keywords: ['bleeding risk', 'hemorrhage'] },
  { outcomePhrase: 'toxicity burden', keywords: ['toxicity', 'treatment toxicity'] },
  { outcomePhrase: 'time to progression', keywords: ['time to progression', 'ttp'] },
  { outcomePhrase: 'relapse rate', keywords: ['relapse rate', 'relapse'] },
  { outcomePhrase: 'recurrence rate', keywords: ['recurrence rate', 'recurrence'] },
  { outcomePhrase: 'biomarker improvement', keywords: ['biomarker', 'marker improvement'] },
  { outcomePhrase: 'inflammatory markers', keywords: ['inflammatory marker', 'crp', 'il-6'] },
  { outcomePhrase: 'viral load', keywords: ['viral load', 'viral suppression'] },
  { outcomePhrase: 'tumor size reduction', keywords: ['tumor size', 'lesion size', 'tumor shrinkage'] },
  { outcomePhrase: 'metastasis progression', keywords: ['metastasis', 'metastatic progression'] },
  { outcomePhrase: 'reproductive safety', keywords: ['reproductive safety', 'fertility'] },
  { outcomePhrase: 'fetal outcomes', keywords: ['fetal outcome', 'pregnancy outcome'] },
  { outcomePhrase: 'cognitive function', keywords: ['cognitive function', 'cognitive decline'] },
  { outcomePhrase: 'mental health outcomes', keywords: ['mental health', 'depression', 'anxiety'] },
  { outcomePhrase: 'sleep quality', keywords: ['sleep quality', 'insomnia'] },
  { outcomePhrase: 'weight control', keywords: ['weight loss', 'weight gain', 'body weight'] },
  { outcomePhrase: 'glycemic control', keywords: ['glycemic control', 'hba1c', 'glucose control'] },
  { outcomePhrase: 'blood pressure control', keywords: ['blood pressure', 'hypertension control'] }
];

const POSITIVE_SIGNAL_PHRASES = [
  'significant reduction',
  'reduced',
  'decreased',
  'improved',
  'improvement',
  'benefit',
  'effective',
  'efficacy',
  'better outcomes',
  'higher survival',
  'lower risk',
  'safe and effective',
  'superior',
  'favorable'
];

const NEGATIVE_SIGNAL_PHRASES = [
  'increased risk',
  'worse outcomes',
  'harmful',
  'adverse',
  'toxicity',
  'contraindicated',
  'ineffective',
  'no benefit',
  'failed to improve',
  'higher mortality',
  'poor response',
  'inferior',
  'deterioration',
  'complication'
];

const NEUTRAL_SIGNAL_PHRASES = [
  'no significant difference',
  'no significant effect',
  'not statistically significant',
  'comparable outcomes',
  'similar outcomes',
  'mixed results',
  'inconclusive',
  'uncertain benefit'
];

const POSITIVE_WITH_NEGATION =
  /(no|not|without|did not|failed to)\s+(clear\s+|significant\s+)?(benefit|improvement|reduction|decrease|efficacy)/gi;

function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.min(max, Math.max(min, numeric));
}

function countPhraseHits(text, phrases) {
  let hits = 0;
  for (const phrase of phrases) {
    if (!phrase) {
      continue;
    }

    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = text.match(regex);
    hits += matches ? matches.length : 0;
  }

  return hits;
}

function normalizeAbstract(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildSentenceWindows(abstract) {
  return normalizeAbstract(abstract)
    .split(/[.!?;]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function detectPolarityFromWindow(windowText) {
  const positiveHits = countPhraseHits(windowText, POSITIVE_SIGNAL_PHRASES);
  const negativeHits = countPhraseHits(windowText, NEGATIVE_SIGNAL_PHRASES);
  const neutralHits = countPhraseHits(windowText, NEUTRAL_SIGNAL_PHRASES);

  let adjustedPositive = positiveHits;
  let adjustedNegative = negativeHits;
  let adjustedNeutral = neutralHits;

  const negatedPositiveHits = (windowText.match(POSITIVE_WITH_NEGATION) || []).length;
  if (negatedPositiveHits > 0) {
    adjustedNegative += negatedPositiveHits;
    adjustedPositive = Math.max(0, adjustedPositive - negatedPositiveHits);
  }

  if (adjustedNeutral >= adjustedPositive && adjustedNeutral >= adjustedNegative && adjustedNeutral > 0) {
    return { position: 'neutral', confidence: clamp(0.45 + adjustedNeutral * 0.08) };
  }

  if (adjustedPositive > adjustedNegative) {
    return { position: 'positive', confidence: clamp(0.5 + adjustedPositive * 0.08) };
  }

  if (adjustedNegative > adjustedPositive) {
    return { position: 'negative', confidence: clamp(0.5 + adjustedNegative * 0.08) };
  }

  return { position: 'neutral', confidence: 0.4 };
}

function detectOutcomePosition(abstract, outcomeEntry) {
  const sentenceWindows = buildSentenceWindows(abstract);
  const relevantWindows = sentenceWindows.filter((sentence) =>
    outcomeEntry.keywords.some((keyword) => sentence.includes(String(keyword).toLowerCase()))
  );

  if (!relevantWindows.length) {
    return null;
  }

  let positiveVotes = 0;
  let negativeVotes = 0;
  let neutralVotes = 0;
  let confidenceAccumulator = 0;

  for (const windowText of relevantWindows) {
    const outcome = detectPolarityFromWindow(windowText);
    confidenceAccumulator += outcome.confidence;

    if (outcome.position === 'positive') {
      positiveVotes += 1;
    } else if (outcome.position === 'negative') {
      negativeVotes += 1;
    } else {
      neutralVotes += 1;
    }
  }

  let position = 'neutral';
  if (positiveVotes > negativeVotes && positiveVotes >= neutralVotes) {
    position = 'positive';
  } else if (negativeVotes > positiveVotes && negativeVotes >= neutralVotes) {
    position = 'negative';
  }

  return {
    position,
    confidence: clamp(confidenceAccumulator / relevantWindows.length)
  };
}

function computeConflictScore(leftMention, rightMention) {
  const averageCredibility = (leftMention.credibility + rightMention.credibility) / 2;
  const averagePolarityConfidence = (leftMention.confidence + rightMention.confidence) / 2;
  const includesNeutral =
    leftMention.position === 'neutral' || rightMention.position === 'neutral';

  const directionalWeight = includesNeutral ? 0.78 : 1;
  return clamp(averageCredibility * 0.8 * directionalWeight + averagePolarityConfidence * 0.2);
}

function toSeverity(score) {
  if (score >= 0.78) {
    return 'high';
  }

  if (score >= 0.58) {
    return 'medium';
  }

  return 'low';
}

function normalizeSource(source) {
  const id = String(source?.id || source?._id || '').trim();
  const title = String(source?.title || 'Untitled source').trim();
  const year = Number(source?.year) || null;
  const journal = String(source?.journal || source?.source || '').trim();
  const credibility = clamp(source?.finalScore ?? source?.lastRelevanceScore ?? 0);

  return {
    id,
    title,
    year,
    journal,
    credibility,
    abstract: String(source?.abstract || '')
  };
}

export function detectEvidenceConflicts(sources = []) {
  const normalizedSources = (Array.isArray(sources) ? sources : [])
    .map(normalizeSource)
    .filter((source) => source.id && source.abstract && source.credibility > MIN_CONFLICT_CREDIBILITY);

  if (normalizedSources.length < 2) {
    return [];
  }

  const mentionsByOutcome = new Map();

  for (const source of normalizedSources) {
    for (const outcomeEntry of OUTCOME_LEXICON) {
      const polarity = detectOutcomePosition(source.abstract, outcomeEntry);
      if (!polarity) {
        continue;
      }

      const mention = {
        sourceId: source.id,
        title: source.title,
        year: source.year,
        journal: source.journal,
        credibility: source.credibility,
        position: polarity.position,
        confidence: polarity.confidence
      };

      if (!mentionsByOutcome.has(outcomeEntry.outcomePhrase)) {
        mentionsByOutcome.set(outcomeEntry.outcomePhrase, []);
      }

      mentionsByOutcome.get(outcomeEntry.outcomePhrase).push(mention);
    }
  }

  const seenPairs = new Set();
  const conflicts = [];

  for (const [outcomePhrase, mentions] of mentionsByOutcome.entries()) {
    if (mentions.length < 2) {
      continue;
    }

    for (let index = 0; index < mentions.length; index += 1) {
      for (let pointer = index + 1; pointer < mentions.length; pointer += 1) {
        const leftMention = mentions[index];
        const rightMention = mentions[pointer];

        if (leftMention.sourceId === rightMention.sourceId) {
          continue;
        }

        if (leftMention.position === rightMention.position) {
          continue;
        }

        const pairKey = [outcomePhrase, leftMention.sourceId, rightMention.sourceId]
          .sort()
          .join('|');
        if (seenPairs.has(pairKey)) {
          continue;
        }
        seenPairs.add(pairKey);

        const conflictScore = computeConflictScore(leftMention, rightMention);

        conflicts.push({
          outcomePhrase,
          sourceA: {
            id: leftMention.sourceId,
            title: leftMention.title,
            year: leftMention.year,
            journal: leftMention.journal,
            credibility: leftMention.credibility,
            position: leftMention.position
          },
          sourceB: {
            id: rightMention.sourceId,
            title: rightMention.title,
            year: rightMention.year,
            journal: rightMention.journal,
            credibility: rightMention.credibility,
            position: rightMention.position
          },
          conflictScore,
          severity: toSeverity(conflictScore)
        });
      }
    }
  }

  return conflicts.sort((left, right) => right.conflictScore - left.conflictScore).slice(0, 50);
}

export default detectEvidenceConflicts;
