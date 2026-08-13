const db = require('../config/database');

// Obtener todas las configuraciones del tenant
exports.getAll = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const [rows] = await db.query('SELECT * FROM settings WHERE tenant_id = ?', [tenantId]);
        const settings = rows.reduce((acc, curr) => {
            acc[curr.setting_key] = curr.setting_value;
            return acc;
        }, {});
        res.json(settings);
    } catch (error) {
        console.error('[SETTINGS] Error al obtener configuraciones:', error);
        res.status(500).json({ message: 'Error al obtener configuraciones.' });
    }
};

// Actualizar una configuración específica
exports.update = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const settings = req.body; // Objeto { key: value }

        for (const [key, value] of Object.entries(settings)) {
            await db.query(
                'INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [tenantId, key, value, value]
            );
        }

        res.json({ message: 'Configuraciones actualizadas correctamente.' });
    } catch (error) {
        console.error('[SETTINGS] Error al actualizar configuraciones:', error);
        res.status(500).json({ message: 'Error al actualizar configuraciones.' });
    }
};

// Obtener un valor específico (Helper interno)
exports.getSettingValue = async (tenantId, key, defaultValue = null) => {
    try {
        const [rows] = await db.query('SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = ?', [tenantId, key]);
        if (rows.length > 0) return rows[0].setting_value;
        return defaultValue;
    } catch (error) {
        return defaultValue;
    }
};

