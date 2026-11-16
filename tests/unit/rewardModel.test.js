'use strict';

jest.mock('../../configs/db', () => ({
  pool: { execute: jest.fn(), query: jest.fn() },
  withTransaction: jest.fn()
}));

const db = require('../../configs/db');
const rewardModel = require('../../models/rewardModel');
const { createMockConn, mockWithTransaction } = require('../helpers/mockConn');

function redeemConn(responses) {
  const conn = createMockConn(responses);
  mockWithTransaction(db, conn);
  return conn;
}

describe('models/rewardModel.redeem', () => {
  test('[positive] a successful redeem deducts points and stock', async () => {
    const conn = redeemConn([
      [[{ id: 5, points: 120 }], []],
      [[{ id: 1, title: 'Coffee Voucher', pointsCost: 30, stock: 10, shopId: 1 }], []],
      [{ affectedRows: 1 }, []],
      [{ affectedRows: 1 }, []]
    ]);

    const result = await rewardModel.redeem({ userId: 5, rewardId: 1 });

    expect(result.reward).toEqual({ id: 1, title: 'Coffee Voucher', pointsCost: 30, shopId: 1 });
    expect(result.remainingPoints).toBe(90);
    expect(result.remainingStock).toBe(9);
    expect(conn.calls).toContain('COMMIT');
  });

  test('[negative] an unknown user returns 404 and rolls back', async () => {
    const conn = redeemConn([[[], []]]);

    await expect(rewardModel.redeem({ userId: 99, rewardId: 1 })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    });
    expect(conn.calls).toContain('ROLLBACK');
    expect(conn.calls).not.toContain('COMMIT');
  });

  test('[negative] an unknown reward returns 404', async () => {
    redeemConn([[[{ id: 5, points: 120 }], []], [[], []]]);

    await expect(rewardModel.redeem({ userId: 5, rewardId: 404 })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  });

  test('[negative] no stock throws OUT_OF_STOCK and rolls back', async () => {
    const conn = redeemConn([
      [[{ id: 5, points: 120 }], []],
      [[{ id: 3, title: 'Bookmark Set', pointsCost: 10, stock: 0, shopId: 2 }], []]
    ]);

    await expect(rewardModel.redeem({ userId: 5, rewardId: 3 })).rejects.toMatchObject({
      statusCode: 409,
      code: 'OUT_OF_STOCK'
    });
    expect(conn.calls).toContain('ROLLBACK');
    expect(conn.calls).not.toContain('COMMIT');
  });

  test('[negative] not enough points throws INSUFFICIENT_POINTS and rolls back', async () => {
    const conn = redeemConn([
      [[{ id: 6, points: 5 }], []],
      [[{ id: 1, title: 'Coffee Voucher', pointsCost: 30, stock: 10, shopId: 1 }], []]
    ]);

    await expect(rewardModel.redeem({ userId: 6, rewardId: 1 })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INSUFFICIENT_POINTS'
    });
    expect(conn.calls).toContain('ROLLBACK');
    expect(conn.calls).not.toContain('COMMIT');
    const lockQueries = conn.calls.filter((sql) => sql.includes('FOR UPDATE'));
    expect(lockQueries).toHaveLength(2);
  });
});
