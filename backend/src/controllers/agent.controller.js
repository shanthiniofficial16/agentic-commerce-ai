const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Merchant = require('../models/Merchant');
const Product = require('../models/Product');
const { runAgent } = require('../services/agent/agentService');
const { createOrder } = require('../services/order.service');

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
      : null;

    const result = await runAgent({
      message: message.trim(),
      history: conversation.messages.slice(-12),
      context: { userId: req.userId, merchantId: merchant._id, currentProduct },
    });

    if (result.pendingOrder) {
      conversation.orderState = result.pendingOrder.state;
      conversation.pendingOrder = result.pendingOrder;
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
    console.error('Agent chat error:', error.message);
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