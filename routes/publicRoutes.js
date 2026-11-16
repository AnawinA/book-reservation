'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const publicController = require('../controllers/publicController');

const router = express.Router();

router.get('/', asyncHandler(publicController.renderHome));

router.get('/api/shops', asyncHandler(publicController.listShops));
router.get('/api/books', asyncHandler(publicController.listBooks));
router.get('/api/books/:isbn', asyncHandler(publicController.getBookByIsbn));
router.get('/api/campaigns', asyncHandler(publicController.listCampaigns));
router.get('/api/rewards', asyncHandler(publicController.listRewards));

module.exports = router;
