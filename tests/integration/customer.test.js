'use strict';

jest.mock('../../configs/db');
jest.mock('../../models/userModel');
jest.mock('../../models/rewardModel');
jest.mock('../../models/bookItemModel');

const request = require('supertest');
const { createApp } = require('../../app');
const userModel = require('../../models/userModel');
const rewardModel = require('../../models/rewardModel');
const bookItemModel = require('../../models/bookItemModel');
const AppError = require('../../utils/AppError');
const { customerCookie, ownerCookie } = require('../helpers/auth');

const app = createApp();

beforeEach(() => {
  userModel.findById.mockResolvedValue({
    id: 5,
    username: 'alice',
    phone: '0811111111',
    points: 120,
    role: 'Customer',
    shopId: null
  });
  bookItemModel.findBorrowsByUser.mockResolvedValue([]);
  bookItemModel.findDonationsByUser.mockResolvedValue([]);
  rewardModel.findAll.mockResolvedValue([]);
  rewardModel.redeem.mockResolvedValue({
    reward: { id: 1, title: 'Coffee Voucher', pointsCost: 30, shopId: 1 },
    remainingPoints: 90,
    remainingStock: 9
  });
});

describe('customer API guards', () => {
  test('[negative] no cookie returns 401', async () => {
    const res = await request(app).get('/api/customer/profile');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('[negative] an owner cookie returns 403', async () => {
    const res = await request(app)
      .get('/api/customer/profile')
      .set('Cookie', ownerCookie(1));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('customer data endpoints', () => {
  test('[positive] GET /api/customer/profile returns the profile without a hash', async () => {
    const res = await request(app)
      .get('/api/customer/profile')
      .set('Cookie', customerCookie());

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('alice');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  test('[positive] GET /api/customer/borrows reports the overdue count', async () => {
    bookItemModel.findBorrowsByUser.mockResolvedValue([
      { barcode: 'BK-0003', isOverdue: true, daysRemaining: -6 },
      { barcode: 'BK-0004', isOverdue: false, daysRemaining: 12 }
    ]);

    const res = await request(app)
      .get('/api/customer/borrows')
      .set('Cookie', customerCookie());

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ count: 2, overdueCount: 1 });
  });

  test('[positive] redeeming a reward returns 201 with a signed voucher', async () => {
    const res = await request(app)
      .post('/api/customer/rewards/1/redeem')
      .set('Cookie', customerCookie())
      .send({});

    expect(res.status).toBe(201);
    expect(typeof res.body.data.redemptionCode).toBe('string');
    expect(res.body.data.redemptionCode.split('.')).toHaveLength(3);
    expect(res.body.data.remainingPoints).toBe(90);
    expect(res.body.data.reward.title).toBe('Coffee Voucher');
  });

  test('[negative] an unaffordable reward returns 400 INSUFFICIENT_POINTS', async () => {
    rewardModel.redeem.mockRejectedValue(AppError.insufficientPoints());

    const res = await request(app)
      .post('/api/customer/rewards/1/redeem')
      .set('Cookie', customerCookie())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_POINTS');
  });

  test('[negative] an unknown reward returns 404', async () => {
    rewardModel.redeem.mockRejectedValue(AppError.notFound('Reward'));

    const res = await request(app)
      .post('/api/customer/rewards/999/redeem')
      .set('Cookie', customerCookie())
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('[negative] an out-of-stock reward returns 409 OUT_OF_STOCK', async () => {
    rewardModel.redeem.mockRejectedValue(AppError.outOfStock());

    const res = await request(app)
      .post('/api/customer/rewards/1/redeem')
      .set('Cookie', customerCookie())
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
  });
});
