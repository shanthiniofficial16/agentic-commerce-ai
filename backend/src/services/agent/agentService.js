const Product = require('../../models/Product');
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
const getProductId = (product) => product?._id ? product._id.toString() : product?.id || null;
const isPendingOrder = (order) => ['AWAITING_APPROVAL', 'PENDING_CONFIRMATION'].includes(order?.state);

const getPreviousProductFromContext = (history = [], context = {}) => {
  if (context.currentProduct) return context.currentProduct;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    const candidate = item?.metadata?.products?.[0];
    if (candidate?.id) return candidate;
  }
  return null;
};

const resolveReferencedProduct = async ({ message, history = [], context }) => {
  const lower = message.toLowerCase();
  const previous = getPreviousProductFromContext(history, context);
  if (previous?.id || previous?._id) return previous;

  const ordinalMatch = lower.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+one\b/);
  if (ordinalMatch) {
    const order = ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
    const index = order.indexOf(ordinalMatch[1].toLowerCase());
    const items = [...history].flatMap((item) => (Array.isArray(item?.metadata?.products) ? item.metadata.products : []));
    const target = items[index] || items[items.length - 1];
    if (target?.id || target?._id) return target;
  }

  const searchText = normalizeProductQuery(message)
    .replace(/\b(this|that|it|the|previous product|product|one)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!searchText) return null;

  const search = await executeTool('searchProducts', { query: searchText, keywords: searchText }, context);
  const candidates = Array.isArray(search?.products) ? search.products : [];
  return candidates[0] || null;
};

