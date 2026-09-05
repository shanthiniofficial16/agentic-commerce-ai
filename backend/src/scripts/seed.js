const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Merchant = require('../models/Merchant');
const Product = require('../models/Product');
const Category = require('../models/Category');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-commerce';
const categoryData = [
  ['Electronics', 'phones, computers, audio and smart devices', ['Phones', 'Laptops', 'Audio', 'Smart Home']],
  ['Fashion', 'everyday clothing and footwear', ['Shoes', 'Clothing', 'Outerwear']],
  ['Beauty', 'carefully selected personal care essentials', ['Skincare', 'Haircare', 'Makeup']],
  ['Home & Kitchen', 'useful objects for a better home', ['Kitchen', 'Appliances', 'Decor']],
  ['Grocery', 'pantry staples and better snacking', ['Pantry', 'Beverages', 'Snacks']],
  ['Sports', 'gear for movement and recovery', ['Fitness', 'Running', 'Outdoor']],
  ['Books', 'ideas worth making time for', ['Business', 'Fiction', 'Learning']],
  ['Accessories', 'small upgrades that go a long way', ['Bags', 'Desk', 'Travel']],
];
const catalog = [
  ['Electronics', 'NovaPhone X1', 'Nova', 'Phones', 42999], ['Electronics', 'OrbitPhone Lite', 'Orbit', 'Phones', 24999], ['Electronics', 'CodeCraft 14 Laptop', 'CodeCraft', 'Laptops', 67999], ['Electronics', 'PixelDesk Air Laptop', 'PixelDesk', 'Laptops', 55999], ['Electronics', 'SonicArc ANC Headphones', 'SonicArc', 'Audio', 5999], ['Electronics', 'Pulse Mini Speaker', 'Pulse', 'Audio', 2499], ['Electronics', 'Halo Smart Lamp', 'Halo', 'Smart Home', 1899],
  ['Fashion', 'Stride Knit Runner', 'Stride', 'Shoes', 3499], ['Fashion', 'Terra Trail Shoe', 'Terra', 'Shoes', 4299], ['Fashion', 'Northline Cotton Shirt', 'Northline', 'Clothing', 1799], ['Fashion', 'Everyday Relaxed Trousers', 'Form', 'Clothing', 2299], ['Fashion', 'Coastline Hoodie', 'Coastline', 'Outerwear', 2799], ['Fashion', 'Lumen Overshirt', 'Lumen', 'Outerwear', 3199],
  ['Beauty', 'Dewdrop Hydration Serum', 'Dewdrop', 'Skincare', 1299], ['Beauty', 'Calm Barrier Moisturiser', 'Calm', 'Skincare', 899], ['Beauty', 'Root & Rise Shampoo', 'Root & Rise', 'Haircare', 749], ['Beauty', 'Silkline Hair Mask', 'Silkline', 'Haircare', 1099], ['Beauty', 'Daylight Tint Balm', 'Daylight', 'Makeup', 699], ['Beauty', 'Soft Focus Lip Colour', 'Soft Focus', 'Makeup', 599],
  ['Home & Kitchen', 'CrispAir Fryer 4L', 'CrispAir', 'Kitchen', 5499], ['Home & Kitchen', 'Stoneware Brew Set', 'Hearth', 'Kitchen', 1599], ['Home & Kitchen', 'WhiskPro Mixer', 'WhiskPro', 'Appliances', 3299], ['Home & Kitchen', 'WarmGlow Table Lamp', 'WarmGlow', 'Decor', 2199], ['Home & Kitchen', 'Linen Grid Cushion', 'Linen Grid', 'Decor', 799], ['Home & Kitchen', 'PureSteam Iron', 'PureSteam', 'Appliances', 2499],
  ['Grocery', 'Morning Roast Coffee', 'Morning Roast', 'Beverages', 499], ['Grocery', 'Cocoa Almond Granola', 'Good Grain', 'Snacks', 379], ['Grocery', 'Golden Harvest Oats', 'Golden Harvest', 'Pantry', 249], ['Grocery', 'Citrus Sparkling Water', 'Citrus', 'Beverages', 299], ['Grocery', 'Garden Herb Pasta', 'Garden Table', 'Pantry', 189], ['Grocery', 'Sea Salt Nut Mix', 'Trail Pantry', 'Snacks', 329],
  ['Sports', 'StrideFlex Yoga Mat', 'StrideFlex', 'Fitness', 1499], ['Sports', 'CoreLoop Resistance Set', 'CoreLoop', 'Fitness', 1199], ['Sports', 'PaceRun Daily Trainer', 'PaceRun', 'Running', 3899], ['Sports', 'AeroLite Running Bottle', 'AeroLite', 'Running', 699], ['Sports', 'CampNest Day Pack', 'CampNest', 'Outdoor', 2499], ['Sports', 'TrailBeam Headlamp', 'TrailBeam', 'Outdoor', 999],
  ['Books', 'The Quiet Advantage', 'Mira Sen', 'Business', 499], ['Books', 'Signals in the Rain', 'Ari Vale', 'Fiction', 399], ['Books', 'Build Better Habits', 'Nikhil Rao', 'Learning', 599], ['Books', 'Small Teams, Big Work', 'Leah Moss', 'Business', 549], ['Books', 'The Map of Ordinary Days', 'Ira Bell', 'Fiction', 449], ['Books', 'Learn by Making', 'Theo Park', 'Learning', 649],
  ['Accessories', 'MetroFold Laptop Backpack', 'MetroFold', 'Bags', 2199], ['Accessories', 'ArcDesk Mechanical Keyboard', 'ArcDesk', 'Desk', 3999], ['Accessories', 'Glide Wireless Mouse', 'Glide', 'Desk', 1499], ['Accessories', 'DockMate USB-C Hub', 'DockMate', 'Desk', 2299], ['Accessories', 'Voyage Packing Cubes', 'Voyage', 'Travel', 1299], ['Accessories', 'LoopCable Organizer', 'Loop', 'Travel', 399],
  ['Fashion', 'Aural Silk Saree', 'Aural', 'Sarees', 4999], ['Fashion', 'Pari Cotton Saree', 'Pari', 'Sarees', 2999], ['Fashion', 'Luna Pearl Bracelet', 'Luna', 'Jewellery', 899], ['Fashion', 'Eon Gold Ring', 'Eon', 'Jewellery', 1199], ['Electronics', 'CodeCraft Laptop 162 Plus', 'CodeCraft', 'Laptops', 69999],
];
const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const imageIds = { Phones: '1511707171634-5f897ff02aa9', Laptops: '1496181133206-80ce9b88a853', Audio: '1505740420928-5e560c06d30e', 'Smart Home': '1558008258-3256797b43f3', Shoes: '1542291026-7eec264c27ff', Clothing: '1529139574466-a303027c1d8b', Outerwear: '1551488831-00ddcb6c6bd3', Skincare: '1556228578-0d85b1a4d571', Haircare: '1522337360788-8b13dee7a37e', Makeup: '1596462502278-27bfdc403348', Kitchen: '1556911220-e15b29be8c8f', Appliances: '1585515320310-259814833e62', Decor: '1618220179428-22790b461013', Beverages: '1544145945-f90425340c7e', Snacks: '1606787366850-de6330128bfc', Pantry: '1542838132-92c53300491e', Fitness: '1517836357463-d25dfeac3438', Running: '1552674605-db6ffd4facb5', Outdoor: '1551632811-561732d1e306', Business: '1495446815901-a7297e633e8d', Fiction: '1544947950-fa07a98d237f', Learning: '1523779917675-b6ed3a42a561', Bags: '1553062407-98eeb64c6a62', Desk: '1527814050087-3793815479db', Travel: '1581553680321-4fffae59fccd', Sarees: '1610030469983-98e550d6193c', Jewellery: '1515562141207-7a88fb7ce338' };
const imageFor = (subcategory, name = '') => {
  const text = name.toLowerCase();
  const imageId = text.includes('speaker') ? '1545454675-3531b543be5d' : text.includes('keyboard') ? '1587829741301-dc798b83add3' : text.includes('mouse') ? '1527814050087-3793815479db' : text.includes('hub') ? '1625842268584-8f3296236761' : text.includes('bottle') ? '1602143407151-7111542de6e8' : text.includes('headlamp') ? '1550951298-5e5d8c5a4d3f' : text.includes('trainer') ? '1542291026-7eec264c27ff' : imageIds[subcategory] || '1526170375885-4d8ecf77b99f';
  return `https://images.unsplash.com/photo-${imageId}?auto=format&fit=crop&w=900&q=80`;
};

