-- =====================================================
-- SySaaS -- SaaS Multi-Tenant & Multi-Branch Migration
-- Run this AFTER all existing migrations
-- =====================================================

USE sysaas;

-- =====================================================
-- PASO 1: Planes de suscripcion SaaS
-- =====================================================
CREATE TABLE IF NOT EXISTS saas_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_branches INT DEFAULT 1,
    max_users INT DEFAULT 3,
    max_monthly_repairs INT DEFAULT NULL,
    features JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO saas_plans (name, slug, price_monthly, price_yearly, max_branches, max_users, max_monthly_repairs, features) VALUES
('Basico', 'basico', 299.00, 2990.00, 1, 3, 100, '{"ecommerce": false, "ai_assistant": false, "advanced_reports": false}'),
('Pro', 'pro', 599.00, 5990.00, 3, 10, 500, '{"ecommerce": true, "ai_assistant": true, "advanced_reports": false}'),
('Enterprise', 'enterprise', 999.00, 9990.00, 99, 999, NULL, '{"ecommerce": true, "ai_assistant": true, "advanced_reports": true}')
ON DUPLICATE KEY UPDATE name = name;

-- =====================================================
-- PASO 2: Empresas / Tenants
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    slug VARCHAR(60) UNIQUE NOT NULL,
    tax_id VARCHAR(30),
    plan_id INT NOT NULL,
    subscription_status ENUM('trial','active','past_due','canceled','suspended') DEFAULT 'trial',
    trial_ends_at TIMESTAMP NULL,
    subscription_expires_at TIMESTAMP NULL,
    stripe_customer_id VARCHAR(100) NULL,
    stripe_subscription_id VARCHAR(100) NULL,
    logo_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#e63358',
    timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
    currency VARCHAR(3) DEFAULT 'MXN',
    tax_rate DECIMAL(5,2) DEFAULT 16.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES saas_plans(id)
);

-- =====================================================
-- PASO 3: Sucursales
-- =====================================================
CREATE TABLE IF NOT EXISTS branches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    is_main BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY uk_tenant_code (tenant_id, code)
);

-- =====================================================
-- PASO 4: Asignacion usuarios <-> sucursales
-- =====================================================
CREATE TABLE IF NOT EXISTS user_branch_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    branch_id INT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_branch (user_id, branch_id)
);

-- =====================================================
-- PASO 5: Stock por sucursal (inventario descentralizado)
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    branch_id INT NOT NULL,
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 5,
    location_in_store VARCHAR(100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE KEY uk_product_branch (product_id, branch_id)
);

-- =====================================================
-- PASO 6: Traslados de inventario entre sucursales
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_transfers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    transfer_number VARCHAR(20) UNIQUE NOT NULL,
    source_branch_id INT NOT NULL,
    destination_branch_id INT NOT NULL,
    status ENUM('pending','approved','in_transit','completed','cancelled') DEFAULT 'pending',
    notes TEXT,
    requested_by INT,
    approved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (source_branch_id) REFERENCES branches(id),
    FOREIGN KEY (destination_branch_id) REFERENCES branches(id),
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_transfer_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transfer_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    FOREIGN KEY (transfer_id) REFERENCES inventory_transfers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- =====================================================
-- PASO 7: Historial de pagos de suscripcion
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    stripe_payment_id VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'MXN',
    status ENUM('pending','succeeded','failed','refunded') DEFAULT 'pending',
    payment_method VARCHAR(50),
    description VARCHAR(255),
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- =====================================================
-- PASO 8: Agregar columnas multi-tenant a tablas existentes
-- =====================================================

-- 8a. users: tenant_id + branch_id (clientes aislados por sucursal) + roles expandidos
-- Nota: Se usa procedimiento condicional para evitar errores si ya existe la columna
SET @dbname = DATABASE();

-- Agregar tenant_id a users
SET @tablename = 'users';
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT NULL AFTER id')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Agregar branch_id a users
SET @columnname = 'branch_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN branch_id INT NULL AFTER tenant_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Expandir ENUM de role en users
ALTER TABLE users MODIFY COLUMN role ENUM(
    'superadmin','tenant_admin','branch_manager',
    'technician','cashier','salesperson','client',
    'admin'
) DEFAULT 'client';

-- 8b. repairs: tenant_id + branch_id
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'repairs' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE repairs ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'branch_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'repairs' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE repairs ADD COLUMN branch_id INT NULL AFTER tenant_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8c. quotes: tenant_id + branch_id
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'quotes' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE quotes ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'branch_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'quotes' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE quotes ADD COLUMN branch_id INT NULL AFTER tenant_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8d. sales: tenant_id + branch_id
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE sales ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'branch_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE sales ADD COLUMN branch_id INT NULL AFTER tenant_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8e. orders: tenant_id + branch_id
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'orders') = 0
    OR
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'orders' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE orders ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'branch_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'orders') = 0
    OR
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'orders' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE orders ADD COLUMN branch_id INT NULL AFTER tenant_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8f. products: tenant_id (catalogo compartido por empresa)
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'products' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE products ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8g. product_categories: tenant_id
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'product_categories' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE product_categories ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8h. stock_movements: tenant_id + branch_id
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stock_movements' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE stock_movements ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'branch_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stock_movements' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE stock_movements ADD COLUMN branch_id INT NULL AFTER tenant_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8i. services_catalog: tenant_id
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'services_catalog' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE services_catalog ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8j. settings: tenant_id
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'settings' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE settings ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8k. activity_logs: tenant_id + branch_id
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'activity_logs' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE activity_logs ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'branch_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'activity_logs' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE activity_logs ADD COLUMN branch_id INT NULL AFTER tenant_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8l. device_types: tenant_id nullable (NULL = global, NOT NULL = personalizado)
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'device_types' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE device_types ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8m. brands: tenant_id nullable (NULL = global, NOT NULL = personalizado)
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'brands' AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    'ALTER TABLE brands ADD COLUMN tenant_id INT NULL AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- Indices para rendimiento multi-tenant
-- =====================================================
-- Se usa CREATE INDEX IF NOT EXISTS (MySQL 8.0+) o se ignoran errores de duplicados

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_repairs_tenant_branch ON repairs(tenant_id, branch_id, status);
CREATE INDEX idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX idx_sales_tenant_branch ON sales(tenant_id, branch_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_categories_tenant ON product_categories(tenant_id);
CREATE INDEX idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX idx_services_tenant ON services_catalog(tenant_id);
CREATE INDEX idx_settings_tenant ON settings(tenant_id);
CREATE INDEX idx_logs_tenant ON activity_logs(tenant_id);

-- Modificar UNIQUE de settings para ser por-tenant
-- Primero eliminar el unique actual si existe, luego crear el nuevo
-- (se ignora error si no existe)
-- ALTER TABLE settings DROP INDEX setting_key;
-- ALTER TABLE settings ADD UNIQUE KEY uk_tenant_setting (tenant_id, setting_key);

SELECT 'SaaS Migration: Schema changes completed successfully.' AS resultado;
