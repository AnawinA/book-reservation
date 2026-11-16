'use strict';

jest.mock('../../configs/db', () => ({
  pool: { execute: jest.fn(), query: jest.fn() },
  withTransaction: jest.fn()
}));

const db = require('../../configs/db');
const shopModel = require('../../models/shopModel');
const bookModel = require('../../models/bookModel');
const campaignModel = require('../../models/campaignModel');
const rewardModel = require('../../models/rewardModel');
const bookItemModel = require('../../models/bookItemModel');

beforeEach(() => {
  db.pool.execute.mockReset();
  db.pool.query.mockReset();
});

describe('models/shopModel', () => {
  test('[positive] findAll casts aggregate counts to numbers', async () => {
    db.pool.execute.mockResolvedValueOnce([
      [{ id: '1', name: 'KMITL Library Corner', totalItems: '4', availableItems: '3', borrowedItems: '1' }],
      []
    ]);

    const shops = await shopModel.findAll();

    expect(shops[0]).toMatchObject({ id: 1, totalItems: 4, availableItems: 3, borrowedItems: 1 });
    expect(db.pool.execute.mock.calls[0][0]).toContain('deleted_at IS NULL');
  });

  test('[positive] create returns the stored shop', async () => {
    db.pool.execute
      .mockResolvedValueOnce([{ insertId: 4 }, []])
      .mockResolvedValueOnce([[{ id: 4, name: 'New Shop', location: 'Bangkok' }], []]);

    await expect(shopModel.create({ name: 'New Shop', location: 'Bangkok' })).resolves.toMatchObject({
      id: 4
    });
    expect(db.pool.execute.mock.calls[0][1]).toEqual(['New Shop', 'Bangkok']);
  });

  test('[negative] update returns null when nothing was updated', async () => {
    db.pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    await expect(shopModel.update(99, { name: 'x', location: 'y' })).resolves.toBeNull();
  });

  test('[positive] update returns the fresh row after a change', async () => {
    db.pool.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{ id: 4, name: 'Renamed', location: 'Bangkok' }], []]);

    await expect(shopModel.update(4, { name: 'Renamed', location: 'Bangkok' })).resolves.toMatchObject({
      name: 'Renamed'
    });
  });

  test('[positive] countActiveBorrows counts only borrowed items', async () => {
    db.pool.execute.mockResolvedValueOnce([[{ activeBorrows: '2' }], []]);

    await expect(shopModel.countActiveBorrows(1)).resolves.toBe(2);
    expect(db.pool.execute.mock.calls[0][0]).toContain("status = 'BORROWED'");
  });

  test('[negative] softDelete reports false when the row is already gone', async () => {
    db.pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    await expect(shopModel.softDelete(99)).resolves.toBe(false);
    expect(db.pool.execute.mock.calls[0][0]).toContain('SET deleted_at = UTC_TIMESTAMP()');
  });
});

