const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Obtener todas las configuraciones del tenant
exports.getAll = async (req, res) => {
    try {
        const tenantId = req.tenantCtx?.tenantId;
        if (!tenantId) {
            return res.json({});
        }

        const [rows] = await db.query('SELECT * FROM settings WHERE tenant_id = ?', [tenantId]);
        const settings = rows.reduce((acc, curr) => {
            acc[curr.setting_key] = curr.setting_value;
            return acc;
        }, {});

        // Respaldo bidireccional y sincronización con la tabla tenants
        const [tenants] = await db.query('SELECT company_name, logo_url FROM tenants WHERE id = ?', [tenantId]);
        if (tenants.length > 0) {
            const tenant = tenants[0];
            // Si no está en settings pero sí en tenants, usar de tenants
            if (!settings.business_logo && tenant.logo_url) {
                settings.business_logo = tenant.logo_url;
            }
            if (!settings.business_name && tenant.company_name) {
                settings.business_name = tenant.company_name;
            }

            // Si está en settings pero no en tenants, asegurar consistencia en tenants
            if (settings.business_logo && !tenant.logo_url && !settings.business_logo.startsWith('blob:')) {
                await db.query('UPDATE tenants SET logo_url = ? WHERE id = ?', [settings.business_logo, tenantId]);
            }
        }

        res.json(settings);
    } catch (error) {
        console.error('[SETTINGS] Error al obtener configuraciones:', error);
        res.status(500).json({ message: 'Error al obtener configuraciones.' });
    }
};

// Actualizar una configuración específica
exports.update = async (req, res) => {
    try {
        const tenantId = req.tenantCtx?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ message: 'No se identifico la empresa asignada para actualizar configuraciones.' });
        }

        const settings = { ...req.body }; // Objeto { key: value }

        // Evitar persistir URLs temporales efímeras de tipo blob:
        if (settings.business_logo && typeof settings.business_logo === 'string' && settings.business_logo.startsWith('blob:')) {
            delete settings.business_logo;
        }

        for (const [key, value] of Object.entries(settings)) {
            await db.query(
                'INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [tenantId, key, value, value]
            );
        }

        // Sincronizar tabla tenants para mantener consistencia de logo y razón social
        if (settings.business_logo !== undefined) {
            const cleanLogo = settings.business_logo && settings.business_logo.trim() !== '' ? settings.business_logo : null;
            await db.query('UPDATE tenants SET logo_url = ? WHERE id = ?', [cleanLogo, tenantId]);
        }
        if (settings.business_name && settings.business_name.trim() !== '') {
            await db.query('UPDATE tenants SET company_name = ? WHERE id = ?', [settings.business_name.trim(), tenantId]);
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
        const settings = { ...req.body };

        // Evitar persistir URLs temporales efímeras de tipo blob:
        if (settings.platform_logo && typeof settings.platform_logo === 'string' && settings.platform_logo.startsWith('blob:')) {
            delete settings.platform_logo;
        }

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

// Actualizar credenciales y contraseña de SuperAdmin
exports.changeSuperAdminPassword = async (req, res) => {
    try {
        const { current_password, new_password, new_email } = req.body;

        if (!new_password && !new_email) {
            return res.status(400).json({ message: 'Debe especificar una nueva contraseña o un nuevo correo electrónico.' });
        }

        const [users] = await db.query('SELECT id, email, password FROM users WHERE id = ? AND role = "superadmin"', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario SuperAdmin no encontrado.' });
        }

        // Verificar contraseña actual
        if (!current_password) {
            return res.status(400).json({ message: 'Debe ingresar su contraseña actual para confirmar los cambios.' });
        }

        const isValid = await bcrypt.compare(current_password, users[0].password);
        if (!isValid) {
            return res.status(400).json({ message: 'La contraseña actual no es correcta.' });
        }

        // Cambio de contraseña
        if (new_password) {
            if (new_password.length < 8) {
                return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
            }
            const hashedPassword = await bcrypt.hash(new_password, 10);
            await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
        }

        // Cambio de correo
        if (new_email && new_email.trim().toLowerCase() !== users[0].email.toLowerCase()) {
            const cleanEmail = new_email.trim().toLowerCase();
            const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, req.user.id]);
            if (existing.length > 0) {
                return res.status(400).json({ message: 'El correo electrónico ingresado ya se encuentra en uso por otra cuenta.' });
            }
            await db.query('UPDATE users SET email = ? WHERE id = ?', [cleanEmail, req.user.id]);
        }

        res.json({ message: 'Credenciales de SuperAdmin actualizadas exitosamente.' });
    } catch (error) {
        console.error('[SETTINGS] Error al cambiar credenciales de SuperAdmin:', error);
        res.status(500).json({ message: 'Error interno al actualizar credenciales.' });
    }
};


