const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    brand: { type: String, default: '', trim: true },
    subcategory: { type: String, default: '', trim: true },
    shortDescription: { type: String, default: '' },
    keyFeatures: [{ type: String }],
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    originalPrice: { type: Number, min: 0 },
    discountPercentage: { type: Number, min: 0, max: 100, default: 0 },
    currency: {
      type: String,
      default: 'INR',
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stockStatus: { type: String, enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'], default: 'IN_STOCK' },
    variants: [{ name: String, options: [{ name: String, value: String, price: Number }] }],
    ratings: {
      average: { type: Number, min: 0, max: 5, default: 0 },
      count: { type: Number, min: 0, default: 0 },
      ratingDistribution: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    seller: { name: String, rating: Number, verified: Boolean },
    delivery: { free: Boolean, estimatedDays: Number, details: String },
    warranty: { duration: String, details: String },
    returnPolicy: { windowDays: Number, details: String },
    aiMetadata: {
      useCases: [{ type: String }], targetAudience: [{ type: String }], budgetSegment: String,
      intentTags: [{ type: String }], complementaryProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
      similarProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], recommendationReasons: [{ type: String }],
    },
    images: [String],
    tags: [String],
    specifications: mongoose.Schema.Types.Mixed,
    active: {
      type: Boolean,
      default: true,
    },
    relatedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  { timestamps: true }
);

// Index for search performance
productSchema.index({ name: 'text', description: 'text', tags: 'text', brand: 'text', category: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.average': -1 });
productSchema.index({ tags: 1 });

module.exports = mongoose.model('Product', productSchema);
