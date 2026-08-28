const axios = require('axios');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const configuredTimeout = Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS);
const REQUEST_TIMEOUT_MS = configuredTimeout >= 10000 ? configuredTimeout : 30000;

const createProviderError = (code, status, message) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const generateCompletion = async ({ messages, tools = [], toolChoice }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    throw createProviderError('AI_NOT_CONFIGURED', 503, 'OpenRouter API key is not configured');
  }

  if (!model) {
    throw createProviderError('AI_NOT_CONFIGURED', 503, 'OpenRouter model is not configured');
  }

  try {
    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      { model, messages, ...(tools.length ? { tools, tool_choice: toolChoice || 'auto' } : {}) },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
          'X-Title': process.env.OPENROUTER_APP_NAME || 'AI Commerce',
        },
      }
    );

    const choice = response.data?.choices?.[0];
    if (!choice?.message || typeof choice.message !== 'object') {
      console.error('[OpenRouter] Invalid response shape', JSON.stringify({ status: response.status, hasChoices: Array.isArray(response.data?.choices), choiceKeys: choice ? Object.keys(choice) : [] }));
      throw createProviderError('AI_INVALID_RESPONSE', 502, 'OpenRouter returned an invalid response');
    }

    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw createProviderError('AI_TIMEOUT', 504, 'OpenRouter API request timed out');
    }

    if (error.code && error.status) {
      throw error;
    }

    const providerStatus = error.response?.status;
    if (providerStatus === 401) {
      throw createProviderError('AI_AUTH_FAILED', 502, 'OpenRouter authentication failed');
    }
    if (providerStatus === 429) {
      const retryAfter = error.response.headers?.['retry-after'];
      const message = retryAfter ? `OpenRouter rate limit exceeded. Try again in ${retryAfter} seconds.` : 'OpenRouter rate limit exceeded. Please try again shortly.';
      throw createProviderError('AI_RATE_LIMITED', 429, message);
    }
    if (providerStatus >= 400) {
      throw createProviderError('AI_PROVIDER_ERROR', 502, 'OpenRouter could not process the request');
    }
    throw createProviderError('AI_NETWORK_ERROR', 502, 'Unable to reach OpenRouter');
  }
};

module.exports = { generateCompletion };