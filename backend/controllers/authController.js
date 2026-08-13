const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const emailService = require('../services/emailService');

// Registro de usuario (multi-tenant)
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
            // Fallback: si no viene tenant_slug, buscar el tenant por defecto
            const [defaultTenant] = await db.query('SELECT id FROM tenants ORDER BY id ASC LIMIT 1');
            if (defaultTenant.length > 0) {
                tenantId = defaultTenant[0].id;
                const [mainBranch] = await db.query(
                    'SELECT id FROM branches WHERE tenant_id = ? AND is_main = TRUE LIMIT 1',
                    [tenantId]
                );
                if (mainBranch.length > 0) {
                    resolvedBranchId = mainBranch[0].id;
                }
            }
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
            } else if (user.role === 'tenant_admin') {
                // Tenant admin: acceso a todas las sucursales
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
                // Staff (technician, cashier, branch_manager): solo sucursales asignadas
                const [assignedBranches] = await db.query(
                    `SELECT b.id, b.code, b.name, b.is_main, uba.is_default
                     FROM branches b
                     JOIN user_branch_assignments uba ON b.id = uba.branch_id
                     WHERE uba.user_id = ? AND b.is_active = TRUE
                     ORDER BY uba.is_default DESC, b.name`,
                    [user.id]
                );
                branches = assignedBranches;
                const defaultAssign = assignedBranches.find(b => b.is_default);
                defaultBranchId = defaultAssign ? defaultAssign.id : (assignedBranches[0]?.id || null);
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
                branch_id: user.branch_id
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

// Obtener usuario actual (con datos de tenant y sucursales)
exports.getMe = async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT id, email, first_name, last_name, phone, address, role, avatar, created_at, tenant_id, branch_id 
             FROM users WHERE id = ?`,
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
                        sp.name as plan_name, sp.slug as plan_slug,
                        sp.max_branches, sp.max_users, sp.features as plan_features
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
            } else if (userData.role === 'tenant_admin' || userData.role === 'superadmin') {
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
                branches = assignedBranches;
                const defaultAssign = assignedBranches.find(b => b.is_default);
                defaultBranchId = defaultAssign ? defaultAssign.id : (assignedBranches[0]?.id || null);
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
