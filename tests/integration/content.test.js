'use strict';

jest.mock('../../configs/db');
jest.mock('../../models/shopModel');
jest.mock('../../models/bookModel');
jest.mock('../../models/campaignModel');
jest.mock('../../models/rewardModel');
jest.mock('../../models/bookItemModel');
jest.mock('../../models/userModel');

const request = require('supertest');
const { createApp } = require('../../app');
const shopModel = require('../../models/shopModel');
const bookModel = require('../../models/bookModel');
const campaignModel = require('../../models/campaignModel');
const rewardModel = require('../../models/rewardModel');
const bookItemModel = require('../../models/bookItemModel');
const userModel = require('../../models/userModel');
const { adminCookie, customerCookie, ownerCookie } = require('../helpers/auth');

const app = createApp();

const SHOP = { id: 1, name: 'KMITL Library Corner', location: 'Ladkrabang, Bangkok', totalItems: 4, availableItems: 3, borrowedItems: 1 };
const BOOK = {
  id: 1,
  isbn: '9780132350884',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  category: 'Software Engineering',
  totalCopies: 3,
  availableCopies: 2
};

beforeEach(() => {
  shopModel.findAll.mockResolvedValue([SHOP]);
  shopModel.findById.mockResolvedValue(SHOP);
  bookModel.search.mockResolvedValue({ items: [BOOK], total: 1 });
  bookModel.findCategories.mockResolvedValue(['Software Engineering']);
  campaignModel.findAll.mockResolvedValue([]);
  rewardModel.findAll.mockResolvedValue([]);
  bookItemModel.findOverdue.mockResolvedValue([]);
  bookItemModel.findInventoryByShop.mockResolvedValue({ items: [], total: 0 });
  bookItemModel.findBorrowsByUser.mockResolvedValue([]);
  bookItemModel.findDonationsByUser.mockResolvedValue([]);
  userModel.findById.mockResolvedValue({
    id: 5,
    username: 'alice',
    phone: '0811111111',
    points: 90,
    role: 'Customer',
    shopId: null
  });
});

describe('public catalogue endpoints', () => {
  test('[positive] GET /api/campaigns?active=true forwards the active filter', async () => {
    const res = await request(app).get('/api/campaigns?active=true');

    expect(res.status).toBe(200);
    expect(campaignModel.findAll).toHaveBeenCalledWith({ activeOnly: true, shopId: null });
  });

  test('[positive] GET /api/rewards?shopId=1 filters by shop', async () => {
    const res = await request(app).get('/api/rewards?shopId=1');

    expect(res.status).toBe(200);
    expect(rewardModel.findAll).toHaveBeenCalledWith({ shopId: 1 });
  });

  test('[negative] GET /api/rewards?shopId=abc returns 400', async () => {
    const res = await request(app).get('/api/rewards?shopId=abc');
    expect(res.status).toBe(400);
  });
});

describe('shop-side endpoints', () => {
  test('[negative] an unknown inventory status filter returns 400', async () => {
    const res = await request(app)
      .get('/api/shops/1/inventory?status=BOGUS')
      .set('Cookie', ownerCookie(1));

    expect(res.status).toBe(400);
    expect(bookItemModel.findInventoryByShop).not.toHaveBeenCalled();
  });

  test('[negative] a malformed barcode returns 400', async () => {
    const res = await request(app)
      .get('/api/book-items/bk')
      .set('Cookie', ownerCookie(1));

    expect(res.status).toBe(400);
  });

  test('[negative] an unknown barcode returns 404', async () => {
    bookItemModel.findByBarcode.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/book-items/BK-9999')
      .set('Cookie', ownerCookie(1));

    expect(res.status).toBe(404);
  });
});

