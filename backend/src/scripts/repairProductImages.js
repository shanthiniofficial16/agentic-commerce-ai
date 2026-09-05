require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../models/Product');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-commerce';
const imageIds = {
  Phones: '1511707171634-5f897ff02aa9', Laptops: '1496181133206-80ce9b88a853', Audio: '1505740420928-5e560c06d30e',
  'Smart Home': '1558008258-3256797b43f3', Shoes: '1542291026-7eec264c27ff', Clothing: '1529139574466-a303027c1d8b',
  Outerwear: '1551488831-00ddcb6c6bd3', Skincare: '1556228578-0d85b1a4d571', Haircare: '1522337360788-8b13dee7a37e',
  Makeup: '1596462502278-27bfdc403348', Kitchen: '1556911220-e15b29be8c8f', Appliances: '1585515320310-259814833e62',
  Decor: '1618220179428-22790b461013', Beverages: '1544145945-f90425340c7e', Snacks: '1606787366850-de6330128bfc',
  Pantry: '1542838132-92c53300491e', Fitness: '1517836357463-d25dfeac3438', Running: '1552674605-db6ffd4facb5',
  Outdoor: '1551632811-561732d1e306', Business: '1495446815901-a7297e633e8d', Fiction: '1544947950-fa07a98d237f',
  Learning: '1523779917675-b6ed3a42a561', Bags: '1553062407-98eeb64c6a62', Desk: '1527814050087-3793815479db',
  Travel: '1581553680321-4fffae59fccd', Sarees: '1610030469983-98e550d6193c', Jewellery: '1515562141207-7a88fb7ce338',
  Books: '1544947950-fa07a98d237f',
};

const imageFor = (subcategory, name = '') => {
  const text = name.toLowerCase();
  const imageId = text.includes('ordinary days') ? '1544947950-fa07a98d237f' : text.includes('better habits') ? '1495446815901-a7297e633e8d' : text.includes('quiet advantage') ? '1523779917675-b6ed3a42a561' : text.includes('signals in the rain') ? '1512820790803-83ca734da794' : text.includes('small teams') ? '1576872381149-7d89d724b5ff' : text.includes('learn by making') ? '1532012197267-da84d127e765' : text.includes('speaker') ? '1545454675-3531b543be5d' : text.includes('keyboard') ? '1587829741301-dc798b83add3' : text.includes('mouse') ? '1527814050087-3793815479db' : text.includes('hub') ? '1625842268584-8f3296236761' : text.includes('bottle') ? '1602143407151-7111542de6e8' : text.includes('headlamp') ? '1506260408121-e353d10b87c7' : text.includes('trainer') ? '1542291026-7eec264c27ff' : imageIds[subcategory];
  return imageId ? `https://images.unsplash.com/photo-${imageId}?auto=format&fit=crop&w=900&q=80` : null;
};

async function repairProductImages() {
  await mongoose.connect(uri);
  try {
    const products = await Product.find({ active: true }).select('_id name subcategory').lean();
    const operations = products
      .map((product) => ({ id: product._id, image: imageFor(product.subcategory, product.name) }))
      .filter((product) => product.image)
      .map((product) => ({ updateOne: { filter: { _id: product.id }, update: { $set: { images: [product.image] } } } }));
    if (operations.length) await Product.bulkWrite(operations);
    console.log(`Repaired images for ${operations.length} active products.`);
  } finally {
    await mongoose.connection.close();
  }
}

repairProductImages().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});