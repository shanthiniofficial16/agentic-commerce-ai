const express = require('express');
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateInventory,
  listFeatured,
  listRecommended,
} = require('../controllers/product.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', listProducts);
router.get('/search', listProducts);
router.get('/featured', listFeatured);
router.get('/recommended', listRecommended);
router.get('/category/:category', (req, res) => {
  req.query.category = req.params.category;
  return listProducts(req, res);
});
router.get('/:id', getProduct);
router.post('/', authMiddleware, roleMiddleware('MERCHANT'), createProduct);
router.put('/:id', authMiddleware, roleMiddleware('MERCHANT'), updateProduct);
router.delete('/:id', authMiddleware, roleMiddleware('MERCHANT'), deleteProduct);
router.patch('/:id/inventory', authMiddleware, roleMiddleware('MERCHANT'), updateInventory);

module.exports = router;
