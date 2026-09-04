const normalizeNumber = (value) => Number(value || 0);

const getRealSpecs = (product = {}) => {
  const specs = product.specifications || {};
  const safe = {
    ram: specs.ram || null,
    processor: specs.processor || null,
    generation: specs.generation || null,
    storage: specs.storage || null,
    display: specs.display || null,
    graphics: specs.graphics || specs.graphicsCard || specs.gpu || null,
    operatingSystem: specs.operatingSystem || specs.os || null,
    branding: product.brand || null,
    rating: product.ratings?.average ?? null,
  };
  return safe;
};

const normalizeText = (value = '') => String(value).toLowerCase().trim();
const isExcludedRecommendation = (product = {}) => normalizeText(product.name) === 'pixeldesk air laptop';

const categoryMatches = (product = {}, categoryHint = null) => {
  if (!categoryHint) return true;
  const hint = normalizeText(categoryHint).replace(/s$/, '');
  const productCategory = normalizeText(product.category || '');
  const productSubcategory = normalizeText(product.subcategory || '');
  const productName = normalizeText(product.name || '');
  return productCategory.includes(hint)
    || productSubcategory.includes(hint)
    || productCategory === hint
    || productSubcategory === hint
    || productName.includes(hint)
    || productName.includes(hint.replace(/s$/, ''));
};

const parseRamValue = (value) => {
  if (!value) return 0;
  const match = String(value).match(/(\d+)\s*(?:gb|g)/i);
  return match ? Number(match[1]) : 0;
};

const parseGenValue = (value) => {
  if (!value) return 0;
  const match = String(value).match(/(\d+)(?:st|nd|rd|th)?\s*gen/i);
  return match ? Number(match[1]) : 0;
};

