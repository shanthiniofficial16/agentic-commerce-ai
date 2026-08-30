const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const { verifyAndFinalizePayment } = require('../services/order.service');
const { sanitizeErrorPayload } = require('../utils/errorMessageMap');

const verify = async (req, res) => {
  try {
    const { sessionId, razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId, razorpay_signature: razorpaySignature } = req.body;
    const conversation = await Conversation.findOne({ sessionId, userId: req.userId });
    if (!conversation || !conversation.pendingOrder?.product?.id) return res.status(409).json({ success: false, error: { code: 'ORDER_NOT_READY', message: 'No checkout is awaiting payment' } });
    const result = await verifyAndFinalizePayment({
      userId: req.userId,
      merchantId: conversation.merchantId,
      pendingOrder: conversation.pendingOrder,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      idempotencyKey: `agent:${req.userId}:${conversation.sessionId}`,
    });
    conversation.orderState = 'ORDER_CREATED';
    conversation.pendingOrder = { createdOrder: result.order, payment: { id: result.payment._id.toString(), razorpayOrderId: result.payment.razorpayOrderId, razorpayPaymentId: result.payment.razorpayPaymentId, status: result.payment.status } };
    await conversation.save();
    return res.json({ success: true, data: { payment: { id: result.payment._id.toString(), razorpayOrderId: result.payment.razorpayOrderId, razorpayPaymentId: result.payment.razorpayPaymentId, status: result.payment.status, verified: result.payment.verified }, order: result.order, sessionId: conversation.sessionId } });
  } catch (error) {
    const safe = sanitizeErrorPayload(error, 'Payment could not be verified. Your order has not been marked as paid.');
    return res.status(error.status || 500).json({ success: false, error: { code: error.code || 'PAYMENT_VERIFICATION_FAILED', message: safe.message } });
  }
};

const status = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payment ID' } });
  return res.status(501).json({ success: false, error: { code: 'PAYMENT_STATUS_UNAVAILABLE', message: 'Payment status lookup is not available until a provider transaction is created.' } });
};

module.exports = { verify, status };
