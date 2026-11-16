-- =====================================================================
-- Book Borrowing System - sample SQL evidence for grading
-- Every section is annotated. Run against the `book_borrowing` database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. DDL (commented out so the file stays re-runnable)
-- ---------------------------------------------------------------------
-- ALTER TABLE book_collections ADD INDEX idx_books_author (author);

-- ---------------------------------------------------------------------
-- 2. DML: insert, update, soft delete, filtered select
-- ---------------------------------------------------------------------
INSERT INTO shops (name, location) VALUES ('Sample Shop', 'Bangkok, Thailand');

UPDATE shops SET location = 'Bangkok, Thailand' WHERE name = 'Sample Shop';

-- Soft delete: the row stays, the application stops reading it
UPDATE shops SET deleted_at = UTC_TIMESTAMP() WHERE name = 'Sample Shop';

SELECT id, name, location
  FROM shops
 WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 3. JOINs: catalog with copy availability
-- ---------------------------------------------------------------------
SELECT bc.isbn,
       bc.title,
       COUNT(bi.id) AS total,
       COALESCE(SUM(bi.status = 'AVAILABLE'), 0) AS available
  FROM book_collections bc
  LEFT JOIN book_items bi ON bi.book_collection_id = bc.id AND bi.deleted_at IS NULL
 WHERE bc.deleted_at IS NULL
 GROUP BY bc.id, bc.isbn, bc.title
 ORDER BY bc.title;

-- Items with their collection, shop and borrower
SELECT bi.barcode, bc.title, s.name AS shop, u.username AS borrower, bi.due_date
  FROM book_items bi
  JOIN book_collections bc ON bc.id = bi.book_collection_id AND bc.deleted_at IS NULL
  JOIN shops s ON s.id = bi.shop_id AND s.deleted_at IS NULL
  LEFT JOIN users u ON u.id = bi.borrower_user_id AND u.deleted_at IS NULL
 WHERE bi.deleted_at IS NULL
 ORDER BY bi.barcode;

-- ---------------------------------------------------------------------
-- 4. Aggregates
-- ---------------------------------------------------------------------
-- Points leaderboard
SELECT u.username, u.points
  FROM users u
 WHERE u.deleted_at IS NULL
 ORDER BY u.points DESC
 LIMIT 10;

-- Donations per shop, keeping only shops above a threshold (GROUP BY + HAVING)
SELECT s.id, s.name, COUNT(bi.id) AS donations
  FROM shops s
  JOIN book_items bi ON bi.shop_id = s.id AND bi.deleted_at IS NULL
 WHERE s.deleted_at IS NULL AND bi.donor_user_id IS NOT NULL
 GROUP BY s.id, s.name
HAVING donations >= 1;

-- Overdue count per shop
SELECT s.id, s.name, COUNT(*) AS overdue_items
  FROM book_items bi
  JOIN shops s ON s.id = bi.shop_id AND s.deleted_at IS NULL
 WHERE bi.status = 'BORROWED'
   AND bi.due_date < UTC_TIMESTAMP()
   AND bi.deleted_at IS NULL
 GROUP BY s.id, s.name;

-- ---------------------------------------------------------------------
-- 5. TCL: a complete borrowing transaction
-- ---------------------------------------------------------------------
START TRANSACTION;

SELECT id, status, shop_id
  FROM book_items
 WHERE barcode = 'BK-0001' AND deleted_at IS NULL
 FOR UPDATE;

UPDATE book_items
   SET status = 'BORROWED',
       borrower_user_id = (SELECT id FROM users WHERE username = 'alice' AND deleted_at IS NULL),
       borrowed_at = UTC_TIMESTAMP(),
       due_date = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 14 DAY)
 WHERE barcode = 'BK-0001' AND status = 'AVAILABLE';

COMMIT;

-- ---------------------------------------------------------------------
-- 6. TCL: a redeem transaction with an explicit ROLLBACK path
-- ---------------------------------------------------------------------
START TRANSACTION;

SELECT id, points FROM users WHERE username = 'bob' AND deleted_at IS NULL FOR UPDATE;
SELECT id, points_cost, stock FROM rewards WHERE id = 1 AND deleted_at IS NULL FOR UPDATE;

-- The customer cannot afford the reward, so the transaction is undone:
ROLLBACK;

-- The successful path (enough points, stock available) would be:
-- UPDATE users SET points = points - 30 WHERE id = 5 AND points >= 30;
-- UPDATE rewards SET stock = stock - 1 WHERE id = 1 AND stock > 0;
-- COMMIT;
