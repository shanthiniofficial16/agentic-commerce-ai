const { GoogleGenAI } = require('@google/genai');

const configuredTimeout = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);
const GEMINI_REQUEST_TIMEOUT_MS = configuredTimeout >= 10000 ? configuredTimeout : 30000;

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const error = new Error('GEMINI_API_KEY is not configured');
    error.code = 'AI_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: GEMINI_REQUEST_TIMEOUT_MS,
      retryOptions: { maxRetries: 0 },
    },
  });
};

const generateAgentReply = async ({ message, history = [], products = [] }) => {
  const client = getClient();
  const model = process.env.AI_MODEL || 'gemini-3.6-flash';
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), GEMINI_REQUEST_TIMEOUT_MS);
  const catalog = products.map((product) => ({
    id: product._id.toString(),
    name: product.name,
    category: product.category,
    price: product.price,
    currency: product.currency,
    description: product.shortDescription || product.description,
    stock: product.stock,
  }));

  const contents = [
    ...history.map((item) => ({
      role: item.role === 'AGENT' ? 'model' : 'user',
      parts: [{ text: item.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  let response;
  try {
    response = await client.models.generateContent({
      model,
      contents,
      config: {
        abortSignal: abortController.signal,
        systemInstruction: [
          'You are the commerce assistant for this marketplace.',
          'Answer using only the supplied product catalog when making product claims.',
          'Be concise, helpful, and never invent availability, prices, policies, or order actions.',
          `Product catalog JSON: ${JSON.stringify(catalog)}`,
        ].join('\n'),
      },
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      const timeoutError = new Error('Gemini API request timed out');
      timeoutError.code = 'AI_TIMEOUT';
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = response.text;
  if (!text) {
    const error = new Error('Gemini returned an empty response');
    error.code = 'AI_EMPTY_RESPONSE';
    error.status = 502;
    throw error;
  }

  return text;
};

module.exports = { generateAgentReply };