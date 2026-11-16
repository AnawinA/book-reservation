'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const ownerShopController = require('../controllers/ownerShopController');
const {
  authenticateApi,
  authenticatePage,
  authorize,
  authorizePage,
  requireOwnShop
} = require('../middlewares/authMiddleware');

const router = express.Router();

const ownerGuard = [authenticateApi, authorize('OwnerShop')];
const ownShop = [...ownerGuard, requireOwnShop('shopId')];

router.get(
  '/shop/dashboard',
  authenticatePage,
  authorizePage('OwnerShop'),
  asyncHandler(ownerShopController.renderDashboard)
);

router.get('/api/shops/:shopId/inventory', ...ownShop, asyncHandler(ownerShopController.getInventory));
router.get('/api/book-items/:barcode', ...ownerGuard, asyncHandler(ownerShopController.getBookItem));
router.post('/api/shops/:shopId/donations', ...ownShop, asyncHandler(ownerShopController.createDonation));
router.post('/api/shops/:shopId/borrows', ...ownShop, asyncHandler(ownerShopController.createBorrow));
router.post('/api/shops/:shopId/returns', ...ownShop, asyncHandler(ownerShopController.createReturn));
router.patch('/api/book-items/:barcode/status', ...ownerGuard, asyncHandler(ownerShopController.updateItemStatus));
router.patch('/api/shops/:shopId/rewards/claim', ...ownShop, asyncHandler(ownerShopController.claimReward));

module.exports = router;
