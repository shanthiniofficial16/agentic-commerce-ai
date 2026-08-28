const { generateCompletion } = require('../openrouter.provider');
const { SYSTEM_PROMPT } = require('./prompts');
const { tools, executeTool } = require('./tools');

const requiredToolFor = (message) => {
  const text = message.toLowerCase();
  if (/\b(in stock|stock|available|availability)\b/.test(text)) return 'checkInventory';
  if (/\b(show|view|what.*in)\b.*\bcart\b|\bmy cart\b/.test(text)) return 'getCart';
  if (/\b(add|put)\b.*\bcart\b/.test(text)) return 'addToCart';
  if (/\b(remove|delete)\b.*\bcart\b/.test(text)) return 'removeFromCart';
  if (/\b(update|change|set)\b.*\b(quantity|cart)\b/.test(text)) return 'updateCart';
  if (/\b(my orders|show orders|recent orders)\b/.test(text)) return 'getMyOrders';
  if (/\b(track|where.*order|order status)\b/.test(text)) return 'trackOrder';
  return null;
};

const runAgent = async ({ message, history = [], context }) => {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((item) => ({
      role: item.role === 'AGENT' ? 'assistant' : 'user',
      content: item.metadata?.products?.length
        ? `${item.content}\nPreviously returned products: ${JSON.stringify(item.metadata.products)}`
        : item.content,
    })),
    { role: 'user', content: message },
  ];
  const products = [];
  const requiredTool = requiredToolFor(message);
  let preExecutedTool = false;
  if (requiredTool === 'checkInventory') {
    const previousProduct = [...history].reverse().find((item) => item.metadata?.products?.length)?.metadata.products[0];
    if (previousProduct?.id) {
      console.log('[Agent] Resolving inventory from the previous product result');
      const result = await executeTool('checkInventory', { productId: previousProduct.id }, context);
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'inventory-context', type: 'function', function: { name: 'checkInventory', arguments: JSON.stringify({ productId: previousProduct.id }) } }],
      });
      messages.push({ role: 'tool', tool_call_id: 'inventory-context', name: 'checkInventory', content: JSON.stringify(result) });
      preExecutedTool = true;
    }
  }
  console.log('[Agent] User message received');
  for (let turn = 0; turn < 6; turn += 1) {
    console.log('[Agent] Calling OpenRouter');
    const response = await generateCompletion({
      messages,
      tools,
      ...(turn === 0 && requiredTool && !preExecutedTool ? { toolChoice: { type: 'function', function: { name: requiredTool } } } : {}),
    });
    console.log('[Agent] OpenRouter response received');
    const assistant = response.choices?.[0]?.message;
    if (!assistant) throw Object.assign(new Error('OpenRouter returned an invalid response'), { code: 'AI_INVALID_RESPONSE', status: 502 });
    messages.push(assistant);
    if (!assistant.tool_calls?.length) {
      console.log('[Agent] Sending final response');
      return { text: assistant.content || 'I could not find an answer for that request.', products };
    }
    for (const call of assistant.tool_calls) {
      console.log(`[Agent] Tool requested: ${call.function.name}`);
      let result;
      try {
        console.log(`[Agent] Executing ${call.function.name}`);
        result = await executeTool(call.function.name, JSON.parse(call.function.arguments || '{}'), context);
        if (result.products) console.log(`[Agent] MongoDB returned ${result.products.length} products`);
      }
      catch (error) { result = { error: error.message }; }
      if (result.products) products.push(...result.products);
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result) });
    }
  }
  throw Object.assign(new Error('Agent reached its tool-call limit'), { code: 'AI_TOOL_LIMIT', status: 502 });
};

module.exports = { runAgent };