'use strict';

const bcrypt = require('bcrypt');
const config = require('../configs/env');
const userModel = require('../models/userModel');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { created, ok } = require('../utils/response');
const { validateRegister, validateLogin, assertValid } = require('../utils/validators');
const {
  COOKIE_NAME,
  signAccessToken,
  cookieOptions,
  clearCookieOptions
} = require('../configs/jwt');

/* A fixed bcrypt hash used to keep the login timing constant for unknown users. */
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0O';

function redirectFor(role) {
  if (role === 'Admin') return '/admin/dashboard';
  if (role === 'OwnerShop') return '/shop/dashboard';
  return '/customer/dashboard';
}

const register = asyncHandler(async (req, res) => {
  const value = assertValid(validateRegister(req.body));

  const conflicts = await userModel.findConflicts(value.username, value.phone);
  const details = [];
  if (conflicts.username) details.push({ field: 'username', message: 'username is already taken' });
  if (conflicts.phone) details.push({ field: 'phone', message: 'phone is already registered' });
  if (details.length) throw AppError.conflict('CONFLICT', 'Username or phone already exists');

  const passwordHash = await bcrypt.hash(value.password, config.bcryptRounds);

  const id = await userModel.create({
    username: value.username,
    phone: value.phone,
    passwordHash,
    role: 'Customer',
    shopId: null
  });

  return created(res, {
    id,
    username: value.username,
    phone: value.phone,
    role: 'Customer',
    points: 0
  });
});

const login = asyncHandler(async (req, res) => {
  const value = assertValid(validateLogin(req.body));

  const user = await userModel.findByUsernameWithHash(value.username);
  const hash = user && user.passwordHash ? user.passwordHash : DUMMY_HASH;
  const matches = await bcrypt.compare(value.password, hash);

  if (!user || !matches) {
    throw AppError.unauthorized('Invalid username or password');
  }

  const token = signAccessToken({ id: user.id, role: user.role, shopId: user.shopId });
  res.cookie(COOKIE_NAME, token, cookieOptions());

  return ok(res, {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      points: user.points,
      shopId: user.shopId
    },
    redirectTo: redirectFor(user.role)
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, clearCookieOptions());
  return ok(res, { message: 'Logged out' });
});

module.exports = { register, login, logout };
