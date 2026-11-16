'use strict';

const AppError = require('./AppError');

function parsePagination(query = {}) {
  const errors = [];

  let page = 1;
  if (query.page !== undefined && query.page !== '') {
    const parsed = Number.parseInt(query.page, 10);
    if (Number.isNaN(parsed) || String(query.page).trim() !== String(parsed) || parsed < 1) {
      errors.push({ field: 'page', message: 'page must be an integer greater than or equal to 1' });
    } else {
      page = parsed;
    }
  }

  let limit = 20;
  if (query.limit !== undefined && query.limit !== '') {
    const parsed = Number.parseInt(query.limit, 10);
    if (Number.isNaN(parsed) || String(query.limit).trim() !== String(parsed) || parsed < 1 || parsed > 100) {
      errors.push({ field: 'limit', message: 'limit must be an integer between 1 and 100' });
    } else {
      limit = parsed;
    }
  }

  if (errors.length) throw AppError.validation(errors);

  return { page, limit, offset: (page - 1) * limit };
}

function buildMeta(page, limit, total) {
  const safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0;
  return {
    page,
    limit,
    total: safeTotal,
    totalPages: Math.max(1, Math.ceil(safeTotal / limit))
  };
}

module.exports = { parsePagination, buildMeta };
