const { generateCompletion } = require('../openrouter.provider');
const { SYSTEM_PROMPT } = require('./prompts');
const { tools, executeTool } = require('./tools');

const friendlyFieldLabel = (field) => {
  const labels = {
    fullName: 'full name',
    phone: 'phone number',
    email: 'email address',
    address: 'delivery address',
    street: 'street address',
    city: 'city',
    state: 'state',
    pincode: 'pincode',
  };
  return labels[field] || field;
};

const normalizeProductQuery = (message) => message.replace(/\b(i want to buy|i want|buy|purchase|order|please|the|a|an)\b/gi, ' ').replace(/\s+/g, ' ').trim();

const pickBestProduct = (products, message) => {
  const normalizedMessage = normalizeProductQuery(message).toLowerCase();
  if (!products?.length) return null;
  return products.find((product) => {
    const haystack = `${product.name} ${product.brand || ''} ${product.category || ''}`.toLowerCase();
    return haystack.includes(normalizedMessage) || normalizedMessage.includes(haystack);
  }) || products[0];
};

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
const isOrderRequest = (message) => /\b(buy|proceed|place|confirm|order)\b/.test(message.toLowerCase());

const runAgent = async ({ message, history = [], context }) => {
  const currentProduct = context.currentProduct ? {
    id: context.currentProduct._id.toString(),
    name: context.currentProduct.name,
    brand: context.currentProduct.brand,
    category: context.currentProduct.category,
    price: context.currentProduct.price,
    currency: context.currentProduct.currency,
    description: context.currentProduct.shortDescription || context.currentProduct.description,
    stock: context.currentProduct.stock,
  } : null;

  if (isOrderRequest(message)) {
    const resolvedProduct = currentProduct || (() => {
      const previousProduct = [...history].reverse().find((item) => item.metadata?.products?.length)?.metadata.products[0];
      return previousProduct ? { id: previousProduct.id, name: previousProduct.name } : null;
    })();

    if (!resolvedProduct && message) {
      const searchResult = await executeTool('searchProducts', { query: message, keywords: normalizeProductQuery(message) }, context);
      const matchedProduct = pickBestProduct(searchResult.products, message);
      if (matchedProduct) {
        const prepared = await executeTool('prepareOrder', { productId: matchedProduct.id, quantity: 1 }, context);
        context.pendingOrder = prepared;
        if (prepared.state === 'AWAITING_APPROVAL') {
          const profile = prepared.profile || {};
          const deliveryLine = [profile.fullName, profile.address || [profile.street, profile.building, profile.landmark].filter(Boolean).join(', '), profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state, profile.pincode, profile.phone].filter(Boolean).join('\n');
          return {
            text: `${prepared.product.name} — ${prepared.product.currency || '₹'}${prepared.total || prepared.product.price}\n\nDelivery details:\n${deliveryLine}\n\nDo you want to confirm your order? Yes / No`,
            products: searchResult.products,
            pendingOrder: prepared,
          };
        }
        if (prepared.state === 'PROFILE_REQUIRED') {
          const missing = prepared.requiredFields || [];
          const askFor = missing[0];
          return {
            text: `I need your ${friendlyFieldLabel(askFor)} to complete this order before checkout.`,
            products: searchResult.products,
            pendingOrder: prepared,
          };
        }
      }
    }

    if (resolvedProduct && resolvedProduct.id) {
      const prepared = await executeTool('prepareOrder', { productId: resolvedProduct.id, quantity: 1 }, context);
      context.pendingOrder = prepared;
      if (prepared.state === 'AWAITING_APPROVAL') {
        const profile = prepared.profile || {};
        const deliveryLine = [profile.fullName, profile.address || [profile.street, profile.building, profile.landmark].filter(Boolean).join(', '), profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state, profile.pincode, profile.phone].filter(Boolean).join('\n');
        return {
          text: `${prepared.product.name} — ${prepared.product.currency || '₹'}${prepared.total || prepared.product.price}\n\nDelivery details:\n${deliveryLine}\n\nDo you want to confirm your order? Yes / No`,
          products: [],
          pendingOrder: prepared,
        };
      }
      if (prepared.state === 'PROFILE_REQUIRED') {
        const missing = prepared.requiredFields || [];
        const askFor = missing[0];
        return {
          text: `I need your ${friendlyFieldLabel(askFor)} to complete this order before checkout.`,
          products: [],
          pendingOrder: prepared,
        };
      }
    }
  }

  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}${currentProduct ? `\nThe customer is currently viewing this real catalog product: ${JSON.stringify(currentProduct)}` : ''}` },
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
  if (context.pendingOrder?.state === 'PROFILE_REQUIRED') {
    const profile = await executeTool('getCustomerProfile', {}, context);
    if (profile.profileComplete) {
      const result = await executeTool('prepareOrder', { productId: context.pendingOrder.productId, quantity: context.pendingOrder.quantity || 1 }, context);
      context.pendingOrder = result;
    }
  }
  const previousProduct = [...history].reverse().find((item) => item.metadata?.products?.length)?.metadata.products[0];
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
  if (isOrderRequest(message) && previousProduct?.id && !context.pendingOrder) {
    console.log('[Agent] Preparing order preview from the previous product result');
    const result = await executeTool('prepareOrder', { productId: previousProduct.id, quantity: 1 }, context);
    context.pendingOrder = result;
    messages.push({ role: 'assistant', content: null, tool_calls: [{ id: 'order-context', type: 'function', function: { name: 'prepareOrder', arguments: JSON.stringify({ productId: previousProduct.id, quantity: 1 }) } }] });
    messages.push({ role: 'tool', tool_call_id: 'order-context', name: 'prepareOrder', content: JSON.stringify(result) });
    preExecutedTool = true;
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
    if (!assistant || typeof assistant !== 'object') throw Object.assign(new Error('OpenRouter returned an invalid response'), { code: 'AI_INVALID_RESPONSE', status: 502 });
    messages.push(assistant);
    if (!assistant.tool_calls?.length) {
      console.log('[Agent] Sending final response');
      return { text: assistant.content || 'I could not find an answer for that request.', products, pendingOrder: context.pendingOrder };
    }
    for (const call of assistant.tool_calls) {
      console.log(`[Agent] Tool requested: ${call.function.name}`);
      let result;
      try {
        console.log(`[Agent] Executing ${call.function.name}`);
        result = await executeTool(call.function.name, JSON.parse(call.function.arguments || '{}'), context);
        if (call.function.name === 'updateCustomerProfile' && context.pendingOrder?.productId) {
          result.orderPreview = await executeTool('prepareOrder', { productId: context.pendingOrder.productId, quantity: context.pendingOrder.quantity || 1 }, context);
          context.pendingOrder = result.orderPreview;
        }
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