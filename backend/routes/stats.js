const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');

// Todas las rutas requieren auth, contexto de tenant, verificación de suscripción y admin
router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isAdmin);

router.get('/dashboard', statsController.getDashboard);
router.get('/revenue', statsController.getRevenue);
router.get('/technicians', statsController.getTechniciansStats);

module.exports = router;

