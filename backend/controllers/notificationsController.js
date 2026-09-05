const db = require('../config/database');
const jwt = require('jsonwebtoken');

// =====================================================
// Store de conexiones SSE activas
// Estructura: Map<tenantId, Set<res>>
// =====================================================
const sseClients = new Map();

function addSSEClient(tenantId, res) {
    if (!sseClients.has(tenantId)) {
        sseClients.set(tenantId, new Set());
    }
    sseClients.get(tenantId).add(res);
}

function removeSSEClient(tenantId, res) {
    const clients = sseClients.get(tenantId);
    if (clients) {
        clients.delete(res);
        if (clients.size === 0) sseClients.delete(tenantId);
    }
}

function pushToTenant(tenantId, eventName, data) {
    const clients = sseClients.get(tenantId);
    if (!clients || clients.size === 0) return;
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
        try {
            res.write(payload);
        } catch {
            clients.delete(res);
        }
    }
}

// =====================================================
// Helper para crear una notificacion y empujarla via SSE
// =====================================================
const createNotification = async (tenantId, { title, message, type, link, entity_id }) => {
    try {
        const [result] = await db.query(
            `INSERT INTO notifications (tenant_id, title, message, type, link, entity_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [tenantId, title, message, type, link || null, entity_id || null]
        );

        // Emitir via SSE inmediatamente a todos los clientes conectados del tenant
        const notification = {
            id: result.insertId,
            tenant_id: tenantId,
            title,
            message,
            type,
            link: link || null,
            entity_id: entity_id || null,
            is_read: 0,
            created_at: new Date().toISOString()
        };
        pushToTenant(tenantId, 'notification', notification);
    } catch (err) {
        // No interrumpir el flujo principal si falla la notificacion
        console.error('[NOTIFICATIONS] Error al crear notificacion:', err.message);
    }
};

module.exports.createNotification = createNotification;

// =====================================================
// GET /api/notifications/stream
// Endpoint SSE — mantiene la conexion abierta y empuja
// eventos en tiempo real. El token va como query param
// porque EventSource no soporta headers custom.
// =====================================================
exports.stream = async (req, res) => {
    // Autenticar via query param (unico mecanismo disponible con EventSource)
    const token = req.query.token;
    if (!token) {
        return res.status(401).json({ message: 'Token requerido.' });
    }

    let user;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [users] = await db.query(
            'SELECT id, role, tenant_id FROM users WHERE id = ? AND is_active = 1',
            [decoded.id]
        );
        if (users.length === 0) return res.status(401).json({ message: 'Usuario no encontrado.' });
        user = users[0];
    } catch {
        return res.status(401).json({ message: 'Token invalido o expirado.' });
    }

    // Solo personal de tenant — no clientes, no superadmin
    if (!user.tenant_id || user.role === 'client' || user.role === 'superadmin') {
        return res.status(403).json({ message: 'Sin acceso a notificaciones.' });
    }

    const tenantId = user.tenant_id;

    // Configurar cabeceras SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Para Nginx/proxies
    res.flushHeaders();

    // Registrar cliente
    addSSEClient(tenantId, res);

    // Heartbeat cada 25 segundos para mantener la conexion viva
    const heartbeat = setInterval(() => {
        try {
            res.write(':heartbeat\n\n');
        } catch {
            clearInterval(heartbeat);
        }
    }, 25_000);

    // Limpiar al desconectar
    req.on('close', () => {
        clearInterval(heartbeat);
        removeSSEClient(tenantId, res);
    });

    req.on('error', () => {
        clearInterval(heartbeat);
        removeSSEClient(tenantId, res);
    });
};

// =====================================================
// GET /api/notifications
// Devuelve notificaciones del tenant del usuario autenticado
// =====================================================
exports.getNotifications = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        if (!tenantId) {
            return res.status(403).json({ message: 'Sin acceso a notificaciones.' });
        }

        const [rows] = await db.query(
            `SELECT id, title, message, type, link, entity_id, is_read, created_at
             FROM notifications
             WHERE tenant_id = ?
             ORDER BY is_read ASC, created_at DESC
             LIMIT 60`,
            [tenantId]
        );

        const unreadCount = rows.filter(n => !n.is_read).length;

        res.json({ notifications: rows, unread_count: unreadCount });
    } catch (error) {
        console.error('[NOTIFICATIONS] Error al obtener notificaciones:', error);
        res.status(500).json({ message: 'Error al obtener notificaciones.' });
    }
};

// =====================================================
// PUT /api/notifications/:id/read
// =====================================================
exports.markAsRead = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { id } = req.params;

        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[NOTIFICATIONS] Error al marcar como leida:', error);
        res.status(500).json({ message: 'Error al actualizar notificacion.' });
    }
};

// =====================================================
// PUT /api/notifications/read-all
// =====================================================
exports.markAllAsRead = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND is_read = 0',
            [tenantId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[NOTIFICATIONS] Error al marcar todas como leidas:', error);
        res.status(500).json({ message: 'Error al actualizar notificaciones.' });
    }
};

// =====================================================
// DELETE /api/notifications/:id
// =====================================================
exports.deleteNotification = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { id } = req.params;

        await db.query(
            'DELETE FROM notifications WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[NOTIFICATIONS] Error al eliminar notificacion:', error);
        res.status(500).json({ message: 'Error al eliminar notificacion.' });
    }
};
