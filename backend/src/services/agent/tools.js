const mongoose = require('mongoose');
const Cart = require('../../models/Cart');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const { createOrder, getProfile, profileStatus, prepareOrder, prepareCartOrder, saveProfile, profileFields } = require('../order.service');

const productView = (product) => ({
  id: product._id.toString(),
  name: product.name,
  brand: product.brand,
  category: product.category,
  subcategory: product.subcategory,
  price: product.price,
  originalPrice: product.originalPrice,
  discountPercentage: product.discountPercentage,
  currency: product.currency,
  description: product.shortDescription || product.description,
  keyFeatures: product.keyFeatures,
  specifications: product.specifications,
  stock: product.stock,
  stockStatus: product.stockStatus,
  rating: product.ratings?.average,
  reviewCount: product.ratings?.count,
  images: product.images,
});

const validId = (value, name) => {
  if (!mongoose.isValidObjectId(value)) throw new Error(`${name} must be a valid product ID`);
  return value;
};

const tools = [
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description: 'Search the live product catalog using customer requirements.',
      parameters: { type: 'object', properties: {
        query: { type: 'string' }, keywords: { type: 'string' }, category: { type: 'string' }, brand: { type: 'string' },
        minPrice: { type: 'number', minimum: 0 }, maxPrice: { type: 'number', minimum: 0 },
        minRating: { type: 'number', minimum: 0, maximum: 5 }, inStock: { type: 'boolean' },
      } },
    },
  },
  {
    type: 'function',
    function: { name: 'getProductDetails', description: 'Get complete facts for one catalog product.', parameters: { type: 'object', required: ['productId'], properties: { productId: { type: 'string' } } } },
  },
  {
    type: 'function',
    function: { name: 'checkInventory', description: 'Check live stock for one catalog product.', parameters: { type: 'object', required: ['productId'], properties: { productId: { type: 'string' } } } },
  },
  {
    type: 'function',
    function: { name: 'getCart', description: 'Get the authenticated customer cart.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: { name: 'addToCart', description: 'Add a live in-stock product to the authenticated customer cart.', parameters: { type: 'object', required: ['productId', 'quantity'], properties: { productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 100 } } } },
  },
  {
    type: 'function',
    function: { name: 'removeFromCart', description: 'Remove a product from the authenticated customer cart.', parameters: { type: 'object', required: ['productId'], properties: { productId: { type: 'string' } } } },
  },
  {
    type: 'function',
    function: { name: 'updateCart', description: 'Set the quantity of a product in the authenticated customer cart.', parameters: { type: 'object', required: ['productId', 'quantity'], properties: { productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 100 } } } },
  },
  {
    type: 'function',
    function: { name: 'clearCart', description: 'Remove every item from the authenticated customer cart when the customer explicitly asks to clear it.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: { name: 'compareProducts', description: 'Compare two or more real catalog products using only their stored facts.', parameters: { type: 'object', required: ['productIds'], properties: { productIds: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } } } } },
  },
  {
    type: 'function',
    function: { name: 'navigate', description: 'Open an existing application route for the authenticated customer.', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string', enum: ['/shop', '/shop/products', '/shop/cart', '/shop/checkout', '/shop/orders', '/shop/profile'] } } } },
  },
  {
    type: 'function',
    function: { name: 'startCheckout', description: 'Prepare the current real cart for checkout and open the existing checkout page.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: { name: 'proceedToPayment', description: 'Prepare the current real cart and open the existing secure payment boundary without handling payment credentials.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: { name: 'getMyOrders', description: 'List orders belonging only to the authenticated customer.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: { name: 'getOrderDetails', description: 'Get one order belonging only to the authenticated customer.', parameters: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'string' } } } },
  },
  {
    type: 'function',
    function: { name: 'trackOrder', description: 'Get the current status of one authenticated customer order.', parameters: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'string' } } } },
  },
  {
    type: 'function',
    function: { name: 'getCustomerProfile', description: 'Get the authenticated customer delivery profile.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: { name: 'updateCustomerProfile', description: 'Save any provided delivery detail fields for the authenticated customer. Merge with existing details and never include payment credentials.', parameters: { type: 'object', properties: { fullName: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, address: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' }, pincode: { type: 'string' } } } },
  },
  {
    type: 'function',
    function: { name: 'prepareOrder', description: 'Prepare an order preview using current database price, inventory, and saved delivery profile. Does not create an order.', parameters: { type: 'object', required: ['productId', 'quantity'], properties: { productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 100 } } } },
  },
  {
    type: 'function',
    function: { name: 'prepareCartOrder', description: 'Prepare an order preview for every item in the authenticated customer cart using current database price, inventory, and saved delivery profile.', parameters: { type: 'object', properties: {} } },
  },
];