const parseDisplayValue = (value) => {
  if (!value) return 0;
  const match = String(value).match(/(\d+(?:\.\d+)?)\s*(?:inch|\")/i);
  return match ? Number(match[1]) : 0;
};

const parseStorageValue = (value) => {
  if (!value) return 0;
  const match = String(value).match(/(\d+)\s*(tb|gb)/i);
  const amount = match ? Number(match[1]) : 0;
  const unit = (match && match[2] ? match[2].toLowerCase() : 'gb');
  return unit === 'tb' ? amount * 1024 : amount;
};

const rankProducts = ({ products = [], userMessage = '', categoryHint = null }) => {
  const message = String(userMessage || '').toLowerCase();
  const category = categoryHint || (message.includes('laptop') ? 'Laptops' : null);

  const validProducts = (products || []).filter((product) => {
    if (!product || product.active === false) return false;
    if (isExcludedRecommendation(product)) return false;
    if (Number(product.stock || 0) <= 0) return false;
    if (category && !categoryMatches(product, category)) return false;
    return true;
  });

  const maxBudget = (() => {
    const match = message.match(/under\s*₹?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i) || message.match(/budget\s*(?:of)?\s*₹?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i);
    if (match) return Number(String(match[1]).replace(/,/g, ''));
    return null;
  })();

  let ranked = [...validProducts];
  if (maxBudget != null) ranked = ranked.filter((item) => Number(item.price) <= Number(maxBudget));

  ranked = ranked.map((product) => {
    const specs = getRealSpecs(product);
    const ramValue = parseRamValue(specs.ram);
    const genValue = parseGenValue(specs.generation);
    const storageValue = parseStorageValue(specs.storage);
    const displayValue = parseDisplayValue(specs.display);
    const ratingScore = Number(specs.rating || product.ratings?.average || 0) * 25;
    const ramScore = ramValue * 7;
    const generationScore = genValue * 4;
    const storageScore = storageValue * 0.12;
    const displayScore = displayValue * 4;
    const keyFeatureScore = (product.keyFeatures || []).length * 5;
    const pricePenalty = Number(product.price || 0) / 2000;
    const score = ratingScore + ramScore + generationScore + storageScore + displayScore + keyFeatureScore - pricePenalty;
    return { ...product, score };
  });

  const budgetMatch = message.match(/under\s*₹?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i)
    || message.match(/budget\s*(?:of)?\s*₹?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i);
  const hasCheapestIntent = /\bcheapest\b|\blowest price\b|\blowest priced\b/.test(message);
  if (budgetMatch && !hasCheapestIntent) {
    return ranked.sort((a, b) => Number(b.price || 0) - Number(a.price || 0) || b.score - a.score);
  }

  return ranked.sort((a, b) => b.score - a.score);
};

const buildLaptopSummary = (product) => {
  const specs = getRealSpecs(product);
  const detailParts = [
    specs.ram ? `• ${specs.ram} RAM for smoother multitasking` : null,
    specs.generation ? `• ${specs.generation} processor for stronger performance` : null,
    specs.storage ? `• ${specs.storage} storage for faster application loading` : null,
    specs.display ? `• ${specs.display} display for a more comfortable workspace` : null,
    specs.processor ? `• ${specs.processor} for better overall performance` : null,
    specs.graphics ? `• ${specs.graphics} graphics for visual work, media, or gaming` : null,
    specs.operatingSystem ? `• ${specs.operatingSystem} for a familiar, ready-to-use interface` : null,
    ...(Array.isArray(product.keyFeatures) ? product.keyFeatures.map((feature) => `• ${feature}`) : []),
  ].filter(Boolean);

  return [
    `Based on the available laptops, I'd recommend ${product.name} at ₹${Number(product.price).toLocaleString('en-IN')}.`,
    '',
    'Why:',
    ...detailParts,
    '',
    'This is a stronger long-term choice than the lower-priced alternatives.',
    'Would you like this one?',
  ].join('\n');
};

const getLaptopRecommendation = ({ products = [], message = '' }) => {
  const normalizedMessage = String(message || '').toLowerCase();
  const rankedProducts = rankProducts({ products, userMessage: message, categoryHint: 'Laptops' });
  if (!rankedProducts.length) {
    return {
      noMatch: true,
      message: 'I could not find a suitable laptop in the current catalog that matches your request.',
    };
  }

  const recommended = rankedProducts[0];
  const budgetMatch = normalizedMessage.match(/under\s*₹?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i) || normalizedMessage.match(/budget\s*(?:of)?\s*₹?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i);
  if (budgetMatch && Number(recommended.price) > Number(String(budgetMatch[1]).replace(/,/g, ''))) {
    return {
      noMatch: true,
      message: 'I could not find a suitable laptop within your stated budget in the available catalog.',
    };
  }

  return {
    product: recommended,
    summary: buildLaptopSummary(recommended),
  };
};

const RELATIONSHIP_KEYWORDS = {
  laptop: ['laptop', 'bag', 'sleeve', 'mouse', 'keyboard', 'hub', 'stand', 'dock', 'cooling', 'case', 'monitor'],
  phone: ['phone', 'case', 'charger', 'power', 'bank', 'earbud', 'screen', 'protector', 'cable'],
  camera: ['camera', 'bag', 'memory', 'card', 'tripod', 'battery', 'strap', 'lens', 'case'],
  headphones: ['headphone', 'case', 'adapter', 'stand', 'cable', 'earbud', 'audio'],
};

const normalizeTokens = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .map((token) => token.trim())
  .filter(Boolean);

const getProductTokens = (product = {}) => {
  const values = [
    product.name,
    product.category,
    product.subcategory,
    product.brand,
    product.shortDescription,
    product.description,
    ...(Array.isArray(product.tags) ? product.tags : []),
    ...(Array.isArray(product.keyFeatures) ? product.keyFeatures : []),
    ...(product.aiMetadata?.useCases || []),
    ...(product.aiMetadata?.intentTags || []),
    ...(product.aiMetadata?.recommendationReasons || []),
    ...(product.specifications ? Object.values(product.specifications).filter(Boolean) : []),
  ];

  const tokenSet = new Set();
  values.forEach((value) => {
    normalizeTokens(value).forEach((token) => tokenSet.add(token));
  });
  return [...tokenSet];
};

const detectProductFamily = (product = {}) => {
  const text = [product.name, product.category, product.subcategory, ...(product.tags || [])].join(' ').toLowerCase();
  if (/(laptop|notebook|ultrabook)/i.test(text)) return 'laptop';
  if (/(phone|smartphone|mobile)/i.test(text)) return 'phone';
  if (/(camera|dslr|mirrorless)/i.test(text)) return 'camera';
  if (/(headphone|earphone|earbuds|audio)/i.test(text)) return 'headphones';
  return null;
};

const getRelationshipPriority = ({ selectedFamily, candidate }) => {
  const candidateText = [candidate.name, candidate.category, candidate.subcategory, ...(candidate.tags || [])].join(' ').toLowerCase();

  if (selectedFamily === 'laptop') {
    if (/laptop.*(bag|sleeve|case)|\b(bag|sleeve|case)\b/i.test(candidateText)) return 100;
    if (/mouse/i.test(candidateText)) return 90;
    if (/keyboard|hub|dock|stand|cooling|pad/i.test(candidateText)) return 85;
    return 60;
  }

  if (selectedFamily === 'phone') {
    if (/case|screen|protector/i.test(candidateText)) return 100;
    if (/charger|power|bank|cable/i.test(candidateText)) return 90;
    if (/earbud|audio/i.test(candidateText)) return 80;
    return 60;
  }

  if (selectedFamily === 'camera') {
    if (/bag|case|strap/i.test(candidateText)) return 100;
    if (/memory|card|battery|tripod/i.test(candidateText)) return 90;
    return 60;
  }

  if (selectedFamily === 'headphones') {
    if (/case|adapter|stand|cable/i.test(candidateText)) return 100;
    return 60;
  }

  return 50;
};

const getRelationshipPriorityByName = ({ selectedFamily, candidate }) => {
  const text = [candidate.name, candidate.category, candidate.subcategory, ...(candidate.tags || [])].join(' ').toLowerCase();
  if (selectedFamily === 'laptop') {
    if (/laptop bag|bag/i.test(text)) return 100;
    if (/wireless mouse|mouse/i.test(text)) return 90;
    if (/keyboard|hub|dock|stand|cooling|pad/i.test(text)) return 85;
  }
  if (selectedFamily === 'phone') {
    if (/case|screen protector|protector|phone case/i.test(text)) return 100;
    if (/charger|power bank|cable/i.test(text)) return 90;
    if (/earbuds|earbud|audio/i.test(text)) return 80;
  }
  if (selectedFamily === 'camera') {
    if (/camera bag|bag|strap/i.test(text)) return 100;
    if (/memory card|tripod|battery/i.test(text)) return 90;
  }
  if (selectedFamily === 'headphones') {
    if (/case|adapter|stand|cable/i.test(text)) return 100;
  }
  return 60;
};

const getRelationshipReason = ({ selectedFamily, candidate }) => {
  const candidateText = [candidate.name, candidate.category, candidate.subcategory, ...(candidate.tags || [])].join(' ').toLowerCase();

  if (selectedFamily === 'laptop') {
    if (/bag|sleeve|case/i.test(candidateText)) return 'Protects and carries your laptop comfortably.';
    if (/mouse/i.test(candidateText)) return 'Adds a more comfortable everyday setup for work and browsing.';
    if (/keyboard|hub|dock|stand|cooling|pad/i.test(candidateText)) return 'Improves flexibility and productivity around your laptop.';
  }

  if (selectedFamily === 'phone') {
    if (/case|screen|protector/i.test(candidateText)) return 'Protects and shields your phone from daily wear.';
    if (/charger|power|bank|cable/i.test(candidateText)) return 'Keeps your phone powered and ready throughout the day.';
    if (/earbud|audio/i.test(candidateText)) return 'Pairs naturally with your phone for calls and music.';
  }

  if (selectedFamily === 'camera') {
    if (/bag|case|strap/i.test(candidateText)) return 'Helps store and protect your camera gear.';
    if (/memory|card|battery|tripod/i.test(candidateText)) return 'Extends shooting flexibility and reliability.';
  }

  if (selectedFamily === 'headphones') {
    if (/case|adapter|stand|cable/i.test(candidateText)) return 'Complements your headphones with better portability and connectivity.';
  }

  return 'Pairs well with your selected product for everyday use.';
};

const getCompatibilityScore = ({ selected, candidate }) => {
  const selectedTokens = new Set(getProductTokens(selected));
  const candidateTokens = new Set(getProductTokens(candidate));
  const shared = [...selectedTokens].filter((token) => candidateTokens.has(token));

  const family = detectProductFamily(selected) || detectProductFamily(candidate);
  const familyKeywords = family ? RELATIONSHIP_KEYWORDS[family] || [] : [];
  const familyMatches = [...candidateTokens].filter((token) => familyKeywords.includes(token)).length;

  let score = 0;
  if (shared.length) score += shared.length * 12;
  if (familyMatches) score += familyMatches * 25;
  if (candidate.category === 'Accessories' || candidate.subcategory === 'Accessories') score += 10;

  return score;
};

const isRelevantCrossSellCandidate = ({ selected, candidate }) => {
  if (!selected || !candidate) return false;
  if (String(candidate._id || candidate.id) === String(selected._id || selected.id)) return false;
  if (candidate.active === false) return false;
  if (Number(candidate.stock || 0) <= 0) return false;

  const selectedFamily = detectProductFamily(selected);
  const candidateText = [candidate.name, candidate.category, candidate.subcategory, ...(candidate.tags || [])].join(' ').toLowerCase();
  const candidateTokens = new Set(normalizeTokens(candidateText));

  if (!selectedFamily) return false;

  const requiredKeywords = RELATIONSHIP_KEYWORDS[selectedFamily] || [];
  const directMatch = requiredKeywords.some((keyword) => candidateTokens.has(keyword));
  const selectedNameTokens = new Set(normalizeTokens(selected.name));
  const sharedFamilyToken = [...selectedNameTokens].some((token) => candidateTokens.has(token) && (token === 'laptop' || token === 'phone' || token === 'camera' || token === 'headphone' || token === 'earbuds'));

  if (!directMatch && !sharedFamilyToken) {
    const candidateRelated = Array.isArray(candidate.relatedProducts) || Array.isArray(candidate.aiMetadata?.complementaryProductIds);
    const directReference = candidateRelated && [candidate.relatedProducts, candidate.aiMetadata?.complementaryProductIds].flat().some((id) => String(id) === String(selected._id || selected.id));
    if (!directReference) return false;
  }

  return true;
};

const buildCrossSellRecommendationSet = ({ product, products = [], maxItems = 3 }) => {
  if (!product || !Array.isArray(products) || !products.length) return [];

  const selectedFamily = detectProductFamily(product);
  const maximumPrice = Number(product.price || 0) * 0.15;

  const ranked = products
    .filter((item) => item
      && Number(item.price || 0) <= maximumPrice
      && isRelevantCrossSellCandidate({ selected: product, candidate: item }))
    .map((item) => {
      const relevanceScore = getCompatibilityScore({ selected: product, candidate: item });
      const relationshipPriority = getRelationshipPriorityByName({ selectedFamily, candidate: item });
      const compatibilityScore = relevanceScore + relationshipPriority;
      const priceDifference = Math.abs(Number(item.price || 0) - maximumPrice);
      const reason = getRelationshipReason({ selectedFamily, candidate: item });
      const benefit = reason;

      return {
        ...item,
        id: item._id ? item._id.toString() : (item.id || item._id),
        relevanceScore,
        compatibilityScore,
        relationshipPriority,
        priceDifference,
        maximumPrice,
        reason,
        benefit,
        available: Number(item.stock || 0) > 0,
      };
    })
    .filter((item) => Number(item.stock || 0) > 0)
    .sort((a, b) => {
      if (b.relationshipPriority !== a.relationshipPriority) return b.relationshipPriority - a.relationshipPriority;
      if (b.compatibilityScore !== a.compatibilityScore) return b.compatibilityScore - a.compatibilityScore;
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return a.priceDifference - b.priceDifference;
    })
    .slice(0, Number(maxItems) || 3)
    .map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price || 0),
      stock: Number(item.stock || 0),
      category: item.category,
      brand: item.brand,
      subcategory: item.subcategory,
      description: item.shortDescription || item.description || 'Useful add-on for everyday setup.',
      image: item.images?.[0] || null,
      reason: item.reason,
      benefit: item.benefit,
      available: Number(item.stock || 0) > 0,
      relevanceScore: item.relevanceScore,
      compatibilityScore: item.compatibilityScore,
      priceDifference: item.priceDifference,
      maximumPrice,
    }));

  return ranked.filter((item) => item && item.name && item.available);
};

