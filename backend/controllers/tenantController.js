const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { sendSubscriptionReminder } = require('../services/emailService');

const getStripe = () => {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

function getStripeSubscriptionDetails(sub) {
    if (!sub) return { periodEnd: null, interval: 'monthly' };
    let periodEnd = null;
    let interval = 'monthly';
    if (sub.current_period_end && typeof sub.current_period_end === 'number') {
        periodEnd = new Date(sub.current_period_end * 1000);
    }
    if (sub.items && Array.isArray(sub.items.data) && sub.items.data.length > 0) {
        const item = sub.items.data[0];
        if (!periodEnd && item.current_period_end && typeof item.current_period_end === 'number') {
            periodEnd = new Date(item.current_period_end * 1000);
        }
        const recurring = item.price?.recurring || item.plan;
        if (recurring && recurring.interval === 'year') {
            interval = 'yearly';
        } else if (recurring && recurring.interval === 'month') {
            interval = 'monthly';
        }
    }
    if (sub.plan && sub.plan.interval === 'year') interval = 'yearly';
    if (sub.metadata && sub.metadata.billing_cycle) interval = sub.metadata.billing_cycle;
    return { periodEnd, interval };
}

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
                `INSERT INTO settings (tenant_id, setting_key, setting_value) 
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
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
        const { billing_cycle = 'monthly' } = req.body || {};
        const days = billing_cycle === 'yearly' ? 365 : 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        const [result] = await db.query(
            'UPDATE tenants SET subscription_status = "active", subscription_expires_at = COALESCE(subscription_expires_at, ?), billing_cycle = ?, trial_ends_at = NULL WHERE id = ?',
            [expiresAt, billing_cycle, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }
        res.json({ message: 'Empresa activada exitosamente con suscripción vigente.' });
    } catch (error) {
        console.error('[TENANTS] Error al reactivar empresa:', error);
        res.status(500).json({ message: 'Error al reactivar empresa.' });
    }
};

// Cambiar plan de una empresa
exports.changeTenantPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan_id, activate_subscription = true, billing_cycle = 'monthly' } = req.body;

        if (!plan_id) {
            return res.status(400).json({ message: 'plan_id es requerido.' });
        }

        // Verificar que el plan exista
        const [plans] = await db.query('SELECT id, name FROM saas_plans WHERE id = ?', [plan_id]);
        if (plans.length === 0) {
            return res.status(404).json({ message: 'Plan no encontrado.' });
        }

        if (activate_subscription) {
            const days = billing_cycle === 'yearly' ? 365 : 30;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + days);
            await db.query(
                `UPDATE tenants 
                 SET plan_id = ?, 
                     subscription_status = 'active', 
                     subscription_expires_at = ?, 
                     billing_cycle = ?,
                     trial_ends_at = NULL 
                 WHERE id = ?`,
                [plan_id, expiresAt, billing_cycle, id]
            );
        } else {
            await db.query('UPDATE tenants SET plan_id = ? WHERE id = ?', [plan_id, id]);
        }

        res.json({ message: `Plan actualizado a "${plans[0].name}" y suscripción activada exitosamente.` });
    } catch (error) {
        console.error('[TENANTS] Error al cambiar plan:', error);
        res.status(500).json({ message: 'Error al cambiar plan de empresa.' });
    }
};

// Listar todos los usuarios de la plataforma (Global)
exports.getGlobalUsers = async (req, res) => {
    try {
        const { role, tenant_id, status, search, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
                   u.is_active, u.tenant_id, u.branch_id, u.created_at,
                   t.company_name, b.name as branch_name
            FROM users u
            LEFT JOIN tenants t ON u.tenant_id = t.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (role) {
            query += ' AND u.role = ?';
            params.push(role);
        }
        if (tenant_id) {
            query += ' AND u.tenant_id = ?';
            params.push(parseInt(tenant_id));
        }
        if (status === 'active') {
            query += ' AND u.is_active = 1';
        } else if (status === 'inactive') {
            query += ' AND u.is_active = 0';
        }
        if (search) {
            query += ' AND (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR t.company_name LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        // No mostrar superadmin en la lista
        query += ' AND u.role != "superadmin"';

        query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [users] = await db.query(query, params);

        res.json(users);
    } catch (error) {
        console.error('[SUPER_USERS] Error al obtener usuarios globales:', error);
        res.status(500).json({ message: 'Error al obtener usuarios.' });
    }
};

// Activar/desactivar un usuario global
exports.toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;

        // No permitir desactivar superadmins
        const [users] = await db.query('SELECT role, is_active, email FROM users WHERE id = ?', [id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        if (users[0].role === 'superadmin') {
            return res.status(403).json({ message: 'No se puede modificar un SuperAdmin.' });
        }

        const newStatus = users[0].is_active ? 0 : 1;
        await db.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id]);

        res.json({
            message: newStatus ? 'Usuario activado exitosamente.' : 'Usuario desactivado exitosamente.',
            is_active: !!newStatus
        });
    } catch (error) {
        console.error('[SUPER_USERS] Error al cambiar estado de usuario:', error);
        res.status(500).json({ message: 'Error al cambiar estado del usuario.' });
    }
};

// Resetear contraseña de un usuario (SuperAdmin)
exports.resetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const [users] = await db.query('SELECT role, email FROM users WHERE id = ?', [id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        if (users[0].role === 'superadmin') {
            return res.status(403).json({ message: 'No se puede resetear la contraseña de un SuperAdmin desde aquí.' });
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);

        res.json({ message: `Contraseña de ${users[0].email} restablecida exitosamente.` });
    } catch (error) {
        console.error('[SUPER_USERS] Error al resetear contraseña:', error);
        res.status(500).json({ message: 'Error al resetear contraseña.' });
    }
};


// =====================================================
// Gestión de Planes SaaS (SuperAdmin)
// =====================================================
exports.getPlans = async (req, res) => {
    try {
        const [plans] = await db.query('SELECT * FROM saas_plans ORDER BY price_monthly ASC');
        res.json(plans);
    } catch (error) {
        console.error('[PLANS] Error al obtener planes:', error);
        res.status(500).json({ message: 'Error al obtener planes SaaS.' });
    }
};

exports.createPlan = async (req, res) => {
    try {
        const { name, slug, price_monthly, price_yearly, max_branches, max_users, max_monthly_repairs, features } = req.body;
        if (!name || !slug) {
            return res.status(400).json({ message: 'El nombre y el slug del plan son obligatorios.' });
        }

        const [result] = await db.query(
            `INSERT INTO saas_plans (name, slug, price_monthly, price_yearly, max_branches, max_users, max_monthly_repairs, features)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, slug, price_monthly || 0, price_yearly || 0, max_branches || 1, max_users || 3, max_monthly_repairs || null, JSON.stringify(features || {})]
        );

        res.status(201).json({ id: result.insertId, message: 'Plan SaaS creado exitosamente.' });
    } catch (error) {
        console.error('[PLANS] Error al crear plan:', error);
        res.status(500).json({ message: 'Error al crear plan.' });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price_monthly, price_yearly, max_branches, max_users, max_monthly_repairs, features, is_active } = req.body;

        await db.query(
            `UPDATE saas_plans SET
                name = COALESCE(?, name),
                price_monthly = COALESCE(?, price_monthly),
                price_yearly = COALESCE(?, price_yearly),
                max_branches = COALESCE(?, max_branches),
                max_users = COALESCE(?, max_users),
                max_monthly_repairs = COALESCE(?, max_monthly_repairs),
                features = COALESCE(?, features),
                is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [name, price_monthly, price_yearly, max_branches, max_users, max_monthly_repairs, features ? JSON.stringify(features) : null, is_active, id]
        );

        res.json({ message: 'Plan SaaS actualizado exitosamente.' });
    } catch (error) {
        console.error('[PLANS] Error al actualizar plan:', error);
        res.status(500).json({ message: 'Error al actualizar plan.' });
    }
};

// =====================================================
// Tenant Admin (Tenant Scoped) Endpoints
// =====================================================

// Obtener datos de la empresa actual con consumo de cuotas y planes
exports.getMyTenant = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const [tenants] = await db.query(`
            SELECT 
                t.*, 
                sp.name as plan_name, 
                sp.slug as plan_slug,
                sp.price_monthly,
                sp.price_yearly,
                sp.max_branches,
                sp.max_users,
                sp.max_monthly_repairs,
                sp.features as plan_features,
                (SELECT COUNT(*) FROM branches WHERE tenant_id = t.id AND is_active = 1) as used_branches,
                (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND role != 'client' AND is_active = 1) as used_users,
                (SELECT COUNT(*) FROM repairs WHERE tenant_id = t.id AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())) as used_repairs_month,
                (SELECT COUNT(*) FROM sales WHERE tenant_id = t.id AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())) as used_sales_month
            FROM tenants t
            JOIN saas_plans sp ON t.plan_id = sp.id
            WHERE t.id = ?
        `, [tenantId]);

        if (tenants.length === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }

        const [availablePlans] = await db.query(
            'SELECT * FROM saas_plans WHERE is_active = 1 ORDER BY price_monthly ASC'
        );

        const tenantData = tenants[0];
        
        // Parsear features de JSON si es string
        let parsedFeatures = {};
        try {
            parsedFeatures = typeof tenantData.plan_features === 'string'
                ? JSON.parse(tenantData.plan_features)
                : (tenantData.plan_features || {});
        } catch (e) {
            parsedFeatures = {};
        }

        const formattedPlans = availablePlans.map(p => {
            let pFeatures = {};
            try {
                pFeatures = typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || {});
            } catch (e) {
                pFeatures = {};
            }
            return {
                ...p,
                price_monthly: parseFloat(p.price_monthly || 0),
                price_yearly: parseFloat(p.price_yearly || 0),
                features: pFeatures
            };
        });

        // Sincronizar automáticamente con Stripe si tiene suscripción activa vinculada
        if (tenantData.stripe_subscription_id && tenantData.subscription_status === 'active') {
            const currentExp = tenantData.subscription_expires_at ? new Date(tenantData.subscription_expires_at) : null;
            const now = new Date();
            const daysRemaining = currentExp ? Math.ceil((currentExp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

            // Sincronizar si no tiene fecha, o si dice menos de 45 días pero tiene ciclo yearly o pagos anuales
            if (!currentExp || (daysRemaining <= 45 && tenantData.billing_cycle === 'yearly')) {
                try {
                    const stripe = getStripe();
                    if (stripe) {
                        const sub = await stripe.subscriptions.retrieve(tenantData.stripe_subscription_id);
                        const details = getStripeSubscriptionDetails(sub);
                        if (details.periodEnd && !isNaN(details.periodEnd.getTime())) {
                            tenantData.subscription_expires_at = details.periodEnd;
                            tenantData.billing_cycle = details.interval || tenantData.billing_cycle;
                            const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id || null);
                            await db.query(
                                'UPDATE tenants SET subscription_expires_at = ?, billing_cycle = ?, stripe_customer_id = COALESCE(?, stripe_customer_id) WHERE id = ?',
                                [details.periodEnd, tenantData.billing_cycle, customerId, tenantId]
                            );
                        }
                    }
                } catch (stripeErr) {
                    console.warn('[TENANT] Aviso al sincronizar suscripcion con Stripe:', stripeErr.message);
                }
            }
        }

        // Asegurar que suscripción activa tenga fecha de expiración calculada si era null
        if (tenantData.subscription_status === 'active' && !tenantData.subscription_expires_at) {
            const autoExp = new Date();
            const daysToAdd = tenantData.billing_cycle === 'yearly' ? 365 : 30;
            autoExp.setDate(autoExp.getDate() + daysToAdd);
            tenantData.subscription_expires_at = autoExp;
            await db.query('UPDATE tenants SET subscription_expires_at = ? WHERE id = ?', [autoExp, tenantId]);
        }

        // Calcular tiempo restante exacto (meses y días)
        let timeRemaining = null;
        const targetExpiration = tenantData.subscription_status === 'trial'
            ? tenantData.trial_ends_at
            : tenantData.subscription_expires_at;

        if (targetExpiration) {
            const expDate = new Date(targetExpiration);
            const now = new Date();
            const diffMs = expDate.getTime() - now.getTime();

            if (diffMs <= 0) {
                timeRemaining = {
                    expired: true,
                    total_days: 0,
                    months: 0,
                    days: 0,
                    text: 'Vencida',
                    is_urgent: true
                };
            } else {
                const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                if (totalDays > 30) {
                    const months = Math.floor(totalDays / 30);
                    const remainderDays = totalDays % 30;
                    const text = remainderDays > 0
                        ? `${months} ${months === 1 ? 'mes' : 'meses'} y ${remainderDays} ${remainderDays === 1 ? 'día' : 'días'} restantes`
                        : `${months} ${months === 1 ? 'mes' : 'meses'} restantes`;
                    timeRemaining = {
                        expired: false,
                        total_days: totalDays,
                        months,
                        days: remainderDays,
                        text,
                        is_urgent: false
                    };
                } else {
                    timeRemaining = {
                        expired: false,
                        total_days: totalDays,
                        months: 0,
                        days: totalDays,
                        text: totalDays === 1 ? '1 día restante' : `${totalDays} días restantes`,
                        is_urgent: totalDays <= 7
                    };
                }
            }

            // Si está por vencer (<= 7 días) y no ha vencido aún, enviar notificación por email (máx 1 por día)
            if (timeRemaining && !timeRemaining.expired && timeRemaining.is_urgent) {
                try {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const [lastAlert] = await db.query(
                        "SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = 'last_expiration_alert_date'",
                        [tenantId]
                    );

                    if (lastAlert.length === 0 || lastAlert[0].setting_value !== todayStr) {
                        await db.query(
                            "INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES (?, 'last_expiration_alert_date', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
                            [tenantId, todayStr, todayStr]
                        );

                        const [adminUsers] = await db.query(
                            "SELECT email FROM users WHERE tenant_id = ? AND role IN ('tenant_admin', 'admin') AND is_active = 1 LIMIT 1",
                            [tenantId]
                        );

                        if (adminUsers.length > 0 && adminUsers[0].email) {
                            sendSubscriptionReminder(adminUsers[0].email, tenantData, timeRemaining.total_days).catch(err => {
                                console.warn('[TENANTS] Fallo al enviar email de recordatorio:', err.message);
                            });
                        }
                    }
                } catch (alertErr) {
                    console.warn('[TENANTS] Advertencia en envio de alerta de vencimiento:', alertErr.message);
                }
            }
        }

        res.json({
            ...tenantData,
            price_monthly: parseFloat(tenantData.price_monthly || 0),
            price_yearly: parseFloat(tenantData.price_yearly || 0),
            used_branches: parseInt(tenantData.used_branches || 0, 10),
            used_users: parseInt(tenantData.used_users || 0, 10),
            used_repairs_month: parseInt(tenantData.used_repairs_month || 0, 10),
            used_sales_month: parseInt(tenantData.used_sales_month || 0, 10),
            time_remaining: timeRemaining,
            plan_features: parsedFeatures,
            available_plans: formattedPlans
        });
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

// Extender días de prueba (Trial) de una empresa por el SuperAdmin
exports.extendTrial = async (req, res) => {
    try {
        const { id } = req.params;
        const { days = 15 } = req.body;

        const [tenants] = await db.query('SELECT trial_ends_at FROM tenants WHERE id = ?', [id]);
        if (tenants.length === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }

        const currentTrialEnd = tenants[0].trial_ends_at ? new Date(tenants[0].trial_ends_at) : new Date();
        const baseDate = currentTrialEnd > new Date() ? currentTrialEnd : new Date();
        baseDate.setDate(baseDate.getDate() + parseInt(days));

        await db.query(
            "UPDATE tenants SET trial_ends_at = ?, subscription_status = 'trial' WHERE id = ?",
            [baseDate, id]
        );

        res.json({
            message: `Periodo de prueba extendido ${days} días exitosamente.`,
            new_trial_ends_at: baseDate
        });
    } catch (error) {
        console.error('[TENANTS] Error al extender trial:', error);
        res.status(500).json({ message: 'Error al extender periodo de prueba.' });
    }
};

// Métricas Financieras y Analítica Global de la Plataforma SaaS (SuperAdmin)
exports.getGlobalAnalytics = async (req, res) => {
    try {
        // Cálculo de MRR (Monthly Recurring Revenue) basado en empresas activas y precios de planes
        const [mrrRows] = await db.query(`
            SELECT 
                SUM(sp.price_monthly) as mrr,
                COUNT(t.id) as active_subscriptions
            FROM tenants t
            JOIN saas_plans sp ON t.plan_id = sp.id
            WHERE t.subscription_status = 'active'
        `);

        // Distribución por plan
        const [planDist] = await db.query(`
            SELECT sp.name, COUNT(t.id) as count
            FROM saas_plans sp
            LEFT JOIN tenants t ON t.plan_id = sp.id
            GROUP BY sp.id, sp.name
        `);

        // Total de reparaciones e inventario global en la plataforma
        const [platformUsage] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM repairs) as total_repairs,
                (SELECT COUNT(*) FROM users WHERE role != 'superadmin') as total_users,
                (SELECT COUNT(*) FROM branches) as total_branches,
                (SELECT COUNT(*) FROM sales) as total_sales
        `);

        const mrr = parseFloat(mrrRows[0]?.mrr || 999);

        res.json({
            mrr,
            arr: mrr * 12,
            active_subscriptions: parseInt(mrrRows[0]?.active_subscriptions || 1, 10),
            plan_distribution: planDist.map(p => ({ name: p.name, count: parseInt(p.count || 0, 10) })),
            platform_usage: {
                total_repairs: parseInt(platformUsage[0]?.total_repairs || 0, 10),
                total_users: parseInt(platformUsage[0]?.total_users || 0, 10),
                total_branches: parseInt(platformUsage[0]?.total_branches || 0, 10),
                total_sales: parseInt(platformUsage[0]?.total_sales || 0, 10)
            }
        });
    } catch (error) {
        console.error('[TENANTS] Error al obtener analítica global:', error);
        res.status(500).json({ message: 'Error al calcular métricas de plataforma.' });
    }
};