const executeTool = async (name, rawArgs, context) => {
  const args = rawArgs || {};
  const { userId, merchantId } = context;
  if (name === 'searchProducts') {
    const query = { merchantId, active: true };
    if (args.category) {
      const category = new RegExp(args.category, 'i');
      query.$or = [{ category }, { subcategory: category }];
    }
    if (args.brand) query.brand = new RegExp(args.brand, 'i');
    const keywords = args.keywords || args.query;
    if (keywords) query.$text = { $search: keywords };
    if (args.minPrice !== undefined || args.maxPrice !== undefined) query.price = { ...(args.minPrice !== undefined ? { $gte: args.minPrice } : {}), ...(args.maxPrice !== undefined ? { $lte: args.maxPrice } : {}) };
    if (args.minRating !== undefined) query['ratings.average'] = { $gte: args.minRating };
    if (args.inStock) query.stock = { $gt: 0 };
    const products = await Product.find(query).sort(keywords ? { score: { $meta: 'textScore' } } : { createdAt: -1 }).limit(20).lean();
    return { products: products.map(productView), count: products.length };
  }
  if (name === 'getProductDetails') {
    const product = await Product.findOne({ _id: validId(args.productId, 'productId'), merchantId, active: true }).lean();
    if (!product) throw new Error('Product not found');
    return { product: productView(product) };
  }
  if (name === 'checkInventory') {
    const product = await Product.findOne({ _id: validId(args.productId, 'productId'), merchantId, active: true }).select('name stock stockStatus').lean();
    if (!product) throw new Error('Product not found');
    return { productId: product._id.toString(), name: product.name, stock: product.stock, stockStatus: product.stockStatus, available: product.stock > 0 };
  }
  if (name === 'getCart') {
    const cart = await Cart.findOne({ userId, merchantId, status: 'ACTIVE' }).populate('items.productId').lean();
    return { cart: cart ? { items: cart.items, subtotal: cart.subtotal, discount: cart.discount, total: cart.total, currency: 'INR' } : null };
  }
  if (name === 'addToCart') {
    const quantity = Number(args.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('quantity must be an integer between 1 and 100');
    const product = await Product.findOne({ _id: validId(args.productId, 'productId'), merchantId, active: true });
    if (!product) throw new Error('Product not found');
    if (product.stock < quantity) throw new Error(`Only ${product.stock} units are available`);
    let cart = await Cart.findOne({ userId, merchantId, status: 'ACTIVE' });
    if (!cart) cart = new Cart({ userId, merchantId, items: [] });
    const item = cart.items.find((entry) => entry.productId.toString() === product._id.toString());
    if (item) { if (product.stock < item.quantity + quantity) throw new Error(`Only ${product.stock} units are available`); item.quantity += quantity; } else cart.items.push({ productId: product._id, quantity, price: product.price, source: ['ai_cross_sell', 'ai_upsell'].includes(args.source) ? args.source : 'customer' });
    cart.subtotal = cart.items.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
    cart.total = cart.subtotal - cart.discount;
    await cart.save();
    const verified = await Cart.findOne({ _id: cart._id, userId, merchantId, status: 'ACTIVE' }).populate('items.productId').lean();
    const verifiedItem = verified.items.find((entry) => entry.productId?._id?.toString() === product._id.toString());
    return { added: true, verified: Boolean(verifiedItem && verifiedItem.quantity >= quantity), product: productView(product), quantity, subtotal: verified.subtotal, total: verified.total, cart: { items: verified.items, subtotal: verified.subtotal, total: verified.total } };
  }
  if (name === 'removeFromCart') {
    const cart = await Cart.findOne({ userId, merchantId, status: 'ACTIVE' });
    if (!cart) throw new Error('Cart not found');
    cart.items = cart.items.filter((item) => item.productId.toString() !== validId(args.productId, 'productId'));
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cart.total = cart.subtotal - cart.discount;
    await cart.save();
    const verified = await Cart.findOne({ _id: cart._id, userId, merchantId, status: 'ACTIVE' }).lean();
    return { removed: true, verified: !verified.items.some((item) => item.productId.toString() === args.productId), subtotal: verified.subtotal, total: verified.total, cart: { items: verified.items, subtotal: verified.subtotal, total: verified.total } };
  }
  if (name === 'updateCart') {
    const quantity = Number(args.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('quantity must be an integer between 1 and 100');
    const product = await Product.findOne({ _id: validId(args.productId, 'productId'), merchantId, active: true });
    if (!product) throw new Error('Product not found');
    if (product.stock < quantity) throw new Error(`Only ${product.stock} units are available`);
    const cart = await Cart.findOne({ userId, merchantId, status: 'ACTIVE' });
    if (!cart) throw new Error('Cart not found');
    const item = cart.items.find((entry) => entry.productId.toString() === product._id.toString());
    if (!item) throw new Error('Item not in cart');
    item.quantity = quantity;
    cart.subtotal = cart.items.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
    cart.total = cart.subtotal - cart.discount;
    await cart.save();
    const verified = await Cart.findOne({ _id: cart._id, userId, merchantId, status: 'ACTIVE' }).lean();
    return { updated: true, verified: verified?.items.some((entry) => entry.productId.toString() === product._id.toString() && entry.quantity === quantity), product: productView(product), quantity, subtotal: verified?.subtotal ?? cart.subtotal, total: verified?.total ?? cart.total };
  }
  if (name === 'clearCart') {
    const cart = await Cart.findOne({ userId, merchantId, status: 'ACTIVE' });
    if (!cart) return { cleared: true, verified: true, subtotal: 0, total: 0 };
    cart.items = [];
    cart.subtotal = 0;
    cart.total = 0;
    await cart.save();
    const verified = await Cart.findOne({ _id: cart._id, userId, merchantId, status: 'ACTIVE' }).lean();
    return { cleared: true, verified: !verified?.items?.length, subtotal: verified?.subtotal ?? 0, total: verified?.total ?? 0 };
  }
  if (name === 'compareProducts') {
    const productIds = [...new Set((args.productIds || []).map((id) => validId(id, 'productId')))].slice(0, 4);
    if (productIds.length < 2) throw new Error('At least two products are required for comparison');
    const products = await Product.find({ _id: { $in: productIds }, merchantId, active: true }).lean();
    if (products.length !== productIds.length) throw new Error('One or more products could not be found');
    return { products: products.map(productView), comparison: products.map((product) => ({ id: product._id.toString(), name: product.name, price: product.price, stock: product.stock, specifications: product.specifications || {}, rating: product.ratings?.average })) };
  }
  if (name === 'navigate') {
    const allowedPaths = ['/shop', '/shop/products', '/shop/cart', '/shop/checkout', '/shop/orders', '/shop/profile'];
    if (!allowedPaths.includes(args.path)) throw new Error('Unsupported application route');
    return { navigated: true, path: args.path };
  }
  if (name === 'startCheckout' || name === 'proceedToPayment') {
    const result = await executeTool('prepareCartOrder', {}, context);
    return { ...result, action: { type: name === 'proceedToPayment' ? 'PROCEED_TO_PAYMENT' : 'START_CHECKOUT', path: '/shop/checkout' } };
  }
  if (name === 'getMyOrders') {
    const orders = await Order.find({ userId, merchantId }).sort({ createdAt: -1 }).limit(10).lean();
    return { orders: orders.map((order) => ({ id: order._id.toString(), items: order.items, total: order.total, currency: order.currency, paymentStatus: order.paymentStatus, status: order.status, estimatedDeliveryDate: order.estimatedDeliveryDate, createdAt: order.createdAt })) };
  }
  if (name === 'getOrderDetails' || name === 'trackOrder') {
    const order = await Order.findOne({ _id: validId(args.orderId, 'orderId'), userId, merchantId }).lean();
    if (!order) throw new Error('Order not found');
    return name === 'trackOrder'
      ? { orderId: order._id.toString(), status: order.status, createdAt: order.createdAt }
      : { order: { id: order._id.toString(), items: order.items, subtotal: order.subtotal, total: order.total, currency: order.currency, status: order.status, createdAt: order.createdAt } };
  }
  if (name === 'getCustomerProfile') {
    const profile = await getProfile(userId);
    return { ...profileStatus(profile), profile: profile ? { ...profile, phone: profile.phone.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2') } : null };
  }
  if (name === 'updateCustomerProfile') {
    const supplied = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined && value !== null && String(value).trim()));
    const profile = await saveProfile(userId, supplied);
    const missingFields = profileFields.filter((field) => !profile?.[field]?.toString().trim());
    const status = profileStatus(profile);
    return { saved: status.profileComplete, missingFields, invalidFields: status.invalidFields, profile: { ...profile, phone: profile.phone.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2') } };
  }
  if (name === 'prepareOrder') {
    const result = await prepareOrder({ userId, merchantId, productId: validId(args.productId, 'productId'), quantity: Number(args.quantity) });
    context.pendingOrder = ['AWAITING_APPROVAL', 'PENDING_CONFIRMATION'].includes(result?.state) ? result : null;
    return result;
  }
  if (name === 'prepareCartOrder') {
    const result = await prepareCartOrder({ userId, merchantId });
    context.pendingOrder = result;
    return result;
  }
  throw new Error('Unsupported agent tool');
};

module.exports = { tools, executeTool };