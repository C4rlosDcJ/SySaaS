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

const isSuppliersAllowed = (req, res, next) => {
    if (req.user?.role === 'superadmin' && !req.headers['x-tenant-id']) return next();
    const tenant = req.tenantCtx?.tenant;
    const planSlug = (tenant?.plan_slug || tenant?.plan_name || '').toLowerCase();
    const isAllowed = ['pro', 'enterprise'].some(p => planSlug.includes(p)) || (tenant?.plan_id && Number(tenant.plan_id) >= 2);
    if (!isAllowed) {
        return res.status(403).json({
            message: 'El módulo de proveedores y órdenes de compra está reservado para los planes Pro y Enterprise.',
            code: 'FEATURE_LOCKED'
        });
    }
    next();
};

router.use(isSuppliersAllowed);

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
