const { generateCompletion } = require('../openrouter.provider');
const { SYSTEM_PROMPT } = require('./prompts');
const { tools, executeTool } = require('./tools');

const runAgent = async ({ message, history = [], context }) => {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history.map((item) => ({ role: item.role === 'AGENT' ? 'assistant' : 'user', content: item.content })), { role: 'user', content: message }];
  const products = [];
  for (let turn = 0; turn < 6; turn += 1) {
    const response = await generateCompletion({ messages, tools });
    const assistant = response.choices?.[0]?.message;
    if (!assistant) throw Object.assign(new Error('OpenRouter returned an invalid response'), { code: 'AI_INVALID_RESPONSE', status: 502 });
    messages.push(assistant);
    if (!assistant.tool_calls?.length) return { text: assistant.content || 'I could not find an answer for that request.', products };
    for (const call of assistant.tool_calls) {
      let result;
      try { result = await executeTool(call.function.name, JSON.parse(call.function.arguments || '{}'), context); }
      catch (error) { result = { error: error.message }; }
      if (result.products) products.push(...result.products);
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result) });
    }
  }
  throw Object.assign(new Error('Agent reached its tool-call limit'), { code: 'AI_TOOL_LIMIT', status: 502 });
};

module.exports = { runAgent };