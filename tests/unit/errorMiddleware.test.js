'use strict';

jest.mock('../../configs/env', () => ({ isProd: true, isTest: true }));

const AppError = require('../../utils/AppError');
const { notFound, errorHandler } = require('../../middlewares/errorMiddleware');

function mockRes() {
  return {
    locals: { currentUser: null },
    json: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis()
  };
}

describe('middlewares/errorMiddleware', () => {
  test('[negative] notFound forwards a 404 AppError', () => {
    const next = jest.fn();
    notFound({}, mockRes(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(next.mock.calls[0][0].code).toBe('NOT_FOUND');
  });

  test('[positive] an AppError keeps its status code and code', () => {
    const res = mockRes();
    const err = AppError.outOfStock();
    errorHandler(err, { originalUrl: '/api/rewards', accepts: () => 'json' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'OUT_OF_STOCK', message: 'Reward is out of stock' }
    });
  });

  test('[negative] ER_DUP_ENTRY is mapped to 409 CONFLICT', () => {
    const res = mockRes();
    errorHandler({ code: 'ER_DUP_ENTRY' }, { originalUrl: '/api/admin/books', accepts: () => 'json' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error.code).toBe('CONFLICT');
  });

  test('[negative] a malformed JSON body is mapped to 400', () => {
    const res = mockRes();
    errorHandler(
      { type: 'entity.parse.failed', message: 'Unexpected token' },
      { originalUrl: '/api/auth/login', accepts: () => 'json' },
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.code).toBe('VALIDATION_ERROR');
  });

  test('[negative] a 500 hides its message in production', () => {
    const res = mockRes();
    errorHandler(new Error('secret stack detail'), { originalUrl: '/api/anything', accepts: () => 'json' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.message).toBe('Internal server error');
  });

  test('[negative] a page request renders the error view', () => {
    const res = mockRes();
    errorHandler(AppError.notFound('Book item'), { originalUrl: '/some-page', accepts: () => 'html' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render).toHaveBeenCalledWith('pages/error', expect.objectContaining({ statusCode: 404 }));
  });
});
