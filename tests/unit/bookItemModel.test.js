'use strict';

jest.mock('../../configs/db', () => ({
  pool: { execute: jest.fn(), query: jest.fn() },
  withTransaction: jest.fn()
}));

const db = require('../../configs/db');
const bookItemModel = require('../../models/bookItemModel');
const { createMockConn, mockWithTransaction } = require('../helpers/mockConn');

const ITEM_ROW = {
  id: 5,
  barcode: 'BK-0001',
  status: 'BORROWED',
  shopId: 1,
  bookCollectionId: 1,
  donorUserId: 5,
  campaignId: 1,
  borrowerUserId: 5,
  borrowedAt: new Date(),
  dueDate: new Date(),
  isbn: '9780132350884',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  category: 'Software Engineering',
  shopName: 'KMITL Library Corner',
  borrowerUsername: 'alice'
};

function useConn(responses) {
  const conn = createMockConn(responses);
  mockWithTransaction(db, conn);
  return conn;
}

describe('models/bookItemModel donations', () => {
  test('[positive] a donation inside an active campaign awards base + bonus points', async () => {
    useConn([
      [[{ id: 1, name: 'KMITL Library Corner' }], []],
      [[{ id: 5, username: 'alice', phone: '0811111111', role: 'Customer' }], []],
      [[{ id: 1, isbn: '9780132350884', title: 'Clean Code' }], []],
      [[{ id: 1, title: 'Back to School Bonus', bonusPoints: 20, shopId: 1 }], []],
      [{ insertId: 101 }, []],
      [{ affectedRows: 1 }, []],
      [[{ ...ITEM_ROW, status: 'AVAILABLE' }], []],
      [[{ id: 5, username: 'alice', points: 150 }], []]
    ]);

    const result = await bookItemModel.donate({
      shopId: 1,
      donorPhone: '0811111111',
      isbn: '9780132350884'
    });

    expect(result.pointsAwarded).toBe(30);
    expect(result.basePoints).toBe(10);
    expect(result.bonusPoints).toBe(20);
    expect(result.campaign).toEqual({ id: 1, title: 'Back to School Bonus', bonusPoints: 20 });
    expect(result.item.barcode).toBe('BK-0001');
  });

  test('[positive] a donation without a campaign awards the base points only', async () => {
    useConn([
      [[{ id: 2, name: 'Siam Book Hub' }], []],
      [[{ id: 6, username: 'bob', phone: '0822222222', role: 'Customer' }], []],
      [[{ id: 2, isbn: '9780201633610', title: 'Design Patterns' }], []],
      [[], []],
      [{ insertId: 102 }, []],
      [{ affectedRows: 1 }, []],
      [[{ ...ITEM_ROW, id: 102, campaignId: null }], []],
      [[{ id: 6, username: 'bob', points: 15 }], []]
    ]);

    const result = await bookItemModel.donate({
      shopId: 2,
      donorPhone: '0822222222',
      isbn: '9780201633610',
      barcode: 'BK-CUSTOM'
    });

    expect(result.pointsAwarded).toBe(10);
    expect(result.bonusPoints).toBe(0);
    expect(result.campaign).toBeNull();
  });

  test('[negative] an unknown donor returns 404 and rolls back', async () => {
    const conn = useConn([
      [[{ id: 1, name: 'KMITL Library Corner' }], []],
      [[], []]
    ]);

    await expect(
      bookItemModel.donate({ shopId: 1, donorPhone: '0899999999', isbn: '9780132350884' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(conn.calls).toContain('ROLLBACK');
  });
});

describe('models/bookItemModel borrowing', () => {
  test('[positive] borrowing an available item sets the borrower and due date', async () => {
    useConn([
      [[{ id: 5, barcode: 'BK-0001', status: 'AVAILABLE', shopId: 1 }], []],
      [[{ id: 5, username: 'alice', phone: '0811111111', role: 'Customer' }], []],
      [[{ activeBorrows: 0 }], []],
      [{ affectedRows: 1 }, []],
      [[ITEM_ROW], []]
    ]);

    const result = await bookItemModel.borrow({
      shopId: 1,
      barcode: 'BK-0001',
      borrowerPhone: '0811111111',
      durationDays: 14
    });

    expect(result.item.status).toBe('BORROWED');
    expect(result.durationDays).toBe(14);
    expect(result.borrower.username).toBe('alice');
  });

  test('[negative] borrowing a non-available item returns ITEM_NOT_AVAILABLE', async () => {
    useConn([[[{ id: 5, barcode: 'BK-0005', status: 'DAMAGED', shopId: 1 }], []]]);

    await expect(
      bookItemModel.borrow({ shopId: 1, barcode: 'BK-0005', borrowerPhone: '0811111111', durationDays: 14 })
    ).rejects.toMatchObject({ statusCode: 409, code: 'ITEM_NOT_AVAILABLE' });
  });

  test('[negative] borrowing from another shop is forbidden', async () => {
    useConn([[[{ id: 5, barcode: 'BK-0006', status: 'AVAILABLE', shopId: 2 }], []]]);

    await expect(
      bookItemModel.borrow({ shopId: 1, barcode: 'BK-0006', borrowerPhone: '0811111111', durationDays: 14 })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('[negative] reaching the active borrow limit is rejected', async () => {
    useConn([
      [[{ id: 5, barcode: 'BK-0001', status: 'AVAILABLE', shopId: 1 }], []],
      [[{ id: 5, username: 'alice', phone: '0811111111', role: 'Customer' }], []],
      [[{ activeBorrows: 5 }], []]
    ]);

    await expect(
      bookItemModel.borrow({ shopId: 1, barcode: 'BK-0001', borrowerPhone: '0811111111', durationDays: 14 })
    ).rejects.toMatchObject({ statusCode: 409, code: 'BORROW_LIMIT_REACHED' });
  });
});

describe('models/bookItemModel returns and status changes', () => {
  test('[positive] returning an overdue book reports wasOverdue', async () => {
    useConn([
      [[{ id: 5, status: 'BORROWED', shopId: 1, dueDate: new Date(), wasOverdue: 1 }], []],
      [{ affectedRows: 1 }, []],
      [[{ ...ITEM_ROW, status: 'AVAILABLE', borrowerUserId: null }], []]
    ]);

    const result = await bookItemModel.returnItem({ shopId: 1, barcode: 'BK-0003' });

    expect(result.wasOverdue).toBe(true);
    expect(result.previousShopId).toBe(1);
    expect(result.item.status).toBe('AVAILABLE');
  });

  test('[negative] returning an item that is not borrowed returns ITEM_NOT_AVAILABLE', async () => {
    useConn([[[{ id: 5, status: 'AVAILABLE', shopId: 1, wasOverdue: 0 }], []]]);

    await expect(bookItemModel.returnItem({ shopId: 1, barcode: 'BK-0001' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'ITEM_NOT_AVAILABLE'
    });
  });

  test('[negative] an invalid status transition returns INVALID_STATUS_TRANSITION', async () => {
    useConn([[[{ id: 5, status: 'AVAILABLE', shopId: 1 }], []]]);

    await expect(
      bookItemModel.updateStatus({ barcode: 'BK-0001', status: 'BORROWED', actorShopId: 1 })
    ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION' });
  });
});
