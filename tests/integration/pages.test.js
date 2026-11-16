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
const { customerCookie } = require('../helpers/auth');

const app = createApp();

beforeEach(() => {
  shopModel.findAll.mockResolvedValue([{ id: 1, name: 'KMITL Library Corner', totalItems: 4, availableItems: 3, borrowedItems: 1 }]);
  bookModel.search.mockResolvedValue({
    items: [
      {
        id: 1,
        isbn: '9780132350884',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        category: 'Software Engineering',
        totalCopies: 3,
        availableCopies: 2
      }
    ],
    total: 1
  });
  bookModel.findCategories.mockResolvedValue(['Software Engineering']);
  campaignModel.findAll.mockResolvedValue([]);
  rewardModel.findAll.mockResolvedValue([]);
  bookItemModel.findOverdue.mockResolvedValue([]);
});

describe('server-rendered pages', () => {
  test('[positive] GET / renders the catalog as HTML', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Clean Code');
    expect(res.text).toContain('Book Catalog');
  });

  test('[negative] a dashboard without a cookie redirects to /?auth=required', async () => {
    const res = await request(app).get('/customer/dashboard');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/?auth=required');
  });

  test('[negative] the admin dashboard with a customer cookie renders the 403 page', async () => {
    const res = await request(app)
      .get('/admin/dashboard')
      .set('Cookie', customerCookie());

    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('403');
    expect(res.text).toContain('You do not have access to this page.');
  });
});
