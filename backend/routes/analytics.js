const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard, featureGuard } = require('../middleware/subscriptionGuard');
const analyticsController = require('../controllers/analyticsController');

router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isAdmin);

// Reportes avanzados con ML - requieren plan Enterprise (advanced_reports)
router.get('/forecast', featureGuard('advanced_reports'), analyticsController.getSalesForecast);
router.get('/customers-segmentation', featureGuard('advanced_reports'), analyticsController.getCustomerSegmentation);
router.get('/chart-png', featureGuard('advanced_reports'), analyticsController.getChartPng);

module.exports = router;
