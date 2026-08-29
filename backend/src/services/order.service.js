const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');

const profileFields = ['fullName', 'phone', 'email', 'street', 'city', 'state', 'pincode'];
const normalizeProfile = (value = {}) => {
  const profile = { ...value };
  const address = [profile.street || profile.address, profile.building, profile.landmark].filter(Boolean).join(', ');
  profile.fullName = (profile.fullName || '').trim();
  profile.phone = (profile.phone || '').trim();
  profile.email = (profile.email || '').trim();
  profile.street = (profile.street || '').trim();
  profile.building = (profile.building || '').trim();
  profile.landmark = (profile.landmark || '').trim();
  profile.city = (profile.city || '').trim();
  profile.state = (profile.state || '').trim();
  profile.pincode = (profile.pincode || '').trim();
  profile.address = address;
  return profile;
};
const validateProfile = (value) => {
  const normalized = normalizeProfile(value || {});
  const missing = profileFields.filter((field) => !normalized?.[field]?.toString().trim());
  if (missing.length) return `Missing required details: ${missing.join(', ')}`;
  if (!/^[6-9]\d{9}$/.test(normalized.phone)) return 'Please provide a valid 10-digit Indian mobile number';
  if (!/^\S+@\S+\.\S+$/.test(normalized.email)) return 'Please provide a valid email address';
  if (!/^\d{6}$/.test(normalized.pincode)) return 'Please provide a valid 6-digit pincode';
  return null;
};

const getProfile = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) return null;
  return normalizeProfile(User.buildCustomerProfile(user));
};
const profileStatus = (profile) => ({
  profileExists: Boolean(profile),
  profileComplete: Boolean(profile && !validateProfile(profile)),
  missingFields: profileFields.filter((field) => !profile?.[field]?.toString().trim()),
  invalidFields: profile ? [
    ...(!/^[6-9]\d{9}$/.test(profile.phone || '') ? ['phone'] : []),
    ...(!/^\S+@\S+\.\S+$/.test(profile.email || '') ? ['email'] : []),
    ...(!/^\d{6}$/.test(profile.pincode || '') ? ['pincode'] : []),
  ] : [],
});

const saveProfile = async (userId, input) => {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND', status: 404 });

  const profileInput = normalizeProfile({ ...(user.profile || {}), ...(input || {}) });
  if (profileInput.address && !profileInput.street) {
    const [streetValue, buildingValue, landmarkValue] = profileInput.address.split(',').map((part) => part.trim());
    profileInput.street = streetValue || '';
    profileInput.building = buildingValue || '';
    profileInput.landmark = landmarkValue || '';
  }

  const nextProfile = {
    ...user.profile,
    ...profileInput,
    fullName: profileInput.fullName || user.name,
    email: profileInput.email || user.email,
  };

  const error = validateProfile(nextProfile);
  if (error) throw Object.assign(new Error(error), { code: 'PROFILE_INVALID', status: 400 });

  user.profile = { ...user.profile, ...nextProfile };
  user.name = nextProfile.fullName || user.name;
  user.email = nextProfile.email || user.email;
  await user.save();
  return normalizeProfile(User.buildCustomerProfile(user));
};

const prepareOrder = async ({ userId, merchantId, productId, quantity = 1 }) => {
  if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw Object.assign(new Error('Invalid product or quantity'), { code: 'ORDER_INVALID', status: 400 });
  const product = await Product.findOne({ _id: productId, merchantId, active: true }).lean();
  if (!product) throw Object.assign(new Error('Product not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) return { state: 'PROFILE_REQUIRED', productId: productId.toString(), quantity, requiredFields: [...new Set([...profileStatus(profile).missingFields, ...profileStatus(profile).invalidFields])] };
  if (product.stock < quantity) throw Object.assign(new Error('Product is not available in the requested quantity'), { code: 'OUT_OF_STOCK', status: 409 });
  return { state: 'AWAITING_APPROVAL', orderPreviewId: `ORDER_PREVIEW_${new mongoose.Types.ObjectId().toString()}`, profile, product: { id: product._id.toString(), name: product.name, price: product.price, currency: product.currency, stock: product.stock }, quantity, total: product.price * quantity, expiresAt: new Date(Date.now() + 15 * 60 * 1000) };
};

const createOrder = async ({ userId, merchantId, pendingOrder, idempotencyKey }) => {
  if (!pendingOrder?.product?.id) throw Object.assign(new Error('No order preview is awaiting approval'), { code: 'ORDER_NOT_READY', status: 409 });
  if (pendingOrder.expiresAt && new Date(pendingOrder.expiresAt) < new Date()) throw Object.assign(new Error('This order preview has expired. Please prepare it again.'), { code: 'ORDER_PREVIEW_EXPIRED', status: 409 });
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey }).lean();
    if (existing) return { id: existing._id.toString(), productName: existing.items[0]?.productName, quantity: existing.items[0]?.quantity, total: existing.total, currency: existing.currency, status: existing.status, delivery: existing.delivery, duplicate: true };
  }
  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) throw Object.assign(new Error('Complete delivery details are required'), { code: 'PROFILE_REQUIRED', status: 400 });
  const product = await Product.findOneAndUpdate({ _id: pendingOrder.product.id, merchantId, active: true, stock: { $gte: pendingOrder.quantity } }, { $inc: { stock: -pendingOrder.quantity } }, { new: true }).lean();
  if (!product) throw Object.assign(new Error('Product is no longer available in the requested quantity'), { code: 'OUT_OF_STOCK', status: 409 });
  if (product.price !== pendingOrder.product.price) {
    await Product.updateOne({ _id: product._id }, { $inc: { stock: pendingOrder.quantity } });
    throw Object.assign(new Error(`The price has changed from ${pendingOrder.product.price} to ${product.price}. Please prepare the order again.`), { code: 'PRICE_CHANGED', status: 409 });
  }
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

module.exports = { getProfile, profileStatus, saveProfile, prepareOrder, createOrder, validateProfile, profileFields };