'use strict';

jest.mock('../../configs/db');
jest.mock('../../models/shopModel');
jest.mock('../../models/bookModel');
jest.mock('../../models/campaignModel');
jest.mock('../../models/rewardModel');
jest.mock('../../models/bookItemModel');

const request = require('supertest');
const { createApp } = require('../../app');
const shopModel = require('../../models/shopModel');
const bookModel = require('../../models/bookModel');
const campaignModel = require('../../models/campaignModel');
const rewardModel = require('../../models/rewardModel');
const bookItemModel = require('../../models/bookItemModel');
const { adminCookie } = require('../helpers/auth');

const app = createApp();

const SHOP = { id: 4, name: 'New Shop', location: 'Bangkok' };

beforeEach(() => {
  shopModel.findAll.mockResolvedValue([SHOP]);
  shopModel.create.mockResolvedValue(SHOP);
  shopModel.findById.mockResolvedValue(SHOP);
  shopModel.countActiveBorrows.mockResolvedValue(0);
  shopModel.softDelete.mockResolvedValue(true);
  shopModel.update.mockResolvedValue(SHOP);
  bookModel.search.mockResolvedValue({ items: [], total: 0 });
  bookModel.findCategories.mockResolvedValue([]);
  campaignModel.findAll.mockResolvedValue([]);
  rewardModel.findAll.mockResolvedValue([]);
  bookItemModel.findOverdue.mockResolvedValue([]);
});

describe('admin shops', () => {
  test('[positive] creating a shop returns 201 with the row', async () => {
    const res = await request(app)
      .post('/api/admin/shops')
      .set('Cookie', adminCookie())
      .send({ name: 'New Shop', location: 'Bangkok' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(SHOP);
  });

  test('[negative] an invalid payload returns 400', async () => {
    const res = await request(app)
      .post('/api/admin/shops')
      .set('Cookie', adminCookie())
      .send({ name: '', location: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(shopModel.create).not.toHaveBeenCalled();
  });

  test('[negative] updating a missing shop returns 404', async () => {
    shopModel.update.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/admin/shops/999')
      .set('Cookie', adminCookie())
      .send({ name: 'Ghost', location: 'Nowhere' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('[positive] deleting a shop without active borrows returns 204', async () => {
    const res = await request(app)
      .delete('/api/admin/shops/4')
      .set('Cookie', adminCookie());

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(shopModel.softDelete).toHaveBeenCalledWith(4);
  });

  test('[negative] deleting a shop with active borrows returns 409', async () => {
    shopModel.countActiveBorrows.mockResolvedValue(2);

    const res = await request(app)
      .delete('/api/admin/shops/1')
      .set('Cookie', adminCookie());

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Shop has active borrows');
    expect(shopModel.softDelete).not.toHaveBeenCalled();
  });
});

describe('admin reports', () => {
  test('[positive] the overdue report aggregates days and shops', async () => {
    bookItemModel.findOverdue.mockResolvedValue([
      { barcode: 'BK-0003', username: 'alice', shopId: 1, shopName: 'KMITL Library Corner', daysOverdue: 6 },
      { barcode: 'BK-0011', username: 'bob', shopId: 1, shopName: 'KMITL Library Corner', daysOverdue: 4 }
    ]);

    const res = await request(app)
      .get('/api/admin/reports/overdue')
      .set('Cookie', adminCookie());

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({
      count: 2,
      totalDaysOverdue: 10,
      byShop: [{ shopId: 1, shopName: 'KMITL Library Corner', count: 2 }]
    });
  });
});
