-- =====================================================
-- SySaaS -- SaaS Data Migration Script
-- Run this AFTER saas_migration.sql
-- This script ONLY creates the SuperAdmin user.
-- It does NOT create any default tenant or sample data.
-- Tenant companies are created by operators through the
-- SuperAdmin panel or via the /api/auth/register-company endpoint.
-- =====================================================

-- =====================================================
-- PASO 9: Migrar datos existentes
-- =====================================================

-- Crear SuperAdmin de la plataforma si no existe
-- Default password: SuperAdmin#2026!SecureKey (cambiar en configuracion de plataforma)
INSERT INTO users (email, password, first_name, last_name, role, is_active, email_verified)
SELECT 'superadmin@sysaas.com',
    '$2a$10$k3jVAnMIND7hAngOIAfoAO/BCJVTNuv5eT7D5zNGI.dR1yxZk/9eu',
    'Super', 'Admin', 'superadmin', TRUE, TRUE
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'superadmin');

SELECT 'SaaS Data Migration completed successfully.' AS resultado;
SELECT 'SuperAdmin: superadmin@sysaas.com / SuperAdmin#2026!SecureKey' AS info;
