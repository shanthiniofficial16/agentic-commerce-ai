const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { createOrder, verify, status, recommendCheckoutProduct } = require('../controllers/payment.controller');

const router = express.Router();

router.post('/create-order', authMiddleware, createOrder);
router.post('/recommendation', authMiddleware, recommendCheckoutProduct);
router.post('/verify', authMiddleware, verify);

router.get('/:id', authMiddleware, status);

module.exports = router;
