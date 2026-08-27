const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    sourceProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    recommendedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      enum: ['UPSELL', 'CROSS_SELL'],
      required: true,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    accepted: {
      type: Number,
      default: 0,
    },
    revenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recommendation', recommendationSchema);
