const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// =====================================================
// SuperAdmin Endpoints
// =====================================================

// Listar todos los tenants/empresas
exports.getTenants = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT t.*, sp.name as plan_name, sp.slug as plan_slug
            FROM tenants t
            JOIN saas_plans sp ON t.plan_id = sp.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND t.subscription_status = ?';
            params.push(status);
        }

        query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [tenants] = await db.query(query, params);

        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM tenants';
        const countParams = [];
        if (status) {
            countQuery += ' WHERE subscription_status = ?';
            countParams.push(status);
        }
        const [countResult] = await db.query(countQuery, countParams);

        res.json({
            tenants,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('[TENANTS] Error al obtener empresas:', error);
        res.status(500).json({ message: 'Error al obtener empresas.' });
    }
};

// Crear nueva empresa (onboarding manual o por SuperAdmin)
exports.createTenant = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { company_name, slug, tax_id, plan_id, admin_email, admin_password, admin_first_name, admin_last_name } = req.body;

        if (!company_name || !slug || !plan_id || !admin_email || !admin_password || !admin_first_name || !admin_last_name) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
        }

        // 1. Validar duplicados de slug de tenant
        const [existingTenant] = await connection.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
        if (existingTenant.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El identificador (slug) ya está en uso.' });
        }

        // 2. Validar duplicados de correo
        const [existingUser] = await connection.query('SELECT id FROM users WHERE email = ?', [admin_email]);
        if (existingUser.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
        }

        // 3. Obtener plan
        const [plans] = await connection.query('SELECT id FROM saas_plans WHERE id = ?', [plan_id]);
        if (plans.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Plan de suscripción inválido.' });
        }

        // 4. Crear Tenant
        const tenantUuid = uuidv4();
        const trialDays = 14;
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

        const [tenantResult] = await connection.query(`
            INSERT INTO tenants (uuid, company_name, slug, tax_id, plan_id, subscription_status, trial_ends_at)
            VALUES (?, ?, ?, ?, ?, 'trial', ?)
        `, [tenantUuid, company_name, slug, tax_id || null, plan_id, trialEndsAt]);

        const newTenantId = tenantResult.insertId;

        // 5. Crear Sucursal Matriz (default)
        const [branchResult] = await connection.query(`
            INSERT INTO branches (tenant_id, code, name, is_main, is_active)
            VALUES (?, 'SUC-001', 'Sucursal Matriz', TRUE, TRUE)
        `, [newTenantId]);

        const newBranchId = branchResult.insertId;

        // 6. Crear Usuario Administrador de Empresa
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(admin_password, 10);

        const [userResult] = await connection.query(`
            INSERT INTO users (tenant_id, branch_id, email, password, first_name, last_name, role, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 'tenant_admin', TRUE)
        `, [newTenantId, newBranchId, admin_email, hashedPassword, admin_first_name, admin_last_name]);

        const newUserId = userResult.insertId;

        // 7. Asignar usuario a sucursal
        await connection.query(`
            INSERT INTO user_branch_assignments (user_id, branch_id, is_default)
            VALUES (?, ?, TRUE)
        `, [newUserId, newBranchId]);

        // 8. Crear configuraciones iniciales por defecto para el tenant
        const defaultSettings = [
            { key: 'business_name', value: company_name },
            { key: 'default_warranty_days', value: '30' }
        ];

        for (const setting of defaultSettings) {
            await connection.query(
                'INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES (?, ?, ?)',
                [newTenantId, setting.key, setting.value]
            );
        }

        await connection.commit();

        res.status(201).json({
            message: 'Empresa y usuario administrador creados exitosamente.',
            tenant_id: newTenantId,
            tenant_uuid: tenantUuid
        });
    } catch (error) {
        await connection.rollback();
        console.error('[TENANTS] Error al crear empresa:', error);
        res.status(500).json({ message: 'Error al registrar empresa.' });
    } finally {
        connection.release();
    }
};

