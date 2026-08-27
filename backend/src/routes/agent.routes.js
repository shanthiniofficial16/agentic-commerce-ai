const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Placeholder routes for Agent APIs
router.post('/chat', authMiddleware, (req, res) => {
  res.json({ success: true, data: { message: 'Agent placeholder' } });
});

router.get('/catalog', (req, res) => {
  res.json({ success: true, data: { products: [], policies: {} } });
});

module.exports = router;
