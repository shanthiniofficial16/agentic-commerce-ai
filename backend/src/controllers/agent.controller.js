const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Merchant = require('../models/Merchant');
const Product = require('../models/Product');
const { runAgent } = require('../services/agent/agentService');
const { createOrder, createPendingPayment, finalizeVerifiedCheckout } = require('../services/order.service');

const isApproval = (message) => /^(yes|confirm|confirmed|place it|place order|proceed|go ahead|buy it|yes,? place( the)? order)$/i.test(message.trim());
const isCancellation = (message) => /^(no|cancel|cancel order|not now|maybe later|don't place it|do not place it|don't buy|stop)$/i.test(message.trim());

const chat = async (req, res) => {
  try {
    const { message, sessionId, merchantId, currentProductId } = req.body;
    console.log('[Agent] Request received');
    console.log(`[Agent] User message: ${typeof message === 'string' ? message : '<invalid>'}`);

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'message is required' },
      });
    }

    if (merchantId && !mongoose.isValidObjectId(merchantId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'merchantId must be valid' },
      });
    }

    if (currentProductId && !mongoose.isValidObjectId(currentProductId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'currentProductId must be valid' },
      });
    }

    const merchant = await Merchant.findOne({
      ...(merchantId ? { _id: merchantId } : {}),
      isActive: true,
      aiAgentEnabled: true,
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: { code: 'MERCHANT_NOT_FOUND', message: 'No active AI-enabled merchant found' },
      });
    }

    const conversationSessionId = sessionId || new mongoose.Types.ObjectId().toString();
    let conversation = await Conversation.findOne({ sessionId: conversationSessionId, userId: req.userId });

    if (!conversation) {
      conversation = new Conversation({
        userId: req.userId,
        merchantId: merchant._id,
        sessionId: conversationSessionId,
        messages: [],
      });
    }

    const currentProduct = currentProductId
      ? await Product.findOne({ _id: currentProductId, merchantId: merchant._id, active: true })
        .select('name brand category price currency shortDescription description stock ratings images')
        .lean()
      : conversation.selectedProductId
        ? await Product.findOne({ _id: conversation.selectedProductId, merchantId: merchant._id, active: true })
          .select('name brand category price currency shortDescription description stock ratings images')
          .lean()
        : null;

    if (isApproval(message) || isCancellation(message)) {
      if (conversation.orderState !== 'AWAITING_APPROVAL' || !conversation.pendingOrder) {
        return res.status(409).json({ success: false, error: { code: 'ORDER_NOT_READY', message: 'There is no order preview awaiting confirmation' } });
      }
      if (isCancellation(message)) {
        conversation.orderState = 'CANCELLED';
        conversation.pendingOrder = undefined;
        await conversation.save();
        return res.json({ success: true, data: { message: 'The order was cancelled.', sessionId: conversation.sessionId, cancelled: true } });
      }

      const payment = await createPendingPayment({
        userId: req.userId,
        merchantId: conversation.merchantId,
        pendingOrder: conversation.pendingOrder,
        idempotencyKey: `agent:${req.userId}:${conversation.sessionId}`,
      });

      if (payment.status === 'SUCCESS' && payment.orderId) {
        const completed = await finalizeVerifiedCheckout({
          userId: req.userId,
          merchantId: conversation.merchantId,
          pendingOrder: conversation.pendingOrder,
          idempotencyKey: `agent:${req.userId}:${conversation.sessionId}`,
        });
        conversation.orderState = 'ORDER_CREATED';
        conversation.pendingOrder = { createdOrder: completed.order };
        await conversation.save();
        return res.json({ success: true, data: { message: `Order placed successfully! 🎉\n\nOrder ID: #${completed.order.id}\nProduct: ${completed.order.productName}\nAmount: ₹${completed.order.total}\nPayment: Successful\nDelivery to: ${completed.order.delivery?.address || completed.order.delivery?.city || 'Saved delivery address'}\n\nYou can track your order from your Orders dashboard.`, order: completed.order, sessionId: conversation.sessionId } });
      }

      const order = await createOrder({
        userId: req.userId,
        merchantId: conversation.merchantId,
        pendingOrder: conversation.pendingOrder,
        idempotencyKey: `agent:${req.userId}:${conversation.sessionId}`,
        paymentId: payment.paymentId,
        paymentStatus: 'PENDING_PAYMENT',
      });
      conversation.orderState = 'ORDER_CREATED';
      conversation.pendingOrder = { createdOrder: order };
      await conversation.save();
      return res.json({ success: true, data: { message: `Payment is still pending. Order has been queued for processing once payment is verified.`, order, sessionId: conversation.sessionId } });
    }

    const result = await runAgent({
      message: message.trim(),
      history: conversation.messages.slice(-12),
      context: { userId: req.userId, merchantId: merchant._id, currentProduct, selectedProductId: conversation.selectedProductId, pendingOrder: conversation.pendingOrder },
    });

    if (result.pendingOrder) {
      conversation.orderState = result.pendingOrder.state;
      conversation.pendingOrder = result.pendingOrder;
    }
    if (result.selectedProductId) {
      conversation.selectedProductId = result.selectedProductId;
    }

    conversation.messages.push({ role: 'USER', content: message.trim() });
    conversation.messages.push({
      role: 'AGENT',
      content: result.text,
      metadata: {
        provider: 'openrouter',
        model: process.env.OPENROUTER_MODEL,
        products: result.products.map((product) => ({ id: product.id, name: product.name })),
      },
    });
    await conversation.save();

    return res.json({
      success: true,
      data: { message: result.text, products: result.products, orderPreview: result.pendingOrder?.state === 'AWAITING_APPROVAL' ? result.pendingOrder : null, profileRequired: result.pendingOrder?.state === 'PROFILE_REQUIRED' ? result.pendingOrder.requiredFields : null, sessionId: conversation.sessionId },
    });
  } catch (error) {
    console.error('[Agent] chat request failed', {
      userId: req.userId,
      message: typeof message === 'string' ? message.slice(0, 200) : message,
      sessionId,
      merchantId,
      currentProductId,
      code: error.code,
      status: error.status,
      stack: error.stack,
    });
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'AGENT_FAILED', message: error.message || 'Unable to process agent request' },
    });
  }
};

