const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
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

const getOrdersForUser = async (userId, merchantId) => {
  const orders = await Order.find({ userId, ...(merchantId ? { merchantId } : {}) }).sort({ createdAt: -1 }).lean();
  return orders.map((order) => ({
    id: order._id.toString(),
    product: order.items?.[0]?.productName || 'Product',
    quantity: order.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0,
    total: order.total,
    currency: order.currency,
    status: order.status,
    paymentStatus: order.status === 'PAID' ? 'Successful' : order.status === 'PENDING_PAYMENT' ? 'Pending' : 'Failed',
    createdAt: order.createdAt,
    delivery: order.delivery,
    items: order.items || [],
  }));
};

const prepareOrder = async ({ userId, merchantId, productId, quantity = 1 }) => {
  if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw Object.assign(new Error('Invalid product or quantity'), { code: 'ORDER_INVALID', status: 400 });
  const product = await Product.findOne({ _id: productId, merchantId, active: true }).lean();
  if (!product) throw Object.assign(new Error('Product not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) return { state: 'PROFILE_REQUIRED', productId: productId.toString(), quantity, requiredFields: [...new Set([...profileStatus(profile).missingFields, ...profileStatus(profile).invalidFields])] };
  if (product.stock < quantity) throw Object.assign(new Error('Product is not available in the requested quantity'), { code: 'OUT_OF_STOCK', status: 409 });
  return { state: 'PENDING_CONFIRMATION', orderPreviewId: `ORDER_PREVIEW_${new mongoose.Types.ObjectId().toString()}`, profile, product: { id: product._id.toString(), name: product.name, price: product.price, currency: product.currency, stock: product.stock }, quantity, total: product.price * quantity, expiresAt: new Date(Date.now() + 15 * 60 * 1000) };
};

const createPendingPayment = async ({ userId, merchantId, pendingOrder, idempotencyKey }) => {
  if (!pendingOrder?.product?.id) throw Object.assign(new Error('No pending order to pay for'), { code: 'ORDER_NOT_READY', status: 409 });
  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) throw Object.assign(new Error('Complete delivery details are required before checkout'), { code: 'PROFILE_REQUIRED', status: 400 });
  const product = await Product.findOne({ _id: pendingOrder.product.id, merchantId, active: true }).lean();
  if (!product) throw Object.assign(new Error('Product not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
  const paymentKey = idempotencyKey || `payment:${userId}:${merchantId}:${pendingOrder.product.id}:${pendingOrder.quantity}`;
  const existing = await Payment.findOne({ idempotencyKey: paymentKey }).lean();
  if (existing) {
    return {
      paymentId: existing._id.toString(),
      status: existing.status,
      verified: existing.verified,
      amount: existing.amount,
      currency: existing.currency,
      orderId: existing.orderId ? existing.orderId.toString() : null,
    };
  }
  const payment = await Payment.create({
    userId,
    merchantId,
    amount: Number(product.price) * Number(pendingOrder.quantity || 1),
    currency: product.currency || 'INR',
    status: 'PENDING',
    verified: false,
    idempotencyKey: paymentKey,
  });
  return {
    paymentId: payment._id.toString(),
    status: payment.status,
    verified: payment.verified,
    amount: payment.amount,
    currency: payment.currency,
    orderId: null,
  };
};

const finalizeVerifiedCheckout = async ({ userId, merchantId, pendingOrder, idempotencyKey }) => {
  if (!pendingOrder?.product?.id) throw Object.assign(new Error('No order preview is awaiting approval'), { code: 'ORDER_NOT_READY', status: 409 });
  const paymentKey = idempotencyKey || `payment:${userId}:${merchantId}:${pendingOrder.product.id}:${pendingOrder.quantity}`;
  const existingPayment = await Payment.findOne({ idempotencyKey: paymentKey }).lean();
  if (existingPayment?.status === 'SUCCESS' && existingPayment.orderId) {
    const existingOrder = await Order.findById(existingPayment.orderId).lean();
    if (existingOrder) return { payment: existingPayment, order: { ...existingOrder, id: existingOrder._id.toString() }, duplicate: true };
  }

  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) throw Object.assign(new Error('Complete delivery details are required before checkout'), { code: 'PROFILE_REQUIRED', status: 400 });

  const product = await Product.findOne({ _id: pendingOrder.product.id, merchantId, active: true }).lean();
  if (!product) throw Object.assign(new Error('Product not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });

  const payment = await Payment.findOneAndUpdate({ idempotencyKey: paymentKey }, {
    userId,
    merchantId,
    amount: Number(product.price) * Number(pendingOrder.quantity || 1),
    currency: product.currency || 'INR',
    status: 'SUCCESS',
    verified: true,
    razorpayOrderId: `demo_order_${Date.now()}`,
    razorpayPaymentId: `demo_payment_${Date.now()}`,
  }, { new: true, upsert: true, setDefaultsOnInsert: true });

  const orderKey = idempotencyKey || `order:${userId}:${merchantId}:${pendingOrder.product.id}:${pendingOrder.quantity}`;
  const existingOrder = await Order.findOne({ idempotencyKey: orderKey }).lean();
  if (existingOrder) {
    await Payment.updateOne({ _id: payment._id }, { $set: { orderId: existingOrder._id } });
    return { payment: { ...payment.toObject ? payment.toObject() : payment, orderId: existingOrder._id.toString() }, order: { ...existingOrder, id: existingOrder._id.toString() }, duplicate: true };
  }

  const createdOrder = await createOrder({
    userId,
    merchantId,
    pendingOrder,
    idempotencyKey: orderKey,
    paymentId: payment._id.toString(),
    paymentStatus: 'PAID',
  });

  await Payment.updateOne({ _id: payment._id }, { $set: { orderId: createdOrder.id || createdOrder._id } });
  return { payment: { ...payment.toObject ? payment.toObject() : payment, orderId: createdOrder.id }, order: createdOrder, duplicate: false };
};

const createOrder = async ({ userId, merchantId, pendingOrder, idempotencyKey, paymentId, paymentStatus = 'PAID' }) => {
  if (!pendingOrder?.product?.id) throw Object.assign(new Error('No order preview is awaiting approval'), { code: 'ORDER_NOT_READY', status: 409 });
  if (pendingOrder.expiresAt && new Date(pendingOrder.expiresAt) < new Date()) throw Object.assign(new Error('This order preview has expired. Please prepare it again.'), { code: 'ORDER_PREVIEW_EXPIRED', status: 409 });
  const orderKey = idempotencyKey || `order:${userId}:${merchantId}:${pendingOrder.product.id}:${pendingOrder.quantity}`;
  const existing = await Order.findOne({ idempotencyKey: orderKey }).lean();
  if (existing) return { id: existing._id.toString(), productName: existing.items[0]?.productName, quantity: existing.items[0]?.quantity, total: existing.total, currency: existing.currency, status: existing.status, delivery: existing.delivery, duplicate: true };

  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) throw Object.assign(new Error('Complete delivery details are required'), { code: 'PROFILE_REQUIRED', status: 400 });
  const product = await Product.findOneAndUpdate({ _id: pendingOrder.product.id, merchantId, active: true, stock: { $gte: pendingOrder.quantity } }, { $inc: { stock: -pendingOrder.quantity } }, { new: true }).lean();
  if (!product) throw Object.assign(new Error('Product is no longer available in the requested quantity'), { code: 'OUT_OF_STOCK', status: 409 });
  if (product.price !== pendingOrder.product.price) {
    await Product.updateOne({ _id: product._id }, { $inc: { stock: pendingOrder.quantity } });
    throw Object.assign(new Error(`The price has changed from ${pendingOrder.product.price} to ${product.price}. Please prepare the order again.`), { code: 'PRICE_CHANGED', status: 409 });
  }
  try {
    const status = paymentStatus === 'PAID' ? 'PAID' : 'PENDING_PAYMENT';
    const order = await Order.create({
      userId,
      merchantId,
      idempotencyKey: orderKey,
      paymentId: paymentId ? new mongoose.Types.ObjectId(paymentId) : undefined,
      items: [{ productId: product._id, productName: product.name, quantity: pendingOrder.quantity, price: product.price }],
      subtotal: product.price * pendingOrder.quantity,
      total: product.price * pendingOrder.quantity,
      currency: product.currency,
      delivery: profile,
      status,
    });
    return { id: order._id.toString(), productName: product.name, quantity: pendingOrder.quantity, total: order.total, currency: order.currency, status: order.status, delivery: profile, duplicate: false };
  } catch (error) {
    await Product.updateOne({ _id: product._id }, { $inc: { stock: pendingOrder.quantity } });
    if (error.code === 11000 && orderKey) {
      const existing = await Order.findOne({ idempotencyKey: orderKey }).lean();
      if (existing) return { id: existing._id.toString(), productName: existing.items[0]?.productName, quantity: existing.items[0]?.quantity, total: existing.total, currency: existing.currency, status: existing.status, delivery: existing.delivery, duplicate: true };
    }
    throw error;
  }
};

module.exports = { getProfile, profileStatus, saveProfile, prepareOrder, createPendingPayment, finalizeVerifiedCheckout, getOrdersForUser, createOrder, validateProfile, profileFields };