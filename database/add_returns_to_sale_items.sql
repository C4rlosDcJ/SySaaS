-- Migration: Add repair_id, is_returned, returned_at, and return_reason to sale_items
-- Run this script in your MySQL / MariaDB database (e.g. via phpMyAdmin or mysql CLI).

USE sysaas_db;

-- 1. Add repair_id to sale_items if not already added
ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS repair_id INT NULL DEFAULT NULL AFTER service_id;

-- 2. Add return tracking columns
ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS is_returned TINYINT(1) NOT NULL DEFAULT 0 AFTER total,
    ADD COLUMN IF NOT EXISTS returned_at DATETIME NULL DEFAULT NULL AFTER is_returned,
    ADD COLUMN IF NOT EXISTS return_reason VARCHAR(255) NULL DEFAULT NULL AFTER returned_at;

-- 3. Add index for repair_id
CREATE INDEX IF NOT EXISTS idx_sale_items_repair ON sale_items(repair_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_returned ON sale_items(is_returned);
