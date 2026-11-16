'use strict';

const { pool } = require('../configs/db');
const AppError = require('../utils/AppError');

const PUBLIC_COLUMNS = 'u.id, u.username, u.phone, u.points, u.role, u.shop_id AS shopId';

async function findById(id, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findByUsernameWithHash(username) {
  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_COLUMNS}, u.password_hash AS passwordHash
       FROM users u
      WHERE u.username = ? AND u.deleted_at IS NULL
      LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function findByPhone(phone, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.phone = ? AND u.deleted_at IS NULL LIMIT 1`,
    [phone]
  );
  return rows[0] || null;
}

/**
 * The UNIQUE indexes also cover soft-deleted rows, so conflicts are checked
 * across every row on purpose.
 */
async function findConflicts(username, phone) {
  const [rows] = await pool.execute(
    'SELECT username, phone FROM users WHERE username = ? OR phone = ?',
    [username, phone]
  );
  return {
    username: rows.some((row) => row.username === username),
    phone: rows.some((row) => row.phone === phone)
  };
}

async function create(
  { username, phone, passwordHash, role = 'Customer', shopId = null },
  conn = pool
) {
  const [result] = await conn.execute(
    'INSERT INTO users (username, phone, password_hash, role, shop_id) VALUES (?, ?, ?, ?, ?)',
    [username, phone, passwordHash, role, shopId]
  );
  return result.insertId;
}

async function addPoints(userId, delta, conn = pool) {
  const [result] = await conn.execute(
    'UPDATE users SET points = points + ? WHERE id = ? AND deleted_at IS NULL',
    [delta, userId]
  );
  if (result.affectedRows === 0) throw AppError.notFound('User');
  return true;
}

async function softDelete(id) {
  const [result] = await pool.execute(
    'UPDATE users SET deleted_at = UTC_TIMESTAMP() WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  PUBLIC_COLUMNS,
  findById,
  findByUsernameWithHash,
  findByPhone,
  findConflicts,
  create,
  addPoints,
  softDelete
};
