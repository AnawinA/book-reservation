'use strict';

jest.mock('../../configs/db');
jest.mock('../../models/bookItemModel');
jest.mock('../../models/rewardModel');
jest.mock('../../models/userModel');
jest.mock('../../models/shopModel');
jest.mock('../../models/campaignModel');

const request = require('supertest');
const { createApp } = require('../../app');
const bookItemModel = require('../../models/bookItemModel');
const rewardModel = require('../../models/rewardModel');
const userModel = require('../../models/userModel');
const AppError = require('../../utils/AppError');
const { ownerCookie } = require('../helpers/auth');
const { signRewardCode } = require('../../configs/jwt');

const app = createApp();

const ITEM = {
  id: 5,
  barcode: 'BK-0001',
  status: 'AVAILABLE',
  shopId: 1,
  title: 'Clean Code'
};

beforeEach(() => {
  bookItemModel.findInventoryByShop.mockResolvedValue({ items: [ITEM], total: 1 });
  bookItemModel.findByBarcode.mockResolvedValue(ITEM);
  bookItemModel.donate.mockResolvedValue({
    item: ITEM,
    pointsAwarded: 30,
    basePoints: 10,
    bonusPoints: 20,
    campaign: { id: 1, title: 'Back to School Bonus', bonusPoints: 20 },
    donor: { id: 5, username: 'alice', points: 150 }
  });
  bookItemModel.borrow.mockResolvedValue({ item: { ...ITEM, status: 'BORROWED' }, durationDays: 14 });
  bookItemModel.returnItem.mockResolvedValue({ item: ITEM, wasOverdue: false, previousShopId: 1 });
  bookItemModel.updateStatus.mockResolvedValue({ ...ITEM, status: 'DAMAGED' });
  rewardModel.findById.mockResolvedValue({ id: 1, title: 'Coffee Voucher', pointsCost: 30, shopId: 1 });
  userModel.findById.mockResolvedValue({ id: 5, username: 'alice' });
});

describe('owner shop scope', () => {
  test('[negative] another shop id returns 403 before any model call', async () => {
    const res = await request(app)
      .get('/api/shops/2/inventory')
      .set('Cookie', ownerCookie(1));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(bookItemModel.findInventoryByShop).not.toHaveBeenCalled();
  });

  test('[positive] the owner can read its own inventory with pagination meta', async () => {
    const res = await request(app)
      .get('/api/shops/1/inventory?page=1&limit=20')
      .set('Cookie', ownerCookie(1));

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });
});

describe('owner transactions', () => {
  test('[positive] recording a donation returns 201 with the awarded points', async () => {
    const res = await request(app)
      .post('/api/shops/1/donations')
      .set('Cookie', ownerCookie(1))
      .send({ donorPhone: '0822222222', isbn: '9780132350884' });

    expect(res.status).toBe(201);
    expect(res.body.data.pointsAwarded).toBe(30);
    expect(bookItemModel.donate).toHaveBeenCalledWith({
      shopId: 1,
      donorPhone: '0822222222',
      isbn: '9780132350884',
      barcode: null
    });
  });

  test('[positive] lending an available book returns 201', async () => {
    const res = await request(app)
      .post('/api/shops/1/borrows')
      .set('Cookie', ownerCookie(1))
      .send({ barcode: 'BK-0001', borrowerPhone: '0811111111', durationDays: 14 });

    expect(res.status).toBe(201);
    expect(res.body.data.item.status).toBe('BORROWED');
  });

  test('[negative] lending an unavailable book returns 409 ITEM_NOT_AVAILABLE', async () => {
    bookItemModel.borrow.mockRejectedValue(
      new AppError(409, 'ITEM_NOT_AVAILABLE', 'Item is not available for borrowing')
    );

    const res = await request(app)
      .post('/api/shops/1/borrows')
      .set('Cookie', ownerCookie(1))
      .send({ barcode: 'BK-0001', borrowerPhone: '0811111111' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_NOT_AVAILABLE');
  });

  test('[positive] returning a book returns 200 with wasOverdue', async () => {
    const res = await request(app)
      .post('/api/shops/1/returns')
      .set('Cookie', ownerCookie(1))
      .send({ barcode: 'BK-0001' });

    expect(res.status).toBe(200);
    expect(res.body.data.wasOverdue).toBe(false);
  });

  test('[positive] a valid status change returns 200', async () => {
    const res = await request(app)
      .patch('/api/book-items/BK-0001/status')
      .set('Cookie', ownerCookie(1))
      .send({ status: 'DAMAGED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DAMAGED');
  });

  test('[negative] an invalid status transition returns 409', async () => {
    bookItemModel.updateStatus.mockRejectedValue(
      new AppError(409, 'INVALID_STATUS_TRANSITION', 'Cannot change status')
    );

    const res = await request(app)
      .patch('/api/book-items/BK-0001/status')
      .set('Cookie', ownerCookie(1))
      .send({ status: 'LOST' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('[positive] a valid voucher is claimed at the matching shop', async () => {
    const code = signRewardCode({ userId: 5, rewardId: 1, shopId: 1 });

    const res = await request(app)
      .patch('/api/shops/1/rewards/claim')
      .set('Cookie', ownerCookie(1))
      .send({ code });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.customer.username).toBe('alice');
    expect(res.body.data.reward.title).toBe('Coffee Voucher');
  });

  test('[negative] a tampered voucher returns 400 INVALID_REWARD_CODE', async () => {
    const res = await request(app)
      .patch('/api/shops/1/rewards/claim')
      .set('Cookie', ownerCookie(1))
      .send({ code: 'not.a.valid.code' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REWARD_CODE');
  });
});
