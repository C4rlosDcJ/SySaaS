-- SySaaS - Sistema de Gestión de Reparaciones

-- =====================================================
-- TABLA: users - Usuarios del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    role ENUM('client', 'technician', 'admin') DEFAULT 'client',
    avatar VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLA: device_types - Tipos de dispositivos
-- =====================================================
CREATE TABLE IF NOT EXISTS device_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO device_types (name, icon, description) VALUES
('Celular', 'smartphone', 'Teléfonos móviles y smartphones'),
('Laptop', 'laptop', 'Computadoras portátiles'),
('Computadora de Escritorio', 'desktop', 'Computadoras de escritorio'),
('Tablet', 'tablet', 'Tablets'),
('Consola', 'gamepad', 'Consolas de videojuegos'),
('Smartwatch', 'watch', 'Relojes inteligentes'),
('Otro', 'device', 'Otros dispositivos');

-- =====================================================
-- TABLA: brands - Marcas
-- =====================================================
CREATE TABLE IF NOT EXISTS brands (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    logo VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO brands (name) VALUES
('Apple'), ('Samsung'), ('Xiaomi'), ('Huawei'),
('Motorola'), ('LG'), ('Sony'), ('HP'),
('Dell'), ('Lenovo'), ('ASUS'), ('Acer'),
('Microsoft'), ('Nintendo'), ('Otro');

-- =====================================================
-- TABLA: services_catalog - Servicios
-- =====================================================
CREATE TABLE IF NOT EXISTS services_catalog (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    device_type_id INT,
    base_price DECIMAL(10,2),
    estimated_time VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_type_id) REFERENCES device_types(id)
);

-- =====================================================
-- TABLA: repairs - Reparaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS repairs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,

    customer_id INT NOT NULL,
    technician_id INT,
    service_id INT,

    device_type_id INT NOT NULL,
    brand_id INT,
    brand_other VARCHAR(100),
    model VARCHAR(100),
    color VARCHAR(50),
    storage_capacity VARCHAR(50),
    serial_number VARCHAR(100),
    imei VARCHAR(20),
    device_password VARCHAR(255),
    accessories_received TEXT,

    physical_condition TINYINT,
    existing_damage TEXT,
    function_checklist JSON,

    problem_description TEXT NOT NULL,
    service_requested TEXT,
    technical_observations TEXT,
    priority ENUM('normal','urgent') DEFAULT 'normal',
    estimated_delivery DATE,

    battery_health VARCHAR(50),
    screen_status VARCHAR(100),
    account_status VARCHAR(255),

    diagnosis_cost DECIMAL(10,2) DEFAULT 0,
    labor_cost DECIMAL(10,2) DEFAULT 0,
    parts_cost DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0,
    advance_payment DECIMAL(10,2) DEFAULT 0,

    warranty_days INT DEFAULT 30,
    warranty_expires DATE,

    status ENUM(
        'received','diagnosing','waiting_approval','waiting_parts',
        'repairing','quality_check','ready','delivered','cancelled'
    ) DEFAULT 'received',

    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    rating INT NULL,
    review_text TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (technician_id) REFERENCES users(id),
    FOREIGN KEY (device_type_id) REFERENCES device_types(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (service_id) REFERENCES services_catalog(id)
);

-- =====================================================
-- TABLA: quotes - Cotizaciones (CORREGIDA)
-- =====================================================
CREATE TABLE IF NOT EXISTS quotes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quote_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INT NOT NULL,

    device_type_id INT NOT NULL,
    brand_id INT,
    brand_other VARCHAR(100),
    model VARCHAR(100),
    problem_description TEXT NOT NULL,

    status ENUM('pending','quoted','approved','rejected','expired')
        DEFAULT 'pending',
    estimated_cost DECIMAL(10,2),
    estimated_time VARCHAR(50),
    admin_notes TEXT,

    converted_to_repair_id INT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,

    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (device_type_id) REFERENCES device_types(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (converted_to_repair_id)
        REFERENCES repairs(id)
        ON DELETE SET NULL
);

-- =====================================================
-- TABLA: quote_images
-- =====================================================
CREATE TABLE IF NOT EXISTS quote_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quote_id INT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id)
        ON DELETE CASCADE
);

