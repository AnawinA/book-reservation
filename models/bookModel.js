'use strict';

const { pool } = require('../configs/db');

const COLLECTION_COLUMNS = 'bc.id, bc.isbn, bc.title, bc.author, bc.category';

async function search({ q, category, page = 1, limit = 20 } = {}) {
  const where = ['bc.deleted_at IS NULL'];
  const params = [];

  if (q) {
    where.push('(bc.title LIKE CONCAT(\'%\', ?, \'%\') OR bc.author LIKE CONCAT(\'%\', ?, \'%\') OR bc.isbn LIKE CONCAT(\'%\', ?, \'%\'))');
    params.push(q, q, q);
  }
  if (category) {
    where.push('bc.category = ?');
    params.push(category);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM book_collections bc ${whereSql}`,
    params
  );
  const total = Number(countRows[0].total);

  const safeLimit = Number.parseInt(limit, 10);
  const safeOffset = (Number.parseInt(page, 10) - 1) * safeLimit;

  const [rows] = await pool.query(
    `SELECT ${COLLECTION_COLUMNS},
            COUNT(bi.id) AS totalCopies,
            COALESCE(SUM(bi.status = 'AVAILABLE'), 0) AS availableCopies
       FROM book_collections bc
       LEFT JOIN book_items bi ON bi.book_collection_id = bc.id AND bi.deleted_at IS NULL
      ${whereSql}
      GROUP BY bc.id, bc.isbn, bc.title, bc.author, bc.category
      ORDER BY bc.title ASC
      LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );

  const items = rows.map((row) => ({
    ...row,
    totalCopies: Number(row.totalCopies),
    availableCopies: Number(row.availableCopies)
  }));

  return { items, total };
}

async function findByIsbn(isbn) {
  const [rows] = await pool.execute(
    `SELECT ${COLLECTION_COLUMNS}
       FROM book_collections bc
      WHERE bc.isbn = ? AND bc.deleted_at IS NULL
      LIMIT 1`,
    [isbn]
  );
  const collection = rows[0];
  if (!collection) return null;

  const [availability] = await pool.execute(
    `SELECT s.id AS shopId,
            s.name AS shopName,
            COUNT(bi.id) AS total,
            COALESCE(SUM(bi.status = 'AVAILABLE'), 0) AS available
       FROM book_items bi
       JOIN shops s ON s.id = bi.shop_id AND s.deleted_at IS NULL
      WHERE bi.book_collection_id = ? AND bi.deleted_at IS NULL
      GROUP BY s.id, s.name
      ORDER BY s.name ASC`,
    [collection.id]
  );

  return {
    ...collection,
    availabilityByShop: availability.map((row) => ({
      ...row,
      shopId: Number(row.shopId),
      total: Number(row.total),
      available: Number(row.available)
    }))
  };
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${COLLECTION_COLUMNS} FROM book_collections bc WHERE bc.id = ? AND bc.deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findCategories() {
  const [rows] = await pool.execute(
    `SELECT DISTINCT bc.category
       FROM book_collections bc
      WHERE bc.deleted_at IS NULL
      ORDER BY bc.category ASC`
  );
  return rows.map((row) => row.category);
}

async function create({ isbn, title, author, category }) {
  const [result] = await pool.execute(
    'INSERT INTO book_collections (isbn, title, author, category) VALUES (?, ?, ?, ?)',
    [isbn, title, author, category]
  );
  return findById(result.insertId);
}

async function update(id, { isbn, title, author, category }) {
  const [result] = await pool.execute(
    `UPDATE book_collections
        SET isbn = ?, title = ?, author = ?, category = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [isbn, title, author, category, id]
  );
  if (result.affectedRows === 0) return null;
  return findById(id);
}

module.exports = { search, findByIsbn, findById, findCategories, create, update };
