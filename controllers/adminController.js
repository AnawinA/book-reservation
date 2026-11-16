'use strict';

const shopModel = require('../models/shopModel');
const bookModel = require('../models/bookModel');
const campaignModel = require('../models/campaignModel');
const rewardModel = require('../models/rewardModel');
const bookItemModel = require('../models/bookItemModel');
const userModel = require('../models/userModel');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { parsePositiveInt, assertValid, validateShop, validateBook, validateCampaign, validateReward } = require('../utils/validators');

async function assertShopExists(shopId) {
  const shop = await shopModel.findById(shopId);
  if (!shop) {
    throw AppError.validation([{ field: 'shopId', message: 'shopId must reference an active shop' }]);
  }
  return shop;
}

function invalidId(field) {
  return AppError.validation([{ field, message: `${field} must be a positive integer` }]);
}

/* ------------------------------ Shops ------------------------------ */

const createShop = asyncHandler(async (req, res) => {
  const value = assertValid(validateShop(req.body));
  return created(res, await shopModel.create(value));
});

const updateShop = asyncHandler(async (req, res) => {
  const shopId = parsePositiveInt(req.params.shopId);
  if (shopId === null) throw invalidId('shopId');
  const value = assertValid(validateShop(req.body));

  const shop = await shopModel.update(shopId, value);
  if (!shop) throw AppError.notFound('Shop');
  return ok(res, shop);
});

const deleteShop = asyncHandler(async (req, res) => {
  const shopId = parsePositiveInt(req.params.shopId);
  if (shopId === null) throw invalidId('shopId');

  const shop = await shopModel.findById(shopId);
  if (!shop) throw AppError.notFound('Shop');

  const activeBorrows = await shopModel.countActiveBorrows(shopId);
  if (activeBorrows > 0) throw AppError.conflict('CONFLICT', 'Shop has active borrows');

  await shopModel.softDelete(shopId);
  return noContent(res);
});

/* ------------------------------ Books ------------------------------ */

const createBook = asyncHandler(async (req, res) => {
  const value = assertValid(validateBook(req.body));
  return created(res, await bookModel.create(value));
});

const updateBook = asyncHandler(async (req, res) => {
  const collectionId = parsePositiveInt(req.params.collectionId);
  if (collectionId === null) throw invalidId('collectionId');
  const value = assertValid(validateBook(req.body));

  const book = await bookModel.update(collectionId, value);
  if (!book) throw AppError.notFound('Book collection');
  return ok(res, book);
});

/* ---------------------------- Campaigns ---------------------------- */

const createCampaign = asyncHandler(async (req, res) => {
  const value = assertValid(validateCampaign(req.body));
  await assertShopExists(value.shopId);
  return created(res, await campaignModel.create(value));
});

const updateCampaign = asyncHandler(async (req, res) => {
  const campaignId = parsePositiveInt(req.params.campaignId);
  if (campaignId === null) throw invalidId('campaignId');
  const value = assertValid(validateCampaign(req.body));
  await assertShopExists(value.shopId);

  const campaign = await campaignModel.update(campaignId, value);
  if (!campaign) throw AppError.notFound('Campaign');
  return ok(res, campaign);
});

/* ----------------------------- Rewards ----------------------------- */

const createReward = asyncHandler(async (req, res) => {
  const value = assertValid(validateReward(req.body));
  await assertShopExists(value.shopId);
  return created(res, await rewardModel.create(value));
});

const updateReward = asyncHandler(async (req, res) => {
  const rewardId = parsePositiveInt(req.params.rewardId);
  if (rewardId === null) throw invalidId('rewardId');
  const value = assertValid(validateReward(req.body));
  await assertShopExists(value.shopId);

  const reward = await rewardModel.update(rewardId, value);
  if (!reward) throw AppError.notFound('Reward');
  return ok(res, reward);
});

/* ----------------------------- Reports ----------------------------- */

const getOverdueReport = asyncHandler(async (req, res) => {
  const rows = await bookItemModel.findOverdue();

  const byShop = [];
  const index = new Map();
  let totalDaysOverdue = 0;

  rows.forEach((row) => {
    totalDaysOverdue += row.daysOverdue;
    if (!index.has(row.shopId)) {
      const entry = { shopId: row.shopId, shopName: row.shopName, count: 0 };
      index.set(row.shopId, entry);
      byShop.push(entry);
    }
    index.get(row.shopId).count += 1;
  });

  return ok(res, rows, { count: rows.length, totalDaysOverdue, byShop });
});

const renderDashboard = asyncHandler(async (req, res) => {
  const [shops, books, campaigns, rewards, overdue, profile] = await Promise.all([
    shopModel.findAll(),
    bookModel.search({ page: 1, limit: 100 }),
    campaignModel.findAll({}),
    rewardModel.findAll({}),
    bookItemModel.findOverdue(),
    userModel.findById(req.user.id)
  ]);

  const stats = {
    shopCount: shops.length,
    bookCount: books.total,
    activeCampaigns: campaigns.filter((campaign) => campaign.isActive).length,
    overdueCount: overdue.length,
    totalRewardStock: rewards.reduce((sum, reward) => sum + Number(reward.stock || 0), 0)
  };

  return res.render('pages/admin', {
    title: 'แดชบอร์ดการจัดการระบบ',
    shops,
    books: books.items,
    campaigns,
    rewards,
    overdue,
    stats,
    currentUser: profile
      ? { ...res.locals.currentUser, username: profile.username }
      : res.locals.currentUser,
    pageScript: 'admin'
  });
});

module.exports = {
  createShop,
  updateShop,
  deleteShop,
  createBook,
  updateBook,
  createCampaign,
  updateCampaign,
  createReward,
  updateReward,
  getOverdueReport,
  renderDashboard
};
