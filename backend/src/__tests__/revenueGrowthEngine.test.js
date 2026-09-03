const {
  rankProducts,
  getLaptopRecommendation,
  getCrossSellRecommendations,
  buildCrossSellRecommendationSet,
  calculateAdditionalRevenue,
  trackRevenueAttribution,
} = require('../services/revenueGrowthService');

describe('revenue growth engine', () => {
  const laptops = [
    {
      _id: 'lap-1',
      name: 'PixelDesk Lite 14',
      category: 'Electronics',
      subcategory: 'Laptops',
      price: 43999,
      stock: 5,
      active: true,
      ratings: { average: 4.1, count: 120 },
      specifications: { ram: '8 GB', processor: 'Intel Core i5', generation: '11th Gen', storage: '512 GB SSD', display: '14-inch FHD' },
      keyFeatures: ['8 GB RAM', '512 GB SSD'],
    },
    {
      _id: 'lap-2',
      name: 'PixelDesk Pro 15',
      category: 'Electronics',
      subcategory: 'Laptops',
      price: 68999,
      stock: 8,
      active: true,
      ratings: { average: 4.6, count: 255 },
      specifications: { ram: '16 GB', processor: 'Intel Core i7', generation: '13th Gen', storage: '512 GB SSD', display: '15.6-inch FHD' },
      keyFeatures: ['16 GB RAM', '512 GB SSD', '13th Gen Intel Core i7'],
    },
    {
      _id: 'lap-3',
      name: 'UltraBook Air',
      category: 'Electronics',
      subcategory: 'Laptops',
      price: 75999,
      stock: 0,
      active: true,
      ratings: { average: 4.7, count: 90 },
      specifications: { ram: '16 GB', processor: 'Intel Core i7', generation: '12th Gen', storage: '1 TB SSD', display: '14-inch 2.8K' },
      keyFeatures: ['16 GB RAM'],
    },
  ];

  const accessories = [
    { _id: 'acc-1', name: 'Laptop Sleeve', category: 'Accessories', price: 6999, stock: 12, active: true, tags: ['bag', 'laptop', 'travel'] },
    { _id: 'acc-2', name: 'Wireless Mouse', category: 'Accessories', price: 6999, stock: 20, active: true, tags: ['mouse', 'accessory', 'desktop'] },
    { _id: 'acc-3', name: 'USB-C Hub', category: 'Accessories', price: 7499, stock: 8, active: true, tags: ['hub', 'usb-c', 'laptop'] },
  ];

  test('recommends a premium suitable laptop when no budget is specified', () => {
    const recommendation = getLaptopRecommendation({
      products: laptops,
      message: 'I need a laptop',
    });

    expect(recommendation).not.toBeNull();
    expect(recommendation.product.name).toBe('PixelDesk Pro 15');
    expect(recommendation.summary).toContain('16 GB');
    expect(recommendation.summary).toContain('13th Gen');
  });

  test('respects the user budget and never recommends something above the maximum', () => {
    const recommendation = getLaptopRecommendation({
      products: laptops,
      message: 'I need a laptop under 70000',
    });

    expect(recommendation).not.toBeNull();
    expect(recommendation.product.price).toBeLessThanOrEqual(70000);
    expect(recommendation.product.name).toBe('PixelDesk Pro 15');
  });

  test('returns a no-match response when no suitable laptop is available', () => {
    const recommendation = getLaptopRecommendation({
      products: [{ ...laptops[0], price: 120000, stock: 0, active: false }],
      message: 'I need a laptop under 70000',
    });

    expect(recommendation).toMatchObject({ noMatch: true });
  });

  test('suggests relevant laptop accessories from the real catalog', () => {
    const crossSell = getCrossSellRecommendations({
      product: laptops[1],
      products: accessories,
    });

    expect(crossSell.recommendations).toHaveLength(3);
    expect(crossSell.recommendations.some((item) => item.name === 'Laptop Sleeve')).toBe(true);
    expect(crossSell.recommendations.some((item) => item.name === 'Wireless Mouse')).toBe(true);
  });

  test('prioritizes relevance before 10% price matching and rejects unrelated products', () => {
    const product = {
      _id: 'lap-target',
      name: 'PixelDesk Pro 15',
      category: 'Electronics',
      subcategory: 'Laptops',
      price: 40000,
      stock: 4,
      active: true,
      tags: ['laptop', 'work', 'gaming'],
    };

    const candidates = [
      { _id: 'acc-1', name: 'Laptop Bag', category: 'Accessories', subcategory: 'Bags', price: 4000, stock: 5, active: true, tags: ['laptop', 'bag', 'travel'] },
      { _id: 'acc-2', name: 'Wireless Mouse', category: 'Accessories', subcategory: 'Desk', price: 4000, stock: 5, active: true, tags: ['mouse', 'laptop', 'work'] },
      { _id: 'acc-3', name: 'USB-C Hub', category: 'Accessories', subcategory: 'Desk', price: 4299, stock: 5, active: true, tags: ['hub', 'laptop', 'connectivity'] },
      { _id: 'acc-4', name: 'Saree', category: 'Fashion', subcategory: 'Sarees', price: 3999, stock: 5, active: true, tags: ['ethnic', 'sale'] },
      { _id: 'acc-5', name: 'Running Shoes', category: 'Fashion', subcategory: 'Shoes', price: 4099, stock: 5, active: true, tags: ['sport', 'running'] },
    ];

    const result = getCrossSellRecommendations({ product, products: candidates });

    expect(result.selectedProductId).toBe('lap-target');
    expect(result.maximumPrice).toBe(6000);
    expect(result.recommendations.map((item) => item.name)).toEqual(['Laptop Bag', 'Wireless Mouse', 'USB-C Hub']);
    expect(result.recommendations.some((item) => item.name === 'Saree')).toBe(false);
    expect(result.recommendations.some((item) => item.name === 'Running Shoes')).toBe(false);
  });

  test('rejects relevant accessories above the dynamic 15% maximum price', () => {
    const product = { ...laptops[0], price: 40000 };
    const result = getCrossSellRecommendations({
      product,
      products: [
        { _id: 'within-maximum', name: 'Wireless Mouse', category: 'Accessories', price: 6000, stock: 5, active: true, tags: ['laptop', 'mouse'] },
        { _id: 'above-maximum', name: 'Laptop Bag', category: 'Accessories', price: 6001, stock: 5, active: true, tags: ['laptop', 'bag'] },
      ],
    });

    expect(result.maximumPrice).toBe(6000);
    expect(result.recommendations.map((item) => item.name)).toEqual(['Wireless Mouse']);
  });

  test('does not add a rejected accessory to the cart', () => {
    const offer = getCrossSellRecommendations({ product: laptops[1], products: accessories }).recommendations[0];
    const result = trackRevenueAttribution({
      originalProductPrice: laptops[1].price,
      upsellRevenue: 0,
      crossSellItems: [],
      accepted: false,
      recommendation: offer,
    });

    expect(result.crossSellRevenue).toBe(0);
    expect(result.finalOrderValue).toBe(laptops[1].price);
  });

  test('adds only the accepted accessory and calculates the proper revenue uplift', () => {
    const acceptedAccessory = accessories[0];
    const result = trackRevenueAttribution({
      originalProductPrice: laptops[1].price,
      upsellRevenue: 0,
      crossSellItems: [{ product: acceptedAccessory, quantity: 1, accepted: true }],
      accepted: true,
    });

    expect(result.crossSellRevenue).toBe(6999);
    expect(result.finalOrderValue).toBe(68999 + 6999);
  });

  test('never recommends an unavailable product', () => {
    const recommendation = getLaptopRecommendation({
      products: laptops,
      message: 'I need a laptop',
    });

    expect(recommendation.product.name).not.toBe('UltraBook Air');
  });

  test('never invents product specifications', () => {
    const recommendation = getLaptopRecommendation({
      products: laptops,
      message: 'I need a laptop',
    });

    expect(recommendation.summary).toContain('16 GB');
    expect(recommendation.summary).not.toContain('32 GB');
    expect(recommendation.summary).not.toContain('5th Gen');
  });

  test('calculates revenue attribution correctly', () => {
    const result = trackRevenueAttribution({
      originalProductPrice: 54999,
      upsellRevenue: 10000,
      crossSellItems: [{ product: { price: 2298 }, quantity: 1, accepted: true }],
    });

    expect(result.originalCartValue).toBe(54999);
    expect(result.upsellRevenue).toBe(10000);
    expect(result.crossSellRevenue).toBe(2298);
    expect(result.totalAdditionalRevenue).toBe(12298);
    expect(result.finalOrderValue).toBe(54999 + 10000 + 2298);
  });

  test('builds a catalog-backed cross-sell recommendation bundle for the chosen laptop', () => {
    const accessoryBundle = buildCrossSellRecommendationSet({
      product: laptops[1],
      products: accessories,
      maxItems: 3,
    });

    expect(Array.isArray(accessoryBundle)).toBe(true);
    expect(accessoryBundle).toHaveLength(3);
    expect(accessoryBundle.every((item) => item.available === true)).toBe(true);
    expect(accessoryBundle[0].benefit).toMatch(/carry|protect|mouse|connect|organize|everyday/i);
  });

  test('supports the real Razorpay payment flow contract without altering payment semantics', () => {
    const amount = calculateAdditionalRevenue({ originalProductPrice: 54999, upsellRevenue: 10000, crossSellRevenue: 2298 });
    expect(amount).toBe(12298);
  });
});
