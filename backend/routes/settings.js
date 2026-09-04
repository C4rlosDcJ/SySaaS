const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { auth, isAdmin, isSuperAdmin, isTenantAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');

// Todas las rutas de configuración requieren auth
router.use(auth);

// Rutas de configuración global de la plataforma (SuperAdmin)
router.get('/global', isSuperAdmin, settingsController.getGlobalSettings);
router.post('/global', isSuperAdmin, settingsController.updateGlobalSettings);

// Rutas de configuración de tenant (requieren contexto, suscripción y ser TenantAdmin)
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isTenantAdmin);

router.get('/', settingsController.getAll);
router.post('/', settingsController.update);

module.exports = router;


