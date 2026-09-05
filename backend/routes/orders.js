const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard, featureGuard } = require('../middleware/subscriptionGuard');
const orderController = require('../controllers/orderController');

// Todas las rutas requieren autenticacion, contexto de tenant, suscripcion activa
// y que el plan incluya e-commerce
router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(featureGuard('ecommerce'));

const isOrdersAllowedForAdmin = (req, res, next) => {
    if (req.user?.role === 'client') return next();
    if (req.user?.role === 'superadmin' && !req.headers['x-tenant-id']) return next();
    const tenant = req.tenantCtx?.tenant;
    const planSlug = (tenant?.plan_slug || tenant?.plan_name || '').toLowerCase();
    const isAllowed = ['pro', 'enterprise'].some(p => planSlug.includes(p)) || (tenant?.plan_id && Number(tenant.plan_id) >= 2);
    if (!isAllowed) {
        return res.status(403).json({
            message: 'El módulo de pedidos web está reservado para los planes Pro y Enterprise.',
            code: 'FEATURE_LOCKED'
        });
    }
    next();
};

router.use(isOrdersAllowedForAdmin);

// Cliente: crear pedido
router.post('/', orderController.createOrder);

// Cliente/Admin: obtener pedidos (filtra automaticamente por rol)
router.get('/', orderController.getOrders);

// Cliente/Admin: detalle de pedido
router.get('/stats', isAdmin, orderController.getOrderStats);
router.get('/:id', orderController.getOrderById);

// Admin: cambiar estado
router.put('/:id/status', isAdmin, orderController.updateOrderStatus);

// Cliente/Admin: cancelar pedido
router.put('/:id/cancel', orderController.cancelOrder);

// Cliente: editar pedido
router.put('/:id', orderController.updateOrder);

module.exports = router;