async function seed() {
  await mongoose.connect(uri);
  try {
    await Promise.all([Product.deleteMany({}), Category.deleteMany({}), Merchant.deleteMany({}), User.deleteMany({})]);
    const categories = await Category.insertMany(categoryData.map(([name, description, subcategories]) => ({ name, slug: slugify(name), description, subcategories })));
    const merchantUser = await User.create({ name: 'AI Commerce Marketplace', email: 'merchant@example.com', passwordHash: 'test123', role: 'MERCHANT' });
    const merchant = await Merchant.create({ userId: merchantUser._id, name: 'AI Commerce Marketplace', description: 'A curated marketplace for useful things.', currency: 'INR', aiAgentEnabled: true });
    merchantUser.merchantId = merchant._id;
    await merchantUser.save();
    const products = await Product.insertMany(catalog.map(([category, name, brand, subcategory, basePrice], index) => {
      const discount = 8 + (index % 5) * 3;
      const originalPrice = basePrice;
      const price = Math.round(basePrice * (1 - discount / 100));
      return { merchantId: merchant._id, sku: `AC-${String(index + 1).padStart(4, '0')}`, slug: slugify(name), name, brand, category, subcategory, shortDescription: `${name} by ${brand}, selected for everyday value.`, description: `A considered ${subcategory.toLowerCase()} essential with dependable performance and a thoughtful design.`, keyFeatures: ['Quality-tested materials', 'Designed for everyday use', 'Simple, reliable experience'], price, originalPrice, discountPercentage: discount, currency: 'INR', stock: 12 + (index % 6) * 7, stockStatus: 'IN_STOCK', images: [imageFor(subcategory, name)], variants: [{ name: 'Colour', options: [{ name: 'Default', value: 'Classic' }] }], tags: [category.toLowerCase(), subcategory.toLowerCase(), brand.toLowerCase()], specifications: { Brand: brand, Category: subcategory, 'Care': 'See product packaging' }, ratings: { average: Number((4.1 + (index % 9) / 10).toFixed(1)), count: 18 + index * 7, ratingDistribution: { 5: 60, 4: 25, 3: 10, 2: 3, 1: 2 } }, seller: { name: 'AI Commerce Marketplace', rating: 4.7, verified: true }, delivery: { free: true, estimatedDays: 4, details: 'Free delivery on eligible orders' }, warranty: { duration: '1 year', details: 'Manufacturer warranty where applicable' }, returnPolicy: { windowDays: 7, details: 'Easy returns on eligible items' }, aiMetadata: { useCases: ['everyday use', subcategory.toLowerCase()], targetAudience: ['value-conscious shoppers'], budgetSegment: price < 2000 ? 'budget' : price < 10000 ? 'mid-range' : 'premium', intentTags: [brand.toLowerCase(), subcategory.toLowerCase()], recommendationReasons: ['Strong ratings from similar shoppers', 'Fits a practical everyday purchase'] }, active: true };
    }));
    for (let index = 0; index < products.length; index += 1) {
      products[index].aiMetadata.complementaryProductIds = [products[(index + 1) % products.length]._id];
      products[index].aiMetadata.similarProductIds = [products[(index + 2) % products.length]._id];
      await products[index].save();
    }
    await User.create({
      name: 'Customer',
      email: 'customer@example.com',
      passwordHash: 'test123',
      role: 'CUSTOMER',
      profile: {
        fullName: 'Customer',
        phone: '9876543210',
        email: 'customer@example.com',
        street: '123 Market Street',
        building: 'A-12',
        landmark: 'Near City Center',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    });
    console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
    console.log('Customer: customer@example.com / test123');
    console.log('Merchant: merchant@example.com / test123');
  } finally {
    await mongoose.connection.close();
  }
}
seed().catch((error) => { console.error('Seed failed:', error.message); process.exitCode = 1; });
