import axios from 'axios';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8001';

/**
 * Call LLM service for RAG generation.
 */
export async function callLLM(systemPrompt, userPrompt) {
  try {
    const { data } = await axios.post(
      `${LLM_SERVICE_URL}/generate`,
      {
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        temperature: 0.1,
        max_tokens: 2048
      },
      { timeout: 120000 }
    );

    return data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      throw new Error('LLM service is unreachable. Please start the configured LLM provider service.');
    }

    throw err;
  }
}

/**
 * Generate embeddings for semantic ranking.
 */
export async function getEmbeddings(texts) {
  try {
    const { data } = await axios.post(`${LLM_SERVICE_URL}/embed`, { texts }, { timeout: 30000 });
    return data.embeddings;
  } catch (err) {
    console.warn('Embedding service unavailable, falling back to keyword scoring');
    return null;
  }
}

/**
 * Semantic rerank using embedding service.
 */
export async function semanticRerank(query, documents) {
  if (!documents?.length) {
    return documents || [];
  }

  try {
    const { data } = await axios.post(
      `${LLM_SERVICE_URL}/rerank`,
      {
        query,
        documents: documents.map((doc) => ({
          id: doc.id,
          text: `${doc.title || ''} ${doc.abstract || ''}`.substring(0, 512)
        })),
        top_k: 100
      },
      { timeout: 30000 }
    );

    const scoreMap = {};
    for (const item of data.ranked || []) {
      scoreMap[item.id] = item.score;
    }

    return documents
      .map((doc) => ({
        ...doc,
        semanticScore: scoreMap[doc.id] || 0,
        finalScore: (doc.finalScore || 0) * 0.5 + (scoreMap[doc.id] || 0) * 0.5
      }))
      .sort((a, b) => b.finalScore - a.finalScore);
  } catch (err) {
    console.warn('Semantic reranking failed, using keyword scores');
    return documents;
  }
}

/**
 * Parse and validate LLM response with resilient fallback behavior.
 */
export function parseLLMResponse(llmData, options = {}) {
  const allowedCitationIds = Array.isArray(options.allowedCitationIds)
    ? options.allowedCitationIds.map((id) => String(id).toUpperCase())
    : [];

  if (llmData?.parsed) {
    const normalized = normalizeStructuredAnswer(llmData.parsed, allowedCitationIds);
    if (isValidStructuredAnswer(normalized)) {
      return normalized;
    }
  }

  const parsedFromText = extractJsonPayload(llmData?.text || '');
  if (parsedFromText) {
    const normalized = normalizeStructuredAnswer(parsedFromText, allowedCitationIds);
    if (isValidStructuredAnswer(normalized)) {
      return normalized;
    }
  }

  return createParserFallback(options);
}

function extractJsonPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to object extraction.
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return null;
  }

  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
}

function createParserFallback(options = {}) {
  const strength = ['LIMITED', 'MODERATE', 'STRONG'].includes(options.evidenceStrengthLabel)
    ? options.evidenceStrengthLabel
    : 'LIMITED';
  const disease = options.disease || 'this condition';

  return {
    condition_overview: `Structured generation could not be validated for ${disease}. Please review the evidence panel directly.`,
    evidence_strength: strength,
    research_insights: [],
    clinical_trials: [],
    key_researchers: [],
    recommendations:
      'A structured summary was not available for this response. Please consult your healthcare provider for personalized guidance.',
    follow_up_suggestions: [
      'Can you summarize the strongest findings from the listed sources?',
      'Can you focus on recruiting clinical trials near my location?',
      'Can you compare benefits and risks from the top studies?'
    ]
  };
}

function isValidStructuredAnswer(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.condition_overview === 'string' &&
    Array.isArray(obj.research_insights) &&
    Array.isArray(obj.clinical_trials) &&
    Array.isArray(obj.follow_up_suggestions)
  );
}

function normalizeStructuredAnswer(answer, allowedCitationIds = []) {
  const allowedSet = new Set(
    (Array.isArray(allowedCitationIds) ? allowedCitationIds : []).map((id) =>
      String(id).toUpperCase()
    )
  );

  const normalizeSourceIds = (sourceIds) => {
    if (!Array.isArray(sourceIds)) {
      return [];
    }

    const ids = sourceIds
      .map((id) => String(id).toUpperCase().trim())
      .filter(Boolean);

    if (!allowedSet.size) {
      return [];
    }

    return ids.filter((id, index) => allowedSet.has(id) && ids.indexOf(id) === index);
  };

  const normalizedInsights = Array.isArray(answer.research_insights)
    ? answer.research_insights
        .map((insight) => ({
          insight: insight?.insight || '',
          type: ['TREATMENT', 'DIAGNOSIS', 'RISK', 'PREVENTION', 'GENERAL'].includes(insight?.type)
            ? insight.type
            : 'GENERAL',
          source_ids: normalizeSourceIds(insight?.source_ids)
        }))
        .filter((insight) => insight.insight && insight.source_ids.length > 0)
    : [];

  const normalizedTrials = Array.isArray(answer.clinical_trials)
    ? answer.clinical_trials
        .map((trial) => ({
          summary: trial?.summary || '',
          status: trial?.status || '',
          location_relevant: Boolean(trial?.location_relevant),
          contact: trial?.contact || '',
          source_ids: normalizeSourceIds(trial?.source_ids)
        }))
        .filter((trial) => trial.summary && trial.source_ids.length > 0)
    : [];

  const followUpDefaults = [
    'Can you summarize the strongest findings from the listed sources?',
    'Can you focus on recruiting clinical trials near my location?',
    'Can you compare benefits and risks from the top studies?'
  ];

  const followUpSuggestions = [
    ...(Array.isArray(answer.follow_up_suggestions) ? answer.follow_up_suggestions : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
    ...followUpDefaults
  ].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 3);

  const baseRecommendations = String(answer.recommendations || '').trim();
  const providerSuffix = 'Please consult your healthcare provider for personalized guidance.';
  const recommendations = baseRecommendations
    ? baseRecommendations.toLowerCase().includes('please consult your healthcare provider')
      ? baseRecommendations
      : `${baseRecommendations.replace(/\.+$/, '')}. ${providerSuffix}`
    : providerSuffix;

  return {
    condition_overview: String(answer.condition_overview || ''),
    evidence_strength: ['LIMITED', 'MODERATE', 'STRONG'].includes(answer.evidence_strength)
      ? answer.evidence_strength
      : 'MODERATE',
    research_insights: normalizedInsights,
    clinical_trials: normalizedTrials,
    key_researchers: Array.isArray(answer.key_researchers) ? answer.key_researchers.filter(Boolean) : [],
    recommendations,
    follow_up_suggestions: followUpSuggestions
  };
}

// Backward-compatible helper for older callers.
export async function generateFromLlm(payload) {
  try {
    const systemPrompt = payload?.system_prompt || payload?.systemPrompt || '';
    const userPrompt = payload?.user_prompt || payload?.userPrompt || payload?.query || '';
    return await callLLM(systemPrompt, userPrompt);
  } catch (error) {
    return {
      status: 'placeholder',
      message: 'LLM generation failed or is not ready yet',
      details: error.message
    };
  }
}