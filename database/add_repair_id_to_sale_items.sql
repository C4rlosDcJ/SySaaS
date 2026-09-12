-- Migration: add repair_id column to sale_items so individual items can reference their origin repair
-- Run once on your database.

ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS repair_id INT NULL DEFAULT NULL AFTER service_id,
    ADD CONSTRAINT fk_sale_items_repair FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE SET NULL;

-- Index for faster lookup during sale cancellation
CREATE INDEX IF NOT EXISTS idx_sale_items_repair ON sale_items(repair_id);
