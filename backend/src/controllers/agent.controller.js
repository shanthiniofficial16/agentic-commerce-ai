const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const AgentAction = require('../models/AgentAction');
const Merchant = require('../models/Merchant');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { runAgent, isPurchaseIntent } = require('../services/agent/agentService');
const { createOrder, createPendingPayment } = require('../services/order.service');
const { executeTool } = require('../services/agent/tools');
const { sanitizeErrorPayload } = require('../utils/errorMessageMap');

const normalizeDecisionMessage = (message) => typeof message === 'string' ? message.trim() : '';

const isConfirmationResponse = (message) => {
  const normalized = normalizeDecisionMessage(message).toLowerCase();
  if (!normalized) return false;
  return /^(yes|confirm|confirmed|place the order|place order|proceed|go ahead|buy it|purchase it|okay,? confirm|ok,? confirm)$/i.test(normalized)
    || /^(yes|confirm|proceed|go ahead|buy it|purchase it|okay,? confirm|ok,? confirm)\b/i.test(normalized)
    || /\b(place the order|place order|proceed|go ahead|buy it|purchase it|confirm)\b/i.test(normalized);
};

const isCancellationResponse = (message) => {
  const normalized = normalizeDecisionMessage(message).toLowerCase();
  if (!normalized) return false;
  return /^(no|cancel|cancel the order|stop|don't buy|do not buy|never mind|cancel order)$/i.test(normalized)
    || /\b(no|cancel|stop|don't buy|do not buy|never mind|cancel the order)\b/i.test(normalized);
};

const parseConfirmationResponse = (message) => {
  if (isConfirmationResponse(message)) return 'confirm';
  if (isCancellationResponse(message)) return 'cancel';
  return 'pending';
};

const isPendingConfirmationState = (state) => ['PENDING_CONFIRMATION', 'AWAITING_APPROVAL'].includes(state);
const formatSuccessfulOrderResponse = (order) => `🎉 Order placed successfully!\n\nHi ${order.delivery?.fullName || 'there'},\n\nYour order for ${order.productName} has been placed successfully.\n\nAmount Paid: ₹${Number(order.total).toLocaleString('en-IN')}\n\nPayment: Successful\n\nExpected Delivery: ${new Date(order.estimatedDeliveryDate).toLocaleDateString('en-US', { dateStyle: 'long' })}\n\nYour order has been saved to your account.\n\nYou can track it from your Orders Dashboard.`;

const createPaymentSessionForConversation = async ({ req, conversation }) => {
  if (!isPendingConfirmationState(conversation.orderState) || !conversation.pendingOrder) {
    throw Object.assign(new Error('No order preview is awaiting approval'), { code: 'ORDER_NOT_READY', status: 409 });
  }

  const pendingOrder = {
    ...conversation.pendingOrder,
    state: conversation.pendingOrder.state || 'PENDING_CONFIRMATION',
    product: conversation.pendingOrder.product || {
      id: conversation.pendingOrder.productId,
      name: conversation.pendingOrder.productName,
      price: conversation.pendingOrder.total,
      currency: conversation.pendingOrder.currency || 'INR',
    },
    quantity: conversation.pendingOrder.quantity || 1,
    total: conversation.pendingOrder.total || conversation.pendingOrder.product?.price || 0,
  };

  const activeCart = await Cart.findOne({ userId: req.userId, merchantId: conversation.merchantId, status: 'ACTIVE' }).lean();
  const originalItems = pendingOrder.items || [{
    productId: pendingOrder.product.id,
    name: pendingOrder.product.name,
    price: pendingOrder.product.price,
    quantity: pendingOrder.quantity,
    source: 'customer',
  }];
  const itemMap = new Map(originalItems.map((item) => [String(item.productId?._id || item.productId), item]));
  for (const cartItem of activeCart?.items || []) {
    const productId = String(cartItem.productId?._id || cartItem.productId);
    const existing = itemMap.get(productId);
    if (existing) {
      existing.quantity = cartItem.quantity;
      existing.price = cartItem.price ?? existing.price;
      existing.source = cartItem.source || existing.source || 'customer';
    } else {
      itemMap.set(productId, cartItem);
    }
  }
  const cartOrder = { ...pendingOrder, items: [...itemMap.values()] };
  if (!cartOrder?.product?.id && !cartOrder?.items?.length) {
    throw Object.assign(new Error('No products selected for this order'), { code: 'ORDER_NOT_READY', status: 409 });
  }
  const paymentSession = await createPendingPayment({
    userId: req.userId,
    merchantId: conversation.merchantId,
    pendingOrder: cartOrder,
    idempotencyKey: `agent:${conversation.sessionId}:${req.userId}:${conversation.merchantId}`,
  });

  conversation.orderState = 'PAYMENT_PENDING';
  conversation.pendingOrder = {
    ...cartOrder,
    payment: {
      id: paymentSession.paymentId,
      status: paymentSession.status,
      verified: Boolean(paymentSession.verified),
      razorpayOrderId: paymentSession.razorpayOrderId,
      keyId: paymentSession.keyId,
    },
  };
  await conversation.save();

  return {
    success: true,
    data: {
      paymentSession: {
        internalOrderId: paymentSession.paymentId,
        paymentId: paymentSession.paymentId,
        razorpayOrderId: paymentSession.razorpayOrderId,
        amount: paymentSession.checkoutAmount || paymentSession.amount * 100,
        currency: paymentSession.currency,
        keyId: paymentSession.keyId,
        sessionId: conversation.sessionId,
      },
    },
  };
};

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

    const hasPendingOrder = isPendingConfirmationState(conversation.orderState) && conversation.pendingOrder;
    const parsedDecision = parseConfirmationResponse(message);
    // Purchase phrases such as "Buy it" start checkout unless a preview already exists.
    const confirmationDecision = !hasPendingOrder && isPurchaseIntent(message) ? 'pending' : parsedDecision;
    // Handle upsell acceptance/rejection
    if (conversation.pendingUpsell && confirmationDecision !== 'pending') {
      const upsell = conversation.pendingUpsell;
      conversation.pendingUpsell = undefined;
      if (confirmationDecision === 'cancel') {
        await AgentAction.create({ sessionId: conversation.sessionId, userId: req.userId, merchantId: conversation.merchantId, action: 'UPSELL_REJECTED', input: { originalProductId: upsell.originalProductId, upsellProductId: upsell.upsellProductId }, status: 'SUCCESS' });
        await conversation.save();
        return res.json({ success: true, data: { message: 'No problem. I kept your original product in the cart.', sessionId: conversation.sessionId, upsellDeclined: true } });
      }
      // Upsell accepted: Remove original, add upsell
      await executeTool('removeFromCart', { productId: upsell.originalProductId }, { userId: req.userId, merchantId: conversation.merchantId }).catch(() => null);
      const cartResult = await executeTool('addToCart', { productId: upsell.upsellProductId, quantity: 1, source: 'ai_upsell' }, { userId: req.userId, merchantId: conversation.merchantId });
      await AgentAction.create({ sessionId: conversation.sessionId, userId: req.userId, merchantId: conversation.merchantId, action: 'UPSELL_ACCEPTED', input: { originalProductId: upsell.originalProductId, originalPrice: upsell.originalPrice, upsellProductId: upsell.upsellProductId, upsellPrice: upsell.upsellPrice }, output: { finalProductId: cartResult.product.id, finalPrice: cartResult.product.price, incrementalRevenue: upsell.upsellPrice - upsell.originalPrice }, status: 'SUCCESS', amount: upsell.upsellPrice - upsell.originalPrice });
      await conversation.save();
      return res.json({ success: true, data: { message: `Perfect! I've upgraded your selection to ${cartResult.product.name} (₹${Number(cartResult.product.price).toLocaleString('en-IN')}). Your new cart total is ₹${Number(cartResult.total).toLocaleString('en-IN')}. Say "Buy it" when you're ready for checkout.`, products: [cartResult.product], sessionId: conversation.sessionId, upsellAccepted: true } });
    }
    if (conversation.pendingRecommendation && confirmationDecision !== 'pending') {
      const recommendation = conversation.pendingRecommendation;
      conversation.pendingRecommendation = undefined;
      if (confirmationDecision === 'cancel') {
        let originalProduct = null;
        let cartResult = null;
        if (recommendation.originalProductId) {
          const actionContext = { userId: req.userId, merchantId: conversation.merchantId };
          const original = await executeTool('getProductDetails', { productId: recommendation.originalProductId }, actionContext);
          cartResult = await executeTool('addToCart', { productId: recommendation.originalProductId, quantity: 1 }, actionContext);
          if (!cartResult.verified) {
            throw Object.assign(new Error('I could not verify that the requested product was added to your cart'), { code: 'CART_VERIFICATION_FAILED', status: 502 });
          }
          originalProduct = original.product;
        }
        await AgentAction.create({ sessionId: conversation.sessionId, userId: req.userId, merchantId: conversation.merchantId, action: 'CROSS_SELL_REJECTED', input: { productId: recommendation.productId }, status: 'SUCCESS' });
        await conversation.save();
        return res.json({ success: true, data: { message: originalProduct ? `No problem. I skipped the recommendation and added ${originalProduct.name} to your cart.` : 'No problem. I skipped the recommendation and kept your cart unchanged.', products: originalProduct ? [originalProduct] : [], cart: cartResult?.cart || null, sessionId: conversation.sessionId, recommendationDeclined: true } });
      }
      const cartResult = await executeTool('addToCart', { productId: recommendation.productId, quantity: 1, source: 'ai_cross_sell' }, { userId: req.userId, merchantId: conversation.merchantId });
      await AgentAction.create({ sessionId: conversation.sessionId, userId: req.userId, merchantId: conversation.merchantId, action: 'CROSS_SELL_ACCEPTED', input: { productId: recommendation.productId }, output: { productId: cartResult.product.id, price: cartResult.product.price }, status: 'SUCCESS', amount: cartResult.product.price });
      await conversation.save();
      return res.json({ success: true, data: { message: `${cartResult.product.name} was added to your cart. Your cart total is now ₹${Number(cartResult.total).toLocaleString('en-IN')}. Say “Buy it” when you are ready for checkout.`, products: [cartResult.product], sessionId: conversation.sessionId, recommendationAccepted: true } });
    }
    if (confirmationDecision !== 'pending') {
      if (!isPendingConfirmationState(conversation.orderState) || !conversation.pendingOrder) {
        return res.status(409).json({ success: false, error: { code: 'ORDER_NOT_READY', message: 'There is no order preview awaiting confirmation. Say “Buy this” first to prepare checkout, then reply “Yes”.' } });
      }
      if (confirmationDecision === 'cancel') {
        conversation.orderState = 'CANCELLED';
        conversation.pendingOrder = undefined;
        await conversation.save();
        return res.json({ success: true, data: { message: 'The order was cancelled.', sessionId: conversation.sessionId, cancelled: true } });
      }

      try {
        const paymentResult = await createPaymentSessionForConversation({ req, conversation });
        return res.json(paymentResult);
      } catch (error) {
        const safe = sanitizeErrorPayload(error, 'The order could not be placed right now. Please try again.');
        return res.status(error.status || 500).json({ success: false, error: { code: error.code || 'ORDER_FAILED', message: safe.message } });
      }
    }

    if (isPendingConfirmationState(conversation.orderState) && conversation.pendingOrder) {
      return res.json({
        success: true,
        data: {
          message: 'Your order is awaiting confirmation. Reply with Yes to confirm or No to cancel.',
          sessionId: conversation.sessionId,
          pendingConfirmation: true,
          orderPreview: conversation.pendingOrder,
        },
      });
    }

    const result = await runAgent({
      message: message.trim(),
      history: conversation.messages.slice(-12),
      context: { userId: req.userId, merchantId: merchant._id, currentProduct, selectedProductId: conversation.selectedProductId, pendingOrder: conversation.pendingOrder },
    });

    if (result.pendingOrder) {
      const nextState = isPendingConfirmationState(result.pendingOrder.state) ? 'PENDING_CONFIRMATION' : result.pendingOrder.state;
      conversation.orderState = nextState;
      conversation.pendingOrder = { ...result.pendingOrder, state: nextState };
    }
    if (result.pendingRecommendation) {
      conversation.pendingRecommendation = result.pendingRecommendation;
      await AgentAction.create({ sessionId: conversation.sessionId, userId: req.userId, merchantId: conversation.merchantId, action: 'CROSS_SELL_RECOMMENDED', input: { productId: result.pendingRecommendation.productId }, status: 'SUCCESS' });
    }
    if (result.pendingUpsell) {
      conversation.pendingUpsell = result.pendingUpsell;
      await AgentAction.create({ sessionId: conversation.sessionId, userId: req.userId, merchantId: conversation.merchantId, action: 'UPSELL_RECOMMENDED', input: { originalProductId: result.pendingUpsell.originalProductId, upsellProductId: result.pendingUpsell.upsellProductId }, status: 'SUCCESS' });
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
      data: {
        message: result.text,
        products: result.products,
        crossSell: Array.isArray(result.crossSell) ? result.crossSell : [],
        orderPreview: isPendingConfirmationState(result.pendingOrder?.state) ? { ...result.pendingOrder, state: 'PENDING_CONFIRMATION' } : null,
        profileRequired: result.pendingOrder?.state === 'PROFILE_REQUIRED' ? result.pendingOrder.requiredFields : null,
        viewOrderPath: result.viewOrderPath || null,
        action: result.action || null,
        cart: result.cart || null,
        sessionId: conversation.sessionId,
      },
    });
  } catch (error) {
    console.error('[Agent] chat request failed', {
      userId: req.userId,
      message: typeof req.body?.message === 'string' ? req.body.message.slice(0, 200) : req.body?.message,
      sessionId: req.body?.sessionId,
      merchantId: req.body?.merchantId,
      currentProductId: req.body?.currentProductId,
      code: error.code,
      status: error.status,
      stack: error.stack,
    });
    const safe = sanitizeErrorPayload(error, 'The shopping assistant could not process that request. Please try again.');
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'AGENT_FAILED', message: safe.message },
    });
  }
};

const confirmOrder = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const conversation = await Conversation.findOne({ sessionId, userId: req.userId });
    if (!conversation) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Order session not found' } });
    if (conversation.orderState === 'ORDER_CREATED' && conversation.pendingOrder?.createdOrder) return res.json({ success: true, data: { order: conversation.pendingOrder.createdOrder, duplicate: true } });
    if (!isPendingConfirmationState(conversation.orderState) || !conversation.pendingOrder) return res.status(409).json({ success: false, error: { code: 'ORDER_NOT_READY', message: 'No order preview is awaiting approval' } });

    const paymentResult = await createPaymentSessionForConversation({ req, conversation });
    return res.json(paymentResult);
  } catch (error) {
    console.error('Confirm order error:', error.message);
    const safe = sanitizeErrorPayload(error, 'The order could not be placed right now. Please try again.');
    return res.status(error.status || 500).json({ success: false, error: { code: error.code || 'ORDER_FAILED', message: safe.message } });
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

module.exports = {
  chat,
  confirmOrder,
  cancelOrder,
  isConfirmationResponse,
  isCancellationResponse,
  parseConfirmationResponse,
};