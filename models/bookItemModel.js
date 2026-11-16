'use strict';

const crypto = require('crypto');
const config = require('../configs/env');
const { pool, withTransaction } = require('../configs/db');
const AppError = require('../utils/AppError');
const userModel = require('./userModel');
const campaignModel = require('./campaignModel');

const STATUS_TRANSITIONS = {
  AVAILABLE: ['DAMAGED', 'LOST'],
  DAMAGED: ['AVAILABLE', 'LOST'],
  LOST: ['AVAILABLE'],
  BORROWED: ['LOST']
};

const ITEM_SELECT = `SELECT bi.id,
                            bi.barcode,
                            bi.status,
                            bi.shop_id AS shopId,
                            bi.book_collection_id AS bookCollectionId,
                            bi.donor_user_id AS donorUserId,
                            bi.campaign_id AS campaignId,
                            bi.borrower_user_id AS borrowerUserId,
                            bi.borrowed_at AS borrowedAt,
                            bi.due_date AS dueDate,
                            bc.isbn AS isbn,
                            bc.title AS title,
                            bc.author AS author,
                            bc.category AS category,
                            s.name AS shopName,
                            bu.username AS borrowerUsername
                       FROM book_items bi
                       JOIN book_collections bc ON bc.id = bi.book_collection_id AND bc.deleted_at IS NULL
                       JOIN shops s ON s.id = bi.shop_id AND s.deleted_at IS NULL
                       LEFT JOIN users bu ON bu.id = bi.borrower_user_id AND bu.deleted_at IS NULL`;

function normalize(row) {
  if (!row) return null;
  const result = { ...row };
  ['id', 'shopId', 'bookCollectionId', 'donorUserId', 'campaignId', 'borrowerUserId'].forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(row, key)) return;
    result[key] = row[key] === null ? null : Number(row[key]);
  });
  return result;
}

async function findById(id, conn = pool) {
  const [rows] = await conn.execute(
    `${ITEM_SELECT} WHERE bi.id = ? AND bi.deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return normalize(rows[0]);
}

async function findByBarcode(barcode, conn = pool) {
  const [rows] = await conn.execute(
    `${ITEM_SELECT} WHERE bi.barcode = ? AND bi.deleted_at IS NULL LIMIT 1`,
    [barcode]
  );
  return normalize(rows[0]);
}

async function findInventoryByShop(shopId, { status = null, page = 1, limit = 20 } = {}) {
  const where = ['bi.shop_id = ?', 'bi.deleted_at IS NULL'];
  const params = [shopId];
  if (status) {
    where.push('bi.status = ?');
    params.push(status);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM book_items bi ${whereSql}`,
    params
  );

  const safeLimit = Number.parseInt(limit, 10);
  const safeOffset = (Number.parseInt(page, 10) - 1) * safeLimit;

  const [rows] = await pool.query(
    `${ITEM_SELECT} ${whereSql} ORDER BY bi.barcode ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );

  return { items: rows.map(normalize), total: Number(countRows[0].total) };
}

async function findDonationsByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT bi.id,
            bi.barcode,
            bc.title AS title,
            bc.isbn AS isbn,
            bi.status,
            s.name AS shopName,
            c.title AS campaignTitle
       FROM book_items bi
       JOIN book_collections bc ON bc.id = bi.book_collection_id AND bc.deleted_at IS NULL
       JOIN shops s ON s.id = bi.shop_id AND s.deleted_at IS NULL
       LEFT JOIN campaigns c ON c.id = bi.campaign_id AND c.deleted_at IS NULL
      WHERE bi.donor_user_id = ? AND bi.deleted_at IS NULL
      ORDER BY bi.id DESC`,
    [userId]
  );
  return rows.map(normalize);
}

