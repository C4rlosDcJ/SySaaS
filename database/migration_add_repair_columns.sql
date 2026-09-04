-- Migración: Agregar columnas faltantes a la tabla repairs
-- Ejecutar este script en MySQL para actualizar la base de datos

USE sysaas;

-- Agregar columnas de información del dispositivo
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_password VARCHAR(255);
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS accessories_received TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS physical_condition TINYINT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS existing_damage TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS function_checklist JSON;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS service_requested TEXT;

-- Agregar columnas de costos
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS advance_payment DECIMAL(10,2) DEFAULT 0;

-- Agregar columnas de garantía
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS warranty_days INT DEFAULT 30;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS warranty_expires DATE;

-- Agregar columnas de tracking de tiempo
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NULL;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL;

-- Agregar tabla de historial si no existe
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

-- Agregar tabla de notas si no existe
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

-- Agregar tabla de imágenes si no existe
CREATE TABLE IF NOT EXISTS repair_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    repair_id INT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    image_type ENUM('before', 'during', 'after') DEFAULT 'before',
    description VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);

-- Agregar tabla de settings si no existe
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar configuración por defecto de garantía
INSERT INTO settings (setting_key, setting_value) 
VALUES ('default_warranty_days', '30')
ON DUPLICATE KEY UPDATE setting_value = setting_value;

SELECT 'Migración completada exitosamente!' as resultado;
