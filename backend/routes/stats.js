const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { auth, isAdmin, isSuperAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');

// Ruta analítica global SuperAdmin (no requiere tenantContext)
router.get('/superadmin', auth, isSuperAdmin, statsController.getSuperAdminStats);
router.get('/superadmin/analytics', auth, isSuperAdmin, statsController.getSuperAdminAnalytics);
router.get('/audit-logs', auth, isSuperAdmin, statsController.getAuditLogs);
router.get('/tenant-detail/:id', auth, isSuperAdmin, statsController.getTenantDetail);

// Rutas de administración scoped a tenant/sucursal
router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isAdmin);

router.get('/dashboard', statsController.getDashboard);
router.get('/analytics', statsController.getEnterpriseAnalytics);
router.get('/revenue', statsController.getRevenue);
router.get('/technicians', statsController.getTechniciansStats);

module.exports = router;

