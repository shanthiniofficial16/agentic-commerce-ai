const mongoose = require('mongoose');
const Merchant = require('./src/models/Merchant');
const Product = require('./src/models/Product');
const { executeTool } = require('./src/services/agent/tools');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/ai-commerce');
    const merchant = await Merchant.findOne({ isActive: true, aiAgentEnabled: true }).lean();
    const context = { userId: '507f1f77bcf86cd799439011', merchantId: merchant && merchant._id.toString() };
    const raw = await Product.find({ merchantId: context.merchantId, active: true }).limit(5).lean();
    console.log('MERCHANT', { id: context.merchantId, count: raw.length, sample: raw.map((p) => ({ name: p.name, category: p.category, subcategory: p.subcategory, price: p.price })) });

    const q1 = await executeTool('searchProducts', { query: 'I need a laptop', keywords: 'I need a laptop', category: 'Laptops', inStock: true }, context);
    console.log('Q1', JSON.stringify(q1, null, 2));

    const q2 = await executeTool('searchProducts', { query: 'laptop', keywords: 'laptop' }, context);
    console.log('Q2', JSON.stringify(q2, null, 2));

    const q3 = await executeTool('searchProducts', { category: 'Laptops', inStock: true }, context);
    console.log('Q3', JSON.stringify(q3, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error('SEARCH_DEBUG_ERROR', error);
    process.exit(1);
  }
})();
