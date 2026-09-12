const express = require('express');
const router = Router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');
const posController = require('../controllers/posController');

// Todas las rutas requieren autenticación, contexto de tenant, verificación de suscripción y ser admin
router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isAdmin);

// Ventas
router.post('/sales', posController.createSale);
router.get('/sales', posController.getSales);
router.get('/sales/stats', posController.getSalesStats);
router.get('/sales/:id', posController.getSaleById);
router.put('/sales/:id/cancel', posController.cancelSale);
router.post('/sales/:id/items/:itemId/return', posController.returnSaleItem);

// Reparaciones cobrables
router.get('/repairs/billable', posController.getBillableRepairs);
router.get('/repairs/:id', posController.getRepairForPOS);

module.exports = router;

