'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const adminController = require('../controllers/adminController');
const { authenticateApi, authenticatePage, authorize, authorizePage } = require('../middlewares/authMiddleware');

const router = express.Router();

const adminGuard = [authenticateApi, authorize('Admin')];

router.get(
  '/admin/dashboard',
  authenticatePage,
  authorizePage('Admin'),
  asyncHandler(adminController.renderDashboard)
);

router.post('/api/admin/shops', ...adminGuard, asyncHandler(adminController.createShop));
router.put('/api/admin/shops/:shopId', ...adminGuard, asyncHandler(adminController.updateShop));
router.delete('/api/admin/shops/:shopId', ...adminGuard, asyncHandler(adminController.deleteShop));

router.post('/api/admin/books', ...adminGuard, asyncHandler(adminController.createBook));
router.put('/api/admin/books/:collectionId', ...adminGuard, asyncHandler(adminController.updateBook));

router.post('/api/admin/campaigns', ...adminGuard, asyncHandler(adminController.createCampaign));
router.put('/api/admin/campaigns/:campaignId', ...adminGuard, asyncHandler(adminController.updateCampaign));

router.post('/api/admin/rewards', ...adminGuard, asyncHandler(adminController.createReward));
router.put('/api/admin/rewards/:rewardId', ...adminGuard, asyncHandler(adminController.updateReward));

router.get('/api/admin/reports/overdue', ...adminGuard, asyncHandler(adminController.getOverdueReport));

module.exports = router;
