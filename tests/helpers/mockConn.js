'use strict';

const TCL = new Set(['START TRANSACTION', 'COMMIT', 'ROLLBACK']);

/**
 * Queued fake mysql2 connection. Transaction-control statements resolve without
 * consuming the queue so tests only list real query responses.
 */
function createMockConn(responses = []) {
  const queue = responses.slice();
  const calls = [];

  function run(sql) {
    const text = String(sql).trim();
    calls.push(text);
    if (TCL.has(text.toUpperCase())) return Promise.resolve([[], []]);
    if (queue.length === 0) {
      return Promise.reject(new Error(`Unexpected query (queue empty): ${text}`));
    }
    const next = queue.shift();
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  }

  const conn = {
    calls,
    execute: jest.fn((sql) => run(sql)),
    query: jest.fn((sql) => run(sql)),
    release: jest.fn()
  };

  return conn;
}

/**
 * Makes the mocked configs/db.withTransaction behave exactly like the real one
 * (literal START TRANSACTION / COMMIT / ROLLBACK around the work callback).
 */
function mockWithTransaction(db, conn) {
  db.withTransaction.mockImplementation(async (work) => {
    await conn.query('START TRANSACTION');
    try {
      const result = await work(conn);
      await conn.query('COMMIT');
      return result;
    } catch (err) {
      await conn.query('ROLLBACK');
      throw err;
    } finally {
      conn.release();
    }
  });
}

module.exports = { createMockConn, mockWithTransaction };
