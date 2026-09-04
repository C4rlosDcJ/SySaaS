const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { auth, isTenantAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');

// Webhook de Stripe (debe llamarse antes del parser express.json() en server.js o usar express.raw)
// Para facilitar el flujo y evitar duplicar el endpoint, lo dejamos aquí sin auth
router.post('/webhook', express.raw({ type: 'application/json' }), billingController.handleWebhook);

// Crear sesión de pago / Checkout
router.post('/checkout', auth, tenantContext, isTenantAdmin, billingController.createCheckoutSession);

// Crear sesión del portal de Stripe
router.post('/portal', auth, tenantContext, isTenantAdmin, billingController.createPortalSession);

// Contratar / Activar suscripción directamente
router.post('/subscribe-plan', auth, tenantContext, isTenantAdmin, billingController.subscribePlan);

module.exports = router;
