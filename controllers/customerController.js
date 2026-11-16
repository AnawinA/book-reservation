'use strict';

const config = require('../configs/env');
const userModel = require('../models/userModel');
const rewardModel = require('../models/rewardModel');
const bookItemModel = require('../models/bookItemModel');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok, created } = require('../utils/response');
const { parsePositiveInt } = require('../utils/validators');
const { signRewardCode, COOKIE_NAME, clearCookieOptions } = require('../configs/jwt');

const getProfile = asyncHandler(async (req, res) => {
  const profile = await userModel.findById(req.user.id);
  if (!profile) throw AppError.notFound('User');
  return ok(res, profile);
});

const getDonations = asyncHandler(async (req, res) => {
  const donations = await bookItemModel.findDonationsByUser(req.user.id);
  return ok(res, donations, { count: donations.length });
});

const getBorrows = asyncHandler(async (req, res) => {
  const borrows = await bookItemModel.findBorrowsByUser(req.user.id);
  return ok(res, borrows, {
    count: borrows.length,
    overdueCount: borrows.filter((borrow) => borrow.isOverdue).length
  });
});

const redeemReward = asyncHandler(async (req, res) => {
  const rewardId = parsePositiveInt(req.params.rewardId);
  if (rewardId === null) {
    throw AppError.validation([{ field: 'rewardId', message: 'rewardId must be a positive integer' }]);
  }

  const result = await rewardModel.redeem({ userId: req.user.id, rewardId });

  const redemptionCode = signRewardCode({
    userId: req.user.id,
    rewardId,
    shopId: result.reward.shopId
  });

  return created(res, {
    redemptionCode,
    reward: result.reward,
    remainingPoints: result.remainingPoints,
    expiresIn: config.reward.ttl,
    instructions: 'Present this code at the reward shop counter.'
  });
});

const renderDashboard = asyncHandler(async (req, res) => {
  const profile = await userModel.findById(req.user.id);

  if (!profile) {
    res.clearCookie(COOKIE_NAME, clearCookieOptions());
    return res.redirect(302, '/?auth=required');
  }

  const [borrows, donations, rewards] = await Promise.all([
    bookItemModel.findBorrowsByUser(req.user.id),
    bookItemModel.findDonationsByUser(req.user.id),
    rewardModel.findAll({})
  ]);

  return res.render('pages/customer', {
    title: 'My Dashboard',
    profile,
    borrows,
    donations,
    rewards,
    currentUser: { ...res.locals.currentUser, username: profile.username },
    pageScript: 'customer'
  });
});

module.exports = { getProfile, getDonations, getBorrows, redeemReward, renderDashboard };
