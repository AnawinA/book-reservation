'use strict';

jest.mock('../../configs/db', () => ({
  pool: { execute: jest.fn(), query: jest.fn() },
  withTransaction: jest.fn()
}));

const db = require('../../configs/db');
const userModel = require('../../models/userModel');

describe('models/userModel', () => {
  test('[positive] findConflicts flags a taken username and phone across all rows', async () => {
    db.pool.execute.mockResolvedValueOnce([
      [{ username: 'alice', phone: '0811111111' }],
      []
    ]);

    await expect(userModel.findConflicts('alice', '0899999999')).resolves.toEqual({
      username: true,
      phone: false
    });
    expect(db.pool.execute.mock.calls[0][1]).toEqual(['alice', '0899999999']);
  });

  test('[positive] create inserts the hashed password and returns the insert id', async () => {
    db.pool.execute.mockResolvedValueOnce([{ insertId: 42 }, []]);

    const id = await userModel.create({
      username: 'carol',
      phone: '0833333333',
      passwordHash: 'hashed',
      role: 'Customer',
      shopId: null
    });

    expect(id).toBe(42);
    expect(db.pool.execute.mock.calls[0][1]).toEqual([
      'carol',
      '0833333333',
      'hashed',
      'Customer',
      null
    ]);
  });

  test('[negative] addPoints throws 404 when no row is updated', async () => {
    db.pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    await expect(userModel.addPoints(99, 10)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    });
    expect(db.pool.execute.mock.calls[0][0]).toContain('deleted_at IS NULL');
  });

  test('[negative] public selections never expose the password hash', async () => {
    expect(userModel.PUBLIC_COLUMNS).not.toContain('password_hash');

    db.pool.execute.mockResolvedValueOnce([[{ id: 5, username: 'alice' }], []]);
    await userModel.findById(5);
    expect(db.pool.execute.mock.calls[0][0]).not.toContain('password_hash');
    expect(db.pool.execute.mock.calls[0][1]).toEqual([5]);
  });
});