const isSpecificProductRequest = (message) => {
  const text = message.toLowerCase();
  const referencePattern = /\b(it|this|that|the first one|the second one|the third one|the fourth one|the fifth one|first one|second one|third one|fourth one|fifth one|the last one|last one|previous product|the previous product)\b/.test(text) || /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+one\b/.test(text);
  if (referencePattern) return true;
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

const isPurchaseIntent = (message) => {
  const text = message.toLowerCase();
  return /(i want to buy|i want this|i want to purchase|buy this|purchase this|buy the|purchase the|place an order for this|place an order for that|proceed with this|proceed with that|proceed with this product|proceed with that product|buy it|purchase it)/.test(text)
    || /^(buy|purchase|place an order|proceed|i want this|i want to buy|i want to purchase)\b/.test(text)
    || /\b(buy|purchase|order|place|proceed)\b.*\b(this|that|it|product)\b/.test(text);
};

const isOrderRequest = (message) => isPurchaseIntent(message) || /\b(buy|proceed|place|confirm|order|purchase)\b/.test(message.toLowerCase());
const isOrderHistoryRequest = (message) => /\b(my orders|recent orders|what did i order|has my order been placed|where is my order|order status|when will i receive|when will .* arrive|expected delivery|delivery date)\b/i.test(message);
const formatOrderHistory = (orders, message) => {
  if (!orders.length) return { text: 'I could not find any orders in your account.', products: [], pendingOrder: null };
  const normalizedMessage = message.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const matchingOrders = orders.filter((order) => order.items?.some((item) => normalizedMessage.includes(String(item.productName || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())));
  const requested = /\b(when|where|status|delivery|arrive|receive|placed)\b/i.test(message) && matchingOrders.length ? matchingOrders : orders;
  const selected = requested.length ? requested.slice(0, 1) : orders;
  const lines = selected.slice(0, 5).map((order) => {
    const item = order.items?.[0];
    const delivery = order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleDateString('en-US', { dateStyle: 'long' }) : 'not available';
    return `${item?.productName || 'Order'} — ₹${Number(order.total || 0).toLocaleString('en-IN')}\nStatus: ${order.status}\nExpected delivery: ${delivery}`;
  });
  return { text: selected.length === 1 && /\b(when|where|status|delivery|arrive|receive)\b/i.test(message) ? `Your ${lines[0].split(' — ')[0]} is currently marked as ${selected[0].status}.\n\nYour expected delivery date is ${selected[0].estimatedDeliveryDate ? new Date(selected[0].estimatedDeliveryDate).toLocaleDateString('en-US', { dateStyle: 'long' }) : 'not available'}.` : `Here are your recent orders:\n\n${lines.join('\n\n')}`, products: [], pendingOrder: null, viewOrderPath: '/shop/deals' };
};

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
  const categoryPatterns = [
    { value: 'laptop', regex: /\blaptops?\b/ },
    { value: 'phone', regex: /\bphones?\b|\bmobile(s)?\b/ },
    { value: 'headphone', regex: /\bheadphones?\b|\bearbuds?\b|\bearphones?\b/ },
    { value: 'tablet', regex: /\btablets?\b/ },
    { value: 'watch', regex: /\bwatches?\b/ },
  ];

  const category = categoryPatterns.find(({ regex }) => regex.test(normalized))?.value || null;
  const result = {
    category,
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
  const hasPriceSignal = /(budget|under|below|between|less than|up to|at most|above|over|from|starting at|around|approximately|roughly|cheapest|best|top rated|highest rated|low price|lowest price)/.test(lower);
  const hasCategorySignal = /(laptop|phone|phones|mobile|mobiles|headphone|earbuds|earphone|tablet|watch)/.test(lower);
  return hasPriceSignal && hasCategorySignal;
};

const isComplementaryRequest = (message) => {
  const lower = message.toLowerCase();
  return /\b(suggest|recommend|matching|match|complement|accessories|go well with|goes well with|for this product|for this laptop|for this phone|for this saree)\b/.test(lower) || /\b(accessory|accessories|ring|rings|bracelet|bracelets|earring|earrings|mouse|bag|headphones)\b/.test(lower);
};

const stripComplementaryClauses = (message) => {
  let cleaned = message;
  cleaned = cleaned.replace(/\b(?:and)\b\s*(?:.*?\b(?:recommend|suggest|matching|match|complement|accessory|accessories|jewellery|jewelry|mouse|bag|headphone|headphones|bracelet|bracelets|ring|rings|earring|earrings)\b.*$)/i, '');
  cleaned = cleaned.replace(/\b(?:recommend|suggest|matching|match|complement|accessory|accessories|jewellery|jewelry|mouse|bag|headphone|headphones|bracelet|bracelets|ring|rings|earring|earrings|what accessories do i need|some accessories)\b.*$/gi, '');
  return cleaned.replace(/\s+/g, ' ').trim();
};

const findUpsellAlternative = async ({ product, context }) => {
  if (!product) return null;
  try {
    const upsell = await Product.findOne({
      merchantId: context.merchantId,
      active: true,
      category: product.category,
      subcategory: product.subcategory,
      price: { $gt: product.price, $lte: product.price * 1.5 },
      stock: { $gt: 0 },
      _id: { $ne: product._id },
    }).sort({ price: 1 }).lean();
    return upsell || null;
  } catch (error) {
    console.error('[Upsell] Error finding alternative:', error.message);
    return null;
  }
};

const findAndRecommendUpsell = async ({ product, context }) => {
  if (!product) return null;
  const upsell = await findUpsellAlternative({ product, context });
  if (!upsell) return null;
  const incrementalRevenue = upsell.price - product.price;
  return {
    text: `I found a higher-spec option that may be a better fit:\n\n${upsell.name}\n₹${Number(upsell.price).toLocaleString('en-IN')}\n\nYour current selection:\n${product.name}\n₹${Number(product.price).toLocaleString('en-IN')}\n\nUpgrade difference:\n₹${Number(incrementalRevenue).toLocaleString('en-IN')}\n\nWould you like to upgrade to the ${upsell.name}?`,
    products: [{
      id: upsell._id.toString(),
      name: upsell.name,
      price: upsell.price,
      stock: upsell.stock,
      category: upsell.category,
      brand: upsell.brand,
      subcategory: upsell.subcategory,
      description: upsell.shortDescription || upsell.description,
    }],
    pendingUpsell: {
      originalProductId: product._id.toString(),
      originalPrice: product.price,
      upsellProductId: upsell._id.toString(),
      upsellPrice: upsell.price,
      incrementalRevenue,
    },
  };
};

const extractRequestedAccessoryTerms = (message) => {
  const text = message.toLowerCase();
  const terms = Array.from(new Set((text.match(/\b(mouse|bag|headphone|headphones|earphone|earphones|ring|rings|bracelet|bracelets|earring|earrings|charger|case|keyboard|hub|speaker|travel|accessory|accessories)\b/g) || []).map((term) => term.replace(/s$/, ''))));
  return terms;
};

const getDesiredAccessoryKeywords = (mainProduct) => {
  const text = `${mainProduct.name || ''} ${mainProduct.category || ''} ${mainProduct.subcategory || ''} ${(mainProduct.tags || []).join(' ')}`.toLowerCase();
  if (/laptop|notebook|ultrabook/.test(text)) return ['mouse', 'bag', 'keyboard', 'hub', 'travel', 'desk', 'accessory'];
  if (/phone|mobile/.test(text)) return ['headphone', 'earphone', 'speaker', 'charger', 'case', 'accessory'];
  if (/saree|dress|jewelry|ring|bracelet|earring/.test(text)) return ['ring', 'bracelet', 'earring', 'jewelry', 'accessory'];
  if (/headphone|earphone|speaker|audio/.test(text)) return ['headphone', 'earphone', 'speaker', 'case', 'charger', 'accessory'];
  return ['accessory', 'mouse', 'bag', 'headphone', 'ring', 'bracelet', 'earring', 'case', 'charger'];
};

const resolveComplementaryProducts = async ({ message, history = [], context }) => {
  const previousProduct = getPreviousProductFromContext(history, context);
  let mainProduct = previousProduct || context.currentProduct || null;

  if (!mainProduct && /\b(laptop|phone|saree|headphone|mouse|bag)\b/i.test(message)) {
    const query = message.toLowerCase();
    const searchText = query.replace(/\b(i bought|i have|i want to buy|suggest|recommend|matching|for this|product|accessories|this|that|buy|purchase|please)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (searchText && !/^(product|accessory|accessories)$/i.test(searchText)) {
      const searchResult = await executeTool('searchProducts', { query: searchText, keywords: searchText }, context);
      const product = Array.isArray(searchResult?.products) ? searchResult.products[0] : null;
      if (product) mainProduct = product;
    }
  }

  if (!mainProduct) {
    return null;
  }

  const productDetails = await executeTool('getProductDetails', { productId: mainProduct.id || mainProduct._id?.toString?.() || mainProduct._id }, context);
  const main = productDetails.product;
  const requestedTerms = extractRequestedAccessoryTerms(message);
  const desiredKeywords = getDesiredAccessoryKeywords(main);

  const keywordPatterns = desiredKeywords.map((keyword) => new RegExp(keyword, 'i'));
  const query = {
    merchantId: context.merchantId,
    active: true,
    _id: { $ne: main._id },
    $and: [
      {
        $or: [
          { category: 'Accessories' },
          { category: 'Electronics', subcategory: /audio/i },
          { subcategory: /bag|desk|travel|audio/i },
          { name: /mouse|bag|keyboard|hub|headphone|earphone|speaker|case|charger|ring|bracelet|earring|accessory/i },
        ]
      }
    ]
  };

  const candidates = await Product.find(query).limit(20).lean();
  const scored = candidates
    .map((product) => {
      const haystack = `${product.name || ''} ${product.category || ''} ${product.subcategory || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      if (product.category === 'Accessories') score += 20;
      if (product.category === 'Electronics' && /headphone|earphone|speaker|charger|case/i.test(product.name || '')) score += 20;
      if (desiredKeywords.some((keyword) => haystack.includes(keyword))) score += 35;
      if (requestedTerms.some((term) => haystack.includes(term))) score += 25;
      if ((product.tags || []).some((tag) => desiredKeywords.includes(tag.toLowerCase()))) score += 10;
      if (/mouse|bag|keyboard|hub|headphone|earphone|speaker|charger|case|ring|bracelet|earring/.test(product.name || '')) score += 10;
      return { product, score };
    })
    .filter((entry) => entry.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!scored.length) {
    const upsell = await Product.findOne({
      merchantId: context.merchantId,
      active: true,
      category: main.category,
      price: { $gt: main.price, $lte: main.price * 1.5 },
      stock: { $gt: 0 },
      _id: { $ne: main._id },
    }).sort({ price: 1 }).lean();
    if (upsell) {
      return {
        text: `I also found a higher-value ${main.category.toLowerCase()} option: ${upsell.name} — ₹${Number(upsell.price).toLocaleString('en-IN')}\nWould you like to consider this upgrade?`,
        products: [{
          id: upsell._id.toString(), name: upsell.name, price: upsell.price, stock: upsell.stock,
          category: upsell.category, brand: upsell.brand, subcategory: upsell.subcategory,
          description: upsell.shortDescription || upsell.description,
        }],
        pendingOrder: null,
        pendingRecommendation: { productId: upsell._id.toString(), productName: upsell.name },
      };
    }
    return {
      text: `I couldn’t find any complementary products in the current catalog for ${main.name}.`,
      products: [],
      pendingOrder: null,
    };
  }

  const selected = scored.map((entry) => entry.product).filter((product) => product && product.name).slice(0, 3);
  const lines = selected.map((product) => `• ${product.name} — ₹${Number(product.price).toLocaleString('en-IN')} — ${Number(product.stock) > 0 ? `Available (${product.stock} in stock)` : 'Currently unavailable'}`);

  return {
    text: `Since you're considering ${main.name}, I found these relevant accessories:\n${lines.join('\n')}\n\nWould you like to add one of these to your cart?`,
    products: selected.map((product) => ({
      id: product._id.toString(),
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      brand: product.brand,
      subcategory: product.subcategory,
      description: product.shortDescription || product.description,
    })),
    pendingOrder: null,
    pendingRecommendation: { productId: selected[0]._id.toString(), productName: selected[0].name, type: 'CROSS_SELL' },
  };
};

const resolveSpecificProductRequest = async ({ message, history = [], context }) => {
  const lower = message.toLowerCase();
  const previousProduct = getPreviousProductFromContext(history, context);
  const referencedProduct = await resolveReferencedProduct({ message, history, context });

  if ((/(this|that|it|the first one|the second one|the third one|the fourth one|the fifth one|first one|second one|third one|fourth one|fifth one|last one|previous product)/.test(lower) || /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/.test(lower)) && (referencedProduct?._id || referencedProduct?.id)) {
    const product = await executeTool('getProductDetails', { productId: referencedProduct._id ? referencedProduct._id.toString() : referencedProduct.id }, context);
    return {
      text: `${product.product.name} — ₹${Number(product.product.price).toLocaleString('en-IN')}\nAvailability: ${Number(product.product.stock) > 0 ? `In stock (${product.product.stock} units available)` : 'Currently unavailable'}\n\n${product.product.description || product.product.shortDescription || 'No additional description is available.'}`,
      products: [product.product],
      pendingOrder: null,
      selectedProductId: getProductId(product.product),
    };
  }

  if (/(this|that|it)\b/.test(lower) && previousProduct?.id) {
    const product = await executeTool('getProductDetails', { productId: previousProduct.id }, context);
    return {
      text: `${product.product.name} — ₹${Number(product.product.price).toLocaleString('en-IN')}\nAvailability: ${Number(product.product.stock) > 0 ? `In stock (${product.product.stock} units available)` : 'Currently unavailable'}\n\n${product.product.description || product.product.shortDescription || 'No additional description is available.'}`,
      products: [product.product],
      pendingOrder: null,
      selectedProductId: getProductId(product.product),
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
    const upsellResult = await findAndRecommendUpsell({ product: current, context });
    
    if (upsellResult) {
      return {
        text: `${current.name} was added to your cart. Current total: ₹${Number(cartResult.total || 0).toLocaleString('en-IN')}.\n\n${upsellResult.text}`,
        products: [current, ...upsellResult.products],
        pendingOrder: null,
        pendingUpsell: upsellResult.pendingUpsell,
        selectedProductId: getProductId(current),
      };
    }
    
    return {
      text: `${current.name} was added to your cart. Current total: ₹${Number(cartResult.total || 0).toLocaleString('en-IN')}.`,
      products: [current],
      pendingOrder: null,
      selectedProductId: getProductId(current),
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
        selectedProductId: getProductId(current),
      };
    }
    if (isPendingOrder(prepared)) {
      const profile = prepared.profile || {};
      const deliveryLine = [profile.fullName, profile.address || [profile.street, profile.building, profile.landmark].filter(Boolean).join(', '), profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state, profile.pincode, profile.phone].filter(Boolean).join('\n');
      return {
        text: `${prepared.product.name} — ${prepared.product.currency || '₹'}${prepared.total || prepared.product.price}\n\nDelivery details:\n${deliveryLine}\n\nDo you want to confirm your order? Yes / No`,
        products: [current],
        pendingOrder: prepared,
        selectedProductId: getProductId(current),
      };
    }
  }

  if (asksForPrice) {
    return {
      text: `${current.name} is priced at ₹${Number(current.price).toLocaleString('en-IN')}.`,
      products: [current],
      pendingOrder: null,
      selectedProductId: getProductId(current),
    };
  }

  if (asksForAvailability) {
    return {
      text: `${current.name} is ${Number(current.stock) > 0 ? `available in stock (${current.stock} units left)` : 'currently unavailable'}.`,
      products: [current],
      pendingOrder: null,
      selectedProductId: getProductId(current),
    };
  }

  const description = current.description || current.shortDescription || 'No additional product description is available.';
  return {
    text: `${current.name}\nPrice: ₹${Number(current.price).toLocaleString('en-IN')}\nAvailability: ${Number(current.stock) > 0 ? `In stock (${current.stock} units available)` : 'Currently unavailable'}\n\n${description}`,
    products: [current],
    pendingOrder: null,
    selectedProductId: getProductId(current),
  };
};

const resolveCombinedShoppingIntent = async ({ message, history = [], context }) => {
  if (!isComplementaryRequest(message)) return null;

  const cleanedMessage = stripComplementaryClauses(message);
  if (!cleanedMessage || cleanedMessage.length < 2) return null;

  const budgetSearch = parseBudgetConstraints(cleanedMessage);
  const queryText = normalizeProductQuery(cleanedMessage) || cleanedMessage;
  const searchArgs = {
    query: queryText,
    keywords: queryText,
    ...(budgetSearch?.category ? { category: budgetSearch.category } : {}),
    ...(budgetSearch?.minPrice !== null && budgetSearch?.minPrice !== undefined ? { minPrice: budgetSearch.minPrice } : {}),
    ...(budgetSearch?.maxPrice !== null && budgetSearch?.maxPrice !== undefined ? { maxPrice: budgetSearch.maxPrice } : {}),
    ...(budgetSearch?.inStock ? { inStock: true } : {}),
  };

  const searchResult = await executeTool('searchProducts', searchArgs, context);
  let products = Array.isArray(searchResult?.products) ? [...searchResult.products] : [];

  if (!products.length) {
    const previousProduct = getPreviousProductFromContext(history, context);
    if (previousProduct?.id) {
      const productResult = await executeTool('getProductDetails', { productId: previousProduct.id }, context);
      products = productResult?.product ? [productResult.product] : [];
    }
  }

  if (!products.length) return null;

  const mainProduct = products[0];
  const complementary = await resolveComplementaryProducts({
    message,
    history,
    context: { ...context, currentProduct: mainProduct },
  });

  const primaryLines = products.slice(0, 5).map((product) => {
    const stockText = Number(product.stock) > 0 ? `Available (${product.stock} in stock)` : 'Out of stock';
    return `• ${product.name} — ₹${Number(product.price).toLocaleString('en-IN')} — ${stockText}`;
  });

  const primaryText = budgetSearch
    ? `Here are the available ${formatBudgetText(budgetSearch)}:\n${primaryLines.join('\n')}`
    : `I found a matching product:\n${primaryLines.join('\n')}`;

  const text = complementary?.products?.length
    ? `${primaryText}\n\n${complementary.text}`
    : primaryText;

  return {
    text,
    products: [...products.slice(0, 5), ...(complementary?.products || [])],
    pendingOrder: complementary?.pendingOrder || null,
    pendingRecommendation: complementary?.pendingRecommendation || null,
    selectedProductId: getProductId(mainProduct),
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

  const combinedIntent = await resolveCombinedShoppingIntent({ message, history, context });
  if (combinedIntent) {
    return combinedIntent;
  }

  const budgetSearch = parseBudgetConstraints(message);
  if (isComplementaryRequest(message)) {
    const complementary = await resolveComplementaryProducts({ message, history, context });
    if (complementary) {
      return complementary;
    }
  }

  if (isOrderHistoryRequest(message)) {
    const historyResult = await executeTool('getMyOrders', {}, context);
    return formatOrderHistory(historyResult.orders || [], message);
  }

  if (isPurchaseIntent(message)) {
    if (/\b(it|cart|everything|all)\b/i.test(message)) {
      const cart = await executeTool('getCart', {}, context);
      if (cart?.cart?.items?.length) {
        const prepared = await executeTool('prepareCartOrder', {}, context);
        if (prepared.state === 'PROFILE_REQUIRED') {
          return { text: `I need your ${friendlyFieldLabel(prepared.requiredFields?.[0])} to complete this order before checkout.`, products: [], pendingOrder: prepared };
        }
        const lines = prepared.items.map((item) => `${item.name}: ₹${Number(item.price).toLocaleString('en-IN')} × ${item.quantity}`);
        return {
          text: `${lines.join('\n')}\nTotal: ₹${Number(prepared.total).toLocaleString('en-IN')}\n\nDo you want to confirm your order? Yes / No`,
          products: [],
          pendingOrder: prepared,
          selectedProductId: prepared.items[0].productId,
        };
      }
    }
    const purchaseTarget = currentProduct || await resolveReferencedProduct({ message, history, context }) || (() => {
      const previousProduct = [...history].reverse().find((item) => item.metadata?.products?.length)?.metadata.products[0];
      return previousProduct ? { id: previousProduct.id, _id: previousProduct.id, name: previousProduct.name } : null;
    })();

    if (purchaseTarget) {
      const productId = purchaseTarget.id || purchaseTarget._id?.toString?.() || purchaseTarget._id;
      if (productId) {
        const product = await executeTool('getProductDetails', { productId }, context);
        const prepared = await executeTool('prepareOrder', { productId, quantity: 1 }, context);
        context.pendingOrder = prepared;

        if (prepared.state === 'PROFILE_REQUIRED') {
          const missing = prepared.requiredFields || [];
          const askFor = missing[0];
          return {
            text: `I need your ${friendlyFieldLabel(askFor)} to complete this order before checkout.`,
            products: [product.product],
            pendingOrder: prepared,
            selectedProductId: getProductId(product.product),
          };
        }

        if (isPendingOrder(prepared)) {
          const profile = prepared.profile || {};
          const deliveryLine = [profile.fullName, profile.address || [profile.street, profile.building, profile.landmark].filter(Boolean).join(', '), profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state, profile.pincode, profile.phone].filter(Boolean).join('\n');

          return {
            text: `${product.product.name}\nPrice: ₹${Number(product.product.price).toLocaleString('en-IN')}\nDelivery to: ${deliveryLine}\n\nDo you want to confirm your order? Yes / No`,
            products: [product.product],
            pendingOrder: prepared,
            selectedProductId: getProductId(product.product),
          };
        }
      }
    }
  }

  if (!isBudgetSearch(message) && isSpecificProductRequest(message)) {
    const specificProduct = await resolveSpecificProductRequest({ message, history, context });
    if (specificProduct) {
      return specificProduct;
    }
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
        if (isPendingOrder(prepared)) {
          const profile = prepared.profile || {};
          const deliveryLine = [profile.fullName, profile.address || [profile.street, profile.building, profile.landmark].filter(Boolean).join(', '), profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state, profile.pincode, profile.phone].filter(Boolean).join('\n');
          return {
            text: `${prepared.product.name} — ${prepared.product.currency || '₹'}${prepared.total || prepared.product.price}\n\nDelivery details:\n${deliveryLine}\n\nDo you want to confirm your order? Yes / No`,
            products: searchResult.products,
            pendingOrder: prepared,
            selectedProductId: getProductId(matchedProduct),
          };
        }
        if (prepared.state === 'PROFILE_REQUIRED') {
          const missing = prepared.requiredFields || [];
          const askFor = missing[0];
          return {
            text: `I need your ${friendlyFieldLabel(askFor)} to complete this order before checkout.`,
            products: searchResult.products,
            pendingOrder: prepared,
            selectedProductId: getProductId(matchedProduct),
          };
        }
      }
    }

    if (resolvedProduct && resolvedProduct.id) {
      const prepared = await executeTool('prepareOrder', { productId: resolvedProduct.id, quantity: 1 }, context);
      context.pendingOrder = prepared;
      if (isPendingOrder(prepared)) {
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
        if (isPendingOrder(prepared)) {
          const profile = prepared.profile || {};
          const deliveryLine = [profile.fullName, profile.address || [profile.street, profile.building, profile.landmark].filter(Boolean).join(', '), profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state, profile.pincode, profile.phone].filter(Boolean).join('\n');
          return {
            text: `${prepared.product.name} — ${prepared.product.currency || '₹'}${prepared.total || prepared.product.price}\n\nDelivery details:\n${deliveryLine}\n\nDo you want to confirm your order? Yes / No`,
            products: searchResult.products,
            pendingOrder: prepared,
            selectedProductId: getProductId(matchedProduct),
          };
        }
        if (prepared.state === 'PROFILE_REQUIRED') {
          const missing = prepared.requiredFields || [];
          const askFor = missing[0];
          return {
            text: `I need your ${friendlyFieldLabel(askFor)} to complete this order before checkout.`,
            products: searchResult.products,
            pendingOrder: prepared,
            selectedProductId: getProductId(matchedProduct),
          };
        }
      }
    }

    if (resolvedProduct && resolvedProduct.id) {
      const prepared = await executeTool('prepareOrder', { productId: resolvedProduct.id, quantity: 1 }, context);
      context.pendingOrder = prepared;
      if (isPendingOrder(prepared)) {
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
      return { text: assistant.content || 'I could not find an answer for that request.', products, pendingOrder: context.pendingOrder, selectedProductId: getProductId(previousProduct || currentProduct || context.currentProduct) };
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

module.exports = {
  runAgent,
  parseBudgetConstraints,
  isBudgetSearch,
  formatBudgetText,
  isPurchaseIntent,
  isOrderRequest,
  findUpsellAlternative,
  findAndRecommendUpsell,
};