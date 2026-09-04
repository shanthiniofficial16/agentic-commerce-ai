const mongoose = require('mongoose');
require('dotenv').config();
const Merchant = require('../models/Merchant');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const AgentAction = require('../models/AgentAction');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-commerce';
const SEED_SOURCE = 'seed-historical-2026';
const START_DATE = new Date('2026-01-01T00:00:00.000Z');
const END_DATE = new Date('2026-09-01T00:00:00.000Z');
const MONTHS = [
  { month: 0, count: 42, aiRate: 0.10 },
  { month: 1, count: 48, aiRate: 0.13 },
  { month: 2, count: 57, aiRate: 0.16 },
  { month: 3, count: 63, aiRate: 0.19 },
  { month: 4, count: 71, aiRate: 0.22 },
  { month: 5, count: 78, aiRate: 0.25 },
  { month: 6, count: 91, aiRate: 0.28 },
  { month: 7, count: 103, aiRate: 0.32 },
];

// A small seeded PRNG keeps reruns reproducible while still spreading values naturally.
const random = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const inHistoricalRange = (date) => date >= START_DATE && date < END_DATE;
const money = (value) => Math.round(Number(value) * 100) / 100;
const productId = (product) => product._id.toString();

const choose = (items, nextRandom) => items[Math.floor(nextRandom() * items.length)];
const chooseDifferent = (items, excludedId, nextRandom) => choose(items.filter((item) => productId(item) !== excludedId), nextRandom);

const makeDate = (month, index, nextRandom) => {
  const daysInMonth = new Date(Date.UTC(2026, month + 1, 0)).getUTCDate();
  const day = 1 + ((index * 7 + Math.floor(nextRandom() * 6)) % daysInMonth);
  const hour = 9 + Math.floor(nextRandom() * 11);
  const minute = Math.floor(nextRandom() * 60);
  return new Date(Date.UTC(2026, month, day, hour, minute, 0));
};

const profileFor = (user) => {
  const profile = user.profile || {};
  return {
    fullName: profile.fullName || user.name,
    phone: profile.phone || '',
    email: profile.email || user.email,
    address: [profile.street, profile.building, profile.landmark].filter(Boolean).join(', '),
    city: profile.city || '',
    state: profile.state || '',
    pincode: profile.pincode || '',
  };
};

const itemFor = (product, quantity, source = 'customer', aiIncrementalAmount = 0) => ({
  productId: product._id,
  productName: product.name,
  quantity,
  price: money(product.price),
  source,
  aiIncrementalAmount: money(aiIncrementalAmount),
});

const buildOrder = ({ month, index, merchant, user, products, nextRandom }) => {
  const electronics = products.filter((product) => product.category === 'Electronics');
  const accessories = products.filter((product) => product.category === 'Accessories');
  const affordable = products.filter((product) => product.price < 10000);
  const laptops = products.filter((product) => product.subcategory === 'Laptops');
  const mainProduct = choose(products, nextRandom);
  const items = [];
  let kind = 'normal';
  const isAiOrder = nextRandom() < MONTHS[month].aiRate;

  if (isAiOrder && laptops.length >= 2 && nextRandom() < 0.35) {
    const original = choose(laptops, nextRandom);
    const upsell = chooseDifferent(laptops, productId(original), nextRandom);
    const originalPrice = Number(original.price);
    const upsellPrice = Number(upsell.price);
    if (upsellPrice > originalPrice) {
      const quantity = 1;
      items.push(itemFor(upsell, quantity, 'ai_upsell', upsellPrice - originalPrice));
      kind = 'upsell';
    }
  }

  if (!items.length) {
    items.push(itemFor(mainProduct, mainProduct.subcategory === 'Laptops' ? 1 : 1 + (nextRandom() < 0.10 ? 1 : 0)));
    if (isAiOrder && accessories.length && nextRandom() < 0.72) {
      const crossSellCount = nextRandom() < 0.28 && accessories.length > 1 ? 2 : 1;
      const selected = [];
      for (let itemIndex = 0; itemIndex < crossSellCount; itemIndex += 1) {
        const candidatePool = accessories.filter((product) => !selected.some((item) => productId(item) === productId(product)) && productId(product) !== productId(mainProduct));
        if (!candidatePool.length) break;
        const accessory = choose(candidatePool, nextRandom);
        selected.push(accessory);
        const quantity = Number(accessory.price) < 2500 && nextRandom() < 0.18 ? 2 : 1;
        items.push(itemFor(accessory, quantity, 'ai_cross_sell', Number(accessory.price) * quantity));
      }
      if (items.length > 1) kind = 'cross-sell';
    }
    if (items.length === 1 && nextRandom() < 0.15 && affordable.length > 1) {
      const extra = chooseDifferent(affordable, productId(mainProduct), nextRandom);
      items.push(itemFor(extra, 1, 'customer'));
    }
  }

  const total = money(items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0));
  const originalProductValue = money(items.filter((item) => item.source === 'customer').reduce((sum, item) => sum + item.price * item.quantity, 0));
  const crossSellRevenue = money(items.filter((item) => item.source === 'ai_cross_sell').reduce((sum, item) => sum + item.aiIncrementalAmount, 0));
  const createdAt = makeDate(month, index, nextRandom);
  const sessionId = `seed-historical-2026-${month + 1}-${String(index + 1).padStart(3, '0')}`;
  const actionBase = { sessionId, userId: user._id, merchantId: merchant._id, status: 'SUCCESS', createdAt, updatedAt: createdAt };
  const actions = [];
  if (kind === 'upsell') {
    actions.push({ ...actionBase, action: 'UPSELL_RECOMMENDED', amount: 0, reason: SEED_SOURCE });
    actions.push({ ...actionBase, action: 'UPSELL_ACCEPTED', amount: items[0].aiIncrementalAmount, reason: SEED_SOURCE });
  } else if (kind === 'cross-sell') {
    for (const item of items.filter((entry) => entry.source === 'ai_cross_sell')) {
      actions.push({ ...actionBase, action: 'CROSS_SELL_RECOMMENDED', amount: 0, input: { productId: item.productId }, reason: SEED_SOURCE });
      actions.push({ ...actionBase, action: 'CROSS_SELL_ACCEPTED', amount: item.aiIncrementalAmount, input: { productId: item.productId }, reason: SEED_SOURCE });
    }
  }

  return {
    order: {
      userId: user._id,
      merchantId: merchant._id,
      items,
      subtotal: total,
      discount: 0,
      total,
      originalProductValue,
      crossSellRevenue,
      finalOrderValue: total,
      source: SEED_SOURCE,
      currency: merchant.currency || 'INR',
      delivery: profileFor(user),
      paymentStatus: 'PAID',
      status: 'COMPLETED',
      idempotencyKey: `${SEED_SOURCE}:${month + 1}:${index + 1}`,
      estimatedDeliveryDate: new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000),
      createdAt,
      updatedAt: createdAt,
    },
    payment: {
      userId: user._id,
      merchantId: merchant._id,
      amount: total,
      currency: merchant.currency || 'INR',
      status: 'VERIFIED_SUCCESS',
      verified: true,
      idempotencyKey: `${SEED_SOURCE}:payment:${month + 1}:${index + 1}`,
      razorpayOrderId: `${SEED_SOURCE}-rp-order-${month + 1}-${index + 1}`,
      razorpayPaymentId: `${SEED_SOURCE}-rp-payment-${month + 1}-${index + 1}`,
      createdAt,
      updatedAt: createdAt,
    },
    actions,
  };
};

