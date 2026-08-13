const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Rastrear reparación por ticket (sin autenticación, global)
router.get('/track/:ticket', publicController.trackRepair);

// Obtener tema visual (público, sin autenticación, por slug del tenant)
router.get('/theme/:slug', publicController.getTheme);

// Catálogo público (sin autenticación, por slug del tenant)
router.get('/catalog/services/:slug', publicController.getCatalogServices);
router.get('/catalog/products/:slug', publicController.getCatalogProducts);

module.exports = router;

