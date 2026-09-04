const express = require('express');
const router = express.Router();
const repairController = require('../controllers/repairController');
const { auth, isAdmin, isTechnicianOrAdmin } = require('../middleware/auth');
const tenantContext = require('../middleware/tenantContext');
const { subscriptionGuard, planLimit } = require('../middleware/subscriptionGuard');

// Todas las rutas requieren autenticación, contexto de tenant y verificación de suscripción
router.use(auth);
router.use(tenantContext);
router.use(subscriptionGuard);

// Listar reparaciones (filtradas por rol y tenant)
router.get('/', repairController.getAll);

// Obtener detalle de reparación
router.get('/:id', repairController.getById);

// Crear reparación
router.post('/', planLimit('monthly_repairs'), repairController.create);

// Actualizar reparación (solo admin/técnico)
router.put('/:id', isTechnicianOrAdmin, repairController.update);

// Cambiar estado (admin/técnico o cliente para aprobar/rechazar)
router.put('/:id/status', repairController.updateStatus);

// Agregar reseña (cliente)
router.post('/:id/review', repairController.addReview);

// Agregar nota
router.post('/:id/notes', repairController.addNote);

// Eliminar reparación (solo admin)
router.delete('/:id', isAdmin, repairController.delete);

// Procesar ingreso por garantía (admin, técnico o cliente propietario)
router.post('/:id/claim-warranty', repairController.claimWarranty);

module.exports = router;

