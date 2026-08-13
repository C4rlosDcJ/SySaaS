const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');
const searchController = require('../controllers/searchController');

// Búsqueda global (solo admin, contextualizada por tenant/sucursal)
router.get('/', auth, tenantContext, subscriptionGuard, isAdmin, searchController.search);

module.exports = router;

