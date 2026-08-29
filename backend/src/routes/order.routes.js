const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getOrdersForUser } = require('../services/order.service');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await getOrdersForUser(req.userId, req.userRole === 'MERCHANT' ? req.userMerchantId : undefined);
    res.json({ success: true, data: { orders } });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: { code: error.code || 'ORDER_FETCH_FAILED', message: error.message || 'Unable to load orders' } });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const orders = await getOrdersForUser(req.userId);
    const order = orders.find((entry) => entry.id === req.params.id);
    res.json({ success: true, data: { order: order || null } });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: { code: error.code || 'ORDER_FETCH_FAILED', message: error.message || 'Unable to load order' } });
  }
});

router.post('/', authMiddleware, (req, res) => {
  res.json({ success: true, data: { order: {} } });
});

module.exports = router;
