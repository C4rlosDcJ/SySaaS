-- ============================================================
-- Migración: Sistema de Notificaciones
-- Descripción: Crea la tabla notifications para alertas internas
--              del tenant (nuevas reparaciones, pedidos, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id            INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id     INT(11) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    message       TEXT NOT NULL,
    type          ENUM('new_repair', 'new_order', 'status_change', 'payment', 'general') NOT NULL DEFAULT 'general',
    link          VARCHAR(500) DEFAULT NULL COMMENT 'Ruta frontend a la que navegar al hacer click',
    entity_id     INT(11) DEFAULT NULL COMMENT 'ID de la reparacion, orden, etc.',
    is_read       TINYINT(1) NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_tenant  (tenant_id),
    INDEX idx_notifications_unread  (tenant_id, is_read),
    INDEX idx_notifications_created (tenant_id, created_at),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
