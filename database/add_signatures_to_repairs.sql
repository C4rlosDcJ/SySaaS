-- Migration: Add signature_approval and signature_delivery to repairs table
-- Run once on your MySQL database

ALTER TABLE repairs 
    ADD COLUMN IF NOT EXISTS signature_approval LONGTEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS signature_delivery LONGTEXT DEFAULT NULL;
