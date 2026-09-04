-- =============================================================================
-- SySaaS - Script de Limpieza de Datos de Prueba para Despliegue en Produccion
--
-- ADVERTENCIA: Este script elimina todos los datos operativos y tenants de prueba.
-- Conserva la estructura de tablas, los planes SaaS, tipos de dispositivos y marcas.
-- Conserva unicamente la cuenta SuperAdmin de la plataforma.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Transacciones POS y Ventas
TRUNCATE TABLE sale_items;
TRUNCATE TABLE sales;
TRUNCATE TABLE order_items;
TRUNCATE TABLE orders;

-- 2. Inventario y Compras
TRUNCATE TABLE purchase_order_items;
TRUNCATE TABLE purchase_orders;
TRUNCATE TABLE branch_inventory;
TRUNCATE TABLE inventory_transfer_items;
TRUNCATE TABLE inventory_transfers;
TRUNCATE TABLE stock_movements;
TRUNCATE TABLE products;
TRUNCATE TABLE product_categories;

-- 3. Modulo de Reparaciones y Cotizaciones
TRUNCATE TABLE repair_images;
TRUNCATE TABLE repair_status_history;
TRUNCATE TABLE repair_notes;
TRUNCATE TABLE repairs;
TRUNCATE TABLE quote_images;
TRUNCATE TABLE quotes;

-- 4. Catalogos y Configuraciones Operativas
TRUNCATE TABLE coupons;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE services_catalog;
TRUNCATE TABLE subscription_payments;
TRUNCATE TABLE system_broadcasts;
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE user_branch_assignments;

-- 5. Configuraciones especificas de empresas/tenants
DELETE FROM settings WHERE tenant_id IS NOT NULL;

-- 6. Ajustar configuraciones globales de la plataforma
UPDATE settings SET setting_value = 'SySaaS' WHERE setting_key = 'platform_name' AND tenant_id IS NULL;
UPDATE settings SET setting_value = 'soporte@sysaas.com' WHERE setting_key = 'support_email' AND tenant_id IS NULL;
UPDATE settings SET setting_value = NULL WHERE setting_key = 'platform_logo' AND tenant_id IS NULL;

-- 7. Eliminar usuarios de prueba (conservar solo superadmin)
DELETE FROM users WHERE role != 'superadmin';

-- 8. Limpiar y desvincular al SuperAdmin
UPDATE users 
SET tenant_id = NULL, 
    branch_id = NULL,
    email = 'superadmin@sysaas.com'
WHERE role = 'superadmin';

-- Asegurar que exista al menos un SuperAdmin si la tabla quedo vacia
INSERT INTO users (email, password, first_name, last_name, role, is_active, email_verified, tenant_id, branch_id)
SELECT 'superadmin@sysaas.com',
       '$2a$10$5HjXkF/XpIdTcLEzlKG8ZeSVY33xY.YINlb6K1O6wwt03ljX3CiZm',
       'Super', 'Admin', 'superadmin', TRUE, TRUE, NULL, NULL
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'superadmin');

-- 9. Eliminar sucursales y tenants de prueba
TRUNCATE TABLE branches;
TRUNCATE TABLE tenants;

-- 10. Reiniciar contadores AUTO_INCREMENT
ALTER TABLE tenants AUTO_INCREMENT = 1;
ALTER TABLE branches AUTO_INCREMENT = 1;
ALTER TABLE repairs AUTO_INCREMENT = 1;
ALTER TABLE sales AUTO_INCREMENT = 1;
ALTER TABLE products AUTO_INCREMENT = 1;
ALTER TABLE product_categories AUTO_INCREMENT = 1;
ALTER TABLE services_catalog AUTO_INCREMENT = 1;
ALTER TABLE suppliers AUTO_INCREMENT = 1;
ALTER TABLE purchase_orders AUTO_INCREMENT = 1;
ALTER TABLE activity_logs AUTO_INCREMENT = 1;
ALTER TABLE system_broadcasts AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Limpieza completada exitosamente. Base de datos lista para produccion.' AS status;
