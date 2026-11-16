'use strict';

jest.mock('../../configs/db');

const AppError = require('../../utils/AppError');
const { errorHandler } = require('../../middlewares/errorMiddleware');
const { attachUser, requireOwnShop } = require('../../middlewares/authMiddleware');
const validators = require('../../utils/validators');
const { signAccessToken } = require('../../configs/jwt');

function mockRes() {
  return {
    locals: {},
    clearCookie: jest.fn(),
    json: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis()
  };
}

describe('configs/env', () => {
  const ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL };
    jest.resetModules();
  });

  test('[positive] development defaults are parsed into numbers and booleans', () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = 'not-a-number';
    process.env.COOKIE_SECURE = 'true';
    process.env.DB_CONNECTION_LIMIT = '';

    jest.resetModules();
    const config = require('../../configs/env');

    expect(config.port).toBe(3000);
    expect(config.cookieSecure).toBe(true);
    expect(config.db.connectionLimit).toBe(10);
    expect(Object.isFrozen(config)).toBe(true);
  });

  test('[negative] production refuses placeholder or short secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change_me_to_a_64_char_random_string';

    jest.resetModules();
    expect(() => require('../../configs/env')).toThrow(/JWT_SECRET/);
  });

  test('[positive] production accepts strong secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(64);
    process.env.REWARD_CODE_SECRET = 'b'.repeat(64);

    jest.resetModules();
    const config = require('../../configs/env');

    expect(config.isProd).toBe(true);
    expect(config.jwt.issuer).toBe('book-borrowing-system');
  });
});

describe('error contract branches', () => {
  test('[negative] a client that does not accept HTML gets JSON', () => {
    const res = mockRes();
    errorHandler(AppError.notFound('Route'), { originalUrl: '/api/thing', accepts: () => false }, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' }
    });
  });

  test('[negative] validation details are included in the JSON error', () => {
    const res = mockRes();
    const error = AppError.validation([{ field: 'isbn', message: 'bad isbn' }]);
    errorHandler(error, { originalUrl: '/api/books', accepts: () => 'json' }, res, jest.fn());

    expect(res.json.mock.calls[0][0].error.details).toEqual([{ field: 'isbn', message: 'bad isbn' }]);
  });

  test('[negative] referenced-row and token errors map to 409 and 401', () => {
    const conflictRes = mockRes();
    errorHandler(
      { code: 'ER_ROW_IS_REFERENCED_2' },
      { originalUrl: '/api/admin/shops/1', accepts: () => 'json' },
      conflictRes,
      jest.fn()
    );
    expect(conflictRes.status).toHaveBeenCalledWith(409);

    const tokenRes = mockRes();
    errorHandler(
      { name: 'TokenExpiredError' },
      { originalUrl: '/api/customer/profile', accepts: () => 'json' },
      tokenRes,
      jest.fn()
    );
    expect(tokenRes.status).toHaveBeenCalledWith(401);
  });

  test('[negative] an unhandled error type becomes INTERNAL_ERROR', () => {
    const res = mockRes();
    errorHandler({}, { originalUrl: '/api/thing', accepts: () => 'json' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_ERROR');
  });
});

describe('auth middleware branches', () => {
  test('[boundary] attachUser tolerates a request without cookies', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    attachUser(req, res, next);

    expect(res.locals.currentUser).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  test('[boundary] an owner account without a shop cannot pass the shop guard', () => {
    const next = jest.fn();
    requireOwnShop('shopId')({ params: { shopId: '1' }, user: { role: 'OwnerShop', shopId: null } }, mockRes(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  test('[boundary] an admin explicitly scoped to a shop passes the shop guard', () => {
    const req = { params: { shopId: '2' }, user: { role: 'Admin', shopId: null } };
    const next = jest.fn();

    requireOwnShop('shopId')(req, mockRes(), next);

    expect(req.shopId).toBe(2);
    expect(next).toHaveBeenCalledWith();
  });

  test('[boundary] a token without a shopId still verifies', () => {
    const token = signAccessToken({ id: 3, role: 'Admin' });
    const req = { cookies: { token } };
    const res = mockRes();

    attachUser(req, res, jest.fn());

    expect(req.user).toEqual({ id: 3, role: 'Admin', shopId: null });
  });
});

describe('validator edge branches', () => {
  test('[boundary] unknown-length ISBNs, null input and numeric ids are handled', () => {
    expect(validators.isValidIsbn('12345678901')).toBe(false);
    expect(validators.normalizeBarcode(null)).toBe('');
    expect(validators.normalizeIsbn(undefined)).toBe('');
    expect(validators.parsePositiveInt(5)).toBe(5);
    expect(validators.parsePositiveInt(0)).toBeNull();
    expect(validators.parsePositiveInt(null)).toBeNull();
    expect(validators.isValidPassword(null)).toBe(false);
    expect(validators.isValidPhone(null)).toBe(false);
    expect(validators.isValidDateString(null)).toBe(false);
  });

  test('[boundary] empty composed payloads report every missing field', () => {
    expect(validators.validateShop({}).errors).toHaveLength(2);
    expect(validators.validateBook({}).errors).toHaveLength(4);
    expect(validators.validateDonation({}).errors).toHaveLength(2);
    expect(validators.validateBorrow({}, {}).errors.length).toBeGreaterThan(0);
    expect(validators.validateLogin({}).errors).toHaveLength(2);
    expect(validators.validateShop({ name: 'a'.repeat(101), location: 'b' }).errors).toHaveLength(1);
  });
});
