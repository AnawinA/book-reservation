'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../configs/env');
const asyncHandler = require('../utils/asyncHandler');
const authController = require('../controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many authentication attempts, try again later' }
    });
  }
});

router.post('/api/auth/register', authLimiter, authController.register);
router.post('/api/auth/login', authLimiter, authController.login);
router.post('/api/auth/logout', asyncHandler(authController.logout));

module.exports = router;
