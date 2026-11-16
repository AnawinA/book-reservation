'use strict';

require('dotenv').config();

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const jwtSecret = process.env.JWT_SECRET || '';
const rewardSecret = process.env.REWARD_CODE_SECRET || '';
const dbPassword = process.env.DB_PASSWORD || '';

function assertSecret(name, value) {
  const missing = !value;
  const tooShort = String(value).length < 32;
  const placeholder = String(value).startsWith('change_me');
  if (missing || tooShort || placeholder) {
    throw new Error(
      `[config] ${name} must be set to a random string of at least 32 characters in production.`
    );
  }
}

if (isProd) {
  assertSecret('JWT_SECRET', jwtSecret);
  assertSecret('REWARD_CODE_SECRET', rewardSecret);
}

const config = Object.freeze({
  nodeEnv,
  isProd,
  isTest,
  port: toInt(process.env.PORT, 3000),
  db: Object.freeze({
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: dbPassword,
    database: process.env.DB_NAME || 'book_borrowing',
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10)
  }),
  jwt: Object.freeze({
    secret: jwtSecret || 'development_only_jwt_secret_do_not_use_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    issuer: 'book-borrowing-system'
  }),
  reward: Object.freeze({
    secret: rewardSecret || 'development_only_reward_secret_do_not_use_in_production',
    ttl: process.env.REWARD_CODE_TTL || '72h'
  }),
  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),
  cookieSecure: toBool(process.env.COOKIE_SECURE, false),
  donationBasePoints: toInt(process.env.DONATION_BASE_POINTS, 10),
  defaultBorrowDays: toInt(process.env.DEFAULT_BORROW_DAYS, 14),
  maxBorrowDays: toInt(process.env.MAX_BORROW_DAYS, 30),
  maxActiveBorrows: toInt(process.env.MAX_ACTIVE_BORROWS, 5),
  seedDefaultPassword: process.env.SEED_DEFAULT_PASSWORD || 'Passw0rd!'
});

module.exports = config;
