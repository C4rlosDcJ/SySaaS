const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');
const orderController = require('../controllers/orderController');

// Todas las rutas requieren autenticación, contexto de tenant y verificación de suscripción
router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);

// Cliente: crear pedido
router.post('/', orderController.createOrder);

// Cliente/Admin: obtener pedidos (filtra automáticamente por rol)
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
