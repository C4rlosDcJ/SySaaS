const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const emailService = require('../services/emailService');

// Registro de nueva Empresa SaaS (Onboarding)
exports.registerCompany = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            company_name, slug, email, password, first_name, last_name, phone,
            plan_slug,       // slug del plan elegido (basico, pro, enterprise)
            is_trial         // true = prueba gratuita 14 dias, false = suscripcion
        } = req.body;

        if (!company_name || !email || !password || !first_name || !last_name) {
            return res.status(400).json({ message: 'Todos los campos marcados como obligatorios son requeridos.' });
        }

        // 1. Resolver slug del tenant
        const finalSlug = slug
            ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
            : company_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

        const [existingTenant] = await connection.query('SELECT id FROM tenants WHERE slug = ?', [finalSlug]);
        if (existingTenant.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El identificador de empresa (slug) ya esta en uso.' });
        }

        const [existingUser] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El correo electronico ya esta registrado.' });
        }

        // 2. Resolver plan: usar el slug enviado o el primer plan activo como default
        let planQuery;
        if (plan_slug) {
            [planQuery] = await connection.query('SELECT * FROM saas_plans WHERE slug = ? AND is_active = 1', [plan_slug]);
        }
        if (!planQuery || planQuery.length === 0) {
            [planQuery] = await connection.query('SELECT * FROM saas_plans WHERE is_active = 1 ORDER BY price_monthly ASC LIMIT 1');
        }
        if (planQuery.length === 0) {
            await connection.rollback();
            return res.status(500).json({ message: 'No hay planes de suscripcion configurados en el sistema.' });
        }
        const plan = planQuery[0];

        // 3. Determinar estado de suscripcion y fechas
        const wantsTrial = is_trial !== false; // por defecto true si no se especifica
        let subscriptionStatus = 'trial';
        let trialEndsAt = null;
        let subscriptionExpiresAt = null;

        if (wantsTrial) {
            subscriptionStatus = 'trial';
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 30); // 30 dias de prueba
            trialEndsAt = trialEnd;
        } else {
            // Sin trial: queda en trial hasta que paguen via Stripe
            // Si no hay Stripe configurado, activar directamente (modo desarrollo)
            const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
            if (!stripeConfigured) {
                subscriptionStatus = 'active';
            } else {
                subscriptionStatus = 'trial';
                const trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + 1); // 1 dia para que complete el pago
                trialEndsAt = trialEnd;
            }
        }

        // 4. Crear Tenant
        const { v4: uuidv4 } = require('uuid');
        const tenantUuid = uuidv4();
        const [tenantResult] = await connection.query(
            `INSERT INTO tenants (uuid, company_name, slug, plan_id, subscription_status, trial_ends_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [tenantUuid, company_name, finalSlug, plan.id, subscriptionStatus, trialEndsAt]
        );
        const tenantId = tenantResult.insertId;

        // 5. Crear Sucursal Principal
        const [branchResult] = await connection.query(
            `INSERT INTO branches (tenant_id, code, name, is_main, phone)
             VALUES (?, 'SUC-001', 'Matriz Principal', TRUE, ?)`,
            [tenantId, phone || null]
        );
        const branchId = branchResult.insertId;

        // 6. Crear Usuario Administrador
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.query(
            `INSERT INTO users (email, password, first_name, last_name, phone, role, tenant_id, branch_id)
             VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)`,
            [email, hashedPassword, first_name, last_name, phone || null, tenantId, branchId]
        );

        // 7. Asignar sucursal principal al admin
        await connection.query(
            `INSERT INTO user_branch_assignments (user_id, branch_id, is_default) VALUES (?, ?, TRUE)`,
            [userResult.insertId, branchId]
        );

        await connection.commit();

        // 8. Generar JWT Token
        const token = jwt.sign(
            { id: userResult.insertId, tenant_id: tenantId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // 9. Parsear features del plan para el contexto frontend
        let planFeatures = {};
        try {
            planFeatures = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {});
        } catch (e) {
            planFeatures = {};
        }

        res.status(201).json({
            message: wantsTrial
                ? `Empresa registrada con periodo de prueba de 30 dias. Bienvenido a ${plan.name}.`
                : `Empresa registrada exitosamente con el plan ${plan.name}.`,
            token,
            user: {
                id: userResult.insertId,
                email,
                first_name,
                last_name,
                role: 'admin',
                tenant_id: tenantId,
                branch_id: branchId
            },
            tenant: {
                id: tenantId,
                company_name,
                slug: finalSlug,
                plan_id: plan.id,
                plan_name: plan.name,
                plan_slug: plan.slug,
                plan_features: planFeatures,
                subscription_status: subscriptionStatus,
                trial_ends_at: trialEndsAt,
                subscription_expires_at: subscriptionExpiresAt,
                max_branches: plan.max_branches,
                max_users: plan.max_users,
                max_monthly_repairs: plan.max_monthly_repairs,
                primary_color: '#e63358',
                currency: 'MXN',
                tax_rate: 16.00
            },
            branches: [{ id: branchId, code: 'SUC-001', name: 'Matriz Principal', is_main: true }],
            default_branch_id: branchId
        });
    } catch (error) {
        await connection.rollback();
        console.error('[AUTH] Error en registro de empresa:', error);
        res.status(500).json({ message: 'Error al registrar la empresa.' });
    } finally {
        connection.release();
    }
};

// Registro de usuario cliente (multi-tenant)
exports.register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, first_name, last_name, phone, address, tenant_slug, branch_id } = req.body;

        // Verificar si el email ya existe
        const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
        }

        // Resolver tenant por slug (si se proporciona)
        let tenantId = null;
        let resolvedBranchId = branch_id || null;

        if (tenant_slug) {
            const [tenants] = await db.query('SELECT id FROM tenants WHERE slug = ?', [tenant_slug]);
            if (tenants.length === 0) {
                return res.status(400).json({ message: 'Empresa no encontrada.' });
            }
            tenantId = tenants[0].id;

            // Si no se especifica branch, usar la sucursal principal
            if (!resolvedBranchId) {
                const [mainBranch] = await db.query(
                    'SELECT id FROM branches WHERE tenant_id = ? AND is_main = TRUE LIMIT 1',
                    [tenantId]
                );
                if (mainBranch.length > 0) {
                    resolvedBranchId = mainBranch[0].id;
                }
            }
        } else {
            // No se proporcionó tenant_slug -- los clientes SIEMPRE deben registrarse
            // bajo una empresa específica. No se hace fallback al primer tenant de la BD
            // para evitar que usuarios se asignen a la empresa equivocada.
            return res.status(400).json({
                message: 'Se requiere el identificador de empresa (tenant_slug) para el registro de clientes.'
            });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario con tenant_id y branch_id
        const [result] = await db.query(
            `INSERT INTO users (email, password, first_name, last_name, phone, address, role, tenant_id, branch_id) 
             VALUES (?, ?, ?, ?, ?, ?, 'client', ?, ?)`,
            [email, hashedPassword, first_name, last_name, phone || null, address || null, tenantId, resolvedBranchId]
        );

        // Generar token
        const token = jwt.sign(
            { id: result.insertId, tenant_id: tenantId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            message: 'Usuario registrado exitosamente.',
            token,
            user: {
                id: result.insertId,
                email,
                first_name,
                last_name,
                phone,
                role: 'client',
                tenant_id: tenantId,
                branch_id: resolvedBranchId
            }
        });
    } catch (error) {
        console.error('[AUTH] Error en registro:', error);
        res.status(500).json({ message: 'Error al registrar usuario.' });
    }
};

// Inicio de sesión (multi-tenant)
exports.login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Buscar usuario (incluye datos multi-tenant)
        const [users] = await db.query(
            `SELECT id, email, password, first_name, last_name, phone, role, is_active, tenant_id, branch_id 
             FROM users WHERE email = ?`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(401).json({ message: 'Cuenta desactivada. Contacta al administrador.' });
        }

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // Generar token con tenant_id
        const token = jwt.sign(
            { id: user.id, tenant_id: user.tenant_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Obtener datos del tenant (si tiene)
        let tenant = null;
        let branches = [];
        let defaultBranchId = null;

        if (user.tenant_id) {
            const [tenants] = await db.query(
                `SELECT t.id, t.company_name, t.slug, t.logo_url, t.primary_color, t.currency, 
                        t.tax_rate, t.subscription_status, t.trial_ends_at,
                        sp.name as plan_name, sp.slug as plan_slug
                 FROM tenants t
                 JOIN saas_plans sp ON t.plan_id = sp.id
                 WHERE t.id = ?`,
                [user.tenant_id]
            );
            if (tenants.length > 0) {
                tenant = tenants[0];
            }

            // Obtener sucursales asignadas al usuario
            if (user.role === 'client') {
                // Clientes: su sucursal esta en users.branch_id
                if (user.branch_id) {
                    const [branchData] = await db.query(
                        'SELECT id, code, name, is_main FROM branches WHERE id = ? AND is_active = TRUE',
                        [user.branch_id]
                    );
                    branches = branchData;
                    defaultBranchId = user.branch_id;
                }
            } else if (['tenant_admin', 'admin', 'superadmin'].includes(user.role)) {
                // Tenant admin / Admin: acceso a todas las sucursales del tenant
                const [allBranches] = await db.query(
                    'SELECT id, code, name, is_main FROM branches WHERE tenant_id = ? AND is_active = TRUE ORDER BY is_main DESC, name',
                    [user.tenant_id]
                );
                branches = allBranches;
                // Default: sucursal principal o la primera asignada
                const [defaultAssign] = await db.query(
                    'SELECT branch_id FROM user_branch_assignments WHERE user_id = ? AND is_default = TRUE LIMIT 1',
                    [user.id]
                );
                defaultBranchId = defaultAssign.length > 0 
                    ? defaultAssign[0].branch_id 
                    : (allBranches.find(b => b.is_main)?.id || allBranches[0]?.id);
            } else {
                // Staff (technician, cashier, branch_manager): solo sucursales asignadas o sucursal base
                const [assignedBranches] = await db.query(
                    `SELECT b.id, b.code, b.name, b.is_main, uba.is_default
                     FROM branches b
                     JOIN user_branch_assignments uba ON b.id = uba.branch_id
                     WHERE uba.user_id = ? AND b.is_active = TRUE
                     ORDER BY uba.is_default DESC, b.name`,
                    [user.id]
                );
                if (assignedBranches.length > 0) {
                    branches = assignedBranches;
                    const defaultAssign = assignedBranches.find(b => b.is_default);
                    defaultBranchId = defaultAssign ? defaultAssign.id : (assignedBranches[0]?.id || null);
                } else if (user.branch_id) {
                    const [fallbackBranch] = await db.query(
                        'SELECT id, code, name, is_main FROM branches WHERE id = ? AND is_active = TRUE',
                        [user.branch_id]
                    );
                    branches = fallbackBranch;
                    defaultBranchId = user.branch_id;
                }
            }
        }

        res.json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                phone: user.phone,
                role: user.role,
                tenant_id: user.tenant_id,
                branch_id: user.branch_id,
                company_name: tenant?.company_name,
                slug: tenant?.slug
            },
            tenant,
            branches,
            default_branch_id: defaultBranchId
        });
    } catch (error) {
        console.error('[AUTH] Error en login:', error);
        res.status(500).json({ message: 'Error al iniciar sesión.' });
    }
};

// Obtener usuario actual autenticado (con tenant y sucursales)
exports.getMe = async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, email, first_name, last_name, phone, address, role, is_active, tenant_id, branch_id, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const userData = users[0];

        // Obtener datos del tenant
        let tenant = null;
        let branches = [];
        let defaultBranchId = null;

        if (userData.tenant_id) {
            const [tenants] = await db.query(
                `SELECT t.id, t.company_name, t.slug, t.logo_url, t.primary_color, t.currency, 
                        t.tax_rate, t.subscription_status, t.trial_ends_at,
                        sp.name as plan_name, sp.slug as plan_slug
                 FROM tenants t
                 JOIN saas_plans sp ON t.plan_id = sp.id
                 WHERE t.id = ?`,
                [userData.tenant_id]
            );
            if (tenants.length > 0) {
                tenant = tenants[0];
            }

            // Sucursales segun rol
            if (userData.role === 'client') {
                if (userData.branch_id) {
                    const [branchData] = await db.query(
                        'SELECT id, code, name, is_main FROM branches WHERE id = ? AND is_active = TRUE',
                        [userData.branch_id]
                    );
                    branches = branchData;
                    defaultBranchId = userData.branch_id;
                }
            } else if (['tenant_admin', 'admin', 'superadmin'].includes(userData.role)) {
                const [allBranches] = await db.query(
                    'SELECT id, code, name, is_main FROM branches WHERE tenant_id = ? AND is_active = TRUE ORDER BY is_main DESC, name',
                    [userData.tenant_id]
                );
                branches = allBranches;
                const [defaultAssign] = await db.query(
                    'SELECT branch_id FROM user_branch_assignments WHERE user_id = ? AND is_default = TRUE LIMIT 1',
                    [userData.id]
                );
                defaultBranchId = defaultAssign.length > 0
                    ? defaultAssign[0].branch_id
                    : (allBranches.find(b => b.is_main)?.id || allBranches[0]?.id);
            } else {
                const [assignedBranches] = await db.query(
                    `SELECT b.id, b.code, b.name, b.is_main, uba.is_default
                     FROM branches b
                     JOIN user_branch_assignments uba ON b.id = uba.branch_id
                     WHERE uba.user_id = ? AND b.is_active = TRUE
                     ORDER BY uba.is_default DESC, b.name`,
                    [userData.id]
                );
                if (assignedBranches.length > 0) {
                    branches = assignedBranches;
                    const defaultAssign = assignedBranches.find(b => b.is_default);
                    defaultBranchId = defaultAssign ? defaultAssign.id : (assignedBranches[0]?.id || null);
                } else if (userData.branch_id) {
                    const [fallbackBranch] = await db.query(
                        'SELECT id, code, name, is_main FROM branches WHERE id = ? AND is_active = TRUE',
                        [userData.branch_id]
                    );
                    branches = fallbackBranch;
                    defaultBranchId = userData.branch_id;
                }
            }
        }

        res.json({
            ...userData,
            tenant,
            branches,
            default_branch_id: defaultBranchId
        });
    } catch (error) {
        console.error('[AUTH] Error al obtener usuario:', error);
        res.status(500).json({ message: 'Error al obtener información del usuario.' });
    }
};

// Actualizar perfil
exports.updateProfile = async (req, res) => {
    try {
        const { first_name, last_name, phone, address } = req.body;

        await db.query(
            `UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ? WHERE id = ?`,
            [first_name, last_name, phone, address, req.user.id]
        );

        res.json({ message: 'Perfil actualizado exitosamente.' });
    } catch (error) {
        console.error('[AUTH] Error al actualizar perfil:', error);
        res.status(500).json({ message: 'Error al actualizar perfil.' });
    }
};

// Cambiar contraseña
exports.changePassword = async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        // Obtener contraseña actual
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Verificar contraseña actual
        const isValid = await bcrypt.compare(current_password, users[0].password);
        if (!isValid) {
            return res.status(400).json({ message: 'Contraseña actual incorrecta.' });
        }

        // Encriptar nueva contraseña
        const hashedPassword = await bcrypt.hash(new_password, 10);

        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

        res.json({ message: 'Contraseña actualizada exitosamente.' });
    } catch (error) {
        console.error('[AUTH] Error al cambiar contraseña:', error);
        res.status(500).json({ message: 'Error al cambiar contraseña.' });
    }
};

// Obtener técnicos y administradores (staff) -- filtrado por tenant
exports.getTechnicians = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        let query = `SELECT id, first_name, last_name, email FROM users 
                     WHERE role IN ('technician', 'tenant_admin', 'branch_manager', 'admin', 'cashier') 
                     AND is_active = TRUE`;
        const params = [];

        if (tenantId) {
            query += ' AND tenant_id = ?';
            params.push(tenantId);
        }

        query += ' ORDER BY first_name, last_name';

        const [users] = await db.query(query, params);
        res.json(users);
    } catch (error) {
        console.error('[AUTH] Error al obtener técnicos:', error);
        res.status(500).json({ message: 'Error al obtener técnicos.' });
    }
};

// Solicitar recuperación de contraseña (Olvidé mi contraseña)
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'El correo electrónico es requerido.' });
        }

        // Buscar si existe el usuario
        const [users] = await db.query(
            'SELECT id, first_name, last_name, email FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            // Retornar mensaje genérico por seguridad (evita enumeración de usuarios)
            return res.json({
                message: 'Si el correo electrónico está registrado, recibirás un enlace de recuperación pronto.'
            });
        }

        const user = users[0];

        // Generar token aleatorio
        const token = crypto.randomBytes(20).toString('hex');
        
        // Expiración: 1 hora a partir de ahora
        const expires = new Date(Date.now() + 3600000); 

        // Guardar token en BD
        await db.query(
            'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
            [token, expires, user.id]
        );

        // Enviar email
        const mailResult = await emailService.sendPasswordResetEmail(user.email, token, user);

        if (!mailResult.success) {
            console.error('[AUTH] No se pudo enviar el correo de restablecimiento:', mailResult.error);
            // Si falla el envío de correo por SMTP configurado incorrectamente, podemos retornar el token en desarrollo para facilitar las pruebas
            if (process.env.NODE_ENV === 'development') {
                return res.json({
                    message: 'Si el correo electrónico está registrado, recibirás un enlace de recuperación pronto. (Dev-Mode: Error SMTP, token devuelto en respuesta)',
                    devToken: token
                });
            }
        }

        res.json({
            message: 'Si el correo electrónico está registrado, recibirás un enlace de recuperación pronto.'
        });
    } catch (error) {
        console.error('[AUTH] Error en forgotPassword:', error);
        res.status(500).json({ message: 'Error al procesar la solicitud de recuperación.' });
    }
};

// Restablecer la contraseña
exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token y contraseña son requeridos.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        }

        // Buscar usuario con token válido y que no haya expirado (fecha de expiración mayor a la actual)
        const [users] = await db.query(
            'SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'El token de recuperación es inválido o ha expirado.' });
        }

        const user = users[0];

        // Encriptar la nueva contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Actualizar contraseña y limpiar el token
        await db.query(
            'UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        res.json({ message: 'Contraseña restablecida exitosamente.' });
    } catch (error) {
        console.error('[AUTH] Error en resetPassword:', error);
        res.status(500).json({ message: 'Error al restablecer la contraseña.' });
    }
};

// Impersonar Tenant por SuperAdmin (Soporte Técnico Asistido)
exports.impersonateTenant = async (req, res) => {
    try {
        const { tenant_id } = req.body;
        if (!tenant_id) {
            return res.status(400).json({ message: 'tenant_id es requerido para impersonar.' });
        }

        // Buscar un usuario tenant_admin o admin de esa empresa
        const [users] = await db.query(
            "SELECT id, email, first_name, last_name, role, tenant_id, branch_id FROM users WHERE tenant_id = ? AND role IN ('tenant_admin', 'admin') ORDER BY (role = 'tenant_admin') DESC, id ASC LIMIT 1",
            [tenant_id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'No se encontró un usuario administrador en esta empresa.' });
        }

        const targetUser = users[0];

        // Generar JWT temporal con el tenant_id de la empresa a la que se da soporte
        const token = jwt.sign(
            { id: targetUser.id, tenant_id: targetUser.tenant_id, is_impersonated: true },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        // Obtener datos de la empresa
        const [tenants] = await db.query(
            `SELECT t.id, t.company_name, t.slug, t.logo_url, t.primary_color, t.currency, 
                    t.tax_rate, t.subscription_status, t.trial_ends_at,
                    sp.name as plan_name, sp.slug as plan_slug
             FROM tenants t
             JOIN saas_plans sp ON t.plan_id = sp.id
             WHERE t.id = ?`,
            [tenant_id]
        );

        // Obtener sucursales de la empresa
        const [branches] = await db.query(
            'SELECT id, code, name, address, phone, email, is_main FROM branches WHERE tenant_id = ? AND is_active = TRUE',
            [tenant_id]
        );

        res.json({
            message: `Impersonación exitosa. Modos soporte activo para ${tenants[0]?.company_name}`,
            token,
            user: {
                id: targetUser.id,
                email: targetUser.email,
                first_name: `[Soporte] ${targetUser.first_name}`,
                last_name: targetUser.last_name,
                role: targetUser.role,
                tenant_id: targetUser.tenant_id,
                branch_id: targetUser.branch_id
            },
            tenant: tenants[0] || null,
            branches,
            default_branch_id: branches[0]?.id || null
        });
    } catch (error) {
        console.error('[AUTH] Error al impersonar empresa:', error);
        res.status(500).json({ message: 'Error al impersonar empresa.' });
    }
};

// Obtener usuarios/personal del tenant
exports.getTenantUsers = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const isBranchManager = req.user.role === 'branch_manager';
        const userBranchId = req.user.branch_id || req.tenantCtx.branchId;

        let query = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.is_active, u.created_at,
                    u.branch_id, b.name as branch_name
             FROM users u
             LEFT JOIN branches b ON u.branch_id = b.id
             WHERE u.tenant_id = ? AND u.role != 'client'
        `;
        const params = [tenantId];

        // Si es gerente de sucursal, ver los miembros de su sede
        if (isBranchManager && userBranchId) {
            query += ' AND (u.branch_id = ? OR u.id = ?)';
            params.push(userBranchId, req.user.id);
        }

        query += ' ORDER BY u.created_at DESC';

        const [users] = await db.query(query, params);

        res.json(users);
    } catch (error) {
        console.error('[AUTH] Error al obtener usuarios del tenant:', error);
        res.status(500).json({ message: 'Error al obtener usuarios de la empresa.' });
    }
};

