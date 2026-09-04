-- =====================================================
-- SySaaS — SuperAdmin Expansion Migration
-- System Broadcasts & Platform Notices
-- =====================================================

USE sysaas_db;

-- Tabla de Anuncios y Comunicados Globales del Sistema
CREATE TABLE IF NOT EXISTS system_broadcasts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'warning', 'urgent') DEFAULT 'info',
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indice para optimizar consulta de avisos activos
CREATE INDEX idx_broadcasts_active ON system_broadcasts(is_active, expires_at);
