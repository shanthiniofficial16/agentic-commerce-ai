const Product = require('../models/Product');
const Merchant = require('../models/Merchant');
const Joi = require('joi');

const productSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().default(''),
  category: Joi.string().required(),
  price: Joi.number().required().min(0),
  currency: Joi.string().default('INR'),
  stock: Joi.number().required().min(0),
  images: Joi.array().items(Joi.string()).default([]),
  tags: Joi.array().items(Joi.string()).default([]),
  specifications: Joi.object().default({}),
  active: Joi.boolean().default(true),
  relatedProducts: Joi.array().items(Joi.string()).default([]),
});

const listProducts = async (req, res) => {
  try {
    const { category, subcategory, brand, minPrice, maxPrice, minRating, minDiscount, search, sort, page = 1, limit = 20 } = req.query;
    const merchantId = req.query.merchantId || req.body.merchantId;

    let query = { active: true };
    
    if (merchantId) {
      query.merchantId = merchantId;
    }

    if (category) {
      query.category = category;
    }

    if (subcategory) query.subcategory = subcategory;
    if (brand) query.brand = brand;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (minRating) query['ratings.average'] = { $gte: parseFloat(minRating) };
    if (minDiscount) query.discountPercentage = { $gte: parseFloat(minDiscount) };

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;
    const sortMap = { price_low: { price: 1 }, price_high: { price: -1 }, rating: { 'ratings.average': -1 }, newest: { createdAt: -1 } };

    const products = await Product.find(query)
      .limit(parsedLimit)
      .skip(skip)
      .sort(sortMap[sort] || (search ? { score: { $meta: 'textScore' } } : { createdAt: -1 }))
      .populate('relatedProducts', 'name price stock');

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
          hasMore: skip + parsedLimit < total,
        },
      },
    });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).populate('relatedProducts');

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    res.json({
      success: true,
      data: { product },
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

const listFeatured = async (req, res) => {
  req.query.sort = 'rating';
  return listProducts(req, res);
};

const listRecommended = async (req, res) => {
  req.query.sort = 'rating';
  return listProducts(req, res);
};

const createProduct = async (req, res) => {
  try {
    const { error, value } = productSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }

    // Verify merchant authorization
    const merchant = await Merchant.findById(req.body.merchantId);
    if (!merchant || merchant.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
    }

    const product = new Product({
      ...value,
      merchantId: req.body.merchantId,
    });

    await product.save();

    res.status(201).json({
      success: true,
      data: { product },
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: error.message },
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = productSchema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    // Verify authorization
    const merchant = await Merchant.findById(product.merchantId);
    if (!merchant || merchant.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
    }

    Object.assign(product, value);
    await product.save();

    res.json({
      success: true,
      data: { product },
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    // Verify authorization
    const merchant = await Merchant.findById(product.merchantId);
    if (!merchant || merchant.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
    }

    await Product.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Product deleted',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: error.message },
    });
  }
};

const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    if (typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Stock must be a non-negative number' },
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    // Verify authorization
    const merchant = await Merchant.findById(product.merchantId);
    if (!merchant || merchant.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
    }

    product.stock = stock;
    await product.save();

    res.json({
      success: true,
      data: { product },
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    });
  }
};

module.exports = {
  listProducts,
  getProduct,
  listFeatured,
  listRecommended,
  createProduct,
  updateProduct,
  deleteProduct,
  updateInventory,
};
