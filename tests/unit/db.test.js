'use strict';

jest.mock('mysql2/promise', () => ({ createPool: jest.fn() }));

const mysql = require('mysql2/promise');

const fakeConn = {
  query: jest.fn(),
  release: jest.fn()
};
const fakePool = {
  getConnection: jest.fn(),
  query: jest.fn(),
  end: jest.fn()
};

mysql.createPool.mockReturnValue(fakePool);

const db = require('../../configs/db');

describe('configs/db withTransaction', () => {
  beforeEach(() => {
    fakeConn.query.mockReset();
    fakeConn.release.mockReset();
    fakePool.getConnection.mockReset();
    fakePool.getConnection.mockResolvedValue(fakeConn);
    fakeConn.query.mockResolvedValue([[], []]);
  });

  test('[positive] START TRANSACTION -> work -> COMMIT in order', async () => {
    const work = jest.fn().mockResolvedValue('result');

    await expect(db.withTransaction(work)).resolves.toBe('result');

    const statements = fakeConn.query.mock.calls.map((call) => call[0]);
    expect(statements).toEqual(['START TRANSACTION', 'COMMIT']);
    expect(work).toHaveBeenCalledWith(fakeConn);
    expect(work.mock.invocationCallOrder[0]).toBeGreaterThan(
      fakeConn.query.mock.invocationCallOrder[0]
    );
    expect(work.mock.invocationCallOrder[0]).toBeLessThan(
      fakeConn.query.mock.invocationCallOrder[1]
    );
  });

  test('[negative] a thrown error triggers ROLLBACK and skips COMMIT', async () => {
    const failure = new Error('boom');
    const work = jest.fn().mockRejectedValue(failure);

    await expect(db.withTransaction(work)).rejects.toThrow('boom');

    const statements = fakeConn.query.mock.calls.map((call) => call[0]);
    expect(statements).toEqual(['START TRANSACTION', 'ROLLBACK']);
    expect(statements).not.toContain('COMMIT');
  });

  test('[boundary] the connection is always released', async () => {
    await db.withTransaction(jest.fn().mockResolvedValue(undefined));
    expect(fakeConn.release).toHaveBeenCalledTimes(1);

    await expect(db.withTransaction(jest.fn().mockRejectedValue(new Error('x')))).rejects.toThrow();
    expect(fakeConn.release).toHaveBeenCalledTimes(2);
  });
});
