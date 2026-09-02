const { isPurchaseIntent, isOrderRequest, stripComplementaryClauses } = require('../services/agent/agentService');

describe('purchase intent detection for checkout flow', () => {
  test('recognizes direct product purchase phrases', () => {
    expect(isPurchaseIntent('I want to buy CodeCraft Laptop 162 Plus')).toBe(true);
    expect(isPurchaseIntent('Buy this')).toBe(true);
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
});
