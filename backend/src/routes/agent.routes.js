const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { chat } = require('../controllers/agent.controller');

const router = express.Router();

router.post('/chat', authMiddleware, chat);

router.get('/catalog', (req, res) => {
  res.json({ success: true, data: { products: [], policies: {} } });
});

module.exports = router;
