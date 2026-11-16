'use strict';

const AppError = require('./AppError');

const ITEM_STATUSES = ['AVAILABLE', 'BORROWED', 'LOST', 'DAMAGED'];
const ROLES = ['Admin', 'Customer', 'OwnerShop'];

const MAX_ID = 2147483647;

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function isValidUsername(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_]{3,30}$/.test(value);
}

function isValidPassword(value) {
  if (typeof value !== 'string') return false;
  if (value.length < 8 || value.length > 72) return false;
  return /[A-Za-z]/.test(value) && /\d/.test(value);
}

function isValidPhone(value) {
  return typeof value === 'string' && /^0\d{9}$/.test(value);
}

function normalizeIsbn(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[-\s]/g, '')
    .toUpperCase();
}

function isValidIsbn10(value) {
  const s = normalizeIsbn(value);
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const digit = s[i] === 'X' ? 10 : Number(s[i]);
    sum += (10 - i) * digit;
  }
  return sum % 11 === 0;
}

function isValidIsbn13(value) {
  const s = normalizeIsbn(value);
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

function isValidIsbn(value) {
  const s = normalizeIsbn(value);
  if (s.length === 10) return isValidIsbn10(s);
  if (s.length === 13) return isValidIsbn13(s);
  return false;
}

function normalizeBarcode(value) {
  return String(value === undefined || value === null ? '' : value)
    .trim()
    .toUpperCase();
}

function isValidBarcode(value) {
  return typeof value === 'string' && /^[A-Z0-9-]{4,32}$/.test(normalizeBarcode(value));
}

function parsePositiveInt(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= MAX_ID ? value : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_ID) return null;
  return parsed;
}

function isValidDateString(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?)?$/.test(trimmed)) {
    return false;
  }
  return !Number.isNaN(Date.parse(trimmed));
}

/* ------------------------------------------------------------------ */
/* Small helpers used by the composed validators                       */
/* ------------------------------------------------------------------ */

function requireText(value, field, min, max, errors) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    errors.push({ field, message: `${field} is required` });
    return '';
  }
  if (text.length < min || text.length > max) {
    errors.push({ field, message: `${field} must be between ${min} and ${max} characters` });
    return text;
  }
  return text;
}

function collect(result) {
  return result;
}

/* ------------------------------------------------------------------ */
/* Composed validators                                                 */
/* ------------------------------------------------------------------ */

function validateRegister(body = {}) {
  const errors = [];
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (!username) {
    errors.push({ field: 'username', message: 'username is required' });
  } else if (!isValidUsername(username)) {
    errors.push({ field: 'username', message: 'username must be 3-30 letters, digits or underscores' });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    errors.push({ field: 'password', message: 'password is required' });
  } else if (!isValidPassword(password)) {
    errors.push({ field: 'password', message: 'password must be 8-72 characters and contain a letter and a digit' });
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phone) {
    errors.push({ field: 'phone', message: 'phone is required' });
  } else if (!isValidPhone(phone)) {
    errors.push({ field: 'phone', message: 'phone must be a Thai mobile number (10 digits starting with 0)' });
  }

  return collect({ value: { username, password, phone }, errors });
}

function validateLogin(body = {}) {
  const errors = [];
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username) errors.push({ field: 'username', message: 'username is required' });
  if (!password) errors.push({ field: 'password', message: 'password is required' });
  return collect({ value: { username, password }, errors });
}

function validateShop(body = {}) {
  const errors = [];
  const name = requireText(body.name, 'name', 1, 100, errors);
  const location = requireText(body.location, 'location', 1, 255, errors);
  return collect({ value: { name, location }, errors });
}

function validateBook(body = {}) {
  const errors = [];
  const isbn = normalizeIsbn(body.isbn);
  if (!isbn) {
    errors.push({ field: 'isbn', message: 'isbn is required' });
  } else if (!isValidIsbn(isbn)) {
    errors.push({ field: 'isbn', message: 'isbn must be a valid ISBN-10 or ISBN-13' });
  }
  const title = requireText(body.title, 'title', 1, 255, errors);
  const author = requireText(body.author, 'author', 1, 255, errors);
  const category = requireText(body.category, 'category', 1, 50, errors);
  return collect({ value: { isbn, title, author, category }, errors });
}

function validateCampaign(body = {}) {
  const errors = [];
  const title = requireText(body.title, 'title', 1, 150, errors);

  const bonus = body.bonusPoints === undefined || body.bonusPoints === '' ? 0 : Number(body.bonusPoints);
  const bonusPoints = Number.isInteger(bonus) && bonus >= 0 && bonus <= 1000 ? bonus : null;
  if (bonusPoints === null) {
    errors.push({ field: 'bonusPoints', message: 'bonusPoints must be an integer between 0 and 1000' });
  }

  const shopId = parsePositiveInt(body.shopId);
  if (shopId === null) errors.push({ field: 'shopId', message: 'shopId must be a positive integer' });

  const startAt = body.startAt;
  const endAt = body.endAt;
  const startValid = isValidDateString(startAt);
  const endValid = isValidDateString(endAt);
  if (!startValid) errors.push({ field: 'startAt', message: 'startAt must be an ISO-8601 date' });
  if (!endValid) errors.push({ field: 'endAt', message: 'endAt must be an ISO-8601 date' });
  if (startValid && endValid && Date.parse(endAt) <= Date.parse(startAt)) {
    errors.push({ field: 'endAt', message: 'endAt must be after startAt' });
  }

  return collect({
    value: { title, bonusPoints, shopId, startAt: startValid ? new Date(startAt) : null, endAt: endValid ? new Date(endAt) : null },
    errors
  });
}

