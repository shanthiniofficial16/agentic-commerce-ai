const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Merchant = require('../models/Merchant');
const Joi = require('joi');
const { getUserFacingErrorMessage } = require('../utils/errorMessageMap');

const customerProfileFields = {
  fullName: Joi.string().trim().min(2).required(),
  phone: Joi.string().trim().pattern(/^[6-9]\d{9}$/).required(),
  email: Joi.string().email().required(),
  street: Joi.string().trim().required(),
  building: Joi.string().trim().allow('').optional(),
  landmark: Joi.string().trim().allow('').optional(),
  city: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
  pincode: Joi.string().trim().pattern(/^\d{6}$/).required(),
};

const registerSchema = Joi.object({
  name: Joi.string().required().min(2),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
  role: Joi.string().valid('CUSTOMER', 'MERCHANT').default('CUSTOMER'),
  fullName: Joi.string().trim().min(2),
  phone: Joi.string().trim().pattern(/^[6-9]\d{9}$/),
  street: Joi.string().trim(),
  building: Joi.string().trim().allow(''),
  landmark: Joi.string().trim().allow(''),
  city: Joi.string().trim(),
  state: Joi.string().trim(),
  pincode: Joi.string().trim().pattern(/^\d{6}$/),
}).custom((value, helpers) => {
  if (value.role === 'CUSTOMER') {
    const requiredFields = ['fullName', 'phone', 'street', 'city', 'state', 'pincode'];
    const missing = requiredFields.filter((field) => !value[field]?.toString().trim());
    if (missing.length) {
      return helpers.message(`Customer profile is incomplete. Missing: ${missing.join(', ')}`);
    }
  }
  return value;
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const normalizeProfileInput = (input = {}) => {
  const safe = { ...input };
  const fullName = (safe.fullName || safe.name || '').trim();
  const email = (safe.email || '').trim();
  const street = (safe.street || safe.address || '').trim();
  const building = (safe.building || '').trim();
  const landmark = (safe.landmark || '').trim();
  const city = (safe.city || '').trim();
  const state = (safe.state || '').trim();
  const pincode = (safe.pincode || '').trim();
  const phone = (safe.phone || '').trim();

  return {
    fullName,
    phone,
    email,
    street,
    building,
    landmark,
    city,
    state,
    pincode,
  };
};

const register = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }

    const { name, email, password, role } = value;
    const profileInput = normalizeProfileInput({
      ...value,
      fullName: value.fullName || name,
      email: value.email || email,
    });

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User already exists' },
      });
    }

    // Create user
    const user = new User({
      name,
      email,
      passwordHash: password,
      role,
      profile: role === 'CUSTOMER' ? {
        fullName: profileInput.fullName || name,
        phone: profileInput.phone,
        email: profileInput.email || email,
        street: profileInput.street,
        building: profileInput.building,
        landmark: profileInput.landmark,
        city: profileInput.city,
        state: profileInput.state,
        pincode: profileInput.pincode,
      } : {
        fullName: name,
        email,
      },
    });

    await user.save();

    // If merchant, create merchant profile
    if (role === 'MERCHANT') {
      const merchant = new Merchant({
        userId: user._id,
        name: name,
      });
      await merchant.save();
      user.merchantId = merchant._id;
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          merchantId: user.merchantId,
          profile: User.buildCustomerProfile(user),
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: getUserFacingErrorMessage('REGISTRATION_FAILED', 'Registration failed. Please try again.') },
    });
  }
};

const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }

    const { email, password } = value;

    // Find user and select passwordHash
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Compare passwords
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          merchantId: user.merchantId,
          profile: User.buildCustomerProfile(user),
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: getUserFacingErrorMessage('LOGIN_FAILED', 'Login failed. Please try again.') },
    });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const profile = User.buildCustomerProfile(user);

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        merchantId: user.merchantId,
        profile,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: getUserFacingErrorMessage('FETCH_FAILED', 'We could not load that information right now. Please try again.') },
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({
      success: true,
      data: User.buildCustomerProfile(user),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: getUserFacingErrorMessage('FETCH_FAILED', 'We could not load that information right now. Please try again.') },
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const payload = normalizeProfileInput({
      ...user.profile,
      ...req.body,
      fullName: req.body.fullName || req.body.name || user.name,
      email: req.body.email || user.email,
    });

    const profileValidation = Joi.object({
      fullName: Joi.string().trim().min(2).required(),
      phone: Joi.string().trim().pattern(/^[6-9]\d{9}$/).required(),
      email: Joi.string().email().required(),
      street: Joi.string().trim().required(),
      building: Joi.string().trim().allow('').optional(),
      landmark: Joi.string().trim().allow('').optional(),
      city: Joi.string().trim().required(),
      state: Joi.string().trim().required(),
      pincode: Joi.string().trim().pattern(/^\d{6}$/).required(),
    }).validate(payload);

    if (profileValidation.error) {
      return res.status(400).json({
        success: false,
        error: { code: 'PROFILE_INVALID', message: profileValidation.error.message },
      });
    }

    user.profile = { ...user.profile, ...payload };
    user.name = payload.fullName || user.name;
    user.email = payload.email || user.email;
    await user.save();

    res.json({
      success: true,
      data: User.buildCustomerProfile(user),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'PROFILE_UPDATE_FAILED', message: getUserFacingErrorMessage('PROFILE_UPDATE_FAILED', 'We could not update your profile right now. Please try again.') },
    });
  }
};

module.exports = {
  register,
  login,
  me,
  getProfile,
  updateProfile,
};
