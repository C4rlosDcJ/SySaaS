const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Rastrear reparación por ticket (sin autenticación, global)
router.get('/track/:ticket', publicController.trackRepair);

// Obtener tema visual (público, sin autenticación, por slug del tenant o default)
router.get('/theme', publicController.getTheme);
router.get('/theme/:slug', publicController.getTheme);

// Catálogo público (sin autenticación, por slug del tenant o default)
router.get('/catalog/services', publicController.getCatalogServices);
router.get('/catalog/services/:slug', publicController.getCatalogServices);
router.get('/catalog/products', publicController.getCatalogProducts);
router.get('/catalog/products/:slug', publicController.getCatalogProducts);

// Alias directos
router.get('/services', publicController.getCatalogServices);
router.get('/services/:slug', publicController.getCatalogServices);
router.get('/products', publicController.getCatalogProducts);
router.get('/products/:slug', publicController.getCatalogProducts);

// Configuración pública de plataforma SaaS (SuperAdmin branding)
router.get('/platform', publicController.getPlatformInfo);

module.exports = router;

