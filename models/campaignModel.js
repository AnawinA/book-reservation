'use strict';

const { pool } = require('../configs/db');

const CAMPAIGN_COLUMNS = `c.id, c.title, c.bonus_points AS bonusPoints, c.shop_id AS shopId,
                          c.start_at AS startAt, c.end_at AS endAt`;

function normalize(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    bonusPoints: Number(row.bonusPoints),
    shopId: Number(row.shopId),
    isActive: row.isActive === undefined ? undefined : Boolean(Number(row.isActive))
  };
}

async function findAll({ activeOnly = false, shopId = null } = {}) {
  const where = ['c.deleted_at IS NULL'];
  const params = [];

  if (activeOnly) {
    where.push('c.start_at <= UTC_TIMESTAMP() AND c.end_at > UTC_TIMESTAMP()');
  }
  if (shopId) {
    where.push('c.shop_id = ?');
    params.push(shopId);
  }

  const [rows] = await pool.execute(
    `SELECT ${CAMPAIGN_COLUMNS},
            s.name AS shopName,
            (c.start_at <= UTC_TIMESTAMP() AND c.end_at > UTC_TIMESTAMP()) AS isActive
       FROM campaigns c
       JOIN shops s ON s.id = c.shop_id AND s.deleted_at IS NULL
      WHERE ${where.join(' AND ')}
      ORDER BY c.start_at DESC, c.id DESC`,
    params
  );
  return rows.map(normalize);
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${CAMPAIGN_COLUMNS},
            (c.start_at <= UTC_TIMESTAMP() AND c.end_at > UTC_TIMESTAMP()) AS isActive
       FROM campaigns c
      WHERE c.id = ? AND c.deleted_at IS NULL
      LIMIT 1`,
    [id]
  );
  return normalize(rows[0]);
}

async function findBestActiveForShop(shopId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT ${CAMPAIGN_COLUMNS}
       FROM campaigns c
      WHERE c.shop_id = ?
        AND c.deleted_at IS NULL
        AND c.start_at <= UTC_TIMESTAMP()
        AND c.end_at > UTC_TIMESTAMP()
      ORDER BY c.bonus_points DESC, c.id ASC
      LIMIT 1`,
    [shopId]
  );
  return normalize(rows[0]);
}

async function create({ title, bonusPoints, shopId, startAt, endAt }) {
  const [result] = await pool.execute(
    `INSERT INTO campaigns (title, bonus_points, shop_id, start_at, end_at)
     VALUES (?, ?, ?, ?, ?)`,
    [title, bonusPoints, shopId, new Date(startAt), new Date(endAt)]
  );
  return findById(result.insertId);
}

async function update(id, { title, bonusPoints, shopId, startAt, endAt }) {
  const [result] = await pool.execute(
    `UPDATE campaigns
        SET title = ?, bonus_points = ?, shop_id = ?, start_at = ?, end_at = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [title, bonusPoints, shopId, new Date(startAt), new Date(endAt), id]
  );
  if (result.affectedRows === 0) return null;
  return findById(id);
}

module.exports = { findAll, findById, findBestActiveForShop, create, update };
