'use strict';

const bcrypt = require('bcrypt');
const config = require('../configs/env');
const { pool, withTransaction, ping, closePool } = require('../configs/db');

const SHOP_DATA = [
  { key: 'ladkrabang', name: 'KMITL Library Corner', location: 'Ladkrabang, Bangkok' },
  { key: 'siam', name: 'Siam Book Hub', location: 'Siam Square, Bangkok' },
  { key: 'nimman', name: 'Nimman Reads', location: 'Chiang Mai' }
];

const USER_DATA = [
  { key: 'admin', username: 'admin', phone: '0800000001', role: 'Admin', shop: null, points: 0 },
  { key: 'owner1', username: 'owner_ladkrabang', phone: '0800000002', role: 'OwnerShop', shop: 'ladkrabang', points: 0 },
  { key: 'owner2', username: 'owner_siam', phone: '0800000003', role: 'OwnerShop', shop: 'siam', points: 0 },
  { key: 'alice', username: 'alice', phone: '0811111111', role: 'Customer', shop: null, points: 120 },
  { key: 'bob', username: 'bob', phone: '0822222222', role: 'Customer', shop: null, points: 5 }
];

const BOOK_DATA = [
  { key: 'clean', isbn: '9780132350884', title: 'Clean Code', author: 'Robert C. Martin', category: 'Software Engineering' },
  { key: 'design', isbn: '9780201633610', title: 'Design Patterns', author: 'Gamma, Helm, Johnson, Vlissides', category: 'Software Engineering' },
  { key: 'goodparts', isbn: '9780596517748', title: 'JavaScript: The Good Parts', author: 'Douglas Crockford', category: 'Programming' },
  { key: 'effective', isbn: '9780134685991', title: 'Effective Java', author: 'Joshua Bloch', category: 'Programming' },
  { key: 'algorithms', isbn: '9780262033848', title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest, Stein', category: 'Computer Science' },
  { key: 'pragmatic', isbn: '9780135957059', title: 'The Pragmatic Programmer', author: 'David Thomas, Andrew Hunt', category: 'Software Engineering' }
];

async function waitForDb(tries = 30) {
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const up = await ping();
    if (up) return true;
    console.log('Waiting for database... (%d/%d)', attempt, tries);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Database did not become reachable in time');
}

async function seed() {
  await waitForDb();

  const [existing] = await pool.execute('SELECT COUNT(*) AS total FROM users');
  if (Number(existing[0].total) > 0) {
    console.log('Seed skipped: users table already has data');
    return { skipped: true };
  }

  const passwordHash = await bcrypt.hash(config.seedDefaultPassword, config.bcryptRounds);

  const summary = await withTransaction(async (conn) => {
    const shopIds = {};
    for (const shop of SHOP_DATA) {
      const [result] = await conn.execute('INSERT INTO shops (name, location) VALUES (?, ?)', [
        shop.name,
        shop.location
      ]);
      shopIds[shop.key] = result.insertId;
    }

    const userIds = {};
    for (const user of USER_DATA) {
      const [result] = await conn.execute(
        `INSERT INTO users (username, phone, points, role, password_hash, shop_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user.username,
          user.phone,
          user.points,
          user.role,
          passwordHash,
          user.shop ? shopIds[user.shop] : null
        ]
      );
      userIds[user.key] = result.insertId;
    }

    const bookIds = {};
    for (const book of BOOK_DATA) {
      const [result] = await conn.execute(
        'INSERT INTO book_collections (isbn, title, author, category) VALUES (?, ?, ?, ?)',
        [book.isbn, book.title, book.author, book.category]
      );
      bookIds[book.key] = result.insertId;
    }

    const [activeCampaign] = await conn.execute(
      `INSERT INTO campaigns (title, bonus_points, shop_id, start_at, end_at)
       VALUES (?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))`,
      ['Back to School Bonus', 20, shopIds.ladkrabang]
    );

    await conn.execute(
      `INSERT INTO campaigns (title, bonus_points, shop_id, start_at, end_at)
       VALUES (?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 DAY), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY))`,
      ['Songkran Drive', 15, shopIds.siam]
    );

    await conn.execute(
      'INSERT INTO rewards (title, points_cost, stock, shop_id) VALUES (?, ?, ?, ?)',
      ['Coffee Voucher', 30, 10, shopIds.ladkrabang]
    );
    await conn.execute(
      'INSERT INTO rewards (title, points_cost, stock, shop_id) VALUES (?, ?, ?, ?)',
      ['Canvas Tote Bag', 100, 2, shopIds.ladkrabang]
    );
    await conn.execute(
      'INSERT INTO rewards (title, points_cost, stock, shop_id) VALUES (?, ?, ?, ?)',
      ['Bookmark Set', 10, 0, shopIds.siam]
    );

    const items = [
      { barcode: 'BK-0001', book: 'clean', shop: 'ladkrabang', donor: 'alice', campaign: activeCampaign.insertId, status: 'AVAILABLE' },
      { barcode: 'BK-0002', book: 'design', shop: 'ladkrabang', donor: 'bob', campaign: activeCampaign.insertId, status: 'AVAILABLE' },
      { barcode: 'BK-0003', book: 'goodparts', shop: 'ladkrabang', donor: 'alice', campaign: activeCampaign.insertId, status: 'BORROWED', borrower: 'alice', borrowedDaysAgo: 20, dueInDays: -6 },
      { barcode: 'BK-0004', book: 'effective', shop: 'siam', donor: 'bob', campaign: null, status: 'BORROWED', borrower: 'bob', borrowedDaysAgo: 2, dueInDays: 12 },
      { barcode: 'BK-0005', book: 'algorithms', shop: 'ladkrabang', donor: 'alice', campaign: activeCampaign.insertId, status: 'AVAILABLE' },
      { barcode: 'BK-0006', book: 'pragmatic', shop: 'siam', donor: 'bob', campaign: null, status: 'AVAILABLE' },
      { barcode: 'BK-0007', book: 'clean', shop: 'siam', donor: 'alice', campaign: null, status: 'DAMAGED' },
      { barcode: 'BK-0008', book: 'design', shop: 'ladkrabang', donor: 'bob', campaign: activeCampaign.insertId, status: 'AVAILABLE' },
      { barcode: 'BK-0009', book: 'goodparts', shop: 'siam', donor: 'alice', campaign: null, status: 'LOST' },
      { barcode: 'BK-0010', book: 'effective', shop: 'ladkrabang', donor: 'bob', campaign: activeCampaign.insertId, status: 'AVAILABLE' }
    ];

    for (const item of items) {
      const borrowed = item.status === 'BORROWED';
      await conn.execute(
        `INSERT INTO book_items
           (book_collection_id, barcode, status, shop_id, donor_user_id, campaign_id,
            borrower_user_id, borrowed_at, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookIds[item.book],
          item.barcode,
          item.status,
          shopIds[item.shop],
          userIds[item.donor],
          item.campaign,
          borrowed ? userIds[item.borrower] : null,
          borrowed ? new Date(Date.now() - item.borrowedDaysAgo * 86400000) : null,
          borrowed ? new Date(Date.now() + item.dueInDays * 86400000) : null
        ]
      );
    }

    return { shopIds, userIds, bookIds };
  });

  console.log('Seed complete.');
  console.log('Shops: %d, Users: %d, Book collections: %d, Book items: 10',
    Object.keys(summary.shopIds).length,
    Object.keys(summary.userIds).length,
    Object.keys(summary.bookIds).length);
  console.log('Accounts (password comes from SEED_DEFAULT_PASSWORD):');
  console.table(USER_DATA.map((user) => ({ username: user.username, role: user.role })));

  return { skipped: false };
}

async function main() {
  try {
    await seed();
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    try {
      await closePool();
    } catch (_) {
      /* ignore */
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { seed };
