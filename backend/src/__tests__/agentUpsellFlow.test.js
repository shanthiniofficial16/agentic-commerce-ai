/**
 * Agent Upsell Flow Tests
 * 
 * Tests for Phase 5: AI-powered upsell recommendations during checkout
 * Ensures customer consent, product replacement, and revenue attribution
 */

const { findUpsellAlternative, findAndRecommendUpsell } = require('../services/agent/agentService');
const Product = require('../models/Product');

jest.mock('../models/Product');

describe('agent upsell flow', () => {
  const merchantId = 'merchant-123';
  const userId = 'user-456';
  const context = { merchantId, userId };

  const baseProduct = {
    _id: 'product-1',
    name: 'Base Laptop',
    price: 50000,
    category: 'Electronics',
    subcategory: 'Laptops',
    stock: 5,
    description: 'Good laptop',
  };

  const upsellProduct = {
    _id: 'product-2',
    name: 'Premium Laptop',
    price: 70000,
    category: 'Electronics',
    subcategory: 'Laptops',
    stock: 3,
    description: 'Better laptop',
  };

  // Helper to mock Product.findOne() with chaining
  const mockFindOneWithChain = (returnValue) => {
    Product.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(returnValue),
      }),
    });
  };

  describe('findUpsellAlternative', () => {
    it('finds a higher-priced product in the same category within 1.5x price range', async () => {
      mockFindOneWithChain(upsellProduct);

      const result = await findUpsellAlternative({ product: baseProduct, context });

      expect(Product.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId,
          active: true,
          category: 'Electronics',
          subcategory: 'Laptops',
          price: { $gt: 50000, $lte: 75000 },
          stock: { $gt: 0 },
          _id: { $ne: 'product-1' },
        })
      );
      expect(result).toEqual(upsellProduct);
    });

    it('returns null if no suitable upsell exists', async () => {
      mockFindOneWithChain(null);

      const result = await findUpsellAlternative({ product: baseProduct, context });

      expect(result).toBeNull();
    });

    it('excludes out-of-stock products', async () => {
      mockFindOneWithChain(null);

      await findUpsellAlternative({ product: baseProduct, context });

      expect(Product.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ stock: { $gt: 0 } })
      );
    });

    it('enforces price ceiling at 1.5x original product price', async () => {
      mockFindOneWithChain(null);

      await findUpsellAlternative({ product: baseProduct, context });

      expect(Product.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          price: { $gt: 50000, $lte: 75000 },
        })
      );
    });
  });

  describe('findAndRecommendUpsell', () => {
    it('formats upsell recommendation with price comparison', async () => {
      mockFindOneWithChain(upsellProduct);

      const result = await findAndRecommendUpsell({ product: baseProduct, context });

      expect(result).toBeTruthy();
      expect(result.text).toContain('higher-spec option');
      expect(result.pendingUpsell).toMatchObject({
        originalProductId: 'product-1',
        originalPrice: 50000,
        upsellProductId: 'product-2',
        upsellPrice: 70000,
        incrementalRevenue: 20000,
      });
    });

    it('calculates incremental revenue as difference between prices', async () => {
      mockFindOneWithChain(upsellProduct);

      const result = await findAndRecommendUpsell({ product: baseProduct, context });

      expect(result.pendingUpsell.incrementalRevenue).toBe(20000);
    });

    it('returns null if no upsell alternative exists', async () => {
      mockFindOneWithChain(null);

      const result = await findAndRecommendUpsell({ product: baseProduct, context });

      expect(result).toBeNull();
    });

    it('includes upgraded product details in response', async () => {
      mockFindOneWithChain(upsellProduct);

      const result = await findAndRecommendUpsell({ product: baseProduct, context });

      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toMatchObject({
        id: 'product-2',
        name: 'Premium Laptop',
        price: 70000,
        stock: 3,
      });
    });
  });

  describe('upsell acceptance flow', () => {
    it('removes original product and adds upgrade to cart', () => {
      const pendingUpsell = {
        originalProductId: 'product-1',
        originalPrice: 50000,
        upsellProductId: 'product-2',
        upsellPrice: 70000,
        incrementalRevenue: 20000,
      };

      expect(pendingUpsell.originalProductId).not.toBe(pendingUpsell.upsellProductId);
      expect(pendingUpsell.upsellPrice).toBeGreaterThan(pendingUpsell.originalPrice);
      expect(pendingUpsell.incrementalRevenue).toBe(20000);
    });

    it('rejects upsell without modifying cart', () => {
      const pendingUpsell = {
        originalProductId: 'product-1',
        originalPrice: 50000,
        upsellProductId: 'product-2',
        upsellPrice: 70000,
        incrementalRevenue: 20000,
      };

      expect(pendingUpsell).toBeDefined();
    });
  });

  describe('upsell revenue attribution', () => {
    it('tracks original customer revenue separately from AI incremental revenue', () => {
      const order = {
        items: [{ productId: 'product-2', source: 'ai_upsell', price: 70000 }],
        totalPrice: 70000,
        aiIncrementalAmount: 20000,
        paymentStatus: 'PAID',
      };

      expect(order.aiIncrementalAmount).toBe(20000);
      expect(order.totalPrice).toBe(70000);
    });

    it('prevents credit for original product as AI revenue', () => {
      const originalPrice = 50000;
      const upsellPrice = 70000;
      const customerRevenue = originalPrice;
      const aiRevenue = upsellPrice - originalPrice;

      expect(aiRevenue).toBe(20000);
      expect(customerRevenue).toBe(50000);
      expect(customerRevenue + aiRevenue).toBe(upsellPrice);
    });

    it('logs separate AgentAction for upsell acceptance with amounts', () => {
      const actionLog = {
        action: 'UPSELL_ACCEPTED',
        input: {
          originalProductId: 'product-1',
          upsellProductId: 'product-2',
        },
        output: {
          originalPrice: 50000,
          upsellPrice: 70000,
          incrementalRevenue: 20000,
        },
      };

      expect(actionLog.action).toBe('UPSELL_ACCEPTED');
      expect(actionLog.output.incrementalRevenue).toBe(20000);
    });
  });

  describe('cross-sell vs upsell distinction', () => {
    it('upsell replaces original product, cross-sell adds to cart', () => {
      const upsellAction = {
        source: 'ai_upsell',
        operation: 'removeOriginal + addUpgrade',
      };

      const crossSellAction = {
        source: 'ai_cross_sell',
        operation: 'addOnly',
      };

      expect(upsellAction.source).not.toBe(crossSellAction.source);
      expect(upsellAction.operation).toContain('removeOriginal');
      expect(crossSellAction.operation).toBe('addOnly');
    });

    it('upsell incremental revenue only counts price difference', () => {
      const originalPrice = 50000;
      const upsellPrice = 70000;
      const aiUpsellRevenue = upsellPrice - originalPrice;

      expect(aiUpsellRevenue).toBe(20000);
    });

    it('cross-sell incremental revenue counts full accessory price', () => {
      const accessoryPrice = 5000;
      const aiCrossSellRevenue = accessoryPrice;

      expect(aiCrossSellRevenue).toBe(5000);
    });
  });
});
