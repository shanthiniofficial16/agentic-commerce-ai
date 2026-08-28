require('dotenv').config();

const axios = require('axios');

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL;
const configuredTimeout = Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS);
const timeout = configuredTimeout >= 10000 ? configuredTimeout : 30000;

if (!apiKey || apiKey === 'your_openrouter_api_key_here' || !model || model === 'your_openrouter_model_here') {
  console.error(JSON.stringify({ ok: false, error: 'OpenRouter configuration is incomplete' }));
  process.exit(1);
}

axios.post(
  'https://openrouter.ai/api/v1/chat/completions',
  {
    model,
    messages: [{ role: 'user', content: 'Reply with exactly: OpenRouter connection successful.' }],
  },
  {
    timeout,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'AI Commerce',
    },
  }
)
  .then((response) => {
    const text = response.data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('OpenRouter returned an invalid response');
    }
    console.log(JSON.stringify({ ok: true, model, response: text.trim() }));
  })
  .catch((error) => {
    const message = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      ? 'OpenRouter API request timed out'
      : error.response?.status === 401
        ? 'OpenRouter authentication failed'
        : error.response?.status === 429
          ? 'OpenRouter rate limit exceeded'
          : error.response?.status >= 400
            ? 'OpenRouter rejected the request'
            : 'Unable to reach OpenRouter';
    console.error(JSON.stringify({ ok: false, model, status: error.response?.status || null, error: message }));
    process.exitCode = 1;
  });