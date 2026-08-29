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
const normalizeCatalogName = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const getPreviousProductFromContext = (history = [], context = {}) => {
  if (context.currentProduct) return context.currentProduct;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    const candidate = item?.metadata?.products?.[0];
    if (candidate?.id) return candidate;
  }
  return null;
};

const isSpecificProductRequest = (message) => {
  const text = message.toLowerCase();
  if (/\b(this|that)\s+(laptop|phone|headphone|product|item)\b/.test(text)) return true;
  if (/\b(show me|tell me about|how much is|how much does|is .* available|available\?|what is the price|price of|add .* to my cart|buy .*|purchase .*|order .*)\b/.test(text)) return true;
  const tokens = normalizeProductQuery(message).split(/\s+/).filter(Boolean);
  return tokens.length >= 3 && !/\b(hello|hi|hey|thanks|thank you|find products|show me available|show me laptops|show me phones|show me headphones)\b/.test(text);
};

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

const normalizeCurrencyNumber = (value, suffix) => {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(String(value).replace(/[₹?,\s]/g, ''));
  if (!Number.isFinite(numeric)) return null;
  return /k$/i.test(String(suffix || '')) || /k\b/i.test(String(value || '')) ? numeric * 1000 : numeric;
};

const parseBudgetConstraints = (message) => {
  const text = message.trim();
  if (!text) return null;

  const normalized = text.toLowerCase();
  const categoryMap = {
    laptop: 'laptop',
    laptops: 'laptop',
    phone: 'phone',
    phones: 'phone',
    mobile: 'phone',
    mobiles: 'phone',
    headphone: 'headphone',
    headphones: 'headphone',
    earbud: 'headphone',
    earbuds: 'headphone',
    earphone: 'headphone',
    earphones: 'headphone',
    tablet: 'tablet',
    tablets: 'tablet',
    watch: 'watch',
    watches: 'watch',
  };

  const category = Object.keys(categoryMap).find((keyword) => normalized.includes(keyword)) || null;
  const result = {
    category: category ? categoryMap[category] : null,
    minPrice: null,
    maxPrice: null,
    sort: null,
    inStock: /\b(in stock|available|availability)\b/.test(normalized),
  };

  const betweenMatch = text.match(/between\s*[₹?]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k)?\s*(?:and|to)\s*[₹?]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k)?/i);
  if (betweenMatch) {
    result.minPrice = normalizeCurrencyNumber(betweenMatch[1], betweenMatch[2]);
    result.maxPrice = normalizeCurrencyNumber(betweenMatch[3], betweenMatch[4]);
    return result;
  }

  const explicitMin = text.match(/(?:above|over|more than|from|starting at|starting from|priced from)\s*[₹?]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k)?/i);
  const explicitMax = text.match(/(?:under|below|less than|upto|up to|not more than|no more than|within|at most|under budget|budget of)\s*[₹?]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k)?/i);
  const aroundMatch = text.match(/(?:around|approximately|roughly|about)\s*[₹?]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k)?/i);

  if (explicitMin) result.minPrice = normalizeCurrencyNumber(explicitMin[1], explicitMin[2]);
  if (explicitMax) result.maxPrice = normalizeCurrencyNumber(explicitMax[1], explicitMax[2]);

  if (aroundMatch) {
    const aroundPrice = normalizeCurrencyNumber(aroundMatch[1], aroundMatch[2]);
    if (aroundPrice !== null) {
      result.minPrice = aroundPrice * 0.85;
      result.maxPrice = aroundPrice * 1.15;
    }
  }

  if (/\bcheapest\b|\blowest price\b|\blowest priced\b/.test(normalized)) result.sort = 'cheapest';
  if (/\bbest\b|\btop rated\b|\bhighest rated\b|\bmost popular\b/.test(normalized)) result.sort = 'best';

  return result;
};