describe('models/bookModel', () => {
  test('[positive] search filters by q and category with LIMIT/OFFSET from parsed ints', async () => {
    db.pool.execute.mockResolvedValueOnce([[{ total: '1' }], []]);
    db.pool.query.mockResolvedValueOnce([
      [{ id: 1, isbn: '9780132350884', title: 'Clean Code', totalCopies: '3', availableCopies: '2' }],
      []
    ]);

    const result = await bookModel.search({ q: 'clean', category: 'Programming', page: 1, limit: 10 });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ totalCopies: 3, availableCopies: 2 });
    expect(db.pool.execute.mock.calls[0][1]).toEqual(['clean', 'clean', 'clean', 'Programming']);
    expect(db.pool.query.mock.calls[0][0]).toContain('LIMIT 10 OFFSET 0');
  });

  test('[positive] search without filters keeps the base predicate', async () => {
    db.pool.execute.mockResolvedValueOnce([[{ total: 0 }], []]);
    db.pool.query.mockResolvedValueOnce([[], []]);

    const result = await bookModel.search({ page: 2, limit: 20 });

    expect(result).toEqual({ items: [], total: 0 });
    expect(db.pool.query.mock.calls[0][0]).toContain('LIMIT 20 OFFSET 20');
  });

  test('[negative] findByIsbn returns null for an unknown ISBN', async () => {
    db.pool.execute.mockResolvedValueOnce([[], []]);
    await expect(bookModel.findByIsbn('9780132350884')).resolves.toBeNull();
  });

  test('[positive] findByIsbn adds per-shop availability', async () => {
    db.pool.execute
      .mockResolvedValueOnce([[{ id: 1, isbn: '9780132350884', title: 'Clean Code' }], []])
      .mockResolvedValueOnce([
        [{ shopId: '1', shopName: 'KMITL Library Corner', total: '2', available: '1' }],
        []
      ]);

    const book = await bookModel.findByIsbn('9780132350884');

    expect(book.availabilityByShop[0]).toEqual({
      shopId: 1,
      shopName: 'KMITL Library Corner',
      total: 2,
      available: 1
    });
  });

  test('[positive] findCategories maps distinct rows to strings', async () => {
    db.pool.execute.mockResolvedValueOnce([[{ category: 'Programming' }, { category: 'Science' }], []]);
    await expect(bookModel.findCategories()).resolves.toEqual(['Programming', 'Science']);
  });

  test('[negative] update returns null for a missing collection', async () => {
    db.pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    await expect(
      bookModel.update(99, { isbn: '9780132350884', title: 't', author: 'a', category: 'c' })
    ).resolves.toBeNull();
  });
});

describe('models/campaignModel', () => {
  test('[positive] findAll computes isActive and filters by shop', async () => {
    db.pool.execute.mockResolvedValueOnce([
      [
        {
          id: '1',
          title: 'Back to School Bonus',
          bonusPoints: '20',
          shopId: '1',
          startAt: new Date(),
          endAt: new Date(),
          shopName: 'KMITL Library Corner',
          isActive: 1
        }
      ],
      []
    ]);

    const campaigns = await campaignModel.findAll({ activeOnly: true, shopId: 1 });

    expect(campaigns[0]).toMatchObject({ id: 1, bonusPoints: 20, isActive: true });
    expect(db.pool.execute.mock.calls[0][0]).toContain('c.start_at <= UTC_TIMESTAMP()');
    expect(db.pool.execute.mock.calls[0][1]).toEqual([1]);
  });

  test('[positive] findBestActiveForShop uses the provided connection and highest bonus', async () => {
    const conn = { execute: jest.fn().mockResolvedValue([[{ id: 1, bonusPoints: '20', shopId: '1' }], []]) };

    const campaign = await campaignModel.findBestActiveForShop(1, conn);

    expect(campaign).toMatchObject({ id: 1, bonusPoints: 20 });
    expect(conn.execute.mock.calls[0][0]).toContain('ORDER BY c.bonus_points DESC');
    expect(db.pool.execute).not.toHaveBeenCalled();
  });

  test('[negative] findBestActiveForShop returns null when no campaign is running', async () => {
    db.pool.execute.mockResolvedValueOnce([[], []]);
    await expect(campaignModel.findBestActiveForShop(2)).resolves.toBeNull();
  });

  test('[positive] create and update persist ISO dates as Date objects', async () => {
    db.pool.execute
      .mockResolvedValueOnce([{ insertId: 3 }, []])
      .mockResolvedValueOnce([[{ id: 3, title: 'New', bonusPoints: 5, shopId: 1 }], []]);

    const created = await campaignModel.create({
      title: 'New',
      bonusPoints: 5,
      shopId: 1,
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-02-01T00:00:00Z'
    });

    expect(created.id).toBe(3);
    expect(db.pool.execute.mock.calls[0][1][3] instanceof Date).toBe(true);

    db.pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    await expect(
      campaignModel.update(99, {
        title: 'x',
        bonusPoints: 1,
        shopId: 1,
        startAt: '2026-01-01T00:00:00Z',
        endAt: '2026-02-01T00:00:00Z'
      })
    ).resolves.toBeNull();
  });
});

