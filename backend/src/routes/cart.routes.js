const express = require('express');
const {
  getCart,
  createCart,
  addToCart,
  removeFromCart,
  updateCartItem,
  validateCart,
} = require('../controllers/cart.controller');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getCart);
router.post('/', createCart);
router.post('/items', addToCart);
router.put('/items/:productId', updateCartItem);
router.delete('/items', removeFromCart);
router.post('/validate', validateCart);

module.exports = router;