const formatBudgetText = (result) => {
  if (!result) return 'products';
  const categoryLabel = result.category ? `${result.category}s` : 'products';
  if (result.maxPrice && result.minPrice) {
    return `${categoryLabel} between ₹${Number(result.minPrice).toLocaleString('en-IN')} and ₹${Number(result.maxPrice).toLocaleString('en-IN')}`;
  }
  if (result.maxPrice) {
    return `${categoryLabel} under ₹${Number(result.maxPrice).toLocaleString('en-IN')}`;
  }
  if (result.minPrice) {
    return `${categoryLabel} above ₹${Number(result.minPrice).toLocaleString('en-IN')}`;
  }
  return categoryLabel;
};

const isBudgetSearch = (message) => {
  const lower = message.toLowerCase();
  return /(laptop|phone|phones|mobile|mobiles|headphone|earbuds|earphone|tablet|watch|budget|under|below|between|cheapest|best|around|approximately|roughly)/.test(lower);
};

const resolveSpecificProductRequest = async ({ message, history = [], context }) => {
  const lower = message.toLowerCase();
  const previousProduct = getPreviousProductFromContext(history, context);

  if (/(this|that|it)\b/.test(lower) && previousProduct?.id) {
    const product = await executeTool('getProductDetails', { productId: previousProduct.id }, context);
    return {
      text: `${product.product.name} — ₹${Number(product.product.price).toLocaleString('en-IN')}\nAvailability: ${Number(product.product.stock) > 0 ? `In stock (${product.product.stock} units available)` : 'Currently unavailable'}\n\n${product.product.description || product.product.shortDescription || 'No additional description is available.'}`,
      products: [product.product],
      pendingOrder: null,
    };
  }

  const candidateText = normalizeProductQuery(message).trim();
  if (!candidateText || candidateText.length < 2 || isBudgetSearch(message)) {
    return null;
  }

  const searchResult = await executeTool('searchProducts', { query: candidateText, keywords: candidateText }, context);
  const products = Array.isArray(searchResult?.products) ? searchResult.products : [];
  if (!products.length) {
    return {
      text: `I couldn’t find “${message.trim()}” in the current catalog. Please check the product name or ask for a different item.`,
      products: [],
      pendingOrder: null,
    };
  }

  const normalizedQuery = normalizeCatalogName(candidateText);
  const scoredProducts = products
    .map((product) => {
      const haystack = normalizeCatalogName(`${product.name} ${product.brand || ''} ${product.category || ''}`);
      let score = 0;
      if (normalizeCatalogName(product.name) === normalizedQuery) score = 100;
      else if (haystack.includes(normalizedQuery) || normalizedQuery.includes(haystack)) score = 90;
      else if (haystack.includes(normalizedQuery.split(' ').slice(0, 2).join(' ')) || normalizedQuery.includes(haystack.split(' ').slice(0, 2).join(' '))) score = 70;
      return { product, score };
    })
    .filter((entry) => entry.score >= 70)
    .sort((a, b) => b.score - a.score);

  if (!scoredProducts.length) {
    return {
      text: `I couldn’t find “${message.trim()}” in the current catalog. Please check the product name or ask for a different item.`,
      products: [],
      pendingOrder: null,
    };
  }

  const match = scoredProducts[0].product;
  const product = await executeTool('getProductDetails', { productId: match.id }, context);
  const current = product.product;
  const asksForPrice = /(how much|price|cost|what is the price)/.test(lower);
  const asksForAvailability = /(available|in stock|stock|availability|is .* available)/.test(lower);
  const asksForDetails = /(show me|tell me about|describe|details|what is it)/.test(lower);
  const asksToAdd = /add .* to my cart|add to cart/.test(lower);
  const asksToBuy = /\b(buy|purchase|order)\b/.test(lower);

  if (asksToAdd) {
    const cartResult = await executeTool('addToCart', { productId: current.id, quantity: 1 }, context);
    return {
      text: `${current.name} was added to your cart. Current total: ₹${Number(cartResult.total || 0).toLocaleString('en-IN')}.`,
      products: [current],
      pendingOrder: null,
    };
  }

  if (asksToBuy) {
    const prepared = await executeTool('prepareOrder', { productId: current.id, quantity: 1 }, context);
    context.pendingOrder = prepared;
    if (prepared.state === 'PROFILE_REQUIRED') {
      const missing = prepared.requiredFields || [];
      const askFor = missing[0];
      return {
        text: `I need your ${friendlyFieldLabel(askFor)} to complete this order before checkout.`,
        products: [current],
        pendingOrder: prepared,
      };
    }
    if (prepared.state === 'AWAITING_APPROVAL') {
      const profile = prepared.profile || {};
      const deliveryLine = [profile.fullName, profile.address || [profile.street, profile.building, profile.landmark].filter(Boolean).join(', '), profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state, profile.pincode, profile.phone].filter(Boolean).join('\n');
      return {
        text: `${prepared.product.name} — ${prepared.product.currency || '₹'}${prepared.total || prepared.product.price}\n\nDelivery details:\n${deliveryLine}\n\nDo you want to confirm your order? Yes / No`,
        products: [current],
        pendingOrder: prepared,
      };
    }
  }

  if (asksForPrice) {
    return {
      text: `${current.name} is priced at ₹${Number(current.price).toLocaleString('en-IN')}.`,
      products: [current],
      pendingOrder: null,
    };
  }

  if (asksForAvailability) {
    return {
      text: `${current.name} is ${Number(current.stock) > 0 ? `available in stock (${current.stock} units left)` : 'currently unavailable'}.`,
      products: [current],
      pendingOrder: null,
    };
  }

  const description = current.description || current.shortDescription || 'No additional product description is available.';
  return {
    text: `${current.name}\nPrice: ₹${Number(current.price).toLocaleString('en-IN')}\nAvailability: ${Number(current.stock) > 0 ? `In stock (${current.stock} units available)` : 'Currently unavailable'}\n\n${description}`,
    products: [current],
    pendingOrder: null,
  };
};

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

  const budgetSearch = parseBudgetConstraints(message);
  if (!isBudgetSearch(message) && isSpecificProductRequest(message)) {
    const specificProduct = await resolveSpecificProductRequest({ message, history, context });
    if (specificProduct) {
      return specificProduct;
    }
  }

  if (isBudgetSearch(message)) {
    const searchArgs = {
      query: message,
      keywords: normalizeProductQuery(message),
      category: budgetSearch?.category || undefined,
      minPrice: budgetSearch?.minPrice ?? undefined,
      maxPrice: budgetSearch?.maxPrice ?? undefined,
      inStock: budgetSearch?.inStock ? true : undefined,
    };

    const searchResult = await executeTool('searchProducts', searchArgs, context);
    let products = Array.isArray(searchResult?.products) ? [...searchResult.products] : [];

    if (products.length && (budgetSearch?.sort === 'cheapest' || /cheapest|lowest price/.test(message.toLowerCase()))) {
      products.sort((a, b) => Number(a.price) - Number(b.price));
    }
    if (products.length && (budgetSearch?.sort === 'best' || /best|top rated|highest rated/.test(message.toLowerCase()))) {
      products.sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)) || (Number(a.price) - Number(b.price)));
    }

    if (!products.length) {
      return {
        text: `I couldn’t find any ${formatBudgetText(budgetSearch)} in the current catalog. Try widening the budget or a different product type.`,
        products: [],
        pendingOrder: null,
      };
    }

    const sample = products.slice(0, 5);
    const lines = sample.map((product) => {
      const stockText = Number(product.stock) > 0 ? `Available (${product.stock} in stock)` : 'Out of stock';
      return `• ${product.name} — ₹${Number(product.price).toLocaleString('en-IN')} — ${stockText} — ${product.specifications?.processor || product.specifications?.model || product.category || 'Product'}`;
    });

    return {
      text: `Here are the available ${formatBudgetText(budgetSearch)}:\n${lines.join('\n')}`,
      products: sample,
      pendingOrder: null,
    };
  }

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