async function seedHistoricalOrders() {
  await mongoose.connect(uri);
  try {
    const existing = await Order.countDocuments({ source: SEED_SOURCE });
    if (existing) {
      const seededOrders = await Order.find({ source: SEED_SOURCE }).select('_id paymentId').lean();
      const paymentIds = new Set(seededOrders.filter((order) => order.paymentId).map((order) => order._id.toString()));
      const payments = await Payment.find({ orderId: { $in: seededOrders.map((order) => order._id) } }).select('_id orderId').lean();
      const repairs = payments.filter((payment) => !paymentIds.has(payment.orderId.toString()));
      if (repairs.length) {
        await Order.bulkWrite(repairs.map((payment) => ({ updateOne: { filter: { _id: payment.orderId, source: SEED_SOURCE }, update: { $set: { paymentId: payment._id } } } })));
        console.log(`Repaired ${repairs.length} historical payment references.`);
      }
      console.log(`Historical seed already exists (${existing} orders). No changes made.`);
      return;
    }

    const merchant = await Merchant.findOne({ isActive: true }).lean();
    const user = await User.findOne({ role: 'CUSTOMER', isActive: true }).lean();
    const products = await Product.find({ merchantId: merchant?._id, active: true }).lean();
    if (!merchant || !user || products.length < 3) {
      throw new Error('An active merchant, customer, and at least three active products are required. Run the normal seed first.');
    }

    const generated = [];
    for (const config of MONTHS) {
      const nextRandom = random(20260101 + config.month * 7919);
      for (let index = 0; index < config.count; index += 1) {
        generated.push(buildOrder({ month: config.month, index, merchant, user, products, nextRandom }));
      }
    }

    const invalid = generated.find(({ order }) => !inHistoricalRange(order.createdAt));
    if (invalid) throw new Error(`Safety check failed: generated date ${invalid.order.createdAt.toISOString()} is outside January-August 2026.`);
    if (generated.some(({ order }) => order.createdAt >= END_DATE || order.createdAt < START_DATE)) {
      throw new Error('Safety check failed: refusing to insert an order outside the historical date range.');
    }

    const orders = await Order.insertMany(generated.map(({ order }) => order), { ordered: true });
    const paymentDocuments = generated.map(({ payment }, index) => ({ ...payment, orderId: orders[index]._id }));
    const payments = await Payment.insertMany(paymentDocuments, { ordered: true });
    await Order.bulkWrite(orders.map((order, index) => ({ updateOne: { filter: { _id: order._id }, update: { $set: { paymentId: payments[index]._id } } } })));
    const actions = generated.flatMap(({ actions: orderActions }) => orderActions);
    if (actions.length) await AgentAction.insertMany(actions, { ordered: true });

    console.log('Historical Order Seed Completed');
    for (const config of MONTHS) console.log(`${new Date(Date.UTC(2026, config.month, 1)).toLocaleDateString('en-US', { month: 'long' })}: ${config.count} orders`);
    console.log(`Total historical seeded orders: ${orders.length}`);
    console.log(`AI attribution actions: ${actions.length}`);
    console.log('September 2026 and future orders: PRESERVED');
  } finally {
    await mongoose.connection.close();
  }
}

seedHistoricalOrders().catch((error) => {
  console.error('Historical order seed failed:', error.message);
  process.exitCode = 1;
});
