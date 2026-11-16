'use strict';

const { signAccessToken } = require('../../configs/jwt');
const {
  attachUser,
  authenticateApi,
  authenticatePage,
  authorize,
  authorizePage,
  requireOwnShop
} = require('../../middlewares/authMiddleware');

function mockRes() {
  const res = {
    locals: {},
    clearCookie: jest.fn(),
    redirect: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis()
  };
  return res;
}

describe('middlewares/authMiddleware', () => {
  test('[positive] attachUser sets req.user and res.locals.currentUser from the cookie', () => {
    const token = signAccessToken({ id: 5, role: 'Customer', shopId: null });
    const req = { cookies: { token } };
    const res = mockRes();
    const next = jest.fn();

    attachUser(req, res, next);

    expect(req.user).toEqual({ id: 5, role: 'Customer', shopId: null });
    expect(res.locals.currentUser).toEqual({ id: 5, role: 'Customer', shopId: null });
    expect(next).toHaveBeenCalledWith();
  });

  test('[negative] attachUser clears an invalid cookie and never blocks', () => {
    const req = { cookies: { token: 'not-a-real-token' } };
    const res = mockRes();
    const next = jest.fn();

    attachUser(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('token', expect.any(Object));
    expect(req.user).toBeUndefined();
    expect(res.locals.currentUser).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  test('[negative] authenticateApi rejects with 401 when there is no user', () => {
    const next = jest.fn();
    authenticateApi({}, mockRes(), next);
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  test('[negative] authenticatePage redirects to the catalog with auth=required', () => {
    const res = mockRes();
    const next = jest.fn();
    authenticatePage({}, res, next);
    expect(res.redirect).toHaveBeenCalledWith(302, '/?auth=required');
    expect(next).not.toHaveBeenCalled();
  });

  test('[negative] authorize rejects a wrong role with 403', () => {
    const next = jest.fn();
    authorize('Admin')({ user: { id: 1, role: 'Customer' } }, mockRes(), next);
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  test('[negative] authorizePage renders the 403 page for a wrong role', () => {
    const res = mockRes();
    const next = jest.fn();
    authorizePage('Admin')({ user: { id: 1, role: 'Customer' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.render).toHaveBeenCalledWith('pages/error', expect.objectContaining({ statusCode: 403 }));
    expect(next).not.toHaveBeenCalled();
  });

  test('[negative] requireOwnShop rejects another owner shop with 403', () => {
    const next = jest.fn();
    requireOwnShop('shopId')(
      { params: { shopId: '2' }, user: { id: 2, role: 'OwnerShop', shopId: 1 } },
      mockRes(),
      next
    );
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  test('[boundary] requireOwnShop rejects a bad id with 400 and accepts a matching one', () => {
    const badNext = jest.fn();
    requireOwnShop('shopId')({ params: { shopId: 'abc' }, user: { shopId: 1 } }, mockRes(), badNext);
    expect(badNext.mock.calls[0][0].code).toBe('VALIDATION_ERROR');

    const req = { params: { shopId: '1' }, user: { id: 2, role: 'OwnerShop', shopId: 1 } };
    const next = jest.fn();
    requireOwnShop('shopId')(req, mockRes(), next);
    expect(req.shopId).toBe(1);
    expect(next).toHaveBeenCalledWith();
  });
});
