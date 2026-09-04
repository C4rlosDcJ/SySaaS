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

        // Sincronizar tabla tenants para mantener consistencia de logo y razón social
        if (settings.business_logo !== undefined) {
            await db.query('UPDATE tenants SET logo_url = ? WHERE id = ?', [settings.business_logo, tenantId]);
        }
        if (settings.business_name) {
            await db.query('UPDATE tenants SET company_name = ? WHERE id = ?', [settings.business_name, tenantId]);
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

// Obtener configuraciones globales (SuperAdmin)
exports.getGlobalSettings = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM settings WHERE tenant_id IS NULL');
        const settings = rows.reduce((acc, curr) => {
            acc[curr.setting_key] = curr.setting_value;
            return acc;
        }, {});
        res.json(settings);
    } catch (error) {
        console.error('[SETTINGS] Error al obtener configuraciones globales:', error);
        res.status(500).json({ message: 'Error al obtener configuraciones globales.' });
    }
};

// Guardar configuraciones globales (SuperAdmin)
exports.updateGlobalSettings = async (req, res) => {
    try {
        const settings = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await db.query(
                'INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES (NULL, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [key, typeof value === 'object' ? JSON.stringify(value) : String(value), typeof value === 'object' ? JSON.stringify(value) : String(value)]
            );
        }
        res.json({ message: 'Configuraciones globales actualizadas correctamente.' });
    } catch (error) {
        console.error('[SETTINGS] Error al actualizar configuraciones globales:', error);
        res.status(500).json({ message: 'Error al actualizar configuraciones globales.' });
    }
};


