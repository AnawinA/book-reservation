'use strict';

const { pool } = require('../configs/db');

async function findAll() {
  const [rows] = await pool.execute(
    `SELECT s.id,
            s.name,
            s.location,
            COUNT(bi.id) AS totalItems,
            COALESCE(SUM(bi.status = 'AVAILABLE'), 0) AS availableItems,
            COALESCE(SUM(bi.status = 'BORROWED'), 0) AS borrowedItems
       FROM shops s
       LEFT JOIN book_items bi ON bi.shop_id = s.id AND bi.deleted_at IS NULL
      WHERE s.deleted_at IS NULL
      GROUP BY s.id, s.name, s.location
      ORDER BY s.name ASC`
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    totalItems: Number(row.totalItems),
    availableItems: Number(row.availableItems),
    borrowedItems: Number(row.borrowedItems)
  }));
}

async function findById(id) {
  const [rows] = await pool.execute(
    'SELECT s.id, s.name, s.location FROM shops s WHERE s.id = ? AND s.deleted_at IS NULL LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function create({ name, location }) {
  const [result] = await pool.execute('INSERT INTO shops (name, location) VALUES (?, ?)', [name, location]);
  return findById(result.insertId);
}

async function update(id, { name, location }) {
  const [result] = await pool.execute(
    'UPDATE shops SET name = ?, location = ? WHERE id = ? AND deleted_at IS NULL',
    [name, location, id]
  );
  if (result.affectedRows === 0) return null;
  return findById(id);
}

async function countActiveBorrows(shopId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS activeBorrows
       FROM book_items bi
      WHERE bi.shop_id = ? AND bi.status = 'BORROWED' AND bi.deleted_at IS NULL`,
    [shopId]
  );
  return Number(rows[0].activeBorrows);
}

async function softDelete(id) {
  const [result] = await pool.execute(
    'UPDATE shops SET deleted_at = UTC_TIMESTAMP() WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { findAll, findById, create, update, countActiveBorrows, softDelete };
