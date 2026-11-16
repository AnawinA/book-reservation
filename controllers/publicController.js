'use strict';

const config = require('../configs/env');
const shopModel = require('../models/shopModel');
const bookModel = require('../models/bookModel');
const campaignModel = require('../models/campaignModel');
const rewardModel = require('../models/rewardModel');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok } = require('../utils/response');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { normalizeIsbn, isValidIsbn, parsePositiveInt } = require('../utils/validators');

const listShops = asyncHandler(async (req, res) => {
  return ok(res, await shopModel.findAll());
});

const listBooks = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim().slice(0, 50) : '';

  const { items, total } = await bookModel.search({ q, category, page, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getBookByIsbn = asyncHandler(async (req, res) => {
  const isbn = normalizeIsbn(req.params.isbn);
  if (!isValidIsbn(isbn)) {
    throw AppError.validation([{ field: 'isbn', message: 'isbn must be a valid ISBN-10 or ISBN-13' }]);
  }

  const book = await bookModel.findByIsbn(isbn);
  if (!book) throw AppError.notFound('Book collection');
  return ok(res, book);
});

const listCampaigns = asyncHandler(async (req, res) => {
  const activeOnly = String(req.query.active) === 'true';
  const shopId = req.query.shopId === undefined ? null : parsePositiveInt(req.query.shopId);
  if (req.query.shopId !== undefined && shopId === null) {
    throw AppError.validation([{ field: 'shopId', message: 'shopId must be a positive integer' }]);
  }
  return ok(res, await campaignModel.findAll({ activeOnly, shopId }));
});

const listRewards = asyncHandler(async (req, res) => {
  const shopId = req.query.shopId === undefined ? null : parsePositiveInt(req.query.shopId);
  if (req.query.shopId !== undefined && shopId === null) {
    throw AppError.validation([{ field: 'shopId', message: 'shopId must be a positive integer' }]);
  }
  return ok(res, await rewardModel.findAll({ shopId }));
});

const renderHome = asyncHandler(async (req, res) => {
  let page = 1;
  let limit = 20;
  let q = '';
  let category = '';

  try {
    const pagination = parsePagination(req.query);
    page = pagination.page;
    limit = pagination.limit;
  } catch (_) {
    page = 1;
    limit = 20;
  }

  if (typeof req.query.q === 'string') q = req.query.q.trim().slice(0, 100);
  if (typeof req.query.category === 'string') category = req.query.category.trim().slice(0, 50);

  const [books, categories, shops, campaigns, rewards] = await Promise.all([
    bookModel.search({ q, category, page, limit }),
    bookModel.findCategories(),
    shopModel.findAll(),
    campaignModel.findAll({ activeOnly: true }),
    rewardModel.findAll({})
  ]);

  return res.render('pages/index', {
    title: 'Book Catalog',
    books: books.items,
    categories,
    shops,
    campaigns,
    rewards,
    query: { q, category, page },
    pagination: buildMeta(page, limit, books.total),
    authRequired: req.query.auth === 'required',
    currentUser: res.locals.currentUser,
    pageScript: 'home',
    maxBorrowDays: config.maxBorrowDays
  });
});

module.exports = { renderHome, listShops, listBooks, getBookByIsbn, listCampaigns, listRewards };
