const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { auth, isBranchManagerOrAbove, isTenantAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard } = require('../middleware/subscriptionGuard');

// Listar traspasos del tenant
router.get('/', auth, tenantContext, subscriptionGuard, isBranchManagerOrAbove, transferController.getTransfers);

// Crear traspaso
router.post('/', auth, tenantContext, subscriptionGuard, isBranchManagerOrAbove, transferController.createTransfer);

// Aprobar traspaso
router.put('/:id(\\d+)/approve', auth, tenantContext, subscriptionGuard, isBranchManagerOrAbove, transferController.approveTransfer);

// Completar traspaso (confirmar recepcion)
router.put('/:id(\\d+)/complete', auth, tenantContext, subscriptionGuard, isBranchManagerOrAbove, transferController.completeTransfer);

// Cancelar traspaso
router.put('/:id(\\d+)/cancel', auth, tenantContext, subscriptionGuard, isBranchManagerOrAbove, transferController.cancelTransfer);

module.exports = router;
