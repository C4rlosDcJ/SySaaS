const express = require('express');
const router = express.Router();
const { auth, isTenantAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');
const couponController = require('../controllers/couponController');

router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);

const isEnterpriseTenant = (req, res, next) => {
    if (req.user?.role === 'superadmin' && !req.headers['x-tenant-id']) return next();
    const tenant = req.tenantCtx?.tenant;
    const planSlug = (tenant?.plan_slug || tenant?.plan_name || '').toLowerCase();
    const isEnterprise = planSlug.includes('enterprise') || (tenant?.plan_id && Number(tenant.plan_id) >= 3);
    if (!isEnterprise) {
        return res.status(403).json({
            message: 'El módulo de cupones está reservado para el plan Enterprise.',
            code: 'FEATURE_LOCKED'
        });
    }
    next();
};

// Validación (disponible para personal en POS)
router.post('/validate', couponController.validateCoupon);

// Administración de cupones (solo administradores de empresa en Enterprise)
router.get('/', isTenantAdmin, isEnterpriseTenant, couponController.getCoupons);
router.post('/', isTenantAdmin, isEnterpriseTenant, couponController.createCoupon);
router.patch('/:id/toggle', isTenantAdmin, isEnterpriseTenant, couponController.toggleCouponStatus);

module.exports = router;
