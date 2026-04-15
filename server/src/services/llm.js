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
export function parseLLMResponse(llmData) {
  if (llmData?.parsed && isValidStructuredAnswer(llmData.parsed)) {
    return normalizeStructuredAnswer(llmData.parsed);
  }

  if (llmData?.text) {
    try {
      const cleaned = llmData.text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (isValidStructuredAnswer(parsed)) {
        return normalizeStructuredAnswer(parsed);
      }
    } catch {
      // no-op, use fallback below
    }
  }

  return createParserFallback();
}

function createParserFallback() {
  return {
    condition_overview: 'Evidence synthesis could not be parsed. Please review the retrieved sources directly.',
    evidence_strength: 'LIMITED',
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
    (obj.condition_overview || obj.research_insights || obj.recommendations)
  );
}

function normalizeStructuredAnswer(answer) {
  return {
    condition_overview: answer.condition_overview || '',
    evidence_strength: ['LIMITED', 'MODERATE', 'STRONG'].includes(answer.evidence_strength)
      ? answer.evidence_strength
      : 'MODERATE',
    research_insights: Array.isArray(answer.research_insights)
      ? answer.research_insights.map((insight) => ({
          insight: insight?.insight || '',
          type: ['TREATMENT', 'DIAGNOSIS', 'RISK', 'PREVENTION', 'GENERAL'].includes(insight?.type)
            ? insight.type
            : 'GENERAL',
          source_ids: Array.isArray(insight?.source_ids) ? insight.source_ids.filter(Boolean) : []
        }))
      : [],
    clinical_trials: Array.isArray(answer.clinical_trials)
      ? answer.clinical_trials.map((trial) => ({
          summary: trial?.summary || '',
          status: trial?.status || '',
          location_relevant: Boolean(trial?.location_relevant),
          contact: trial?.contact || '',
          source_ids: Array.isArray(trial?.source_ids) ? trial.source_ids.filter(Boolean) : []
        }))
      : [],
    key_researchers: Array.isArray(answer.key_researchers) ? answer.key_researchers.filter(Boolean) : [],
    recommendations: answer.recommendations || '',
    follow_up_suggestions: Array.isArray(answer.follow_up_suggestions)
      ? answer.follow_up_suggestions.filter(Boolean)
      : []
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