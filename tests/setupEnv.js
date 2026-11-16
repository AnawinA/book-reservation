'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.REWARD_CODE_SECRET = 'test_reward_secret_0123456789abcdef0123456789abcdef0123456789ab';
process.env.JWT_EXPIRES_IN = '1d';
process.env.REWARD_CODE_TTL = '72h';
process.env.BCRYPT_ROUNDS = '4';
process.env.COOKIE_SECURE = 'false';
process.env.DONATION_BASE_POINTS = '10';
process.env.DEFAULT_BORROW_DAYS = '14';
process.env.MAX_BORROW_DAYS = '30';
process.env.MAX_ACTIVE_BORROWS = '5';
process.env.SEED_DEFAULT_PASSWORD = 'Passw0rd!';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'book_borrowing_test';