-- =====================================================
-- TABLA: repair_images - Imágenes de reparaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS repair_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    repair_id INT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    image_type ENUM('before', 'during', 'after') DEFAULT 'before',
    description VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);

-- =====================================================
-- TABLA: repair_status_history - Historial de estados
-- =====================================================
CREATE TABLE IF NOT EXISTS repair_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    repair_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    changed_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- =====================================================
-- TABLA: repair_notes - Notas de reparaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS repair_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    repair_id INT NOT NULL,
    user_id INT NOT NULL,
    note TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =====================================================
-- TABLA: settings - Configuraciones del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Configuración por defecto
INSERT INTO settings (setting_key, setting_value) VALUES
('default_warranty_days', '30'),
('company_name', 'SySaaS'),
('company_phone', ''),
('company_email', ''),
('company_address', '')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX idx_repairs_customer ON repairs(customer_id);
CREATE INDEX idx_repairs_status ON repairs(status);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_status_history_repair ON repair_status_history(repair_id);

-- =====================================================
-- NOTA: No se crean usuarios tenant por defecto aquí.
-- El usuario SuperAdmin de la plataforma se gestiona
-- mediante las migraciones SaaS multi-tenant.
-- =====================================================


-- -- =====================================================
-- -- SYSAAS - Sistema de Gestión de Reparaciones
-- -- Base de datos MySQL
-- -- =====================================================

-- CREATE DATABASE IF NOT EXISTS sistec CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE sistec;

-- -- =====================================================
-- -- TABLA: users - Usuarios del sistema
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS users (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     email VARCHAR(255) UNIQUE NOT NULL,
--     password VARCHAR(255) NOT NULL,
--     first_name VARCHAR(100) NOT NULL,
--     last_name VARCHAR(100) NOT NULL,
--     phone VARCHAR(20),
--     address TEXT,
--     role ENUM('client', 'technician', 'admin') DEFAULT 'client',
--     avatar VARCHAR(255),
--     is_active BOOLEAN DEFAULT TRUE,
--     email_verified BOOLEAN DEFAULT FALSE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );

-- -- =====================================================
-- -- TABLA: device_types - Tipos de dispositivos
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS device_types (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     name VARCHAR(100) NOT NULL,
--     icon VARCHAR(50),
--     description TEXT,
--     is_active BOOLEAN DEFAULT TRUE
-- );

-- -- Datos iniciales de tipos de dispositivos
-- INSERT INTO device_types (name, icon, description) VALUES
-- ('Celular', 'smartphone', 'Teléfonos móviles y smartphones'),
-- ('Laptop', 'laptop', 'Computadoras portátiles'),
-- ('Computadora de Escritorio', 'desktop', 'Computadoras de escritorio y PC'),
-- ('Tablet', 'tablet', 'Tablets y dispositivos similares'),
-- ('Consola de Videojuegos', 'gamepad', 'PlayStation, Xbox, Nintendo, etc.'),
-- ('Smartwatch', 'watch', 'Relojes inteligentes'),
-- ('Otro', 'device', 'Otros dispositivos electrónicos');

-- -- =====================================================
-- -- TABLA: brands - Marcas de dispositivos
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS brands (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     name VARCHAR(100) NOT NULL,
--     logo VARCHAR(255),
--     is_active BOOLEAN DEFAULT TRUE
-- );

-- -- Datos iniciales de marcas
-- INSERT INTO brands (name) VALUES
-- ('Apple'), ('Samsung'), ('Xiaomi'), ('Huawei'), ('Motorola'),
-- ('LG'), ('Sony'), ('HP'), ('Dell'), ('Lenovo'),
-- ('ASUS'), ('Acer'), ('Microsoft'), ('Nintendo'), ('Otro');

-- -- =====================================================
-- -- TABLA: services_catalog - Catálogo de servicios
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS services_catalog (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     name VARCHAR(255) NOT NULL,
--     description TEXT,
--     device_type_id INT,
--     base_price DECIMAL(10, 2),
--     estimated_time VARCHAR(50),
--     is_active BOOLEAN DEFAULT TRUE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (device_type_id) REFERENCES device_types(id)
-- );