describe('admin content endpoints', () => {
  test('[positive] creating a book returns 201', async () => {
    bookModel.create.mockResolvedValue(BOOK);

    const res = await request(app)
      .post('/api/admin/books')
      .set('Cookie', adminCookie())
      .send({ isbn: '978-0-13-235088-4', title: 'Clean Code', author: 'Robert C. Martin', category: 'Software Engineering' });

    expect(res.status).toBe(201);
    expect(bookModel.create).toHaveBeenCalledWith({
      isbn: '9780132350884',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      category: 'Software Engineering'
    });
  });

  test('[negative] updating an unknown book returns 404', async () => {
    bookModel.update.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/admin/books/999')
      .set('Cookie', adminCookie())
      .send({ isbn: '9780132350884', title: 't', author: 'a', category: 'c' });

    expect(res.status).toBe(404);
  });

  test('[positive] a campaign for a missing shop returns 400 with a shopId detail', async () => {
    shopModel.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/admin/campaigns')
      .set('Cookie', adminCookie())
      .send({
        title: 'Bonus',
        bonusPoints: 20,
        shopId: 99,
        startAt: '2026-01-01T00:00:00Z',
        endAt: '2026-02-01T00:00:00Z'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('shopId');
    expect(campaignModel.create).not.toHaveBeenCalled();
  });

  test('[positive] creating and updating a campaign works', async () => {
    campaignModel.create.mockResolvedValue({ id: 3, title: 'Bonus', bonusPoints: 20, shopId: 1 });
    campaignModel.update.mockResolvedValue({ id: 3, title: 'Bonus', bonusPoints: 25, shopId: 1 });

    const payload = {
      title: 'Bonus',
      bonusPoints: 20,
      shopId: 1,
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-02-01T00:00:00Z'
    };

    const createdRes = await request(app)
      .post('/api/admin/campaigns')
      .set('Cookie', adminCookie())
      .send(payload);
    expect(createdRes.status).toBe(201);

    const updatedRes = await request(app)
      .put('/api/admin/campaigns/3')
      .set('Cookie', adminCookie())
      .send({ ...payload, bonusPoints: 25 });
    expect(updatedRes.status).toBe(200);
    expect(updatedRes.body.data.bonusPoints).toBe(25);
  });

  test('[positive] creating and updating a reward works', async () => {
    rewardModel.create.mockResolvedValue({ id: 4, title: 'Tote', pointsCost: 100, stock: 2, shopId: 1 });
    rewardModel.update.mockResolvedValue({ id: 4, title: 'Tote', pointsCost: 90, stock: 2, shopId: 1 });

    const createdRes = await request(app)
      .post('/api/admin/rewards')
      .set('Cookie', adminCookie())
      .send({ title: 'Tote', pointsCost: 100, stock: 2, shopId: 1 });
    expect(createdRes.status).toBe(201);

    const updatedRes = await request(app)
      .put('/api/admin/rewards/4')
      .set('Cookie', adminCookie())
      .send({ title: 'Tote', pointsCost: 90, stock: 2, shopId: 1 });
    expect(updatedRes.status).toBe(200);
    expect(updatedRes.body.data.pointsCost).toBe(90);
  });
});

describe('server-rendered dashboards', () => {
  test('[positive] the customer dashboard renders profile, borrows and rewards', async () => {
    const res = await request(app)
      .get('/customer/dashboard')
      .set('Cookie', customerCookie());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('alice');
    expect(res.text).toContain('points available');
  });

  test('[positive] the shop dashboard renders the shop inventory', async () => {
    const res = await request(app)
      .get('/shop/dashboard')
      .set('Cookie', ownerCookie(1));

    expect(res.status).toBe(200);
    expect(res.text).toContain('KMITL Library Corner');
    expect(res.text).toContain('Inventory');
  });

  test('[positive] the admin dashboard renders the KPI tiles and overdue report', async () => {
    const res = await request(app)
      .get('/admin/dashboard')
      .set('Cookie', adminCookie());

    expect(res.status).toBe(200);
    expect(res.text).toContain('Administration');
    expect(res.text).toContain('Overdue report');
  });

  test('[positive] a customer donations call returns the count meta', async () => {
    bookItemModel.findDonationsByUser.mockResolvedValue([{ barcode: 'BK-0001' }]);

    const res = await request(app)
      .get('/api/customer/donations')
      .set('Cookie', customerCookie());

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ count: 1 });
  });
});
