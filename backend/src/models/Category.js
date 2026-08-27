const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  subcategories: [{ type: String, trim: true }],
  active: { type: Boolean, default: true },
}, { timestamps: true });

categorySchema.index({ slug: 1 });

module.exports = mongoose.model('Category', categorySchema);