async function findBorrowsByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT bi.id,
            bi.barcode,
            bc.title AS title,
            bc.isbn AS isbn,
            bi.borrowed_at AS borrowedAt,
            bi.due_date AS dueDate,
            s.name AS shopName,
            (bi.due_date < UTC_TIMESTAMP()) AS isOverdue,
            DATEDIFF(bi.due_date, UTC_TIMESTAMP()) AS daysRemaining
       FROM book_items bi
       JOIN book_collections bc ON bc.id = bi.book_collection_id AND bc.deleted_at IS NULL
       JOIN shops s ON s.id = bi.shop_id AND s.deleted_at IS NULL
      WHERE bi.borrower_user_id = ? AND bi.status = 'BORROWED' AND bi.deleted_at IS NULL
      ORDER BY bi.due_date ASC`,
    [userId]
  );
  return rows.map((row) => ({
    ...normalize(row),
    isOverdue: Boolean(Number(row.isOverdue)),
    daysRemaining: Number(row.daysRemaining)
  }));
}

function generateBarcode() {
  return `BK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function donate({ shopId, donorPhone, isbn, barcode = null }) {
  return withTransaction(async (conn) => {
    const [shopRows] = await conn.execute(
      'SELECT id, name FROM shops WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [shopId]
    );
    const shop = shopRows[0];
    if (!shop) throw AppError.notFound('Shop');

    const donor = await userModel.findByPhone(donorPhone, conn);
    if (!donor || donor.role !== 'Customer') throw AppError.notFound('Donor');

    const [collectionRows] = await conn.execute(
      'SELECT id, isbn, title FROM book_collections WHERE isbn = ? AND deleted_at IS NULL LIMIT 1',
      [isbn]
    );
    const collection = collectionRows[0];
    if (!collection) throw AppError.notFound('Book collection');

    const finalBarcode = barcode || generateBarcode();
    const campaign = await campaignModel.findBestActiveForShop(shopId, conn);
    const bonusPoints = campaign ? Number(campaign.bonusPoints) : 0;

    const [insert] = await conn.execute(
      `INSERT INTO book_items (book_collection_id, barcode, status, shop_id, donor_user_id, campaign_id)
       VALUES (?, ?, 'AVAILABLE', ?, ?, ?)`,
      [collection.id, finalBarcode, shopId, donor.id, campaign ? campaign.id : null]
    );

    const pointsAwarded = config.donationBasePoints + bonusPoints;
    await userModel.addPoints(donor.id, pointsAwarded, conn);

    const item = await findById(insert.insertId, conn);
    const donorAfter = await userModel.findById(donor.id, conn);

    return {
      item,
      pointsAwarded,
      basePoints: config.donationBasePoints,
      bonusPoints,
      campaign: campaign ? { id: campaign.id, title: campaign.title, bonusPoints } : null,
      donor: donorAfter
    };
  });
}

async function borrow({ shopId, barcode, borrowerPhone, durationDays = config.defaultBorrowDays }) {
  return withTransaction(async (conn) => {
    const [itemRows] = await conn.execute(
      `SELECT id, barcode, status, shop_id AS shopId
         FROM book_items
        WHERE barcode = ? AND deleted_at IS NULL
        FOR UPDATE`,
      [barcode]
    );
    const locked = itemRows[0];
    if (!locked) throw AppError.notFound('Book item');
    if (Number(locked.shopId) !== Number(shopId)) {
      throw AppError.forbidden('Item is not located at this shop');
    }
    if (locked.status !== 'AVAILABLE') {
      throw new AppError(409, 'ITEM_NOT_AVAILABLE', 'Item is not available for borrowing');
    }

    const borrower = await userModel.findByPhone(borrowerPhone, conn);
    if (!borrower || borrower.role !== 'Customer') throw AppError.notFound('Borrower');

    const [countRows] = await conn.execute(
      `SELECT COUNT(*) AS activeBorrows
         FROM book_items
        WHERE borrower_user_id = ? AND status = 'BORROWED' AND deleted_at IS NULL`,
      [borrower.id]
    );
    if (Number(countRows[0].activeBorrows) >= config.maxActiveBorrows) {
      throw new AppError(409, 'BORROW_LIMIT_REACHED', 'Borrower has reached the active borrow limit');
    }

    await conn.execute(
      `UPDATE book_items
          SET status = 'BORROWED',
              borrower_user_id = ?,
              borrowed_at = UTC_TIMESTAMP(),
              due_date = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY)
        WHERE id = ? AND status = 'AVAILABLE' AND deleted_at IS NULL`,
      [borrower.id, durationDays, locked.id]
    );

    const item = await findById(locked.id, conn);
    return {
      item,
      borrower: { id: borrower.id, username: borrower.username, phone: borrower.phone },
      durationDays
    };
  });
}

