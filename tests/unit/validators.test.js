'use strict';

const v = require('../../utils/validators');

describe('validators', () => {
  test('[boundary] password of 7 characters is rejected', () => {
    expect(v.isValidPassword('abc1234')).toBe(false);
  });

  test('[boundary] password of exactly 8 characters is accepted', () => {
    expect(v.isValidPassword('abcd1234')).toBe(true);
  });

  test('[boundary] password of exactly 72 characters is accepted', () => {
    const value = `${'a'.repeat(71)}1`;
    expect(value).toHaveLength(72);
    expect(v.isValidPassword(value)).toBe(true);
  });

  test('[boundary] password of 73 characters is rejected', () => {
    expect(v.isValidPassword(`${'a'.repeat(72)}1`)).toBe(false);
  });

  test('[negative] password without a digit is rejected', () => {
    expect(v.isValidPassword('onlyletters')).toBe(false);
  });

  test('[boundary] username of 2 characters is rejected', () => {
    expect(v.isValidUsername('ab')).toBe(false);
  });

  test('[boundary] username of 3 characters is accepted', () => {
    expect(v.isValidUsername('abc')).toBe(true);
  });

  test('[boundary] username of 30 characters is accepted', () => {
    expect(v.isValidUsername('a'.repeat(30))).toBe(true);
  });

  test('[boundary] username of 31 characters is rejected', () => {
    expect(v.isValidUsername('a'.repeat(31))).toBe(false);
  });

  test('[negative] username with a hyphen is rejected', () => {
    expect(v.isValidUsername('bad-name')).toBe(false);
  });

  test('[positive] valid Thai mobile numbers are accepted', () => {
    expect(v.isValidPhone('0811111111')).toBe(true);
    expect(v.isValidPhone('0800000001')).toBe(true);
  });

  test('[negative] phone must be 10 digits starting with 0', () => {
    expect(v.isValidPhone('811111111')).toBe(false);
    expect(v.isValidPhone('1811111111')).toBe(false);
  });

  test('[positive] ISBN-10 checksum is validated', () => {
    expect(v.isValidIsbn10('0306406152')).toBe(true);
    expect(v.isValidIsbn10('0306406153')).toBe(false);
  });

  test('[positive] ISBN-13 checksum is validated', () => {
    expect(v.isValidIsbn13('9780132350884')).toBe(true);
    expect(v.isValidIsbn13('9780132350885')).toBe(false);
  });

  test('[positive] hyphens and spaces are stripped by normalizeIsbn', () => {
    expect(v.normalizeIsbn(' 978-0-13-235088-4 ')).toBe('9780132350884');
    expect(v.isValidIsbn('978-0-13-235088-4')).toBe(true);
  });

  test('[negative] barcode must be 4-32 uppercase characters', () => {
    expect(v.isValidBarcode('BK-0001')).toBe(true);
    expect(v.isValidBarcode('ab1')).toBe(false);
    expect(v.isValidBarcode('BK_0001')).toBe(false);
    expect(v.normalizeBarcode(' bk-0001 ')).toBe('BK-0001');
  });

  test('[boundary] durationDays 0/1/30/31 is validated against the max', () => {
    const options = { defaultDays: 14, maxDays: 30 };
    const base = { barcode: 'BK-0001', borrowerPhone: '0811111111' };

    expect(v.validateBorrow({ ...base, durationDays: 0 }, options).errors).toHaveLength(1);
    expect(v.validateBorrow({ ...base, durationDays: 1 }, options).errors).toHaveLength(0);
    expect(v.validateBorrow({ ...base, durationDays: 30 }, options).errors).toHaveLength(0);
    expect(v.validateBorrow({ ...base, durationDays: 31 }, options).errors).toHaveLength(1);
    expect(v.validateBorrow(base, options).value.durationDays).toBe(14);
  });

  test('[boundary] pagination limit 0/1/100/101 is enforced', () => {
    const { parsePagination } = require('../../utils/pagination');
    expect(() => parsePagination({ limit: '0' })).toThrow();
    expect(parsePagination({ limit: '1' }).limit).toBe(1);
    expect(parsePagination({ limit: '100' }).limit).toBe(100);
    expect(() => parsePagination({ limit: '101' })).toThrow();
    expect(parsePagination({}).page).toBe(1);
    expect(parsePagination({ page: '2', limit: '10' }).offset).toBe(10);
  });

  test('[negative] status update rejects BORROWED and unknown values', () => {
    expect(v.validateStatusUpdate({ status: 'BORROWED' }).errors).toHaveLength(1);
    expect(v.validateStatusUpdate({ status: 'AVAILABLE' }).errors).toHaveLength(0);
    expect(v.validateStatusUpdate({ status: 'WHATEVER' }).errors).toHaveLength(1);
    expect(v.ITEM_STATUSES).toEqual(['AVAILABLE', 'BORROWED', 'LOST', 'DAMAGED']);
  });

  test('[positive] composed validators normalize and accept good payloads', () => {
    expect(v.validateShop({ name: ' Shop ', location: ' Bangkok ' }).value).toEqual({
      name: 'Shop',
      location: 'Bangkok'
    });
    expect(
      v.validateBook({ isbn: '978-0-13-235088-4', title: 'T', author: 'A', category: 'C' }).errors
    ).toHaveLength(0);
    expect(
      v.validateDonation({ donorPhone: '0811111111', isbn: '9780132350884', barcode: 'bk-9' }).value
    ).toEqual({ donorPhone: '0811111111', isbn: '9780132350884', barcode: 'BK-9' });
    expect(v.validateReturn({ barcode: 'bk-0001' }).value.barcode).toBe('BK-0001');
    expect(v.validateClaim({ code: 'x'.repeat(2048) }).errors).toHaveLength(0);
    expect(v.validateClaim({ code: 'y'.repeat(2049) }).errors).toHaveLength(1);
  });

  test('[negative] campaign and reward windows are validated', () => {
    const badCampaign = v.validateCampaign({
      title: 'Campaign',
      bonusPoints: 5000,
      shopId: '0',
      startAt: '2026-01-02T00:00:00Z',
      endAt: '2026-01-01T00:00:00Z'
    });
    const fields = badCampaign.errors.map((error) => error.field);
    expect(fields).toContain('bonusPoints');
    expect(fields).toContain('shopId');
    expect(fields).toContain('endAt');

    const goodCampaign = v.validateCampaign({
      title: 'Campaign',
      bonusPoints: 20,
      shopId: 1,
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-02-01T00:00:00Z'
    });
    expect(goodCampaign.errors).toHaveLength(0);
    expect(goodCampaign.value.startAt instanceof Date).toBe(true);

    expect(v.validateReward({ title: 'R', pointsCost: 0, stock: -1, shopId: 1 }).errors).toHaveLength(2);
    expect(v.validateReward({ title: 'R', pointsCost: 30, stock: 0, shopId: 1 }).errors).toHaveLength(0);
  });

  test('[boundary] ids, ISO dates and pagination meta are validated', () => {
    expect(v.parsePositiveInt('10')).toBe(10);
    expect(v.parsePositiveInt('0')).toBeNull();
    expect(v.parsePositiveInt('2147483648')).toBeNull();
    expect(v.parsePositiveInt('1.5')).toBeNull();
    expect(v.isValidDateString('2026-01-01T00:00:00Z')).toBe(true);
    expect(v.isValidDateString('not-a-date')).toBe(false);

    const { buildMeta } = require('../../utils/pagination');
    expect(buildMeta(1, 20, 0)).toEqual({ page: 1, limit: 20, total: 0, totalPages: 1 });
    expect(buildMeta(2, 10, 25).totalPages).toBe(3);
  });

  test('[negative] assertValid throws AppError.validation with details', () => {
    const result = v.validateRegister({ username: 'ab', phone: '123', password: 'short' });
    expect(result.errors.length).toBeGreaterThan(0);

    let thrown;
    try {
      v.assertValid(result);
    } catch (err) {
      thrown = err;
    }
    expect(thrown.statusCode).toBe(400);
    expect(thrown.code).toBe('VALIDATION_ERROR');
    expect(thrown.details.length).toBeGreaterThan(0);
  });
});
