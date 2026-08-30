const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { verify, status } = require('../controllers/payment.controller');

const router = express.Router();

router.post('/verify', authMiddleware, verify);

router.get('/:id', authMiddleware, status);

module.exports = router;
