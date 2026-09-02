const normalizeNumber = (value) => Number(value || 0);

const getRealSpecs = (product = {}) => {
  const specs = product.specifications || {};
  const safe = {
    ram: specs.ram || null,
    processor: specs.processor || null,
    generation: specs.generation || null,
    storage: specs.storage || null,
    display: specs.display || null,
    branding: product.brand || null,
    rating: product.ratings?.average ?? null,
  };
  return safe;
};

const normalizeText = (value = '') => String(value).toLowerCase().trim();

const categoryMatches = (product = {}, categoryHint = null) => {
  if (!categoryHint) return true;
  const hint = normalizeText(categoryHint).replace(/s$/, '');
  const productCategory = normalizeText(product.category || '');
  const productSubcategory = normalizeText(product.subcategory || '');
  return productCategory.includes(hint) || productSubcategory.includes(hint) || productCategory === hint || productSubcategory === hint;
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

const getCrossSellRecommendations = ({ product, products = [] }) => {
  if (!product || !Array.isArray(products) || !products.length) return [];

  const targetText = `${product.name || ''} ${product.category || ''} ${product.subcategory || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  const normalized = (value = '') => String(value).toLowerCase();

  const scored = products
    .filter((item) => item && item.active !== false && Number(item.stock || 0) > 0)
    .map((item) => {
      const haystack = `${item.name || ''} ${item.category || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      if (item.category === 'Accessories') score += 30;
      if (haystack.includes('laptop') && targetText.includes('laptop')) score += 25;
      if (haystack.includes('mouse') || haystack.includes('bag') || haystack.includes('hub') || haystack.includes('keyboard')) score += 25;
      if (targetText.includes('laptop') && (haystack.includes('bag') || haystack.includes('mouse') || haystack.includes('hub') || haystack.includes('keyboard'))) score += 30;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, 3);

  return scored.filter((item) => item && item.name);
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
  getLaptopRecommendation,
  getCrossSellRecommendations,
  getUpsellRecommendation,
  calculateAdditionalRevenue,
  trackRevenueAttribution,
};
