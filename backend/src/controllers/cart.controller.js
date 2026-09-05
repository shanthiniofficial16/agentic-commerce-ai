const Cart = require('../models/Cart');
const Product = require('../models/Product');

const getCart = async (req, res) => {
  try {
    const { merchantId } = req.query;
    
    let query = { userId: req.userId, status: 'ACTIVE' };
    if (merchantId) {
      query.merchantId = merchantId;
    }

    const cart = await Cart.findOne(query).populate('items.productId');

    if (!cart) {
      return res.json({
        success: true,
        data: { cart: null },
      });
    }

    res.json({
      success: true,
      data: { cart },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

const createCart = async (req, res) => {
  try {
    const { merchantId } = req.body;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'merchantId is required' },
      });
    }

    // Check if cart already exists
    let cart = await Cart.findOne({ userId: req.userId, merchantId });
    if (cart) {
      return res.json({
        success: true,
        data: { cart },
      });
    }

    cart = new Cart({
      userId: req.userId,
      merchantId,
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
    });

    await cart.save();

    res.status(201).json({
      success: true,
      data: { cart },
    });
  } catch (error) {
    console.error('Create cart error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: error.message },
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, quantity, merchantId, source } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid productId and quantity required' },
      });
    }

    // Get product
    const product = await Product.findById(productId);
    if (!product || !product.active) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found or inactive' },
      });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: { code: 'OUT_OF_STOCK', message: 'Insufficient stock' },
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId: req.userId, merchantId: product.merchantId, status: 'ACTIVE' });
    if (!cart) {
      cart = new Cart({
        userId: req.userId,
        merchantId: product.merchantId,
        items: [],
      });
    }

    // Check if product already in cart
    const existingItem = cart.items.find(item => item.productId.toString() === productId);
    if (existingItem) {
      if (source === 'ai_cross_sell' && existingItem.source === 'ai_cross_sell') {
        return res.status(409).json({
          success: false,
          error: { code: 'RECOMMENDATION_ALREADY_IN_CART', message: 'That recommendation is already in your cart.' },
        });
      }
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        price: product.price,
        source: ['ai_cross_sell', 'ai_upsell'].includes(source) ? source : 'customer',
      });
    }

    // Recalculate totals
    cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cart.total = cart.subtotal - cart.discount;

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      success: true,
      data: { cart },
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { productId, merchantId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'productId is required' },
      });
    }

    const cart = await Cart.findOne({ userId: req.userId, merchantId, status: 'ACTIVE' });
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: { code: 'CART_NOT_FOUND', message: 'Cart not found' },
      });
    }

    cart.items = cart.items.filter(item => item.productId.toString() !== productId);

    // Recalculate totals
    cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cart.total = cart.subtotal - cart.discount;

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      success: true,
      data: { cart },
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, merchantId } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid quantity required' },
      });
    }

    // Get product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: { code: 'OUT_OF_STOCK', message: 'Insufficient stock' },
      });
    }

    const cart = await Cart.findOne({ userId: req.userId, merchantId, status: 'ACTIVE' });
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: { code: 'CART_NOT_FOUND', message: 'Cart not found' },
      });
    }

    const item = cart.items.find(i => i.productId.toString() === productId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'ITEM_NOT_FOUND', message: 'Item not in cart' },
      });
    }

    item.quantity = quantity;

    // Recalculate totals
    cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cart.total = cart.subtotal - cart.discount;

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      success: true,
      data: { cart },
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    });
  }
};

const validateCart = async (req, res) => {
  try {
    const { cartId, merchantId } = req.body;

    const cart = await Cart.findById(cartId).populate('items.productId');
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: { code: 'CART_NOT_FOUND', message: 'Cart not found' },
      });
    }

    const validationErrors = [];

    // Check each product
    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        validationErrors.push(`Product ${item.productId} not found`);
        continue;
      }

      if (!product.active) {
        validationErrors.push(`Product ${product.name} is inactive`);
      }

      if (product.stock < item.quantity) {
        validationErrors.push(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }

      // Check if price has changed significantly
      if (product.price !== item.price) {
        validationErrors.push(`Price for ${product.name} changed from ${item.price} to ${product.price}`);
      }
    }

    res.json({
      success: validationErrors.length === 0,
      data: {
        valid: validationErrors.length === 0,
        errors: validationErrors,
      },
    });
  } catch (error) {
    console.error('Validate cart error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'VALIDATION_FAILED', message: error.message },
    });
  }
};

module.exports = {
  getCart,
  createCart,
  addToCart,
  removeFromCart,
  updateCartItem,
  validateCart,
};
