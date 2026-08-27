const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorType: {
      type: String,
      enum: ['USER', 'SYSTEM', 'AGENT'],
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
      enum: ['PRODUCT', 'CART', 'ORDER', 'PAYMENT', 'USER', 'MERCHANT'],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    amount: {
      type: Number,
      default: 0,
    },
    previousState: mongoose.Schema.Types.Mixed,
    newState: mongoose.Schema.Types.Mixed,
    reason: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
    },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