describe('models/rewardModel reads and writes', () => {
  test('[positive] findAll casts numbers and filters by shop', async () => {
    db.pool.execute.mockResolvedValueOnce([
      [{ id: '1', title: 'Coffee Voucher', pointsCost: '30', stock: '10', shopId: '1', shopName: 'KMITL Library Corner' }],
      []
    ]);

    const rewards = await rewardModel.findAll({ shopId: 1 });

    expect(rewards[0]).toMatchObject({ id: 1, pointsCost: 30, stock: 10 });
    expect(db.pool.execute.mock.calls[0][1]).toEqual([1]);
  });

  test('[positive] findById returns a normalized reward or null', async () => {
    db.pool.execute.mockResolvedValueOnce([[{ id: '2', pointsCost: '100', stock: '2', shopId: '1' }], []]);
    await expect(rewardModel.findById(2)).resolves.toMatchObject({ id: 2, pointsCost: 100, stock: 2 });

    db.pool.execute.mockResolvedValueOnce([[], []]);
    await expect(rewardModel.findById(404)).resolves.toBeNull();
  });

  test('[positive] create returns the row and update returns null when missing', async () => {
    db.pool.execute
      .mockResolvedValueOnce([{ insertId: 9 }, []])
      .mockResolvedValueOnce([[{ id: 9, title: 'Tote', pointsCost: 100, stock: 2, shopId: 1 }], []]);

    await expect(
      rewardModel.create({ title: 'Tote', pointsCost: 100, stock: 2, shopId: 1 })
    ).resolves.toMatchObject({ id: 9 });

    db.pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    await expect(
      rewardModel.update(99, { title: 'Tote', pointsCost: 100, stock: 2, shopId: 1 })
    ).resolves.toBeNull();
  });
});

describe('models/bookItemModel reads', () => {
  test('[positive] findInventoryByShop filters by status and paginates', async () => {
    db.pool.execute.mockResolvedValueOnce([[{ total: '1' }], []]);
    db.pool.query.mockResolvedValueOnce([
      [{ id: 1, barcode: 'BK-0001', status: 'AVAILABLE', shopId: 1, bookCollectionId: 1 }],
      []
    ]);

    const result = await bookItemModel.findInventoryByShop(1, { status: 'AVAILABLE', page: 1, limit: 50 });

    expect(result.total).toBe(1);
    expect(result.items[0].barcode).toBe('BK-0001');
    expect(db.pool.execute.mock.calls[0][1]).toEqual([1, 'AVAILABLE']);
    expect(db.pool.query.mock.calls[0][0]).toContain('LIMIT 50 OFFSET 0');
  });

  test('[negative] findByBarcode returns null when the item does not exist', async () => {
    db.pool.execute.mockResolvedValueOnce([[], []]);
    await expect(bookItemModel.findByBarcode('BK-9999')).resolves.toBeNull();
  });

  test('[positive] findDonationsByUser keeps the donation fields', async () => {
    db.pool.execute.mockResolvedValueOnce([
      [{ id: 1, barcode: 'BK-0001', title: 'Clean Code', status: 'AVAILABLE', shopName: 'KMITL Library Corner' }],
      []
    ]);

    const donations = await bookItemModel.findDonationsByUser(4);

    expect(donations[0].barcode).toBe('BK-0001');
    expect(db.pool.execute.mock.calls[0][1]).toEqual([4]);
  });

  test('[positive] findBorrowsByUser flags overdue loans', async () => {
    db.pool.execute.mockResolvedValueOnce([
      [{ id: 3, barcode: 'BK-0003', isOverdue: 1, daysRemaining: -6 }],
      []
    ]);

    const borrows = await bookItemModel.findBorrowsByUser(4);

    expect(borrows[0]).toMatchObject({ isOverdue: true, daysRemaining: -6 });
  });

  test('[positive] findOverdue casts numeric fields and orders by due date', async () => {
    db.pool.execute.mockResolvedValueOnce([
      [{ id: '3', userId: '4', shopId: '1', barcode: 'BK-0003', daysOverdue: '6' }],
      []
    ]);

    const overdue = await bookItemModel.findOverdue();

    expect(overdue[0]).toMatchObject({ id: 3, userId: 4, shopId: 1, daysOverdue: 6 });
    expect(db.pool.execute.mock.calls[0][0]).toContain('ORDER BY bi.due_date ASC');
  });
});
