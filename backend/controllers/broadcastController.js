const db = require('../config/database');

// Obtener comunicados activos para avisos en Dashboard de empresas
exports.getActiveBroadcasts = async (req, res) => {
    try {
        const [broadcasts] = await db.query(`
            SELECT id, title, message, type, created_at
            FROM system_broadcasts
            WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
        `);
        res.json(broadcasts);
    } catch (error) {
        console.error('[BROADCASTS] Error al obtener comunicados activos:', error);
        res.status(500).json({ message: 'Error al obtener comunicados.' });
    }
};

// Listar todos los comunicados (SuperAdmin)
exports.getAllBroadcasts = async (req, res) => {
    try {
        const [broadcasts] = await db.query(`
            SELECT sb.*, u.first_name as author_name
            FROM system_broadcasts sb
            LEFT JOIN users u ON sb.created_by = u.id
            ORDER BY sb.created_at DESC
        `);
        res.json(broadcasts);
    } catch (error) {
        console.error('[BROADCASTS] Error al obtener todos los comunicados:', error);
        res.status(500).json({ message: 'Error al obtener lista de comunicados.' });
    }
};

// Crear comunicado masivo (SuperAdmin)
exports.createBroadcast = async (req, res) => {
    try {
        const { title, message, type, expires_at } = req.body;
        const userId = req.user.id;

        if (!title || !message) {
            return res.status(400).json({ message: 'El título y el mensaje son requeridos.' });
        }

        const [result] = await db.query(`
            INSERT INTO system_broadcasts (title, message, type, expires_at, created_by)
            VALUES (?, ?, ?, ?, ?)
        `, [title, message, type || 'info', expires_at || null, userId]);

        res.status(201).json({
            id: result.insertId,
            message: 'Comunicado publicado exitosamente en toda la plataforma.'
        });
    } catch (error) {
        console.error('[BROADCASTS] Error al crear comunicado:', error);
        res.status(500).json({ message: 'Error al publicar comunicado.' });
    }
};

// Cambiar estado activo/inactivo (SuperAdmin)
exports.toggleBroadcastStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT is_active FROM system_broadcasts WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Comunicado no encontrado.' });
        }

        const newStatus = !rows[0].is_active;
        await db.query('UPDATE system_broadcasts SET is_active = ? WHERE id = ?', [newStatus, id]);

        res.json({ message: `Comunicado ${newStatus ? 'activado' : 'desactivado'}.` });
    } catch (error) {
        console.error('[BROADCASTS] Error al actualizar comunicado:', error);
        res.status(500).json({ message: 'Error al actualizar estado.' });
    }
};
