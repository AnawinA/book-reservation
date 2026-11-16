'use strict';

const jwtLib = require('jsonwebtoken');
const config = require('../../configs/env');
const {
  signAccessToken,
  verifyAccessToken,
  signRewardCode,
  verifyRewardCode,
  cookieOptions,
  clearCookieOptions,
  COOKIE_NAME
} = require('../../configs/jwt');

describe('configs/jwt', () => {
  test('[positive] access token round trip keeps id, role and shopId', () => {
    const token = signAccessToken({ id: 7, role: 'OwnerShop', shopId: 2 });
    expect(verifyAccessToken(token)).toEqual({ id: 7, role: 'OwnerShop', shopId: 2 });
  });

  test('[negative] a tampered token is rejected', () => {
    const token = signAccessToken({ id: 7, role: 'Customer', shopId: null });
    expect(() => verifyAccessToken(`${token}x`)).toThrow();
  });

  test('[negative] an expired token is rejected', () => {
    const expired = jwtLib.sign({ role: 'Customer', shopId: null }, config.jwt.secret, {
      algorithm: 'HS256',
      subject: '7',
      issuer: config.jwt.issuer,
      expiresIn: -10
    });
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });

  test('[negative] a voucher with the wrong typ is rejected', () => {
    const wrongTyp = jwtLib.sign({ typ: 'access', uid: 1, rid: 2, sid: 3 }, config.reward.secret, {
      algorithm: 'HS256',
      expiresIn: '1h'
    });
    expect(() => verifyRewardCode(wrongTyp)).toThrow(/reward/i);

    const code = signRewardCode({ userId: 1, rewardId: 2, shopId: 3 });
    const payload = verifyRewardCode(code);
    expect(payload.uid).toBe(1);
    expect(payload.rid).toBe(2);
    expect(payload.sid).toBe(3);
    expect(typeof payload.jti).toBe('string');
  });

  test('[positive] cookie options are HttpOnly and SameSite strict', () => {
    const options = cookieOptions();
    expect(COOKIE_NAME).toBe('token');
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('strict');
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(24 * 60 * 60 * 1000);
    expect(clearCookieOptions()).not.toHaveProperty('maxAge');
  });
});
