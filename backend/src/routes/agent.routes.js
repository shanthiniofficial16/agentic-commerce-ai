const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { chat, confirmOrder, cancelOrder } = require('../controllers/agent.controller');

const router = express.Router();

router.post('/chat', authMiddleware, chat);
router.post('/order/confirm', authMiddleware, confirmOrder);
router.post('/order/cancel', authMiddleware, cancelOrder);

router.get('/catalog', (req, res) => {
  res.json({ success: true, data: { products: [], policies: {} } });
});

module.exports = router;
