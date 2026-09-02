const mongoose = require('mongoose');
const Product = require('./src/models/Product');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/ai-commerce');
    const total = await Product.countDocuments({ active: true });
    const sample = await Product.find({ active: true }).sort({ createdAt: -1 }).limit(12).lean();
    const laptops = await Product.find({ active: true, $or: [{ category: /laptop/i }, { subcategory: /laptop/i }, { name: /laptop/i }] }).limit(10).lean();
    const accessories = await Product.find({ active: true, $or: [{ category: /accessory/i }, { subcategory: /bag|mouse|keyboard|hub|sleeve|cooling/i }, { name: /bag|mouse|keyboard|hub|sleeve|cooling/i }] }).limit(20).lean();
    console.log(JSON.stringify({
      total,
      sample: sample.map((p) => ({ name: p.name, category: p.category, subcategory: p.subcategory, price: p.price, stock: p.stock, tags: p.tags ? p.tags.slice(0, 6) : [] })),
      laptopCount: laptops.length,
      laptopSample: laptops.map((p) => ({ name: p.name, category: p.category, subcategory: p.subcategory, price: p.price, stock: p.stock })),
      accessoryCount: accessories.length,
      accessorySample: accessories.map((p) => ({ name: p.name, category: p.category, subcategory: p.subcategory, price: p.price, stock: p.stock }))
    }, null, 2));
    await mongoose.disconnect();
  } catch (error) {
    console.error('CHECK_ERROR', error);
    process.exit(1);
  }
})();
