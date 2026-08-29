require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../models/Product');
const Merchant = require('../models/Merchant');

const TARGET_COUNT = 600;
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-commerce';
const imageIds = {
  Phones: '1523275335684-37898b6baf30',
  Laptops: '1496181133206-80ce9b88a853',
  Headphones: '1505740420928-5e560c06d30e',
  Smartwatches: '1523275335684-37898b6baf30',
  Tablets: '1544244015-0df4b3ffc6b0',
  Cameras: '1516035069371-29a1b244cc32',
  Monitors: '1527443224154-c4a3942d3acf',
  Keyboards: '1587829741301-dc798b83add3',
  Gaming: '1542751371-adc38448a05e',
  Accessories: '1526170375885-4d8ecf77b99f',
};
const families = [
  ['Phones', 'Nova', 'Phone', 12000, 95000, ['daily use', 'photography', 'travel']],
  ['Laptops', 'CodeCraft', 'Laptop', 32000, 145000, ['coding', 'office', 'student']],
  ['Headphones', 'SoundCore', 'Headphones', 900, 18000, ['gaming', 'music', 'travel']],
  ['Smartwatches', 'Pulse', 'Watch', 1800, 25000, ['fitness', 'health', 'daily use']],
  ['Tablets', 'NovaTab', 'Tablet', 10000, 65000, ['study', 'entertainment', 'travel']],
  ['Cameras', 'VisionPro', 'Camera', 18000, 125000, ['photography', 'content creation', 'travel']],
  ['Monitors', 'ViewMax', 'Monitor', 8500, 55000, ['coding', 'gaming', 'office']],
  ['Keyboards', 'KeyCraft', 'Keyboard', 1000, 12000, ['coding', 'office', 'gaming']],
  ['Gaming', 'GameForge', 'Gaming', 3000, 180000, ['gaming', 'streaming', 'esports']],
  ['Accessories', 'NovaGear', 'Accessory', 500, 15000, ['travel', 'office', 'daily use']],
  ['Sarees', 'Aural', 'Saree', 1999, 7000, ['traditional', 'wedding', 'festive']],
  ['Jewellery', 'Luna', 'Bracelet', 499, 4500, ['gift', 'occasion', 'style']],
  ['Jewellery', 'Eon', 'Ring', 699, 3500, ['gift', 'occasion', 'style']],
];

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const imageFor = (subcategory) => `https://images.unsplash.com/photo-${imageIds[subcategory]}?auto=format&fit=crop&w=900&q=80`;
const nextSku = (usedSkus, sequence) => {
  let sku;
  do { sequence.value += 1; sku = `AI-${String(sequence.value).padStart(6, '0')}`; } while (usedSkus.has(sku));
  usedSkus.add(sku);
  return sku;
};
const priceFor = (min, max, index) => Math.round((min + ((index * 7919) % (max - min + 1))) / 10) * 10;

