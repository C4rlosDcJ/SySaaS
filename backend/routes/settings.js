const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');

// Todas las rutas de configuración requieren auth, contexto de tenant, verificación de suscripción y admin
router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isAdmin);

router.get('/', settingsController.getAll);
router.post('/', settingsController.update);

module.exports = router;