// Obtener detalle de una empresa
exports.getTenantById = async (req, res) => {
    try {
        const { id } = req.params;
        const [tenants] = await db.query(`
            SELECT t.*, sp.name as plan_name, sp.slug as plan_slug
            FROM tenants t
            JOIN saas_plans sp ON t.plan_id = sp.id
            WHERE t.id = ?
        `, [id]);

        if (tenants.length === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }
        res.json(tenants[0]);
    } catch (error) {
        console.error('[TENANTS] Error al obtener detalle de empresa:', error);
        res.status(500).json({ message: 'Error al obtener empresa.' });
    }
};

// Actualizar empresa por SuperAdmin
exports.updateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { company_name, slug, tax_id, plan_id, subscription_status, subscription_expires_at } = req.body;

        const [result] = await db.query(`
            UPDATE tenants SET
                company_name = COALESCE(?, company_name),
                slug = COALESCE(?, slug),
                tax_id = COALESCE(?, tax_id),
                plan_id = COALESCE(?, plan_id),
                subscription_status = COALESCE(?, subscription_status),
                subscription_expires_at = COALESCE(?, subscription_expires_at)
            WHERE id = ?
        `, [company_name, slug, tax_id, plan_id, subscription_status, subscription_expires_at, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }

        res.json({ message: 'Empresa actualizada exitosamente.' });
    } catch (error) {
        console.error('[TENANTS] Error al actualizar empresa:', error);
        res.status(500).json({ message: 'Error al actualizar empresa.' });
    }
};

// Suspender empresa
exports.suspendTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            'UPDATE tenants SET subscription_status = "suspended" WHERE id = ?',
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }
        res.json({ message: 'Empresa suspendida exitosamente.' });
    } catch (error) {
        console.error('[TENANTS] Error al suspender empresa:', error);
        res.status(500).json({ message: 'Error al suspender empresa.' });
    }
};

// Reactivar empresa
exports.activateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            'UPDATE tenants SET subscription_status = "active" WHERE id = ?',
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }
        res.json({ message: 'Empresa reactivada exitosamente.' });
    } catch (error) {
        console.error('[TENANTS] Error al reactivar empresa:', error);
        res.status(500).json({ message: 'Error al reactivar empresa.' });
    }
};

// =====================================================
// Tenant Admin (Tenant Scoped) Endpoints
// =====================================================

// Obtener datos de la empresa actual
exports.getMyTenant = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const [tenants] = await db.query(`
            SELECT t.*, sp.name as plan_name, sp.slug as plan_slug
            FROM tenants t
            JOIN saas_plans sp ON t.plan_id = sp.id
            WHERE t.id = ?
        `, [tenantId]);

        if (tenants.length === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }
        res.json(tenants[0]);
    } catch (error) {
        console.error('[TENANTS] Error al obtener mi empresa:', error);
        res.status(500).json({ message: 'Error al obtener datos de la empresa.' });
    }
};

// Actualizar datos de mi empresa (Tenant Settings)
exports.updateMyTenant = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const { company_name, logo_url, primary_color, timezone, currency, tax_rate } = req.body;

        await db.query(`
            UPDATE tenants SET
                company_name = COALESCE(?, company_name),
                logo_url = COALESCE(?, logo_url),
                primary_color = COALESCE(?, primary_color),
                timezone = COALESCE(?, timezone),
                currency = COALESCE(?, currency),
                tax_rate = COALESCE(?, tax_rate)
            WHERE id = ?
        `, [company_name, logo_url, primary_color, timezone, currency, tax_rate, tenantId]);

        res.json({ message: 'Datos de la empresa actualizados correctamente.' });
    } catch (error) {
        console.error('[TENANTS] Error al actualizar mi empresa:', error);
        res.status(500).json({ message: 'Error al actualizar datos de la empresa.' });
    }
};