const confirmOrder = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const conversation = await Conversation.findOne({ sessionId, userId: req.userId });
    if (!conversation) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Order session not found' } });
    if (conversation.orderState === 'ORDER_CREATED' && conversation.pendingOrder?.createdOrder) return res.json({ success: true, data: { order: conversation.pendingOrder.createdOrder, duplicate: true } });
    if (conversation.orderState !== 'AWAITING_APPROVAL' || !conversation.pendingOrder) return res.status(409).json({ success: false, error: { code: 'ORDER_NOT_READY', message: 'No order preview is awaiting approval' } });
    const order = await createOrder({ userId: req.userId, merchantId: conversation.merchantId, pendingOrder: conversation.pendingOrder, idempotencyKey: `agent:${req.userId}:${conversation.sessionId}` });
    conversation.orderState = 'ORDER_CREATED';
    conversation.pendingOrder = { createdOrder: order };
    await conversation.save();
    return res.json({ success: true, data: { order } });
  } catch (error) {
    console.error('Confirm order error:', error.message);
    return res.status(error.status || 500).json({ success: false, error: { code: error.code || 'ORDER_FAILED', message: error.message || 'Unable to place order' } });
  }
};

const cancelOrder = async (req, res) => {
  const conversation = await Conversation.findOne({ sessionId: req.body.sessionId, userId: req.userId });
  if (!conversation) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Order session not found' } });
  conversation.orderState = 'CANCELLED';
  conversation.pendingOrder = undefined;
  await conversation.save();
  return res.json({ success: true, data: { cancelled: true } });
};

module.exports = { chat, confirmOrder, cancelOrder };