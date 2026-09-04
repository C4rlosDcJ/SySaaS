-- =====================================================
-- SySaaS — POS & Inventory Migration
-- Run this AFTER the original schema.sql
-- =====================================================

USE sysaas;

-- =====================================================
-- TABLA: product_categories — Categorías de productos
-- =====================================================
CREATE TABLE IF NOT EXISTS product_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO product_categories (name, description, color) VALUES
('Accesorios', 'Fundas, micas, cargadores, cables', '#6366f1'),
('Refacciones', 'Pantallas, baterías, puertos, flex', '#f59e0b'),
('Audio', 'Audífonos, bocinas, adaptadores de audio', '#ec4899'),
('Protección', 'Mica de vidrio, cases, protectores', '#22c55e'),
('Energía', 'Cargadores, power banks, cables', '#3b82f6'),
('Otros', 'Productos varios', '#78716c')
ON DUPLICATE KEY UPDATE name = name;

-- =====================================================
-- TABLA: products — Catálogo de productos en venta
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sku VARCHAR(50) UNIQUE,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT,
    purchase_price DECIMAL(10,2) DEFAULT 0,
    sale_price DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES product_categories(id)
        ON DELETE SET NULL
);

-- =====================================================
-- TABLA: stock_movements — Movimientos de inventario
-- =====================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    type ENUM('in', 'out', 'adjustment') NOT NULL,
    quantity INT NOT NULL,
    reference VARCHAR(255),
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- =====================================================
-- TABLA: sales — Ventas (cabecera)
-- =====================================================
CREATE TABLE IF NOT EXISTS sales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sale_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INT,
    repair_id INT,
    cashier_id INT NOT NULL,

    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,

    payment_method ENUM('cash', 'card', 'transfer', 'mixed') NOT NULL DEFAULT 'cash',
    amount_received DECIMAL(10,2) DEFAULT 0,
    change_amount DECIMAL(10,2) DEFAULT 0,

    status ENUM('completed', 'cancelled', 'refunded') DEFAULT 'completed',
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE SET NULL,
    FOREIGN KEY (cashier_id) REFERENCES users(id)
);

-- =====================================================
-- TABLA: sale_items — Ítems de cada venta
-- =====================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    product_id INT,
    service_id INT,
    description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (service_id) REFERENCES services_catalog(id) ON DELETE SET NULL
);

-- =====================================================
-- Agregar estado de pago a reparaciones (si no existe)
-- =====================================================
SET @dbname = DATABASE();
SET @tablename = 'repairs';
SET @columnname = 'payment_status';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname,
           ' ENUM(\'pending\', \'partial\', \'paid\') DEFAULT \'pending\' AFTER status')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- Índices para rendimiento (ignorar error si ya existen)
-- =====================================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);

