const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { auth, isSuperAdmin } = require('../middleware/auth');

const { authLimiter } = require('../middleware/rateLimiter');

// Impersonar empresa (Soporte Técnico asistido para SuperAdmin)
router.post('/impersonate-tenant', auth, isSuperAdmin, authController.impersonateTenant);

// Registro de Empresa (SaaS Onboarding)
router.post('/register-company', authLimiter, [
    body('company_name').notEmpty().withMessage('El nombre de la empresa es requerido'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('first_name').notEmpty().withMessage('El nombre es requerido'),
    body('last_name').notEmpty().withMessage('El apellido es requerido')
], authController.registerCompany);

// Registro
router.post('/register', authLimiter, [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('first_name').notEmpty().withMessage('El nombre es requerido'),
    body('last_name').notEmpty().withMessage('El apellido es requerido')
], authController.register);

// Login
router.post('/login', authLimiter, [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('La contraseña es requerida')
], authController.login);

// Obtener usuario actual (requiere auth)
router.get('/me', auth, authController.getMe);

// Obtener técnicos (solo admin/staff)
router.get('/technicians', auth, authController.getTechnicians);

// Actualizar perfil (requiere auth)
router.put('/profile', auth, authController.updateProfile);

// Cambiar contraseña (requiere auth)
router.put('/change-password', auth, [
    body('current_password').notEmpty().withMessage('Contraseña actual requerida'),
    body('new_password').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
], authController.changePassword);

// Solicitar recuperación de contraseña (Olvidé mi contraseña)
router.post('/forgot-password', authLimiter, [
    body('email').isEmail().withMessage('Email inválido')
], authController.forgotPassword);

// Restablecer contraseña
router.post('/reset-password', authLimiter, [
    body('token').notEmpty().withMessage('Token requerido'),
    body('password').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
], authController.resetPassword);

const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard, planLimit } = require('../middleware/subscriptionGuard');
const { isAdmin } = require('../middleware/auth');

// Gestión de usuarios/personal del tenant (Admin del taller)
router.get('/tenant-users', auth, tenantContext, subscriptionGuard, isAdmin, authController.getTenantUsers);
router.post('/tenant-users', auth, tenantContext, subscriptionGuard, isAdmin, planLimit('users'), [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('first_name').notEmpty().withMessage('El nombre es requerido'),
    body('last_name').notEmpty().withMessage('El apellido es requerido'),
    body('role').notEmpty().withMessage('El rol es requerido')
], authController.createTenantUser);
router.put('/tenant-users/:id', auth, tenantContext, subscriptionGuard, isAdmin, authController.updateTenantUser);
router.patch('/tenant-users/:id/toggle-status', auth, tenantContext, subscriptionGuard, isAdmin, authController.toggleTenantUserStatus);

module.exports = router;
