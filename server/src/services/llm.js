import axios from 'axios';

export async function generateFromLlm(payload) {
  const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://localhost:8000';

  try {
    const response = await axios.post(`${llmServiceUrl}/generate`, payload, {
      timeout: 30000
    });

    return response.data;
  } catch (error) {
    return {
      status: 'placeholder',
      message: 'LLM generation failed or is not ready yet.',
      details: error.message
    };
  }
}