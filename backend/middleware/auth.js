const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Middleware de autenticación
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Obtener usuario de la base de datos (incluye tenant_id y branch_id para multi-tenancy)
        const [users] = await db.query(
            `SELECT id, email, first_name, last_name, phone, role, is_active, tenant_id, branch_id 
             FROM users WHERE id = ?`,
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Usuario no encontrado.' });
        }

        if (!users[0].is_active) {
            return res.status(401).json({ message: 'Cuenta desactivada.' });
        }

        req.user = users[0];
        next();
    } catch (error) {
        console.error('[AUTH] Error de autenticación:', error.message);
        res.status(401).json({ message: 'Token inválido o expirado.' });
    }
};

// Middleware para verificar rol de SuperAdmin (operador de la plataforma SaaS)
const isSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de super administrador.' });
    }
    next();
};

// Middleware para verificar rol de admin de empresa (tenant_admin o admin)
const isTenantAdmin = (req, res, next) => {
    const allowed = ['tenant_admin', 'admin', 'superadmin'];
    if (!allowed.includes(req.user.role)) {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador de empresa.' });
    }
    next();
};

// Middleware para verificar rol de admin (compatible con el sistema anterior + nuevos roles)
// Middleware para verificar rol de admin o personal de tienda (compatible con POS y taller)
const isAdmin = (req, res, next) => {
    const adminRoles = ['admin', 'tenant_admin', 'branch_manager', 'superadmin', 'technician', 'salesperson', 'cashier'];
    if (!adminRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de empleado o administrador.' });
    }
    next();
};

// Middleware para gerente de sucursal o superior
const isBranchManagerOrAbove = (req, res, next) => {
    const allowed = ['tenant_admin', 'admin', 'branch_manager', 'superadmin'];
    if (!allowed.includes(req.user.role)) {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de gerente o superior.' });
    }
    next();
};

// Middleware para verificar que es staff (no cliente)
const isStaff = (req, res, next) => {
    const staffRoles = ['superadmin', 'tenant_admin', 'branch_manager', 'technician', 'cashier', 'salesperson', 'admin'];
    if (!staffRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de empleado.' });
    }
    next();
};

// Middleware para verificar rol de técnico o admin
const isTechnicianOrAdmin = (req, res, next) => {
    const allowed = ['technician', 'admin', 'tenant_admin', 'branch_manager', 'superadmin'];
    if (!allowed.includes(req.user.role)) {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de técnico o administrador.' });
    }
    next();
};

module.exports = { 
    auth, 
    isAdmin, 
    isSuperAdmin, 
    isTenantAdmin, 
    isBranchManagerOrAbove, 
    isStaff, 
    isTechnicianOrAdmin 
};

