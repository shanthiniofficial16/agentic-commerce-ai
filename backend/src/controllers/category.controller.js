const Category = require('../models/Category');

const listCategories = async (req, res) => {
  try {
    const categories = await Category.find({ active: true }).sort({ name: 1 }).lean();
    res.json({ success: true, data: { categories } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: error.message } });
  }
};

module.exports = { listCategories };