async function returnItem({ shopId, barcode }) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT id, status, shop_id AS shopId, due_date AS dueDate,
              (due_date IS NOT NULL AND due_date < UTC_TIMESTAMP()) AS wasOverdue
         FROM book_items
        WHERE barcode = ? AND deleted_at IS NULL
        FOR UPDATE`,
      [barcode]
    );
    const locked = rows[0];
    if (!locked) throw AppError.notFound('Book item');
    if (locked.status !== 'BORROWED') {
      throw new AppError(409, 'ITEM_NOT_AVAILABLE', 'Item is not currently borrowed');
    }

    const previousShopId = Number(locked.shopId);
    const wasOverdue = Boolean(Number(locked.wasOverdue));

    await conn.execute(
      `UPDATE book_items
          SET status = 'AVAILABLE',
              borrower_user_id = NULL,
              borrowed_at = NULL,
              due_date = NULL,
              shop_id = ?
        WHERE id = ? AND deleted_at IS NULL`,
      [shopId, locked.id]
    );

    const item = await findById(locked.id, conn);
    return { item, wasOverdue, previousShopId };
  });
}

async function updateStatus({ barcode, status, actorShopId }) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT id, status, shop_id AS shopId
         FROM book_items
        WHERE barcode = ? AND deleted_at IS NULL
        FOR UPDATE`,
      [barcode]
    );
    const locked = rows[0];
    if (!locked) throw AppError.notFound('Book item');
    if (Number(locked.shopId) !== Number(actorShopId)) {
      throw AppError.forbidden('Item belongs to another shop');
    }

    const allowed = STATUS_TRANSITIONS[locked.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot change status from ${locked.status} to ${status}`
      );
    }

    await conn.execute(
      `UPDATE book_items
          SET status = ?,
              borrower_user_id = CASE WHEN ? = 'AVAILABLE' THEN NULL ELSE borrower_user_id END,
              borrowed_at = CASE WHEN ? = 'AVAILABLE' THEN NULL ELSE borrowed_at END,
              due_date = CASE WHEN ? = 'AVAILABLE' THEN NULL ELSE due_date END
        WHERE id = ? AND deleted_at IS NULL`,
      [status, status, status, status, locked.id]
    );

    return findById(locked.id, conn);
  });
}

async function findOverdue() {
  const [rows] = await pool.execute(
    `SELECT bi.id,
            bi.barcode,
            bi.due_date AS dueDate,
            DATEDIFF(UTC_TIMESTAMP(), bi.due_date) AS daysOverdue,
            u.id AS userId,
            u.username,
            u.phone,
            bc.title AS title,
            bc.isbn AS isbn,
            s.id AS shopId,
            s.name AS shopName
       FROM book_items bi
       JOIN users u ON u.id = bi.borrower_user_id AND u.deleted_at IS NULL
       JOIN book_collections bc ON bc.id = bi.book_collection_id AND bc.deleted_at IS NULL
       JOIN shops s ON s.id = bi.shop_id AND s.deleted_at IS NULL
      WHERE bi.status = 'BORROWED'
        AND bi.due_date < UTC_TIMESTAMP()
        AND bi.deleted_at IS NULL
      ORDER BY bi.due_date ASC`
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    userId: Number(row.userId),
    shopId: Number(row.shopId),
    daysOverdue: Number(row.daysOverdue)
  }));
}

module.exports = {
  STATUS_TRANSITIONS,
  ITEM_SELECT,
  findById,
  findByBarcode,
  findInventoryByShop,
  findDonationsByUser,
  findBorrowsByUser,
  donate,
  borrow,
  returnItem,
  updateStatus,
  findOverdue
};
