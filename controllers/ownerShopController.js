'use strict';

const config = require('../configs/env');
const shopModel = require('../models/shopModel');
const campaignModel = require('../models/campaignModel');
const rewardModel = require('../models/rewardModel');
const bookItemModel = require('../models/bookItemModel');
const userModel = require('../models/userModel');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok, created } = require('../utils/response');
const { parsePagination, buildMeta } = require('../utils/pagination');
const {
  ITEM_STATUSES,
  normalizeBarcode,
  isValidBarcode,
  assertValid,
  validateDonation,
  validateBorrow,
  validateReturn,
  validateStatusUpdate,
  validateClaim
} = require('../utils/validators');
const { verifyRewardCode } = require('../configs/jwt');

const getInventory = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);

  let status = null;
  if (req.query.status !== undefined && req.query.status !== '') {
    status = String(req.query.status).trim().toUpperCase();
    if (!ITEM_STATUSES.includes(status)) {
      throw AppError.validation([
        { field: 'status', message: `status must be one of ${ITEM_STATUSES.join(', ')}` }
      ]);
    }
  }

  const { items, total } = await bookItemModel.findInventoryByShop(req.shopId, { status, page, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getBookItem = asyncHandler(async (req, res) => {
  const barcode = normalizeBarcode(req.params.barcode);
  if (!isValidBarcode(barcode)) {
    throw AppError.validation([{ field: 'barcode', message: 'barcode is not valid' }]);
  }

  const item = await bookItemModel.findByBarcode(barcode);
  if (!item) throw AppError.notFound('Book item');
  return ok(res, item);
});

const createDonation = asyncHandler(async (req, res) => {
  const value = assertValid(validateDonation(req.body));
  const result = await bookItemModel.donate({ shopId: req.shopId, ...value });
  return created(res, result);
});

const createBorrow = asyncHandler(async (req, res) => {
  const value = assertValid(
    validateBorrow(req.body, {
      defaultDays: config.defaultBorrowDays,
      maxDays: config.maxBorrowDays
    })
  );
  const result = await bookItemModel.borrow({ shopId: req.shopId, ...value });
  return created(res, result);
});

const createReturn = asyncHandler(async (req, res) => {
  const value = assertValid(validateReturn(req.body));
  const result = await bookItemModel.returnItem({ shopId: req.shopId, barcode: value.barcode });
  return ok(res, result);
});

const updateItemStatus = asyncHandler(async (req, res) => {
  const barcode = normalizeBarcode(req.params.barcode);
  if (!isValidBarcode(barcode)) {
    throw AppError.validation([{ field: 'barcode', message: 'barcode is not valid' }]);
  }
  const value = assertValid(validateStatusUpdate(req.body));

  const item = await bookItemModel.updateStatus({
    barcode,
    status: value.status,
    actorShopId: req.user.shopId
  });
  return ok(res, item);
});

const claimReward = asyncHandler(async (req, res) => {
  const { code } = assertValid(validateClaim(req.body));

  let payload;
  try {
    payload = verifyRewardCode(code);
  } catch (_) {
    throw new AppError(400, 'INVALID_REWARD_CODE', 'Reward code is invalid or expired');
  }

  if (Number(payload.sid) !== Number(req.shopId)) {
    throw AppError.forbidden('This reward belongs to another shop');
  }

  const reward = await rewardModel.findById(payload.rid);
  if (!reward) throw AppError.notFound('Reward');

  const customer = await userModel.findById(payload.uid);
  if (!customer) throw AppError.notFound('Customer');

  return ok(res, {
    valid: true,
    claimedAt: new Date().toISOString(),
    reward: { id: reward.id, title: reward.title, pointsCost: reward.pointsCost },
    customer: { id: customer.id, username: customer.username },
    voucherId: payload.jti,
    issuedAt: new Date(payload.iat * 1000).toISOString()
  });
});

const renderDashboard = asyncHandler(async (req, res) => {
  const shopId = req.user.shopId;
  if (shopId === null || shopId === undefined) {
    return res.status(403).render('pages/error', {
      title: 'Forbidden',
      statusCode: 403,
      message: 'Your account is not linked to a shop.',
      pageScript: null,
      currentUser: res.locals.currentUser
    });
  }

  const shop = await shopModel.findById(shopId);
  if (!shop) {
    return res.status(403).render('pages/error', {
      title: 'Forbidden',
      statusCode: 403,
      message: 'Your shop could not be found.',
      pageScript: null,
      currentUser: res.locals.currentUser
    });
  }

  const [inventory, campaigns, rewards, profile] = await Promise.all([
    bookItemModel.findInventoryByShop(shopId, { page: 1, limit: 50 }),
    campaignModel.findAll({ shopId }),
    rewardModel.findAll({ shopId }),
    userModel.findById(req.user.id)
  ]);

  return res.render('pages/shop', {
    title: `${shop.name} Dashboard`,
    shop,
    inventory: inventory.items,
    campaigns,
    rewards,
    currentUser: profile
      ? { ...res.locals.currentUser, username: profile.username }
      : res.locals.currentUser,
    pageScript: 'shop'
  });
});

module.exports = {
  getInventory,
  getBookItem,
  createDonation,
  createBorrow,
  createReturn,
  updateItemStatus,
  claimReward,
  renderDashboard
};
