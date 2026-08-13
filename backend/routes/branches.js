const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { auth, isTenantAdmin, isBranchManagerOrAbove } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard, planLimit } = require('../middleware/subscriptionGuard');

// Listar sucursales de mi empresa
router.get('/', auth, tenantContext, subscriptionGuard, branchController.getBranches);

// Crear sucursal (con validacion de limite del plan)
router.post('/', auth, tenantContext, subscriptionGuard, isTenantAdmin, planLimit('branches'), branchController.createBranch);

// Actualizar sucursal
router.put('/:id(\\d+)', auth, tenantContext, subscriptionGuard, isTenantAdmin, branchController.updateBranch);

// Desactivar sucursal
router.put('/:id(\\d+)/deactivate', auth, tenantContext, subscriptionGuard, isTenantAdmin, branchController.deactivateBranch);

// Asignar usuario a sucursal
router.post('/:id(\\d+)/assign-user', auth, tenantContext, subscriptionGuard, isTenantAdmin, branchController.assignUser);

// Quitar usuario de sucursal
router.delete('/:id(\\d+)/remove-user/:userId(\\d+)', auth, tenantContext, subscriptionGuard, isTenantAdmin, branchController.removeUser);

// Listar usuarios de una sucursal
router.get('/:id(\\d+)/users', auth, tenantContext, subscriptionGuard, isBranchManagerOrAbove, branchController.getBranchUsers);

module.exports = router;
