const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getOrdersForUser } = require('../services/order.service');
const { getUserFacingErrorMessage } = require('../utils/errorMessageMap');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await getOrdersForUser(req.userId, req.userRole === 'MERCHANT' ? req.userMerchantId : undefined);
    res.json({ success: true, data: { orders } });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: { code: error.code || 'ORDER_FETCH_FAILED', message: getUserFacingErrorMessage(error.code || 'ORDER_FETCH_FAILED', 'We could not load your orders right now. Please try again.') } });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const orders = await getOrdersForUser(req.userId);
    const order = orders.find((entry) => entry.id === req.params.id);
    res.json({ success: true, data: { order: order || null } });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: { code: error.code || 'ORDER_FETCH_FAILED', message: getUserFacingErrorMessage(error.code || 'ORDER_FETCH_FAILED', 'We could not load that order right now. Please try again.') } });
  }
});

router.post('/', authMiddleware, (req, res) => {
  res.json({ success: true, data: { order: {} } });
});

module.exports = router;
