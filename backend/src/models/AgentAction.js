const mongoose = require('mongoose');

const agentActionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'USER_REQUEST',
        'PRODUCT_SEARCH',
        'PRODUCT_SELECTED',
        'UPSELL_RECOMMENDED',
        'UPSELL_ACCEPTED',
        'UPSELL_REJECTED',
        'CROSS_SELL_RECOMMENDED',
        'CROSS_SELL_ACCEPTED',
        'CROSS_SELL_REJECTED',
        'CART_CREATED',
        'CART_VALIDATED',
        'PAYMENT_GATE_APPROVED',
        'PAYMENT_GATE_REJECTED',
        'RAZORPAY_ORDER_CREATED',
        'PAYMENT_INITIATED',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'ORDER_CREATED',
        'ORDER_CANCELLED',
        'PRICE_CHANGE_DETECTED',
        'INVENTORY_FAILURE',
      ],
    },
    tool: {
      type: String,
      default: '',
    },
    input: mongoose.Schema.Types.Mixed,
    output: mongoose.Schema.Types.Mixed,
    reason: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'PENDING'],
      default: 'PENDING',
    },
    amount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AgentAction', agentActionSchema);
