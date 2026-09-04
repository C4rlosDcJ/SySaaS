-- =====================================================
-- SySaaS -- Seed de Desarrollo (SOLO PARA DEV/TESTING)
-- NO ejecutar en produccion.
-- Crea datos de prueba: un tenant de ejemplo y usuarios.
-- Ejecutar manualmente cuando se necesite poblar la BD local.
-- Uso: mysql -u root -p sysaas_db < database/seed_dev.sql
-- =====================================================

-- Verificar que exista al menos un plan
SET @plan_id = (SELECT id FROM saas_plans ORDER BY id ASC LIMIT 1);

-- Crear tenant de prueba si no existe
INSERT INTO tenants (uuid, company_name, slug, plan_id, subscription_status)
SELECT UUID(), 'Empresa Demo', 'empresa-demo',
    @plan_id,
    'active'
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'empresa-demo');

SET @tenant_id = (SELECT id FROM tenants WHERE slug = 'empresa-demo' LIMIT 1);

-- Sucursal principal del tenant de prueba
INSERT INTO branches (tenant_id, code, name, is_main, phone)
SELECT @tenant_id, 'SUC-001', 'Sucursal Principal', TRUE, '55 0000 0000'
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE tenant_id = @tenant_id AND is_main = TRUE);

SET @branch_id = (SELECT id FROM branches WHERE tenant_id = @tenant_id AND is_main = TRUE LIMIT 1);

-- Admin de la empresa de prueba (password: admin123)
INSERT INTO users (email, password, first_name, last_name, role, is_active, email_verified, tenant_id, branch_id)
SELECT 'admin@empresa-demo.com',
    '$2a$10$5HjXkF/XpIdTcLEzlKG8ZeSVY33xY.YINlb6K1O6wwt03ljX3CiZm',
    'Admin', 'Demo', 'admin', TRUE, TRUE, @tenant_id, @branch_id
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@empresa-demo.com');

-- Asignar admin a la sucursal
INSERT INTO user_branch_assignments (user_id, branch_id, is_default)
SELECT u.id, @branch_id, TRUE
FROM users u
WHERE u.email = 'admin@empresa-demo.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_branch_assignments uba
    WHERE uba.user_id = u.id AND uba.branch_id = @branch_id
  );

SELECT 'Seed de desarrollo aplicado.' AS resultado;
SELECT CONCAT('Tenant ID: ', @tenant_id) AS info;
SELECT CONCAT('Branch ID: ', @branch_id) AS info;
SELECT 'Admin: admin@empresa-demo.com / admin123' AS credenciales;