const buildProduct = (family, index, sku) => {
  const [subcategory, brand, noun, minPrice, maxPrice, useCases] = family;
  const model = `${brand} ${noun} ${String(index + 1).padStart(3, '0')}`;
  const price = priceFor(minPrice, maxPrice, index + sku.length);
  const discountPercentage = 5 + (index % 6) * 3;
  const originalPrice = Math.round(price / (1 - discountPercentage / 100));
  const stock = [0, 2, 5, 8, 12, 19, 25, 33, 40][index % 9];
  const stockStatus = stock === 0 ? 'OUT_OF_STOCK' : stock < 8 ? 'LOW_STOCK' : 'IN_STOCK';
  const keywords = [subcategory.toLowerCase(), noun.toLowerCase(), brand.toLowerCase(), ...useCases];
  const specifications = {
    Brand: brand,
    Category: subcategory,
    UseCases: useCases.join(', '),
    Variant: `${8 + (index % 9)} series`,
    Connectivity: index % 2 ? 'Bluetooth 5.3' : 'Wi-Fi and USB-C',
  };
  return {
    merchantId: null,
    name: model,
    sku,
    slug: slugify(`${model}-${sku}`),
    brand,
    subcategory,
    shortDescription: `${model} is built for ${useCases[0]}, ${useCases[1]}, and dependable everyday performance.`,
    keyFeatures: [`${useCases[0]} focused design`, 'Quality-tested materials', `${index % 2 ? 'Wireless' : 'USB-C'} connectivity`],
    description: `${model} combines practical features with reliable performance for ${useCases.join(', ')}. It is designed for shoppers who want clear value and flexible everyday use.`,
    category: 'Electronics',
    price,
    originalPrice,
    discountPercentage,
    currency: 'INR',
    stock,
    stockStatus,
    variants: [{ name: 'Colour', options: [{ name: 'Default', value: index % 2 ? 'Graphite' : 'Silver' }] }],
    ratings: { average: Number((4 + (index % 10) / 10).toFixed(1)), count: 10 + index * 3, ratingDistribution: { 5: 60, 4: 25, 3: 10, 2: 3, 1: 2 } },
    seller: { name: 'AI Commerce Marketplace', rating: 4.7, verified: true },
    delivery: { free: true, estimatedDays: 4, details: 'Free delivery on eligible orders' },
    warranty: { duration: '1 year', details: 'Manufacturer warranty where applicable' },
    returnPolicy: { windowDays: 7, details: 'Easy returns on eligible items' },
    aiMetadata: { useCases, targetAudience: ['value-conscious shoppers'], budgetSegment: price < 10000 ? 'budget' : price < 50000 ? 'mid-range' : 'premium', intentTags: keywords, recommendationReasons: [`Useful for ${useCases[0]}`, 'Strong everyday value'] },
    images: [imageFor(subcategory)],
    tags: keywords,
    specifications,
    active: true,
  };
};

async function seedProducts() {
  await mongoose.connect(uri);
  try {
    const existingCount = await Product.countDocuments();
    const existingSkus = new Set((await Product.find({}, { sku: 1, _id: 0 }).lean()).map((product) => product.sku).filter(Boolean));
    const merchants = await Merchant.find({ isActive: true }).select('_id').lean();
    const merchant = merchants[0];
    if (!merchant) throw new Error('No active merchant exists');

    const required = Math.max(TARGET_COUNT - existingCount, 0);
    if (!required) {
      console.log(JSON.stringify({ existingProducts: existingCount, productsRequired: 0, productsGenerated: 0, productsInserted: 0, duplicateSkus: 0, errors: 0, totalProducts: existingCount }));
      return;
    }

    const sequence = { value: 0 };
    const batch = Array.from({ length: required }, (_, index) => {
      const family = families[index % families.length];
      const product = buildProduct(family, index, nextSku(existingSkus, sequence));
      product.merchantId = merchant._id;
      return new Product(product);
    });
    const validationErrors = batch.map((product) => product.validateSync()).filter(Boolean);
    if (validationErrors.length) {
      throw new Error(`Generated product validation failed for ${validationErrors.length} products`);
    }

    let inserted;
    let duplicateSkus = 0;
    let errors = 0;
    try {
      inserted = await Product.insertMany(batch, { ordered: false });
    } catch (error) {
      duplicateSkus = error.writeErrors?.filter((entry) => entry.code === 11000).length || 0;
      errors = error.writeErrors?.length || 1;
      inserted = error.insertedDocs || [];
    }
    const finalCount = await Product.countDocuments();
    console.log(JSON.stringify({ existingProducts: existingCount, productsRequired: required, productsGenerated: batch.length, productsInserted: inserted.length, duplicateSkus, errors, totalProducts: finalCount, skuRange: { first: batch[0].sku, last: batch[batch.length - 1].sku } }));
  } finally {
    await mongoose.disconnect();
  }
}

seedProducts().catch((error) => { console.error(JSON.stringify({ errors: 1, message: error.message })); process.exitCode = 1; });
