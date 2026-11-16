'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const customerController = require('../controllers/customerController');
const { authenticateApi, authenticatePage, authorize, authorizePage } = require('../middlewares/authMiddleware');

const router = express.Router();

const apiGuard = [authenticateApi, authorize('Customer')];

router.get(
  '/customer/dashboard',
  authenticatePage,
  authorizePage('Customer'),
  asyncHandler(customerController.renderDashboard)
);

router.get('/api/customer/profile', ...apiGuard, asyncHandler(customerController.getProfile));
router.get('/api/customer/donations', ...apiGuard, asyncHandler(customerController.getDonations));
router.get('/api/customer/borrows', ...apiGuard, asyncHandler(customerController.getBorrows));
router.post(
  '/api/customer/rewards/:rewardId/redeem',
  ...apiGuard,
  asyncHandler(customerController.redeemReward)
);

module.exports = router;
