'use strict';

const AppError = require('../utils/AppError');
const { parsePositiveInt } = require('../utils/validators');
const { COOKIE_NAME, verifyAccessToken, clearCookieOptions } = require('../configs/jwt');

function readToken(req) {
  return req.cookies ? req.cookies[COOKIE_NAME] : undefined;
}

/**
 * Never blocks. Attaches req.user and res.locals.currentUser when the HttpOnly
 * cookie holds a valid token, otherwise clears a stale cookie.
 */
function attachUser(req, res, next) {
  res.locals.currentUser = null;
  const token = readToken(req);

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = payload;
      res.locals.currentUser = {
        id: payload.id,
        role: payload.role,
        shopId: payload.shopId
      };
    } catch (_) {
      if (typeof res.clearCookie === 'function') {
        res.clearCookie(COOKIE_NAME, clearCookieOptions());
      }
    }
  }
  return next();
}

function authenticateApi(req, res, next) {
  if (!req.user) return next(AppError.unauthorized('Authentication required'));
  return next();
}

function authenticatePage(req, res, next) {
  if (!req.user) return res.redirect(302, '/?auth=required');
  return next();
}

function authorize(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) return next(AppError.unauthorized('Authentication required'));
    if (!roles.includes(req.user.role)) return next(AppError.forbidden('Insufficient role'));
    return next();
  };
}

function authorizePage(...roles) {
  return function rolePageGuard(req, res, next) {
    if (!req.user) return res.redirect(302, '/?auth=required');
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('pages/error', {
        title: 'ไม่มีสิทธิ์เข้าถึง',
        statusCode: 403,
        message: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้',
        pageScript: null,
        currentUser: res.locals.currentUser || null
      });
    }
    return next();
  };
}

function requireOwnShop(paramName = 'shopId') {
  return function shopScopeGuard(req, res, next) {
    const parsed = parsePositiveInt(req.params[paramName]);
    if (parsed === null) {
      return next(
        AppError.validation([{ field: paramName, message: `${paramName} must be a positive integer` }])
      );
    }
    if (req.user && req.user.role === 'Admin') {
      req.shopId = parsed;
      return next();
    }
    if (req.user.shopId === null || req.user.shopId === undefined || Number(req.user.shopId) !== parsed) {
      return next(AppError.forbidden('You can only manage your own shop'));
    }
    req.shopId = parsed;
    return next();
  };
}

module.exports = {
  attachUser,
  authenticateApi,
  authenticatePage,
  authorize,
  authorizePage,
  requireOwnShop
};
