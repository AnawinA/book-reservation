'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./env');

const COOKIE_NAME = 'token';
const ALGORITHM = 'HS256';

function signAccessToken({ id, role, shopId = null }) {
  return jwt.sign({ role, shopId: shopId === undefined ? null : shopId }, config.jwt.secret, {
    algorithm: ALGORITHM,
    subject: String(id),
    issuer: config.jwt.issuer,
    expiresIn: config.jwt.expiresIn
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: [ALGORITHM],
    issuer: config.jwt.issuer
  });
  return {
    id: Number(payload.sub),
    role: payload.role,
    shopId: payload.shopId === undefined ? null : payload.shopId
  };
}

function signRewardCode({ userId, rewardId, shopId }) {
  return jwt.sign(
    { typ: 'reward', uid: userId, rid: rewardId, sid: shopId },
    config.reward.secret,
    {
      algorithm: ALGORITHM,
      jwtid: crypto.randomUUID(),
      expiresIn: config.reward.ttl
    }
  );
}

function verifyRewardCode(code) {
  const payload = jwt.verify(code, config.reward.secret, { algorithms: [ALGORITHM] });
  if (payload.typ !== 'reward') {
    throw new jwt.JsonWebTokenError('Not a reward code');
  }
  return payload;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  };
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/'
  };
}

module.exports = {
  COOKIE_NAME,
  signAccessToken,
  verifyAccessToken,
  signRewardCode,
  verifyRewardCode,
  cookieOptions,
  clearCookieOptions
};
