const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { verifyAndFinalizePayment } = require('../services/order.service');
const { createCheckoutOrderForUser } = require('../services/payment.service');
const { sanitizeErrorPayload } = require('../utils/errorMessageMap');

const createOrder = async (req, res) => {
  try {
    const merchantId = req.body.merchantId || req.query.merchantId;
    const frontendAmount = req.body.amount;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'merchantId is required' },
      });
    }

    const result = await createCheckoutOrderForUser({
      userId: req.userId,
      merchantId,
      frontendAmount,
    });

    return res.json({
      success: true,
      data: {
        keyId: result.keyId,
        razorpayOrderId: result.razorpayOrderId,
        amount: result.amount,
        currency: result.currency,
        internalOrderId: result.internalOrderId,
      },
    });
  } catch (error) {
    const safe = sanitizeErrorPayload(error, 'Razorpay order could not be created right now.');
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'PAYMENT_FAILED',
        message: safe.message,
      },
    });
  }
};

const verify = async (req, res) => {
  try {
    const { sessionId, internalOrderId, razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId, razorpay_signature: razorpaySignature } = req.body;
    const paymentRecord = await Payment.findOne({
      userId: req.userId,
      ...(internalOrderId
        ? { $or: [{ _id: mongoose.Types.ObjectId.isValid(internalOrderId) ? new mongoose.Types.ObjectId(internalOrderId) : internalOrderId }, { orderId: mongoose.Types.ObjectId.isValid(internalOrderId) ? new mongoose.Types.ObjectId(internalOrderId) : internalOrderId }] }
        : {}),
      ...(razorpayOrderId ? { razorpayOrderId } : {}),
    });

    const orderRecord = paymentRecord?.orderId ? await Order.findById(paymentRecord.orderId).lean() : null;
    const conversation = sessionId ? await Conversation.findOne({ sessionId, userId: req.userId }) : null;
    if (!paymentRecord && !orderRecord) {
      return res.status(409).json({ success: false, error: { code: 'ORDER_NOT_READY', message: 'No checkout is awaiting payment verification.' } });
    }

    const pendingOrder = orderRecord ? {
      product: orderRecord.items?.[0] ? {
        id: orderRecord.items[0].productId?.toString ? orderRecord.items[0].productId.toString() : orderRecord.items[0].productId,
        name: orderRecord.items[0].productName,
        price: orderRecord.items[0].price,
        currency: orderRecord.currency,
      } : { id: null },
      quantity: orderRecord.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 1,
      total: orderRecord.total,
      items: orderRecord.items || [],
      payment: { razorpayOrderId: orderRecord.razorpayOrderId || razorpayOrderId },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    } : conversation?.pendingOrder;

    if (!pendingOrder?.product?.id && !paymentRecord) {
      return res.status(409).json({ success: false, error: { code: 'ORDER_NOT_READY', message: 'No checkout is awaiting payment verification.' } });
    }

    const result = await verifyAndFinalizePayment({
      userId: req.userId,
      merchantId: orderRecord?.merchantId || paymentRecord?.merchantId || conversation?.merchantId,
      pendingOrder,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      idempotencyKey: paymentRecord?.idempotencyKey || `checkout:${req.userId}:${sessionId || paymentRecord?._id || Date.now()}`,
    });

    if (conversation) {
      conversation.orderState = 'ORDER_CREATED';
      conversation.pendingOrder = { createdOrder: result.order, payment: { id: result.payment._id.toString(), razorpayOrderId: result.payment.razorpayOrderId, razorpayPaymentId: result.payment.razorpayPaymentId, status: result.payment.status } };
      await conversation.save();
    }

    return res.json({
      success: true,
      data: {
        payment: {
          id: result.payment._id.toString(),
          razorpayOrderId: result.payment.razorpayOrderId,
          razorpayPaymentId: result.payment.razorpayPaymentId,
          status: result.payment.status,
          verified: result.payment.verified,
        },
        order: result.order,
        sessionId: conversation?.sessionId || null,
        duplicate: Boolean(result.duplicate),
      },
    });
  } catch (error) {
    const safe = sanitizeErrorPayload(error, 'Payment could not be verified. Your order has not been marked as paid.');
    return res.status(error.status || 500).json({ success: false, error: { code: error.code || 'PAYMENT_VERIFICATION_FAILED', message: safe.message } });
  }
};

const status = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payment ID' } });
  return res.status(501).json({ success: false, error: { code: 'PAYMENT_STATUS_UNAVAILABLE', message: 'Payment status lookup is not available until a provider transaction is created.' } });
};

module.exports = { createOrder, verify, status };
