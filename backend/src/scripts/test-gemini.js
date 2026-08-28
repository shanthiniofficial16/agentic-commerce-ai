require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

const configuredTimeout = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);
const timeoutMs = configuredTimeout >= 10000 ? configuredTimeout : 30000;
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.AI_MODEL || 'gemini-3.6-flash';

if (!apiKey || apiKey === 'your_gemini_api_key_here') {
  console.error('Gemini connectivity test failed: GEMINI_API_KEY is not configured.');
  process.exit(1);
}

const client = new GoogleGenAI({
  apiKey,
  httpOptions: {
    timeout: timeoutMs,
    retryOptions: { maxRetries: 0 },
  },
});
const abortController = new AbortController();
const timeout = setTimeout(() => abortController.abort(), timeoutMs);

client.models.generateContent({
  model,
  contents: 'Reply with exactly: Gemini connection successful.',
  config: { abortSignal: abortController.signal },
})
  .then((response) => {
    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }
    console.log(JSON.stringify({
      ok: true,
      model,
      response: text,
    }));
  })
  .catch((error) => {
    const message = abortController.signal.aborted
      ? 'Gemini API request timed out.'
      : (error.message || 'Gemini API request failed.');
    console.error(JSON.stringify({ ok: false, model, error: message }));
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timeout));