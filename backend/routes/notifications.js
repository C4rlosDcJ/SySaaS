const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

// SSE stream — autenticacion via query param (?token=...) porque
// EventSource del browser no soporta headers custom
router.get('/stream', notificationsController.stream);

// Rutas REST normales — protegidas con auth middleware
router.use(auth);
router.get('/', notificationsController.getNotifications);
router.put('/read-all', notificationsController.markAllAsRead);
router.put('/:id/read', notificationsController.markAsRead);
router.delete('/:id', notificationsController.deleteNotification);

module.exports = router;
