const express = require('express');
const router = express.Router();
const { auth, isTenantAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');
const couponController = require('../controllers/couponController');

router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);

// Validación (disponible para personal en POS)
router.post('/validate', couponController.validateCoupon);

// Administración de cupones (solo administradores de empresa)
router.get('/', isTenantAdmin, couponController.getCoupons);
router.post('/', isTenantAdmin, couponController.createCoupon);
router.patch('/:id/toggle', isTenantAdmin, couponController.toggleCouponStatus);

module.exports = router;
