'use strict';

const { pool, withTransaction } = require('../configs/db');
const AppError = require('../utils/AppError');

const REWARD_COLUMNS = 'r.id, r.title, r.points_cost AS pointsCost, r.stock, r.shop_id AS shopId';

function normalize(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    pointsCost: Number(row.pointsCost),
    stock: Number(row.stock),
    shopId: Number(row.shopId)
  };
}

async function findAll({ shopId = null } = {}) {
  const where = ['r.deleted_at IS NULL'];
  const params = [];
  if (shopId) {
    where.push('r.shop_id = ?');
    params.push(shopId);
  }

  const [rows] = await pool.execute(
    `SELECT ${REWARD_COLUMNS}, s.name AS shopName
       FROM rewards r
       JOIN shops s ON s.id = r.shop_id AND s.deleted_at IS NULL
      WHERE ${where.join(' AND ')}
      ORDER BY r.points_cost ASC, r.id ASC`,
    params
  );
  return rows.map(normalize);
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${REWARD_COLUMNS} FROM rewards r WHERE r.id = ? AND r.deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return normalize(rows[0]);
}

async function create({ title, pointsCost, stock, shopId }) {
  const [result] = await pool.execute(
    'INSERT INTO rewards (title, points_cost, stock, shop_id) VALUES (?, ?, ?, ?)',
    [title, pointsCost, stock, shopId]
  );
  return findById(result.insertId);
}

async function update(id, { title, pointsCost, stock, shopId }) {
  const [result] = await pool.execute(
    `UPDATE rewards
        SET title = ?, points_cost = ?, stock = ?, shop_id = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [title, pointsCost, stock, shopId, id]
  );
  if (result.affectedRows === 0) return null;
  return findById(id);
}

/**
 * ADR-3: lock the user and the reward, then deduct points and stock in one
 * transaction. Any failure rolls everything back.
 */
async function redeem({ userId, rewardId }) {
  return withTransaction(async (conn) => {
    const [userRows] = await conn.execute(
      'SELECT id, points FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
      [userId]
    );
    const user = userRows[0];
    if (!user) throw AppError.notFound('User');

    const [rewardRows] = await conn.execute(
      `SELECT id, title, points_cost AS pointsCost, stock, shop_id AS shopId
         FROM rewards
        WHERE id = ? AND deleted_at IS NULL
        FOR UPDATE`,
      [rewardId]
    );
    const reward = rewardRows[0];
    if (!reward) throw AppError.notFound('Reward');

    const pointsCost = Number(reward.pointsCost);
    const stock = Number(reward.stock);
    const points = Number(user.points);

    if (stock < 1) throw AppError.outOfStock();
    if (points < pointsCost) throw AppError.insufficientPoints();

    const [pointsResult] = await conn.execute(
      'UPDATE users SET points = points - ? WHERE id = ? AND points >= ?',
      [pointsCost, userId, pointsCost]
    );
    if (pointsResult.affectedRows !== 1) throw AppError.insufficientPoints();

    const [stockResult] = await conn.execute(
      'UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0',
      [rewardId]
    );
    if (stockResult.affectedRows !== 1) throw AppError.outOfStock();

    return {
      reward: {
        id: Number(reward.id),
        title: reward.title,
        pointsCost,
        shopId: Number(reward.shopId)
      },
      remainingPoints: points - pointsCost,
      remainingStock: stock - 1
    };
  });
}

module.exports = { findAll, findById, create, update, redeem };
