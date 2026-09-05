const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const { createOrder: createRazorpayOrder, getConfig } = require('./razorpay.provider');

const normalizeAmount = (value) => {
  const numericAmount = Number(value);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw Object.assign(new Error('Final payable amount must be greater than zero.'), { code: 'INVALID_AMOUNT', status: 400 });
  }
  return numericAmount;
};

const calculateCartTotal = async ({ userId, merchantId }) => {
  const cartQuery = Cart.findOne({ userId, merchantId, status: 'ACTIVE' });
  const cart = await (typeof cartQuery?.sort === 'function' ? cartQuery.sort({ updatedAt: -1 }) : cartQuery);
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    throw Object.assign(new Error('Your cart is empty.'), { code: 'CART_EMPTY', status: 400 });
  }

  let subtotal = 0;
  const validatedItems = [];
  for (const item of cart.items) {
    const product = await Product.findById(item.productId);
    const productData = product && typeof product.toObject === 'function' ? product.toObject() : product;

    if (!productData || !productData.active) {
      throw Object.assign(new Error('A cart item is no longer available.'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
    }

    const quantity = Number(item.quantity || 0);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw Object.assign(new Error('Invalid cart quantity.'), { code: 'VALIDATION_ERROR', status: 400 });
    }

    if (productData.stock < quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${productData.name}.`), { code: 'OUT_OF_STOCK', status: 409 });
    }

    if (Number(productData.price) <= 0) {
      throw Object.assign(new Error(`Invalid price for ${productData.name}.`), { code: 'INVALID_AMOUNT', status: 400 });
    }

    subtotal += Number(productData.price) * quantity;
    validatedItems.push({
      productId: productData._id,
      productName: productData.name,
      quantity,
      price: Number(productData.price),
      source: item.source || 'customer',
      aiIncrementalAmount: item.source === 'ai_cross_sell' ? Number(productData.price) * quantity : 0,
    });
  }

  return { cart, subtotal, validatedItems };
};

const createCheckoutOrderForUser = async ({ userId, merchantId, frontendAmount }) => {
  const { cart, subtotal, validatedItems } = await calculateCartTotal({ userId, merchantId });

  if (frontendAmount !== undefined) {
    const providedAmount = normalizeAmount(frontendAmount);
    if (Number(providedAmount) !== Number(subtotal)) {
      throw Object.assign(new Error('Final payable amount does not match the server-calculated cart total.'), { code: 'INVALID_AMOUNT', status: 400 });
    }
  }

  const safeAmount = Math.round(subtotal * 100) / 100;
  if (safeAmount <= 0) {
    throw Object.assign(new Error('The final payable amount is invalid.'), { code: 'INVALID_AMOUNT', status: 400 });
  }

  const amountInPaise = Math.round(safeAmount * 100);
  const orderKey = `checkout:${userId}:${merchantId}:${Date.now()}`;

  const orderPayload = await Order.create({
    userId,
    merchantId,
    idempotencyKey: orderKey,
    items: validatedItems,
    subtotal: safeAmount,
    total: safeAmount,
    originalProductValue: validatedItems.filter((item) => item.source === 'customer').reduce((sum, item) => sum + item.price * item.quantity, 0),
    crossSellRevenue: 0,
    finalOrderValue: safeAmount,
    currency: 'INR',
    status: 'PENDING_PAYMENT',
    paymentStatus: 'PENDING',
    delivery: {},
  });
  const receipt = `checkout_${String(orderPayload._id).slice(-24)}`;

  const paymentRecord = await Payment.create({
    userId,
    merchantId,
    orderId: orderPayload._id,
    amount: safeAmount,
    currency: 'INR',
    status: 'PENDING',
    verified: false,
    idempotencyKey: `payment:${userId}:${merchantId}:${orderPayload._id}`,
  });

  const { keyId } = getConfig();

  let razorpayResponse;
  try {
    razorpayResponse = await createRazorpayOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
    });
    if (Number(razorpayResponse?.order?.amount) !== amountInPaise) {
      throw Object.assign(new Error('Razorpay returned an unexpected order amount.'), { code: 'INVALID_AMOUNT', status: 502 });
    }
  } catch (error) {
    paymentRecord.status = 'FAILED';
    paymentRecord.failureReason = error.message;
    if (typeof paymentRecord.save === 'function') {
      await paymentRecord.save();
    }
    await Order.findByIdAndUpdate(orderPayload._id, {
      paymentStatus: 'FAILED',
      status: 'PAYMENT_FAILED',
    });
    throw Object.assign(new Error(`Razorpay order creation failed: ${error.message}`), { code: 'RAZORPAY_ORDER_CREATION_FAILED', status: 502 });
  }

  orderPayload.razorpayOrderId = razorpayResponse.order.id;
  orderPayload.paymentStatus = 'PENDING';
  orderPayload.status = 'PENDING_PAYMENT';
  orderPayload.paymentId = paymentRecord._id;
  if (typeof orderPayload.save === 'function') {
    await orderPayload.save();
  }

  paymentRecord.razorpayOrderId = razorpayResponse.order.id;
  paymentRecord.status = 'INITIATED';
  if (typeof paymentRecord.save === 'function') {
    await paymentRecord.save();
  }

  return {
    keyId,
    razorpayOrderId: razorpayResponse.order.id,
    amount: razorpayResponse.order.amount,
    currency: 'INR',
    internalOrderId: orderPayload._id.toString(),
  };
};

module.exports = {
  createCheckoutOrderForUser,
  calculateCartTotal,
  normalizeAmount,
};
