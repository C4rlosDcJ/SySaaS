const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');
const analyticsController = require('../controllers/analyticsController');

router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);
router.use(isAdmin);

// Pronóstico predictivo de ventas a 30 días (Scikit-Learn)
router.get('/forecast', analyticsController.getSalesForecast);

// Segmentación K-Means de clientes
router.get('/customers-segmentation', analyticsController.getCustomerSegmentation);

// Generación de imagen PNG Matplotlib para reportes impresos
router.get('/chart-png', analyticsController.getChartPng);

module.exports = router;