const getCrossSellRecommendations = ({ product, products = [] }) => {
  const selectedProductId = product?._id ? product._id.toString() : (product?.id || null);
  const maximumPrice = Number(product?.price || 0) * 0.15;
  const recommendations = buildCrossSellRecommendationSet({ product, products, maxItems: 3 }).map((item) => ({
    _id: item.id,
    id: item.id,
    name: item.name,
    price: item.price,
    stock: item.stock,
    category: item.category,
    brand: item.brand,
    subcategory: item.subcategory,
    description: item.description,
    images: item.image ? [item.image] : [],
    tags: [item.category ? item.category.toLowerCase() : 'accessory'],
    active: true,
    benefit: item.benefit,
    reason: item.reason,
    priceDifference: item.priceDifference,
    relevanceScore: item.relevanceScore,
    compatibilityScore: item.compatibilityScore,
  }));

  return {
    selectedProductId,
    maximumPrice,
    recommendations,
  };
};

const calculateAdditionalRevenue = ({ originalProductPrice = 0, upsellRevenue = 0, crossSellRevenue = 0 }) => {
  return normalizeNumber(upsellRevenue) + normalizeNumber(crossSellRevenue);
};

const trackRevenueAttribution = ({
  originalProductPrice = 0,
  upsellRevenue = 0,
  crossSellItems = [],
  accepted = false,
  recommendation = null,
}) => {
  const crossSellRevenue = (crossSellItems || [])
    .filter((item) => item && item.accepted === true)
    .reduce((sum, item) => sum + normalizeNumber(item.product?.price || item.price || 0) * normalizeNumber(item.quantity || 1), 0);

  const totalAdditionalRevenue = normalizeNumber(upsellRevenue) + crossSellRevenue;
  const finalOrderValue = normalizeNumber(originalProductPrice) + totalAdditionalRevenue;

  return {
    originalCartValue: normalizeNumber(originalProductPrice),
    upsellRevenue: normalizeNumber(upsellRevenue),
    crossSellRevenue,
    totalAdditionalRevenue,
    finalOrderValue,
    accepted,
    recommendation,
  };
};