// Crear usuario de personal (Admin de Empresa o Gerente de Sucursal)
exports.createTenantUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, first_name, last_name, phone, role, branch_id } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const isBranchManager = req.user.role === 'branch_manager';
        const managerBranchId = req.user.branch_id || req.tenantCtx.branchId;

        // Validar permisos de rol según el rango de quien crea
        if (isBranchManager) {
            // Un gerente SOLO puede crear roles con menor rango que él
            const allowedForManager = ['technician', 'salesperson', 'cashier'];
            if (!allowedForManager.includes(role)) {
                return res.status(403).json({ 
                    message: 'No tienes permisos para asignar este rol. Como Gerente solo puedes crear Técnicos, Vendedores o Cajeros.' 
                });
            }
        }

        const allowedRoles = ['technician', 'salesperson', 'cashier', 'branch_manager', 'tenant_admin', 'admin'];
        let finalRole = allowedRoles.includes(role) ? role : 'technician';
        if (finalRole === 'admin') finalRole = 'tenant_admin';

        // Verificar si el email ya existe en el sistema
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
        }

        // Determinar la sucursal de asignación (si es gerente, forzar su sucursal)
        let targetBranchId = isBranchManager ? managerBranchId : (branch_id || req.tenantCtx.branchId);
        if (!targetBranchId) {
            const [mainBranch] = await db.query('SELECT id FROM branches WHERE tenant_id = ? AND is_main = TRUE LIMIT 1', [tenantId]);
            if (mainBranch.length > 0) {
                targetBranchId = mainBranch[0].id;
            }
        }

        // Hash de contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario
        const [result] = await db.query(
            `INSERT INTO users (tenant_id, branch_id, email, password, first_name, last_name, phone, role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [tenantId, targetBranchId || null, email, hashedPassword, first_name, last_name, phone || null, finalRole]
        );

        res.status(201).json({
            message: 'Usuario de personal creado exitosamente.',
            user: {
                id: result.insertId,
                email,
                first_name,
                last_name,
                role: finalRole,
                branch_id: targetBranchId
            }
        });
    } catch (error) {
        console.error('[AUTH] Error al crear usuario de personal:', error);
        res.status(500).json({ message: 'Error al crear el usuario.' });
    }
};

// Actualizar usuario de personal
exports.updateTenantUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, phone, role, branch_id, password, is_active } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const isBranchManager = req.user.role === 'branch_manager';
        const managerBranchId = req.user.branch_id || req.tenantCtx.branchId;

        // Verificar que el usuario pertenezca al tenant y no sea cliente
        const [users] = await db.query(
            'SELECT id, role, branch_id FROM users WHERE id = ? AND tenant_id = ? AND role != "client"',
            [id, tenantId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado o no pertenece a tu empresa.' });
        }

        const targetUser = users[0];

        if (isBranchManager) {
            // Un gerente no puede modificar administradores ni a otros gerentes
            const higherRoles = ['tenant_admin', 'admin', 'superadmin', 'branch_manager'];
            if (higherRoles.includes(targetUser.role) && targetUser.id !== req.user.id) {
                return res.status(403).json({ 
                    message: 'No tienes permisos para modificar a administradores o gerentes de sucursal.' 
                });
            }

            // No puede asignar roles iguales o superiores
            if (role && !['technician', 'salesperson', 'cashier'].includes(role)) {
                return res.status(403).json({ 
                    message: 'No tienes permisos para asignar este rol. Solo puedes gestionar Técnicos, Vendedores o Cajeros.' 
                });
            }
        }

        const allowedRoles = ['technician', 'salesperson', 'cashier', 'branch_manager', 'tenant_admin', 'admin'];
        let finalRole = allowedRoles.includes(role) ? role : null;
        if (finalRole === 'admin') finalRole = 'tenant_admin';

        const updates = [];
        const params = [];

        if (first_name !== undefined) { updates.push('first_name = ?'); params.push(first_name); }
        if (last_name !== undefined) { updates.push('last_name = ?'); params.push(last_name); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
        
        if (finalRole && !isBranchManager) { 
            updates.push('role = ?'); 
            params.push(finalRole); 
        } else if (finalRole && isBranchManager && ['technician', 'salesperson', 'cashier'].includes(finalRole)) { 
            updates.push('role = ?'); 
            params.push(finalRole); 
        }
        
        if (branch_id !== undefined && !isBranchManager) { 
            updates.push('branch_id = ?'); 
            params.push(branch_id || null); 
        } else if (isBranchManager) {
            updates.push('branch_id = ?');
            params.push(managerBranchId);
        }

        if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

        if (password && password.trim().length >= 6) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password = ?');
            params.push(hashedPassword);
        }

        if (updates.length > 0) {
            params.push(id, tenantId);
            await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
        }

        res.json({ message: 'Usuario actualizado exitosamente.' });
    } catch (error) {
        console.error('[AUTH] Error al actualizar usuario de personal:', error);
        res.status(500).json({ message: 'Error al actualizar usuario.' });
    }
};

// Cambiar estado activo/inactivo del usuario
exports.toggleTenantUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;
        const isBranchManager = req.user.role === 'branch_manager';

        const [users] = await db.query(
            'SELECT id, role, is_active FROM users WHERE id = ? AND tenant_id = ? AND role != "client"',
            [id, tenantId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const targetUser = users[0];

        if (isBranchManager) {
            const higherRoles = ['tenant_admin', 'admin', 'superadmin', 'branch_manager'];
            if (higherRoles.includes(targetUser.role)) {
                return res.status(403).json({ 
                    message: 'No tienes permisos para desactivar o activar a administradores o gerentes.' 
                });
            }
        }

        const newStatus = !targetUser.is_active;
        await db.query('UPDATE users SET is_active = ? WHERE id = ? AND tenant_id = ?', [newStatus, id, tenantId]);

        res.json({ message: `Estado del usuario cambiado a ${newStatus ? 'activo' : 'inactivo'}.` });
    } catch (error) {
        console.error('[AUTH] Error al cambiar estado de usuario:', error);
        res.status(500).json({ message: 'Error al cambiar estado del usuario.' });
    }
};
