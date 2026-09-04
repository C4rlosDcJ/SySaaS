const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function cleanTestData() {
    console.log('===========================================================');
    console.log('   SySaaS - Script de Limpieza de Datos de Prueba');
    console.log('===========================================================');

    const connection = await pool.getConnection();

    try {
        console.log('[CLEANUP] Iniciando proceso de limpieza...');

        // 1. Desactivar validacion de llaves foraneas temporalmente
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        const tablesToTruncate = [
            'sale_items',
            'sales',
            'order_items',
            'orders',
            'purchase_order_items',
            'purchase_orders',
            'branch_inventory',
            'inventory_transfer_items',
            'inventory_transfers',
            'stock_movements',
            'products',
            'product_categories',
            'repair_images',
            'repair_status_history',
            'repair_notes',
            'repairs',
            'quote_images',
            'quotes',
            'coupons',
            'suppliers',
            'services_catalog',
            'subscription_payments',
            'system_broadcasts',
            'activity_logs',
            'user_branch_assignments',
            'branches',
            'tenants'
        ];

        for (const table of tablesToTruncate) {
            process.stdout.write(`[CLEANUP] Vaciando tabla ${table}... `);
            await connection.query(`TRUNCATE TABLE \`${table}\``);
            console.log('OK');
        }

        // 2. Limpiar configuraciones pertenecientes a tenants
        console.log('[CLEANUP] Eliminando configuraciones de tenants...');
        await connection.query('DELETE FROM settings WHERE tenant_id IS NOT NULL');

        // 3. Normalizar configuraciones globales
        console.log('[CLEANUP] Normalizando configuraciones globales del sistema...');
        await connection.query("UPDATE settings SET setting_value = 'SySaaS' WHERE setting_key = 'platform_name' AND tenant_id IS NULL");
        await connection.query("UPDATE settings SET setting_value = 'soporte@sysaas.com' WHERE setting_key = 'support_email' AND tenant_id IS NULL");
        await connection.query("UPDATE settings SET setting_value = NULL WHERE setting_key = 'platform_logo' AND tenant_id IS NULL");

        // 4. Eliminar usuarios excepto el superadmin
        console.log('[CLEANUP] Eliminando usuarios de prueba...');
        await connection.query("DELETE FROM users WHERE role != 'superadmin'");

        // 5. Normalizar cuenta superadmin
        console.log('[CLEANUP] Verificando cuenta SuperAdmin...');
        const [superadminRows] = await connection.query("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1");
        if (superadminRows.length > 0) {
            await connection.query(`
                UPDATE users
                SET tenant_id = NULL,
                    branch_id = NULL,
                    email = 'superadmin@sysaas.com'
                WHERE role = 'superadmin'
            `);
            console.log('[CLEANUP] Cuenta SuperAdmin desvinculada de tenants y actualizada a superadmin@sysaas.com');
        } else {
            const defaultPassHash = '$2a$10$5HjXkF/XpIdTcLEzlKG8ZeSVY33xY.YINlb6K1O6wwt03ljX3CiZm'; // admin123
            await connection.query(`
                INSERT INTO users (email, password, first_name, last_name, role, is_active, email_verified, tenant_id, branch_id)
                VALUES ('superadmin@sysaas.com', ?, 'Super', 'Admin', 'superadmin', TRUE, TRUE, NULL, NULL)
            `, [defaultPassHash]);
            console.log('[CLEANUP] SuperAdmin creado (superadmin@sysaas.com / admin123)');
        }

        // 6. Reiniciar AUTO_INCREMENT en tablas principales
        const autoIncrementTables = [
            'tenants',
            'branches',
            'repairs',
            'sales',
            'products',
            'product_categories',
            'services_catalog',
            'suppliers',
            'purchase_orders',
            'activity_logs',
            'system_broadcasts'
        ];

        for (const table of autoIncrementTables) {
            await connection.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
        }

        // 7. Reactivar validacion de llaves foraneas
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

        // 8. Limpiar archivos subidos en backend/uploads (conservar .gitkeep)
        const uploadsDir = path.join(__dirname, '../uploads');
        if (fs.existsSync(uploadsDir)) {
            console.log('[CLEANUP] Limpiando archivos de prueba en backend/uploads...');
            const files = fs.readdirSync(uploadsDir);
            let deletedFiles = 0;
            for (const file of files) {
                if (file !== '.gitkeep') {
                    const filePath = path.join(uploadsDir, file);
                    if (fs.statSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                        deletedFiles++;
                    }
                }
            }
            console.log(`[CLEANUP] Archivos eliminados de uploads: ${deletedFiles}`);
        }

        console.log('===========================================================');
        console.log('   PROCESO COMPLETADO EXITOSAMENTE');
        console.log('   Base de datos limpia y lista para produccion.');
        console.log('   Acceso SuperAdmin: superadmin@sysaas.com');
        console.log('===========================================================');

    } catch (error) {
        console.error('[CLEANUP ERROR] Ocurrio un error durante la limpieza:', error);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

cleanTestData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
