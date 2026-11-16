'use strict';

const mysql = require('mysql2/promise');
const config = require('./env');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  timezone: 'Z',
  decimalNumbers: true,
  charset: 'utf8mb4',
  enableKeepAlive: true
});

/**
 * ADR-3: every multi-table business operation runs through this helper.
 * Transaction control statements are sent literally so mysql2 does not
 * wrap them in PREPARE/EXECUTE.
 */
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.query('START TRANSACTION');
    const result = await work(conn);
    await conn.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await conn.query('ROLLBACK');
    } catch (_) {
      /* the rollback failure must never hide the original error */
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function ping() {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return Boolean(rows && rows.length);
  } catch (_) {
    return false;
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, withTransaction, ping, closePool };