function validateReward(body = {}) {
  const errors = [];
  const title = requireText(body.title, 'title', 1, 150, errors);

  const cost = body.pointsCost === undefined || body.pointsCost === '' ? NaN : Number(body.pointsCost);
  const pointsCost = Number.isInteger(cost) && cost >= 1 && cost <= 100000 ? cost : null;
  if (pointsCost === null) {
    errors.push({ field: 'pointsCost', message: 'pointsCost must be an integer between 1 and 100000' });
  }

  const stockValue = body.stock === undefined || body.stock === '' ? 0 : Number(body.stock);
  const stock = Number.isInteger(stockValue) && stockValue >= 0 && stockValue <= 100000 ? stockValue : null;
  if (stock === null) {
    errors.push({ field: 'stock', message: 'stock must be an integer between 0 and 100000' });
  }

  const shopId = parsePositiveInt(body.shopId);
  if (shopId === null) errors.push({ field: 'shopId', message: 'shopId must be a positive integer' });

  return collect({ value: { title, pointsCost, stock, shopId }, errors });
}

function validateDonation(body = {}) {
  const errors = [];
  const donorPhone = typeof body.donorPhone === 'string' ? body.donorPhone.trim() : '';
  if (!donorPhone) {
    errors.push({ field: 'donorPhone', message: 'donorPhone is required' });
  } else if (!isValidPhone(donorPhone)) {
    errors.push({ field: 'donorPhone', message: 'donorPhone must be a Thai mobile number' });
  }

  const isbn = normalizeIsbn(body.isbn);
  if (!isbn) {
    errors.push({ field: 'isbn', message: 'isbn is required' });
  } else if (!isValidIsbn(isbn)) {
    errors.push({ field: 'isbn', message: 'isbn must be a valid ISBN-10 or ISBN-13' });
  }

  let barcode = null;
  if (body.barcode !== undefined && body.barcode !== null && String(body.barcode).trim() !== '') {
    barcode = normalizeBarcode(body.barcode);
    if (!isValidBarcode(barcode)) {
      errors.push({ field: 'barcode', message: 'barcode must be 4-32 uppercase letters, digits or hyphens' });
    }
  }

  return collect({ value: { donorPhone, isbn, barcode }, errors });
}

function validateBorrow(body = {}, options = {}) {
  const errors = [];
  const barcode = normalizeBarcode(body.barcode);
  if (!isValidBarcode(barcode)) {
    errors.push({ field: 'barcode', message: 'barcode must be 4-32 uppercase letters, digits or hyphens' });
  }

  const borrowerPhone = typeof body.borrowerPhone === 'string' ? body.borrowerPhone.trim() : '';
  if (!borrowerPhone) {
    errors.push({ field: 'borrowerPhone', message: 'borrowerPhone is required' });
  } else if (!isValidPhone(borrowerPhone)) {
    errors.push({ field: 'borrowerPhone', message: 'borrowerPhone must be a Thai mobile number' });
  }

  const defaultDays = options.defaultDays === undefined ? 14 : options.defaultDays;
  const maxDays = options.maxDays === undefined ? 30 : options.maxDays;
  let durationDays = defaultDays;
  if (body.durationDays !== undefined && body.durationDays !== null && body.durationDays !== '') {
    const parsed = parsePositiveInt(body.durationDays);
    if (parsed === null || parsed > maxDays) {
      errors.push({ field: 'durationDays', message: `durationDays must be an integer between 1 and ${maxDays}` });
    } else {
      durationDays = parsed;
    }
  }

  return collect({ value: { barcode, borrowerPhone, durationDays }, errors });
}

function validateReturn(body = {}) {
  const errors = [];
  const barcode = normalizeBarcode(body.barcode);
  if (!isValidBarcode(barcode)) {
    errors.push({ field: 'barcode', message: 'barcode must be 4-32 uppercase letters, digits or hyphens' });
  }
  return collect({ value: { barcode }, errors });
}

function validateStatusUpdate(body = {}) {
  const errors = [];
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
  if (status === 'BORROWED') {
    errors.push({ field: 'status', message: 'status may not be set to BORROWED' });
  } else if (!ITEM_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `status must be one of ${ITEM_STATUSES.join(', ')}` });
  }
  return collect({ value: { status }, errors });
}

function validateClaim(body = {}) {
  const errors = [];
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    errors.push({ field: 'code', message: 'code is required' });
  } else if (code.length > 2048) {
    errors.push({ field: 'code', message: 'code must be at most 2048 characters' });
  }
  return collect({ value: { code }, errors });
}

function assertValid(result) {
  if (!result || !Array.isArray(result.errors) || result.errors.length > 0) {
    throw AppError.validation(result && result.errors ? result.errors : []);
  }
  return result.value;
}

module.exports = {
  isValidUsername,
  isValidPassword,
  isValidPhone,
  normalizeIsbn,
  isValidIsbn10,
  isValidIsbn13,
  isValidIsbn,
  normalizeBarcode,
  isValidBarcode,
  parsePositiveInt,
  isValidDateString,
  ITEM_STATUSES,
  ROLES,
  validateRegister,
  validateLogin,
  validateShop,
  validateBook,
  validateCampaign,
  validateReward,
  validateDonation,
  validateBorrow,
  validateReturn,
  validateStatusUpdate,
  validateClaim,
  assertValid
};
