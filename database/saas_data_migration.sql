-- =====================================================
-- SySaaS -- SaaS Data Migration Script
-- Run this AFTER saas_migration.sql
-- Migrates existing data to a default tenant and branch
-- =====================================================

USE sysaas;

-- =====================================================
-- PASO 9: Migrar datos existentes al tenant por defecto
-- =====================================================

-- Solo ejecutar si no existe un tenant por defecto aun
SET @tenant_exists = (SELECT COUNT(*) FROM tenants LIMIT 1);

-- Crear tenant por defecto si no existe
INSERT INTO tenants (uuid, company_name, slug, plan_id, subscription_status)
SELECT UUID(), 'Mi Empresa', 'mi-empresa', 
    (SELECT id FROM saas_plans WHERE slug = 'enterprise' LIMIT 1), 
    'active'
FROM dual
WHERE @tenant_exists = 0;

-- Obtener el ID del tenant por defecto
SET @default_tenant_id = (SELECT id FROM tenants WHERE slug = 'mi-empresa' LIMIT 1);

-- Crear sucursal principal si no existe
INSERT INTO branches (tenant_id, code, name, is_main)
SELECT @default_tenant_id, 'SUC-001', 'Sucursal Principal', TRUE
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE tenant_id = @default_tenant_id AND is_main = TRUE);

SET @default_branch_id = (SELECT id FROM branches WHERE tenant_id = @default_tenant_id AND is_main = TRUE LIMIT 1);

-- =====================================================
-- Migrar datos de tablas existentes
-- =====================================================

-- Usuarios: asignar tenant y branch
UPDATE users SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL AND role != 'superadmin';

UPDATE users SET branch_id = @default_branch_id 
WHERE branch_id IS NULL AND role != 'superadmin';

-- Convertir admin existente a tenant_admin
UPDATE users SET role = 'tenant_admin' 
WHERE role = 'admin' AND tenant_id = @default_tenant_id;

-- Crear SuperAdmin de la plataforma si no existe
INSERT INTO users (email, password, first_name, last_name, role, is_active, email_verified)
SELECT 'superadmin@sysaas.com',
    '$2a$10$5HjXkF/XpIdTcLEzlKG8ZeSVY33xY.YINlb6K1O6wwt03ljX3CiZm',
    'Super', 'Admin', 'superadmin', TRUE, TRUE
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'superadmin');

-- Reparaciones
UPDATE repairs SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;
UPDATE repairs SET branch_id = @default_branch_id 
WHERE branch_id IS NULL;

-- Cotizaciones
UPDATE quotes SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;
UPDATE quotes SET branch_id = @default_branch_id 
WHERE branch_id IS NULL;

-- Ventas
UPDATE sales SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;
UPDATE sales SET branch_id = @default_branch_id 
WHERE branch_id IS NULL;

-- Pedidos
UPDATE orders SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;
UPDATE orders SET branch_id = @default_branch_id 
WHERE branch_id IS NULL;

-- Productos (catalogo compartido por empresa, no por sucursal)
UPDATE products SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;

-- Categorias de productos
UPDATE product_categories SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;

-- Movimientos de stock
UPDATE stock_movements SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;
UPDATE stock_movements SET branch_id = @default_branch_id 
WHERE branch_id IS NULL;

-- Catalogo de servicios
UPDATE services_catalog SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;

-- Settings (configuracion por tenant)
UPDATE settings SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;

-- Activity logs
UPDATE activity_logs SET tenant_id = @default_tenant_id 
WHERE tenant_id IS NULL;

-- =====================================================
-- Migrar stock de products.stock a branch_inventory
-- =====================================================
INSERT INTO branch_inventory (product_id, branch_id, stock, min_stock)
SELECT p.id, @default_branch_id, p.stock, p.min_stock
FROM products p
WHERE p.tenant_id = @default_tenant_id
AND NOT EXISTS (
    SELECT 1 FROM branch_inventory bi 
    WHERE bi.product_id = p.id AND bi.branch_id = @default_branch_id
);

