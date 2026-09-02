const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

const getEstimatedDeliveryDate = (createdAt = new Date()) => {
  const deliveryDays = Number.parseInt(process.env.ESTIMATED_DELIVERY_DAYS || '5', 10);
  const estimatedDate = new Date(createdAt);
  estimatedDate.setDate(estimatedDate.getDate() + (Number.isFinite(deliveryDays) && deliveryDays >= 0 ? deliveryDays : 5));
  return estimatedDate;
};

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
  const orders = await Order.find({ userId, ...(merchantId ? { merchantId } : {}) }).populate('items.productId', 'images').sort({ createdAt: -1 }).lean();
  return orders.map((order) => ({
    id: order._id.toString(),
    product: order.items?.[0]?.productName || 'Product',
    quantity: order.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0,
    total: order.total,
    currency: order.currency,
    status: order.status,
    paymentStatus: order.paymentStatus || (order.status === 'PAID' ? 'PAID' : order.status === 'PENDING_PAYMENT' ? 'PENDING' : 'FAILED'),
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    createdAt: order.createdAt,
    delivery: order.delivery,
    items: order.items || [],
    productImage: order.items?.[0]?.productId?.images?.[0] || null,
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

const prepareCartOrder = async ({ userId, merchantId }) => {
  const cart = await Cart.findOne({ userId, merchantId, status: 'ACTIVE' }).lean();
  if (!cart?.items?.length) throw Object.assign(new Error('Your cart is empty'), { code: 'CART_EMPTY', status: 400 });
  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) return { state: 'PROFILE_REQUIRED', requiredFields: [...new Set([...profileStatus(profile).missingFields, ...profileStatus(profile).invalidFields])] };
  const items = [];
  for (const item of cart.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) throw Object.assign(new Error('Invalid cart quantity'), { code: 'ORDER_INVALID', status: 400 });
    const product = await Product.findOne({ _id: item.productId, merchantId, active: true }).lean();
    if (!product) throw Object.assign(new Error('A cart product is no longer available'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
    if (product.stock < item.quantity) throw Object.assign(new Error(`${product.name} is not available in the requested quantity`), { code: 'OUT_OF_STOCK', status: 409 });
    items.push({ productId: product._id.toString(), name: product.name, price: product.price, currency: product.currency, quantity: item.quantity, stock: product.stock, source: item.source || 'customer' });
  }
  return { state: 'PENDING_CONFIRMATION', orderPreviewId: `ORDER_PREVIEW_${new mongoose.Types.ObjectId().toString()}`, profile, items, product: { id: items[0].productId, name: items[0].name, price: items[0].price, currency: items[0].currency, quantity: items[0].quantity, stock: items[0].stock }, quantity: items[0].quantity, total: items.reduce((sum, item) => sum + item.price * item.quantity, 0), expiresAt: new Date(Date.now() + 15 * 60 * 1000) };
};

const createPendingPayment = async ({ userId, merchantId, pendingOrder, idempotencyKey }) => {
  const { createOrder: createRazorpayOrder } = require('./razorpay.provider');
  if (!pendingOrder?.product?.id) throw Object.assign(new Error('No pending order to pay for'), { code: 'ORDER_NOT_READY', status: 409 });
  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) throw Object.assign(new Error('Complete delivery details are required before checkout'), { code: 'PROFILE_REQUIRED', status: 400 });
  const requestedItems = pendingOrder.items || [{ productId: pendingOrder.product.id, quantity: pendingOrder.quantity || 1 }];
  const products = [];
  for (const item of requestedItems) {
    const product = await Product.findOne({ _id: item.productId, merchantId, active: true }).lean();
    if (!product) throw Object.assign(new Error('Product not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
    if (product.stock < item.quantity) throw Object.assign(new Error(`${product.name} is not available in the requested quantity`), { code: 'OUT_OF_STOCK', status: 409 });
    products.push({ product, quantity: item.quantity, source: item.source || 'customer' });
  }
  const paymentKey = idempotencyKey || `payment:${userId}:${merchantId}:${pendingOrder.orderPreviewId}`;
  const existing = await Payment.findOne({ idempotencyKey: paymentKey }).lean();
  if (existing && ['PENDING', 'INITIATED', 'PROCESSING'].includes(existing.status)) {
      return {
        paymentId: existing._id.toString(),
        status: existing.status,
        verified: existing.verified,
        amount: existing.amount,
        currency: existing.currency,
        orderId: existing.orderId ? existing.orderId.toString() : null,
        razorpayOrderId: existing.razorpayOrderId,
        keyId: process.env.RAZORPAY_KEY_ID,
      };
  }
  const amount = products.reduce((sum, item) => sum + Number(item.product.price) * Number(item.quantity), 0);
    const payment = existing
      ? await Payment.findOneAndUpdate({ _id: existing._id }, {
        $set: { userId, merchantId, amount, currency: products[0].product.currency || 'INR', status: 'PENDING', verified: false },
        $unset: { failureReason: '', razorpayOrderId: '', razorpayPaymentId: '', orderId: '' },
      }, { new: true })
      : await Payment.create({
        userId,
        merchantId,
        amount,
        currency: products[0].product.currency || 'INR',
        status: 'PENDING',
        verified: false,
        idempotencyKey: paymentKey,
      });
  let provider;
  try {
    provider = await createRazorpayOrder({ amount: Math.round(amount * 100), currency: products[0].product.currency || 'INR', receipt: paymentKey.slice(0, 40) });
  } catch (error) {
    payment.status = 'FAILED';
    payment.failureReason = error.message;
    await payment.save();
    throw error;
  }
  payment.status = 'INITIATED';
  payment.razorpayOrderId = provider.order.id;
  await payment.save();
  return {
    paymentId: payment._id.toString(),
    status: payment.status,
    verified: payment.verified,
    amount: payment.amount,
    currency: payment.currency,
    orderId: null,
    razorpayOrderId: provider.order.id,
    keyId: provider.keyId,
    checkoutAmount: provider.order.amount,
  };
};

const verifyAndFinalizePayment = async ({ userId, merchantId, pendingOrder, razorpayOrderId, razorpayPaymentId, razorpaySignature, idempotencyKey }) => {
  const { verifySignature, fetchPayment } = require('./razorpay.provider');
  if (!pendingOrder?.product?.id || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) throw Object.assign(new Error('Incomplete payment verification details'), { code: 'PAYMENT_VERIFICATION_INVALID', status: 400 });
  const paymentRecord = await Payment.findOne({ userId, merchantId, razorpayOrderId, idempotencyKey });
  if (!paymentRecord) {
    const verifiedPayment = await Payment.findOne({ userId, merchantId, razorpayPaymentId, status: 'VERIFIED_SUCCESS' }).lean();
    if (verifiedPayment?.orderId) {
      const existingOrder = await Order.findById(verifiedPayment.orderId).lean();
      if (existingOrder) return { payment: verifiedPayment, order: { ...existingOrder, id: existingOrder._id.toString() }, duplicate: true };
    }
  }
  if (!paymentRecord) throw Object.assign(new Error('Payment transaction not found'), { code: 'PAYMENT_NOT_FOUND', status: 404 });
  if (paymentRecord.razorpayOrderId !== razorpayOrderId) throw Object.assign(new Error('Payment order does not match the checkout session'), { code: 'PAYMENT_VERIFICATION_FAILED', status: 400 });
  if (!verifySignature({ orderId: paymentRecord.razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature })) throw Object.assign(new Error('Payment signature verification failed'), { code: 'PAYMENT_VERIFICATION_FAILED', status: 400 });
  if (paymentRecord.status === 'VERIFIED_SUCCESS' && paymentRecord.orderId) {
    const existingOrder = await Order.findById(paymentRecord.orderId).lean();
    if (existingOrder) return { payment: paymentRecord.toObject(), order: { ...existingOrder, id: existingOrder._id.toString() }, duplicate: true };
  }
  const providerPayment = await fetchPayment(razorpayPaymentId);
  if (!['captured', 'authorized'].includes(providerPayment.status)) {
    paymentRecord.status = 'FAILED';
    paymentRecord.failureReason = `Provider payment status: ${providerPayment.status}`;
    await paymentRecord.save();
    throw Object.assign(new Error('Payment was not verified by Razorpay'), { code: 'PAYMENT_FAILED', status: 402 });
  }
  paymentRecord.razorpayPaymentId = razorpayPaymentId;
  paymentRecord.status = 'VERIFIED_SUCCESS';
  paymentRecord.verified = true;
  await paymentRecord.save();
  if (paymentRecord.orderId) {
    const existingOrder = await Order.findOne({ _id: paymentRecord.orderId, userId, merchantId });
    if (existingOrder && existingOrder.paymentStatus === 'PENDING') {
      for (const item of existingOrder.items || []) {
        const reserved = await Product.findOneAndUpdate(
          { _id: item.productId, merchantId, active: true, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true },
        ).lean();
        if (!reserved) {
          throw Object.assign(new Error('A product is no longer available in the requested quantity'), { code: 'OUT_OF_STOCK', status: 409 });
        }
      }
      existingOrder.paymentStatus = 'PAID';
      existingOrder.status = 'PAID';
      existingOrder.crossSellRevenue = existingOrder.items
        .filter((item) => item.source === 'ai_cross_sell')
        .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
      await existingOrder.save();
      await Cart.updateOne(
        { userId, merchantId, status: 'ACTIVE' },
        { $set: { items: [], subtotal: 0, total: 0, status: 'CHECKED_OUT' } },
      );
      await Payment.updateOne({ _id: paymentRecord._id }, { $set: { orderId: existingOrder._id } });
      return { payment: paymentRecord.toObject(), order: { id: existingOrder._id.toString(), productName: existingOrder.items[0]?.productName, quantity: existingOrder.items.reduce((sum, item) => sum + item.quantity, 0), total: existingOrder.total, currency: existingOrder.currency, status: existingOrder.status, paymentStatus: existingOrder.paymentStatus, estimatedDeliveryDate: existingOrder.estimatedDeliveryDate, delivery: existingOrder.delivery, items: existingOrder.items, duplicate: false } };
    }
  }
  const order = await createOrder({ userId, merchantId, pendingOrder, idempotencyKey, paymentId: paymentRecord._id.toString(), paymentStatus: 'PAID' });
  await Payment.updateOne({ _id: paymentRecord._id }, { $set: { orderId: order.id } });
  return { payment: paymentRecord.toObject(), order };
};

const finalizeVerifiedCheckout = async ({ userId, merchantId, pendingOrder, idempotencyKey }) => {
  throw Object.assign(new Error('Provider payment verification is required before checkout can be finalized'), { code: 'PAYMENT_VERIFICATION_REQUIRED', status: 409 });
};

const createOrder = async ({ userId, merchantId, pendingOrder, idempotencyKey, paymentId, paymentStatus = 'PAID' }) => {
  if (!pendingOrder?.product?.id) throw Object.assign(new Error('No order preview is awaiting approval'), { code: 'ORDER_NOT_READY', status: 409 });
  if (pendingOrder.expiresAt && new Date(pendingOrder.expiresAt) < new Date()) throw Object.assign(new Error('This order preview has expired. Please prepare it again.'), { code: 'ORDER_PREVIEW_EXPIRED', status: 409 });
  const orderKey = idempotencyKey || `order:${userId}:${merchantId}:${pendingOrder.product.id}:${pendingOrder.quantity}`;
  const existing = await Order.findOne({ idempotencyKey: orderKey }).lean();
  if (existing) return { id: existing._id.toString(), productName: existing.items[0]?.productName, quantity: existing.items.reduce((sum, item) => sum + item.quantity, 0), total: existing.total, currency: existing.currency, status: existing.status, paymentStatus: existing.paymentStatus, estimatedDeliveryDate: existing.estimatedDeliveryDate, delivery: existing.delivery, items: existing.items, duplicate: true };

  const profile = await getProfile(userId);
  if (!profile || validateProfile(profile)) throw Object.assign(new Error('Complete delivery details are required'), { code: 'PROFILE_REQUIRED', status: 400 });
  const requestedItems = pendingOrder.items || [{ productId: pendingOrder.product.id, name: pendingOrder.product.name, price: pendingOrder.product.price, quantity: pendingOrder.quantity }];
  const products = [];
  for (const item of requestedItems) {
    const product = await Product.findOneAndUpdate({ _id: item.productId, merchantId, active: true, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { new: true }).lean();
    if (!product || product.price !== item.price) {
      for (const reserved of products) await Product.updateOne({ _id: reserved._id }, { $inc: { stock: reserved.quantity } });
      if (product) await Product.updateOne({ _id: product._id }, { $inc: { stock: item.quantity } });
      throw Object.assign(new Error(product ? `The price of ${product.name} changed while preparing the order. Please try again.` : 'A product is no longer available in the requested quantity'), { code: product ? 'PRICE_CHANGED' : 'OUT_OF_STOCK', status: 409 });
    }
    products.push({ ...product, quantity: item.quantity, source: item.source || 'customer' });
  }
  const orderItems = products.map((product) => ({ productId: product._id, productName: product.name, quantity: product.quantity, price: product.price, source: product.source || 'customer', aiIncrementalAmount: product.source === 'ai_cross_sell' ? product.price * product.quantity : product.aiIncrementalAmount || 0 }));
  const orderTotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const originalProductValue = orderItems.filter((item) => item.source === 'customer').reduce((sum, item) => sum + item.price * item.quantity, 0);
  const crossSellRevenue = orderItems.filter((item) => item.source === 'ai_cross_sell').reduce((sum, item) => sum + item.price * item.quantity, 0);
  try {
    const status = paymentStatus === 'PAID' ? 'PAID' : 'PENDING_PAYMENT';
    const order = await Order.create({
      userId,
      merchantId,
      idempotencyKey: orderKey,
      paymentId: paymentId ? new mongoose.Types.ObjectId(paymentId) : undefined,
      paymentStatus,
      estimatedDeliveryDate: getEstimatedDeliveryDate(),
      razorpayOrderId: pendingOrder.payment?.razorpayOrderId,
      items: orderItems,
      subtotal: orderTotal,
      total: orderTotal,
      originalProductValue,
      crossSellRevenue: paymentStatus === 'PAID' ? crossSellRevenue : 0,
      finalOrderValue: orderTotal,
      currency: products[0].currency,
      delivery: profile,
      status,
    });
    return { id: order._id.toString(), productName: products[0].name, quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0), total: order.total, currency: order.currency, status: order.status, paymentStatus: order.paymentStatus, estimatedDeliveryDate: order.estimatedDeliveryDate, delivery: profile, items: order.items, duplicate: false };
  } catch (error) {
    for (const reserved of products) await Product.updateOne({ _id: reserved._id }, { $inc: { stock: reserved.quantity } });
    if (error.code === 11000 && orderKey) {
      const existing = await Order.findOne({ idempotencyKey: orderKey }).lean();
      if (existing) return { id: existing._id.toString(), productName: existing.items[0]?.productName, quantity: existing.items.reduce((sum, item) => sum + item.quantity, 0), total: existing.total, currency: existing.currency, status: existing.status, paymentStatus: existing.paymentStatus, estimatedDeliveryDate: existing.estimatedDeliveryDate, delivery: existing.delivery, items: existing.items, duplicate: true };
    }
    throw error;
  }
};

module.exports = { getProfile, profileStatus, saveProfile, prepareOrder, prepareCartOrder, createPendingPayment, verifyAndFinalizePayment, finalizeVerifiedCheckout, getOrdersForUser, createOrder, validateProfile, profileFields };