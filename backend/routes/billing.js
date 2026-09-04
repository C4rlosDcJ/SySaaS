const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { auth, isTenantAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');

// Webhook de Stripe - body ya llega como string desde el middleware de server.js
router.post('/webhook', billingController.handleWebhook);

// Crear sesion de pago / Checkout (requiere admin del tenant)
router.post('/checkout', auth, tenantContext, isTenantAdmin, billingController.createCheckoutSession);

// Verificar sesion de Stripe al regresar del checkout (activar suscripcion en tiempo real)
router.post('/verify-session', auth, tenantContext, isTenantAdmin, billingController.verifyCheckoutSession);

// Crear sesion del portal de Stripe (autoservicio de suscripcion)
router.post('/portal', auth, tenantContext, isTenantAdmin, billingController.createPortalSession);

// Contratar / Activar suscripcion directamente (modo interno / sin Stripe)
router.post('/subscribe-plan', auth, tenantContext, isTenantAdmin, billingController.subscribePlan);

module.exports = router;
