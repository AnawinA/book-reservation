-- =====================================================================
-- Book Borrowing System - schema
-- MySQL 8.0 / InnoDB / utf8mb4_unicode_ci. Every timestamp is UTC.
-- Hard deletes are blocked by FK RESTRICT; the application soft deletes.
-- ADR-1: users.shop_id links an OwnerShop account to its shop.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS book_borrowing
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE book_borrowing;

CREATE TABLE IF NOT EXISTS shops (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  INDEX idx_shops_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(30) NOT NULL,
  phone VARCHAR(10) NOT NULL,
  points INT UNSIGNED NOT NULL DEFAULT 0,
  role ENUM('Admin','Customer','OwnerShop') NOT NULL DEFAULT 'Customer',
  password_hash CHAR(60) NOT NULL,
  shop_id INT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_phone (phone),
  INDEX idx_users_role (role),
  INDEX idx_users_deleted (deleted_at),
  CONSTRAINT fk_users_shop FOREIGN KEY (shop_id) REFERENCES shops (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS book_collections (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  isbn VARCHAR(13) NOT NULL,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_books_isbn (isbn),
  INDEX idx_books_category (category),
  INDEX idx_books_title (title),
  INDEX idx_books_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(150) NOT NULL,
  bonus_points INT UNSIGNED NOT NULL DEFAULT 0,
  shop_id INT UNSIGNED NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  INDEX idx_campaign_active (shop_id, start_at, end_at),
  INDEX idx_campaigns_deleted (deleted_at),
  CONSTRAINT chk_campaign_window CHECK (end_at > start_at),
  CONSTRAINT chk_campaign_bonus CHECK (bonus_points <= 1000),
  CONSTRAINT fk_campaigns_shop FOREIGN KEY (shop_id) REFERENCES shops (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rewards (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(150) NOT NULL,
  points_cost INT UNSIGNED NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  shop_id INT UNSIGNED NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  INDEX idx_rewards_shop (shop_id),
  INDEX idx_rewards_deleted (deleted_at),
  CONSTRAINT chk_reward_cost CHECK (points_cost > 0),
  CONSTRAINT fk_rewards_shop FOREIGN KEY (shop_id) REFERENCES shops (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS book_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_collection_id INT UNSIGNED NOT NULL,
  barcode VARCHAR(32) NOT NULL,
  status ENUM('AVAILABLE','BORROWED','LOST','DAMAGED') NOT NULL DEFAULT 'AVAILABLE',
  shop_id INT UNSIGNED NOT NULL,
  donor_user_id INT UNSIGNED NULL,
  campaign_id INT UNSIGNED NULL,
  borrower_user_id INT UNSIGNED NULL,
  borrowed_at DATETIME NULL,
  due_date DATETIME NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_items_barcode (barcode),
  INDEX idx_items_shop_status (shop_id, status),
  INDEX idx_items_status_due (status, due_date),
  INDEX idx_items_borrower (borrower_user_id),
  INDEX idx_items_donor (donor_user_id),
  INDEX idx_items_collection (book_collection_id),
  INDEX idx_items_deleted (deleted_at),
  CONSTRAINT chk_items_dates CHECK (due_date IS NULL OR borrowed_at IS NULL OR due_date >= borrowed_at),
  CONSTRAINT fk_items_collection FOREIGN KEY (book_collection_id) REFERENCES book_collections (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_items_shop FOREIGN KEY (shop_id) REFERENCES shops (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_items_donor FOREIGN KEY (donor_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_items_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_items_borrower FOREIGN KEY (borrower_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
