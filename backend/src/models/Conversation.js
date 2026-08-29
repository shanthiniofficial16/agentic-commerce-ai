const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['USER', 'AGENT'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  metadata: mongoose.Schema.Types.Mixed,
});

const conversationSchema = new mongoose.Schema(
  {
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
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    messages: [messageSchema],
    selectedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CLOSED'],
      default: 'ACTIVE',
    },
    orderState: {
      type: String,
      enum: ['SHOPPING', 'PROFILE_REQUIRED', 'ORDER_PREVIEW', 'AWAITING_APPROVAL', 'ORDER_CREATED', 'CANCELLED'],
      default: 'SHOPPING',
    },
    pendingOrder: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
