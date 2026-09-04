const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { auth, isSuperAdmin, isTenantAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');

// =====================================================
// Rutas de SuperAdmin (Globales)
// =====================================================
router.get('/plans', auth, tenantController.getPlans);
router.post('/plans', auth, isSuperAdmin, tenantController.createPlan);
router.put('/plans/:id', auth, isSuperAdmin, tenantController.updatePlan);

router.get('/analytics', auth, isSuperAdmin, tenantController.getGlobalAnalytics);
router.get('/', auth, isSuperAdmin, tenantController.getTenants);
router.post('/', auth, isSuperAdmin, tenantController.createTenant);
router.get('/users', auth, isSuperAdmin, tenantController.getGlobalUsers);
router.put('/users/:id/toggle-status', auth, isSuperAdmin, tenantController.toggleUserStatus);
router.put('/users/:id/reset-password', auth, isSuperAdmin, tenantController.resetUserPassword);
router.get('/:id(\\d+)', auth, isSuperAdmin, tenantController.getTenantById);
router.put('/:id(\\d+)', auth, isSuperAdmin, tenantController.updateTenant);
router.put('/:id(\\d+)/suspend', auth, isSuperAdmin, tenantController.suspendTenant);
router.put('/:id(\\d+)/activate', auth, isSuperAdmin, tenantController.activateTenant);
router.put('/:id(\\d+)/change-plan', auth, isSuperAdmin, tenantController.changeTenantPlan);
router.put('/:id(\\d+)/extend-trial', auth, isSuperAdmin, tenantController.extendTrial);

// =====================================================
// Rutas de Tenant Admin (Scoped a Empresa)
// =====================================================
router.get('/me', auth, tenantContext, tenantController.getMyTenant);
router.put('/me', auth, tenantContext, subscriptionGuard, isTenantAdmin, tenantController.updateMyTenant);

module.exports = router;
