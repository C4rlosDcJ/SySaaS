const express = require('express');
const router = express.Router();
const { auth, isSuperAdmin } = require('../middleware/auth');
const broadcastController = require('../controllers/broadcastController');

// Obtener comunicados activos (disponible para todos los usuarios autenticados)
router.get('/active', auth, broadcastController.getActiveBroadcasts);

// Rutas de administración (solo SuperAdmin)
router.get('/', auth, isSuperAdmin, broadcastController.getAllBroadcasts);
router.post('/', auth, isSuperAdmin, broadcastController.createBroadcast);
router.put('/:id/toggle', auth, isSuperAdmin, broadcastController.toggleBroadcastStatus);

module.exports = router;
