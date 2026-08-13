const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');

// Rutas con autenticación y contexto multi-tenant
router.get('/', auth, tenantContext, subscriptionGuard, serviceController.getAll);
router.get('/device-types', auth, tenantContext, subscriptionGuard, serviceController.getDeviceTypes);
router.get('/brands', auth, tenantContext, subscriptionGuard, serviceController.getBrands);
router.get('/:id', auth, tenantContext, subscriptionGuard, serviceController.getById);

// Rutas de tipos de dispositivo
router.post('/device-types', auth, tenantContext, subscriptionGuard, isAdmin, serviceController.createDeviceType);
router.put('/device-types/:id', auth, tenantContext, subscriptionGuard, isAdmin, serviceController.updateDeviceType);
router.delete('/device-types/:id', auth, tenantContext, subscriptionGuard, isAdmin, serviceController.deleteDeviceType);

// Rutas de marcas
router.post('/brands', auth, tenantContext, subscriptionGuard, isAdmin, serviceController.createBrand);
router.put('/brands/:id', auth, tenantContext, subscriptionGuard, isAdmin, serviceController.updateBrand);
router.delete('/brands/:id', auth, tenantContext, subscriptionGuard, isAdmin, serviceController.deleteBrand);

// Rutas de servicios (admin)
router.post('/', auth, tenantContext, subscriptionGuard, isAdmin, serviceController.create);
router.put('/:id', auth, tenantContext, subscriptionGuard, isAdmin, serviceController.update);
router.delete('/:id', auth, tenantContext, subscriptionGuard, isAdmin, serviceController.delete);

module.exports = router;