-- =====================================================
-- Asignar staff a la sucursal principal
-- =====================================================
INSERT INTO user_branch_assignments (user_id, branch_id, is_default)
SELECT u.id, @default_branch_id, TRUE
FROM users u
WHERE u.tenant_id = @default_tenant_id
AND u.role IN ('tenant_admin', 'branch_manager', 'technician', 'cashier')
AND NOT EXISTS (
    SELECT 1 FROM user_branch_assignments uba 
    WHERE uba.user_id = u.id AND uba.branch_id = @default_branch_id
);

-- =====================================================
-- Hacer NOT NULL las columnas criticas (solo si ya hay datos migrados)
-- =====================================================
-- Nota: Estas alteraciones pueden fallar si quedan NULLs.
-- Se ejecutan como sentencias preparadas para control de errores.

-- repairs.tenant_id -> NOT NULL
SET @orphan_count = (SELECT COUNT(*) FROM repairs WHERE tenant_id IS NULL);
SET @alter_sql = IF(@orphan_count = 0,
    'ALTER TABLE repairs MODIFY COLUMN tenant_id INT NOT NULL',
    'SELECT "WARN: repairs tiene filas sin tenant_id, no se puede hacer NOT NULL" AS warning'
);
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- repairs.branch_id -> NOT NULL
SET @orphan_count = (SELECT COUNT(*) FROM repairs WHERE branch_id IS NULL);
SET @alter_sql = IF(@orphan_count = 0,
    'ALTER TABLE repairs MODIFY COLUMN branch_id INT NOT NULL',
    'SELECT "WARN: repairs tiene filas sin branch_id, no se puede hacer NOT NULL" AS warning'
);
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sales.tenant_id -> NOT NULL
SET @orphan_count = (SELECT COUNT(*) FROM sales WHERE tenant_id IS NULL);
SET @alter_sql = IF(@orphan_count = 0,
    'ALTER TABLE sales MODIFY COLUMN tenant_id INT NOT NULL',
    'SELECT "WARN: sales tiene filas sin tenant_id" AS warning'
);
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sales.branch_id -> NOT NULL
SET @orphan_count = (SELECT COUNT(*) FROM sales WHERE branch_id IS NULL);
SET @alter_sql = IF(@orphan_count = 0,
    'ALTER TABLE sales MODIFY COLUMN branch_id INT NOT NULL',
    'SELECT "WARN: sales tiene filas sin branch_id" AS warning'
);
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- products.tenant_id -> NOT NULL
SET @orphan_count = (SELECT COUNT(*) FROM products WHERE tenant_id IS NULL);
SET @alter_sql = IF(@orphan_count = 0,
    'ALTER TABLE products MODIFY COLUMN tenant_id INT NOT NULL',
    'SELECT "WARN: products tiene filas sin tenant_id" AS warning'
);
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- product_categories.tenant_id -> NOT NULL
SET @orphan_count = (SELECT COUNT(*) FROM product_categories WHERE tenant_id IS NULL);
SET @alter_sql = IF(@orphan_count = 0,
    'ALTER TABLE product_categories MODIFY COLUMN tenant_id INT NOT NULL',
    'SELECT "WARN: product_categories tiene filas sin tenant_id" AS warning'
);
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- services_catalog.tenant_id -> NOT NULL
SET @orphan_count = (SELECT COUNT(*) FROM services_catalog WHERE tenant_id IS NULL);
SET @alter_sql = IF(@orphan_count = 0,
    'ALTER TABLE services_catalog MODIFY COLUMN tenant_id INT NOT NULL',
    'SELECT "WARN: services_catalog tiene filas sin tenant_id" AS warning'
);
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'SaaS Data Migration completed successfully.' AS resultado;
SELECT CONCAT('Default Tenant ID: ', @default_tenant_id) AS info;
SELECT CONCAT('Default Branch ID: ', @default_branch_id) AS info;
SELECT CONCAT('SuperAdmin password: admin123') AS info;
