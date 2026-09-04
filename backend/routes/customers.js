const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');

// Todas las rutas requieren auth, contexto de tenant, verificación de suscripción y admin
router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isAdmin);

router.get('/', customerController.getAll);
router.get('/:id', customerController.getById);
router.get('/:id/repairs', customerController.getRepairs);
router.post('/', customerController.create);
router.put('/:id', customerController.update);
router.delete('/:id', customerController.delete);

module.exports = router;

