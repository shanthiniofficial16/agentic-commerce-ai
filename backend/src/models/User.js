const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const profileSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    street: { type: String, trim: true },
    building: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

const buildCustomerProfile = (user) => {
  const profile = user?.profile || {};
  const fullName = (profile.fullName || user?.name || '').trim();
  const email = (profile.email || user?.email || '').trim();
  const street = (profile.street || '').trim();
  const building = (profile.building || '').trim();
  const landmark = (profile.landmark || '').trim();
  const city = (profile.city || '').trim();
  const state = (profile.state || '').trim();
  const pincode = (profile.pincode || '').trim();
  const addressParts = [street, building, landmark].filter(Boolean);

  return {
    fullName,
    phone: (profile.phone || '').trim(),
    email,
    street,
    building,
    landmark,
    city,
    state,
    pincode,
    address: addressParts.join(', '),
  };
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Don't return by default
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'MERCHANT', 'ADMIN'],
      default: 'CUSTOMER',
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      default: null,
    },
    profile: {
      type: profileSchema,
      default: () => ({})
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.getCustomerProfile = function () {
  return buildCustomerProfile(this.toObject ? this.toObject() : this);
};

userSchema.statics.buildCustomerProfile = buildCustomerProfile;

module.exports = mongoose.model('User', userSchema);
module.exports.buildCustomerProfile = buildCustomerProfile;
