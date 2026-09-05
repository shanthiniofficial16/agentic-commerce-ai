const Product = require('../models/Product');
const { isPurchaseIntent, isOrderRequest, stripComplementaryClauses, shouldGenerateCheckoutRecommendations, findAndRecommendUpsell, runAgent } = require('../services/agent/agentService');

jest.mock('../models/Product');

describe('purchase intent detection for checkout flow', () => {
  test('recognizes direct product purchase phrases', () => {
    expect(isPurchaseIntent('I want to buy CodeCraft Laptop 162 Plus')).toBe(true);
    expect(isPurchaseIntent('Buy this')).toBe(true);
    expect(isPurchaseIntent('buy me')).toBe(true);
    expect(isPurchaseIntent('Purchase this')).toBe(true);
    expect(isPurchaseIntent('I want this')).toBe(true);
    expect(isPurchaseIntent('Place an order for this')).toBe(true);
    expect(isPurchaseIntent('Proceed with this product')).toBe(true);
  });

  test('keeps order requests in the checkout flow', () => {
    expect(isOrderRequest('I want to buy CodeCraft Laptop 162 Plus')).toBe(true);
    expect(isOrderRequest('Place an order for this')).toBe(true);
    expect(isOrderRequest('Proceed with this product')).toBe(true);
  });

  test('preserves the product name when asking for complementary accessories', () => {
    const cleaned = stripComplementaryClauses('Suggest a complementary accessory for CodeCraft Laptop 162 Plus');
    expect(cleaned).toBe('CodeCraft Laptop 162 Plus');
  });

  test('does not trigger checkout recommendations during product discovery', () => {
    expect(shouldGenerateCheckoutRecommendations({ message: 'I need a laptop' })).toBe(false);
    expect(shouldGenerateCheckoutRecommendations({ message: 'I want to buy PixelDesk Air Laptop' })).toBe(false);
    expect(shouldGenerateCheckoutRecommendations({ message: 'Place order' })).toBe(true);
    expect(shouldGenerateCheckoutRecommendations({ message: 'Proceed to checkout' })).toBe(true);
  });

  test('handles tool-shaped products that expose id instead of _id during upsell checks', async () => {
    Product.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'upsell_456',
          name: 'Premium Model',
          price: 76000,
          stock: 12,
          category: 'Electronics',
          subcategory: 'Laptops',
          brand: 'BrandX',
          shortDescription: 'Better spec',
        }),
      }),
    });

    const result = await findAndRecommendUpsell({
      product: {
        id: 'original_123',
        name: 'Current Model',
        category: 'Electronics',
        subcategory: 'Laptops',
        price: 65000,
      },
      context: { merchantId: 'merchant_123' },
    });

    expect(result).not.toBeNull();
    expect(result.pendingUpsell.originalProductId).toBe('original_123');
    expect(result.pendingUpsell.upsellProductId).toBe('upsell_456');
    expect(result.products[0].id).toBe('upsell_456');
  });

  test('returns a real navigation action for an existing application route', async () => {
    const result = await runAgent({ message: 'Show my cart', history: [], context: { userId: 'user_123', merchantId: 'merchant_123' } });

    expect(result.action).toEqual({ navigated: true, path: '/shop/cart' });
    expect(result.text).toMatch(/opening/i);
  });
});
