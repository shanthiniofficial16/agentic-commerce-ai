# Phase 5: Upsell Flow - End-to-End Testing Guide

## Overview
Phase 5 upsell implementation is complete on the backend. This guide documents the expected behavior for end-to-end testing.

## Test Scenario 1: Customer Accepts Upsell

**Setup**:
- Ensure products with price progression exist in MongoDB:
  - Base Product: Laptop ₹50,000 (stock: 5)
  - Upsell Product: Premium Laptop ₹70,000 (stock: 3, same category/subcategory)

**Flow**:
1. Customer: "Add a laptop to my cart"
2. Agent: Shows base laptop (₹50,000), adds to cart
3. Agent SHOULD suggest: "I found a higher-spec option: Premium Laptop ₹70,000. Upgrade difference: ₹20,000. Would you like to upgrade?"
4. Customer: "Yes, upgrade"
5. Agent: "Upgraded to Premium Laptop. Cart total: ₹70,000."

**Expected Result**:
- Cart contains ONLY Premium Laptop (₹70,000)
- Original Base Laptop removed
- Order will show: totalPrice=70,000, aiIncrementalAmount=20,000, source='ai_upsell'
- AgentAction logged: UPSELL_RECOMMENDED then UPSELL_ACCEPTED with originalPrice=50000, upsellPrice=70000

**Verification**:
```javascript
// Check Conversation.pendingUpsell state
{
  originalProductId: 'base-laptop-id',
  originalPrice: 50000,
  upsellProductId: 'premium-laptop-id',
  upsellPrice: 70000,
  incrementalRevenue: 20000
}

// Check AgentAction logs
{ action: 'UPSELL_RECOMMENDED', ... }
{ action: 'UPSELL_ACCEPTED', input: { originalProductId, upsellProductId }, output: { originalPrice, upsellPrice, incrementalRevenue } }

// Check Order
{ 
  items: [{ productId: 'premium-laptop-id', source: 'ai_upsell', price: 70000 }],
  totalPrice: 70000,
  aiIncrementalAmount: 20000
}
```

## Test Scenario 2: Customer Rejects Upsell

**Setup**: Same as Scenario 1

**Flow**:
1. Customer: "Add a laptop to my cart"
2. Agent: Shows base laptop (₹50,000), adds to cart
3. Agent: Suggests upgrade to Premium Laptop
4. Customer: "No, keep the original"
5. Agent: "I kept your original product in the cart."

**Expected Result**:
- Cart contains ONLY Base Laptop (₹50,000)
- No upsell product added
- No order created yet
- AgentAction logged: UPSELL_RECOMMENDED then UPSELL_REJECTED

**Verification**:
```javascript
// Check AgentAction logs
{ action: 'UPSELL_RECOMMENDED', ... }
{ action: 'UPSELL_REJECTED', ... }

// Check Cart
{ items: [{ productId: 'base-laptop-id', source: 'customer', price: 50000 }] }
```

## Test Scenario 3: No Upsell Available

**Setup**:
- Base Product: Budget Laptop ₹20,000 (stock: 5)
- No products exist in same category with price 20,000-30,000 in stock

**Flow**:
1. Customer: "Add a budget laptop to my cart"
2. Agent: Shows budget laptop, adds to cart
3. Agent: "I couldn't find any better options in our catalog for this product."

**Expected Result**:
- Cart contains Budget Laptop (₹20,000)
- No upsell offered
- No UPSELL_RECOMMENDED action logged
- Agent continues to next step

## Test Scenario 4: Upsell Out of Stock

**Setup**:
- Base Product: Laptop ₹50,000 (stock: 5)
- Premium Laptop ₹70,000 (stock: 0) - OUT OF STOCK

**Flow**:
1. Customer: "Add a laptop to my cart"
2. Agent: Shows base laptop, adds to cart
3. Agent: Does NOT mention upgrade

**Expected Result**:
- Cart contains Base Laptop (₹50,000)
- No upsell offered (because premium laptop is out of stock)
- Upsell query in agentService.findUpsellAlternative() returned null

## Test Scenario 5: Upsell Price Exceeds Ceiling

**Setup**:
- Base Product: Laptop ₹50,000 (stock: 5)
- Expensive Laptop ₹100,000 (stock: 5) - EXCEEDS 1.5x ceiling (50k * 1.5 = 75k max)
- Premium Laptop ₹70,000 (stock: 5) - WITHIN CEILING

**Flow**:
1. Customer: "Add a laptop to my cart"
2. Agent: Shows base laptop, adds to cart
3. Agent: Suggests Premium Laptop ₹70,000 upgrade (NOT Expensive Laptop)

**Expected Result**:
- Upsell recommendation shows Premium Laptop (✅ within 1.5x ceiling)
- Expensive Laptop is never considered (❌ exceeds ceiling)
- Price constraint enforced by MongoDB query: `price: { $gt: 50000, $lte: 75000 }`

## Cross-Sell vs Upsell: Key Differences

### Cross-Sell (Accessories)
```javascript
// Action: ADDS product to cart
executeTool('addToCart', { productId: accessory.id, source: 'ai_cross_sell' })

// Revenue attribution:
aiIncrementalAmount = accessory.price (full price)

// Flow: "Would you like to add X accessory?"
// Result: Cart has [original + accessory]
```

### Upsell (Replacement)
```javascript
// Action: REMOVES original, then ADDS upgrade
executeTool('removeFromCart', { productId: original.id })
executeTool('addToCart', { productId: upgrade.id, source: 'ai_upsell' })

// Revenue attribution:
aiIncrementalAmount = (upgrade.price - original.price) (difference only)

// Flow: "Would you like to upgrade to better product?"
// Result: Cart has [upgrade only, original removed]
```

## Debug Checklist

- [ ] Verify `Product.findOne()` query includes `stock: { $gt: 0 }`
- [ ] Verify `Product.findOne()` query includes `price: { $gt: original, $lte: original * 1.5 }`
- [ ] Check `conversation.pendingUpsell` is set after recommendation
- [ ] Check `conversation.pendingUpsell` is cleared after acceptance/rejection
- [ ] Verify `removeFromCart()` called BEFORE `addToCart()` on acceptance
- [ ] Verify `source: 'ai_upsell'` passed to addToCart
- [ ] Check AgentAction logs both UPSELL_RECOMMENDED and UPSELL_ACCEPTED/REJECTED
- [ ] Check Order.aiIncrementalAmount = (upsell_price - original_price), NOT full upsell price
- [ ] Verify merchant analytics shows separate `upsellRevenue` field

## Files Modified

1. **backend/src/controllers/agent.controller.js**
   - Removed old recommendation.type conditional
   - Added separate upsell acceptance/rejection handler
   - Updated recommendation logging to handle pendingUpsell

2. **backend/src/services/agent/agentService.js**
   - Added findUpsellAlternative() function
   - Added findAndRecommendUpsell() function
   - Integrated upsell trigger into cart add flow
   - Removed old upsell fallback from complementary products
   - Exported upsell functions

3. **backend/src/__tests__/agentUpsellFlow.test.js** (NEW)
   - 16 comprehensive unit tests
   - Covers finding, recommendation, acceptance, revenue attribution

## Related Files (No Changes, For Reference)

- **backend/src/models/Conversation.js**: `pendingUpsell` field already exists
- **backend/src/models/Order.js**: `aiIncrementalAmount` and source attribution already supported
- **backend/src/services/order.service.js**: Order creation uses source attribution correctly
- **frontend/src/pages/MerchantDashboard.jsx**: Analytics display includes upsellRevenue metric