-- -- Datos iniciales de servicios
-- INSERT INTO services_catalog (name, description, device_type_id, base_price, estimated_time) VALUES
-- -- Celulares
-- ('Cambio de pantalla', 'Reemplazo de pantalla LCD/OLED completa', 1, 800.00, '1-2 horas'),
-- ('Cambio de batería', 'Reemplazo de batería original o compatible', 1, 350.00, '30 min'),
-- ('Reparación de puerto de carga', 'Reparación o reemplazo del puerto de carga', 1, 300.00, '1 hora'),
-- ('Cambio de cámara', 'Reemplazo de cámara trasera o frontal', 1, 500.00, '1 hora'),
-- ('Liberación de red', 'Desbloqueo de operador de red', 1, 200.00, '30 min'),
-- ('Recuperación de datos', 'Recuperación de fotos, contactos y archivos', 1, 600.00, '2-4 horas'),
-- -- Laptops
-- ('Cambio de pantalla laptop', 'Reemplazo de pantalla LCD/LED', 2, 1500.00, '2-3 horas'),
-- ('Cambio de teclado', 'Reemplazo de teclado completo', 2, 800.00, '1-2 horas'),
-- ('Limpieza y mantenimiento', 'Limpieza interna, pasta térmica, ventiladores', 2, 400.00, '1-2 horas'),
-- ('Actualización de RAM', 'Instalación de memoria RAM adicional', 2, 300.00, '30 min'),
-- ('Cambio de disco duro/SSD', 'Reemplazo o actualización de almacenamiento', 2, 500.00, '1 hora'),
-- ('Reparación de bisagras', 'Reparación de bisagras rotas o flojas', 2, 600.00, '2 horas'),
-- -- Consolas
-- ('Reparación de lector', 'Reparación de lector de discos', 5, 700.00, '2-3 horas'),
-- ('Cambio de pasta térmica consola', 'Mantenimiento térmico de consola', 5, 400.00, '1-2 horas'),
-- ('Reparación de HDMI', 'Reparación de puerto HDMI', 5, 800.00, '2-3 horas'),
-- ('Reparación de control', 'Reparación de mandos/controles', 5, 300.00, '1 hora'),
-- -- General
-- ('Diagnóstico', 'Diagnóstico completo del dispositivo', NULL, 150.00, '30 min'),
-- ('Formateo y reinstalación', 'Formateo y reinstalación de sistema operativo', NULL, 350.00, '2-3 horas');

-- -- =====================================================
-- -- TABLA: repairs - Órdenes de reparación
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS repairs (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     ticket_number VARCHAR(20) UNIQUE NOT NULL,
    
--     -- Relaciones
--     customer_id INT NOT NULL,
--     technician_id INT,
--     service_id INT,
    
--     -- Información del dispositivo
--     device_type_id INT NOT NULL,
--     brand_id INT,
--     brand_other VARCHAR(100),
--     model VARCHAR(100),
--     color VARCHAR(50),
--     storage_capacity VARCHAR(50),
--     serial_number VARCHAR(100),
--     imei VARCHAR(20),
--     device_password VARCHAR(255),
--     accessories_received TEXT,
    
--     -- Condición pre-reparación
--     physical_condition TINYINT,
--     existing_damage TEXT,
    
--     -- Checklist de funciones (JSON)
--     function_checklist JSON,
    
--     -- Servicio
--     problem_description TEXT NOT NULL,
--     service_requested TEXT,
--     priority ENUM('normal', 'urgent') DEFAULT 'normal',
--     estimated_delivery DATE,
    
--     -- Costos
--     diagnosis_cost DECIMAL(10, 2) DEFAULT 0,
--     labor_cost DECIMAL(10, 2) DEFAULT 0,
--     parts_cost DECIMAL(10, 2) DEFAULT 0,
--     discount DECIMAL(10, 2) DEFAULT 0,
--     total_cost DECIMAL(10, 2) DEFAULT 0,
--     advance_payment DECIMAL(10, 2) DEFAULT 0,
    
--     -- Estado
--     status ENUM(
--         'received',
--         'diagnosing',
--         'waiting_approval',
--         'waiting_parts',
--         'repairing',
--         'quality_check',
--         'ready',
--         'delivered',
--         'cancelled'
--     ) DEFAULT 'received',
    
--     -- Garantía
--     warranty_days INT DEFAULT 30,
--     warranty_expires DATE,
    
--     -- Fechas
--     received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     started_at TIMESTAMP NULL,
--     completed_at TIMESTAMP NULL,
--     delivered_at TIMESTAMP NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
--     -- Llaves foráneas
--     FOREIGN KEY (customer_id) REFERENCES users(id),
--     FOREIGN KEY (technician_id) REFERENCES users(id),
--     FOREIGN KEY (device_type_id) REFERENCES device_types(id),
--     FOREIGN KEY (brand_id) REFERENCES brands(id),
--     FOREIGN KEY (service_id) REFERENCES services_catalog(id)
-- );

