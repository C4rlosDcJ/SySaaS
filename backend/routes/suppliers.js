const express = require('express');
const router = express.Router();
const { auth, isTenantAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');
const supplierController = require('../controllers/supplierController');

router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isTenantAdmin);

// Proveedores
router.get('/', supplierController.getSuppliers);
router.post('/', supplierController.createSupplier);
router.put('/:id', supplierController.updateSupplier);
router.delete('/:id', supplierController.deleteSupplier);

// Órdenes de Compra
router.get('/purchase-orders', supplierController.getPurchaseOrders);
router.post('/purchase-orders', supplierController.createPurchaseOrder);
router.put('/purchase-orders/:id/receive', supplierController.receivePurchaseOrder);

module.exports = router;