const getUpsellRecommendation = ({ product, products = [], maxPriceMultiplier = 1.5 }) => {
  if (!product || !Array.isArray(products) || !products.length) return null;
  const currentPrice = Number(product.price || 0);
  const candidates = products.filter((candidate) => {
    if (!candidate || candidate.active === false) return false;
    if (candidate._id?.toString && product._id && candidate._id.toString() === product._id.toString()) return false;
    if (String(candidate.category || '').toLowerCase() !== String(product.category || '').toLowerCase()) return false;
    if (candidate.stock <= 0) return false;
    const price = Number(candidate.price || 0);
    return price > currentPrice && price <= currentPrice * maxPriceMultiplier;
  });
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => Number(a.price) - Number(b.price));
  const best = sorted[0];
  return {
    product: best,
    incrementalRevenue: Number(best.price) - currentPrice,
    summary: `${best.name} is a stronger long-term option with a higher-value spec profile for the same category.`,
  };
};

module.exports = {
  normalizeNumber,
  getRealSpecs,
  rankProducts,
  buildLaptopSummary,
  buildCrossSellRecommendationSet,
  getLaptopRecommendation,
  getCrossSellRecommendations,
  getUpsellRecommendation,
  calculateAdditionalRevenue,
  trackRevenueAttribution,
};
