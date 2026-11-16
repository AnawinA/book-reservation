'use strict';

jest.mock('../../configs/db');
jest.mock('../../models/shopModel');
jest.mock('../../models/bookModel');
jest.mock('../../models/campaignModel');
jest.mock('../../models/rewardModel');

const request = require('supertest');
const { createApp } = require('../../app');
const shopModel = require('../../models/shopModel');
const bookModel = require('../../models/bookModel');
const campaignModel = require('../../models/campaignModel');
const rewardModel = require('../../models/rewardModel');

const app = createApp();

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
  shopModel.findAll.mockResolvedValue([{ id: 1, name: 'KMITL Library Corner', totalItems: 4 }]);
  bookModel.search.mockResolvedValue({ items: [BOOK], total: 1 });
  bookModel.findCategories.mockResolvedValue(['Programming']);
  bookModel.findByIsbn.mockResolvedValue({ ...BOOK, availabilityByShop: [] });
  campaignModel.findAll.mockResolvedValue([]);
  rewardModel.findAll.mockResolvedValue([]);
});

describe('public API', () => {
  test('[positive] GET /api/shops lists shops with item statistics', async () => {
    const res = await request(app).get('/api/shops');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].name).toBe('KMITL Library Corner');
  });

  test('[positive] GET /api/books returns the list with pagination meta', async () => {
    const res = await request(app).get('/api/books?q=clean&page=1&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe('Clean Code');
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(bookModel.search).toHaveBeenCalledWith({
      q: 'clean',
      category: '',
      page: 1,
      limit: 10
    });
  });

  test('[boundary] GET /api/books?limit=101 returns 400', async () => {
    const res = await request(app).get('/api/books?limit=101');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(bookModel.search).not.toHaveBeenCalled();
  });

  test('[positive] GET /api/books/:isbn normalizes the ISBN and returns the book', async () => {
    const res = await request(app).get('/api/books/978-0-13-235088-4');

    expect(res.status).toBe(200);
    expect(res.body.data.isbn).toBe('9780132350884');
    expect(bookModel.findByIsbn).toHaveBeenCalledWith('9780132350884');
  });

  test('[negative] an invalid ISBN checksum returns 400', async () => {
    const res = await request(app).get('/api/books/9780132350885');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('[negative] an unknown ISBN returns 404', async () => {
    bookModel.findByIsbn.mockResolvedValue(null);

    const res = await request(app).get('/api/books/9780201633610');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