-- -- =====================================================
-- -- TABLA: repair_images - Imágenes de reparaciones
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS repair_images (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     repair_id INT NOT NULL,
--     image_path VARCHAR(255) NOT NULL,
--     image_type ENUM('before', 'during', 'after') DEFAULT 'before',
--     description VARCHAR(255),
--     uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
-- );

-- -- =====================================================
-- -- TABLA: repair_status_history - Historial de estados
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS repair_status_history (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     repair_id INT NOT NULL,
--     status VARCHAR(50) NOT NULL,
--     notes TEXT,
--     changed_by INT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE,
--     FOREIGN KEY (changed_by) REFERENCES users(id)
-- );

-- -- =====================================================
-- -- TABLA: repair_notes - Notas internas (solo admin)
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS repair_notes (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     repair_id INT NOT NULL,
--     user_id INT NOT NULL,
--     note TEXT NOT NULL,
--     is_internal BOOLEAN DEFAULT TRUE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE,
--     FOREIGN KEY (user_id) REFERENCES users(id)
-- );

-- -- =====================================================
-- -- TABLA: quotes - Cotizaciones
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS quotes (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     quote_number VARCHAR(20) UNIQUE NOT NULL,
--     customer_id INT NOT NULL,
    
--     -- Información del dispositivo
--     device_type_id INT NOT NULL,
--     brand_id INT,
--     brand_other VARCHAR(100),
--     model VARCHAR(100),
--     problem_description TEXT NOT NULL,
    
--     -- Estado y respuesta
--     status ENUM('pending', 'quoted', 'approved', 'rejected', 'expired') DEFAULT 'pending',
--     estimated_cost DECIMAL(10, 2),
--     estimated_time VARCHAR(50),
--     admin_notes TEXT,
    
--     -- Conversión a reparación
--     converted_to_repair_id INT,
    
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     expires_at TIMESTAMP,
    
--     FOREIGN KEY (customer_id) REFERENCES users(id),
--     FOREIGN KEY (device_type_id) REFERENCES device_types(id),
--     FOREIGN KEY (brand_id) REFERENCES brands(id),
--     FOREIGN KEY (converted_to_repair_id) REFERENCES repairs(id)
-- );

-- -- =====================================================
-- -- TABLA: quote_images - Imágenes de cotizaciones
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS quote_images (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     quote_id INT NOT NULL,
--     image_path VARCHAR(255) NOT NULL,
--     uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
-- );

-- -- =====================================================
-- -- TABLA: email_notifications - Registro de emails
-- -- =====================================================
-- CREATE TABLE IF NOT EXISTS email_notifications (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     user_id INT NOT NULL,
--     repair_id INT,
--     email_type VARCHAR(50) NOT NULL,
--     subject VARCHAR(255),
--     sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     FOREIGN KEY (repair_id) REFERENCES repairs(id)
-- );

-- -- =====================================================
-- -- Índices para mejor rendimiento
-- -- =====================================================
-- CREATE INDEX idx_repairs_customer ON repairs(customer_id);
-- CREATE INDEX idx_repairs_technician ON repairs(technician_id);
-- CREATE INDEX idx_repairs_status ON repairs(status);
-- CREATE INDEX idx_repairs_ticket ON repairs(ticket_number);
-- CREATE INDEX idx_quotes_customer ON quotes(customer_id);
-- CREATE INDEX idx_quotes_status ON quotes(status);
-- CREATE INDEX idx_status_history_repair ON repair_status_history(repair_id);

-- -- =====================================================
-- -- Usuario admin por defecto (password: admin123)
-- -- =====================================================
-- INSERT INTO users (email, password, first_name, last_name, phone, role, is_active, email_verified) VALUES
-- ('admin@sistec.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador', 'Sistema', '0000000000', 'admin', TRUE, TRUE);

