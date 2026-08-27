const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    currency: {
      type: String,
      default: 'INR',
    },
    transactionLimit: {
      type: Number,
      default: 100000, // Default to 1 lakh INR
    },
    aiAgentEnabled: {
      type: Boolean,
      default: true,
    },
    requireCustomerApproval: {
      type: Boolean,
      default: true,
    },
    allowUpsells: {
      type: Boolean,
      default: true,
    },
    allowCrossSells: {
      type: Boolean,
      default: true,
    },
    maxCartQuantity: {
      type: Number,
      default: 100,
    },
    discountLimit: {
      type: Number,
      default: 0.5, // 50% max discount
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Merchant', merchantSchema);
