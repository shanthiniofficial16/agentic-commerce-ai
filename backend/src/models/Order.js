const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  productName: String,
  quantity: Number,
  price: Number,
  source: { type: String, enum: ['customer', 'ai_cross_sell', 'ai_upsell'], default: 'customer' },
  aiIncrementalAmount: { type: Number, default: 0, min: 0 },
});

const orderSchema = new mongoose.Schema(
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
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    delivery: {
      fullName: String,
      phone: String,
      email: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
    estimatedDeliveryDate: {
      type: Date,
    },
    razorpayOrderId: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ['PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELLED', 'COMPLETED'],
      default: 'PENDING_PAYMENT',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
