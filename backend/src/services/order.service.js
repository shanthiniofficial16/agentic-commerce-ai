const mongoose = require('mongoose');
const CustomerProfile = require('../models/CustomerProfile');
const Order = require('../models/Order');
const Product = require('../models/Product');

const profileFields = ['fullName', 'phone', 'email', 'address', 'city', 'state', 'pincode'];
const validateProfile = (value) => {
  const missing = profileFields.filter((field) => !value?.[field]?.toString().trim());
  if (missing.length) return `Missing required details: ${missing.join(', ')}`;
  if (!/^[6-9]\d{9}$/.test(value.phone)) return 'Please provide a valid 10-digit Indian mobile number';
  if (!/^\S+@\S+\.\S+$/.test(value.email)) return 'Please provide a valid email address';
  if (!/^\d{6}$/.test(value.pincode)) return 'Please provide a valid 6-digit pincode';
  return null;
};

const getProfile = (userId) => CustomerProfile.findOne({ userId }).lean();

const saveProfile = async (userId, input) => {
  const profile = { ...input, userId };
  const error = validateProfile(profile);
  if (error) throw Object.assign(new Error(error), { code: 'PROFILE_INVALID', status: 400 });
  return CustomerProfile.findOneAndUpdate({ userId }, profile, { new: true, upsert: true, runValidators: true }).lean();
};

const prepareOrder = async ({ userId, merchantId, productId, quantity = 1 }) => {
  if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw Object.assign(new Error('Invalid product or quantity'), { code: 'ORDER_INVALID', status: 400 });
  const profile = await getProfile(userId);
  if (!profile) return { state: 'PROFILE_REQUIRED', productId: productId.toString(), quantity, requiredFields: profileFields };
  const product = await Product.findOne({ _id: productId, merchantId, active: true }).lean();
  if (!product) throw Object.assign(new Error('Product not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
  if (product.stock < quantity) throw Object.assign(new Error('Product is not available in the requested quantity'), { code: 'OUT_OF_STOCK', status: 409 });
  return { state: 'AWAITING_APPROVAL', profile, product: { id: product._id.toString(), name: product.name, price: product.price, currency: product.currency, stock: product.stock }, quantity, total: product.price * quantity };
};

const createOrder = async ({ userId, merchantId, pendingOrder, idempotencyKey }) => {
  if (!pendingOrder?.product?.id) throw Object.assign(new Error('No order preview is awaiting approval'), { code: 'ORDER_NOT_READY', status: 409 });
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey }).lean();
    if (existing) return { id: existing._id.toString(), productName: existing.items[0]?.productName, quantity: existing.items[0]?.quantity, total: existing.total, currency: existing.currency, status: existing.status, delivery: existing.delivery, duplicate: true };
  }
  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) throw Object.assign(new Error('Complete delivery details are required'), { code: 'PROFILE_REQUIRED', status: 400 });
  const product = await Product.findOneAndUpdate({ _id: pendingOrder.product.id, merchantId, active: true, stock: { $gte: pendingOrder.quantity } }, { $inc: { stock: -pendingOrder.quantity } }, { new: true }).lean();
  if (!product) throw Object.assign(new Error('Product is no longer available in the requested quantity'), { code: 'OUT_OF_STOCK', status: 409 });
  try {
    const order = await Order.create({ userId, merchantId, idempotencyKey, items: [{ productId: product._id, productName: product.name, quantity: pendingOrder.quantity, price: product.price }], subtotal: product.price * pendingOrder.quantity, total: product.price * pendingOrder.quantity, currency: product.currency, delivery: profile, status: 'PENDING_PAYMENT' });
    return { id: order._id.toString(), productName: product.name, quantity: pendingOrder.quantity, total: order.total, currency: order.currency, status: order.status, delivery: profile };
  } catch (error) {
    await Product.updateOne({ _id: product._id }, { $inc: { stock: pendingOrder.quantity } });
    if (error.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey }).lean();
      if (existing) return { id: existing._id.toString(), productName: existing.items[0]?.productName, quantity: existing.items[0]?.quantity, total: existing.total, currency: existing.currency, status: existing.status, delivery: existing.delivery, duplicate: true };
    }
    throw error;
  }
};

module.exports = { getProfile, saveProfile, prepareOrder, createOrder, validateProfile, profileFields };