const db = require('../config/database');

// Obtener todos los servicios del tenant
exports.getAll = async (req, res) => {
    try {
        const { device_type_id, active_only, brand_id } = req.query;
        const tenantId = req.tenantCtx.tenantId;

        let query = `
      SELECT s.*, dt.name as device_type_name, b.name as brand_name
      FROM services_catalog s
      LEFT JOIN device_types dt ON s.device_type_id = dt.id
      LEFT JOIN brands b ON s.brand_id = b.id
      WHERE (s.tenant_id = ? OR s.tenant_id IS NULL)
    `;
        const params = [tenantId];

        if (active_only === 'true') {
            query += ' AND s.is_active = TRUE';
        }
        if (device_type_id) {
            query += ' AND (s.device_type_id = ? OR s.device_type_id IS NULL)';
            params.push(device_type_id);
        }
        if (brand_id) {
            query += ' AND (s.brand_id = ? OR s.brand_id IS NULL)';
            params.push(brand_id);
        }

        query += ' ORDER BY s.device_type_id, s.name';

        const [services] = await db.query(query, params);
        res.json(services);
    } catch (error) {
        console.error('[SERVICES] Error al obtener servicios:', error);
        res.status(500).json({ message: 'Error al obtener servicios.' });
    }
};

// Obtener un servicio por ID
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [services] = await db.query(`
      SELECT s.*, dt.name as device_type_name, b.name as brand_name
      FROM services_catalog s
      LEFT JOIN device_types dt ON s.device_type_id = dt.id
      LEFT JOIN brands b ON s.brand_id = b.id
      WHERE s.id = ? AND (s.tenant_id = ? OR s.tenant_id IS NULL)
    `, [id, tenantId]);

        if (services.length === 0) {
            return res.status(404).json({ message: 'Servicio no encontrado.' });
        }

        res.json(services[0]);
    } catch (error) {
        console.error('[SERVICES] Error al obtener servicio:', error);
        res.status(500).json({ message: 'Error al obtener servicio.' });
    }
};

// Crear servicio (admin)
exports.create = async (req, res) => {
    try {
        const { name, description, device_type_id, base_price, estimated_time, barcode, brand_id } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const finalPrice = (base_price === '' || base_price === undefined) ? 0 : base_price;
        
        // Generar código de barras automático si no se proporciona (12 dígitos numéricos con prefijo 9 para servicios)
        const finalBarcode = barcode || `9${Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('')}`;

        const [result] = await db.query(`
      INSERT INTO services_catalog (tenant_id, name, description, device_type_id, base_price, estimated_time, barcode, brand_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [tenantId, name, description, device_type_id || null, finalPrice, estimated_time, finalBarcode, brand_id || null]);

        res.status(201).json({
            message: 'Servicio creado exitosamente.',
            service: { id: result.insertId, name }
        });
    } catch (error) {
        console.error('[SERVICES] Error al crear servicio:', error);
        res.status(500).json({ message: 'Error al crear servicio.' });
    }
};

// Actualizar servicio (admin)
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, device_type_id, base_price, estimated_time, is_active, barcode, brand_id } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const finalPrice = (base_price === '' || base_price === undefined) ? 0 : base_price;

        const [result] = await db.query(`
      UPDATE services_catalog SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        device_type_id = ?,
        base_price = COALESCE(?, base_price),
        estimated_time = COALESCE(?, estimated_time),
        is_active = COALESCE(?, is_active),
        barcode = COALESCE(?, barcode),
        brand_id = ?
      WHERE id = ? AND tenant_id = ?
    `, [name, description, device_type_id, finalPrice, estimated_time, is_active, barcode, brand_id || null, id, tenantId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Servicio no encontrado o no pertenece a tu empresa.' });
        }

        res.json({ message: 'Servicio actualizado exitosamente.' });
    } catch (error) {
        console.error('[SERVICES] Error al actualizar servicio:', error);
        res.status(500).json({ message: 'Error al actualizar servicio.' });
    }
};

// Eliminar servicio (admin)
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [result] = await db.query('DELETE FROM services_catalog WHERE id = ? AND tenant_id = ?', [id, tenantId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Servicio no encontrado.' });
        }

        res.json({ message: 'Servicio eliminado exitosamente.' });
    } catch (error) {
        console.error('[SERVICES] Error al eliminar servicio:', error);
        res.status(500).json({ message: 'Error al eliminar servicio.' });
    }
};

// === TIPOS DE DISPOSITIVO ===

exports.getDeviceTypes = async (req, res) => {
    try {
        const { all } = req.query;
        const tenantId = req.tenantCtx.tenantId;
        
        let query = 'SELECT * FROM device_types WHERE (tenant_id = ? OR tenant_id IS NULL)';
        const params = [tenantId];
        
        if (all !== 'true') {
            query += ' AND is_active = TRUE';
        }
        query += ' ORDER BY name';
        const [types] = await db.query(query, params);
        res.json(types);
    } catch (error) {
        console.error('[SERVICES] Error al obtener tipos de dispositivo:', error);
        res.status(500).json({ message: 'Error al obtener tipos de dispositivo.' });
    }
};

exports.createDeviceType = async (req, res) => {
    try {
        const { name, is_active } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const [result] = await db.query(
            'INSERT INTO device_types (tenant_id, name, is_active) VALUES (?, ?, ?)',
            [tenantId, name, is_active !== undefined ? is_active : true]
        );
        res.status(201).json({ message: 'Tipo de dispositivo creado.', id: result.insertId });
    } catch (error) {
        console.error('[SERVICES] Error al crear tipo de dispositivo:', error);
        res.status(500).json({ message: 'Error al crear tipo de dispositivo.' });
    }
};

exports.updateDeviceType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, is_active } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        
        const [result] = await db.query(
            'UPDATE device_types SET name = COALESCE(?, name), is_active = COALESCE(?, is_active) WHERE id = ? AND tenant_id = ?',
            [name, is_active, id, tenantId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Tipo de dispositivo no encontrado o es de sistema.' });
        }
        res.json({ message: 'Tipo de dispositivo actualizado.' });
    } catch (error) {
        console.error('[SERVICES] Error al actualizar tipo de dispositivo:', error);
        res.status(500).json({ message: 'Error al actualizar tipo de dispositivo.' });
    }
};

exports.deleteDeviceType = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;
        
        // Verificar si hay servicios asociados
        const [services] = await db.query(
            'SELECT id FROM services_catalog WHERE device_type_id = ? AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1', 
            [id, tenantId]
        );
        if (services.length > 0) {
            return res.status(400).json({ message: 'No se puede eliminar: tiene servicios asociados.' });
        }
        const [result] = await db.query('DELETE FROM device_types WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Tipo de dispositivo no encontrado o es de sistema.' });
        }
        res.json({ message: 'Tipo de dispositivo eliminado.' });
    } catch (error) {
        console.error('[SERVICES] Error al eliminar tipo de dispositivo:', error);
        res.status(500).json({ message: 'Error al eliminar tipo de dispositivo.' });
    }
};

// === MARCAS ===

exports.getBrands = async (req, res) => {
    try {
        const { all } = req.query;
        const tenantId = req.tenantCtx.tenantId;
        
        let query = 'SELECT * FROM brands WHERE (tenant_id = ? OR tenant_id IS NULL)';
        const params = [tenantId];
        
        if (all !== 'true') {
            query += ' AND is_active = TRUE';
        }
        query += ' ORDER BY name';
        const [brands] = await db.query(query, params);
        res.json(brands);
    } catch (error) {
        console.error('[SERVICES] Error al obtener marcas:', error);
        res.status(500).json({ message: 'Error al obtener marcas.' });
    }
};

exports.createBrand = async (req, res) => {
    try {
        const { name, is_active } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const [result] = await db.query(
            'INSERT INTO brands (tenant_id, name, is_active) VALUES (?, ?, ?)',
            [tenantId, name, is_active !== undefined ? is_active : true]
        );
        res.status(201).json({ message: 'Marca creada.', id: result.insertId });
    } catch (error) {
        console.error('[SERVICES] Error al crear marca:', error);
        res.status(500).json({ message: 'Error al crear marca.' });
    }
};

exports.updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, is_active } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        
        const [result] = await db.query(
            'UPDATE brands SET name = COALESCE(?, name), is_active = COALESCE(?, is_active) WHERE id = ? AND tenant_id = ?',
            [name, is_active, id, tenantId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Marca no encontrada o es de sistema.' });
        }
        res.json({ message: 'Marca actualizada.' });
    } catch (error) {
        console.error('[SERVICES] Error al actualizar marca:', error);
        res.status(500).json({ message: 'Error al actualizar marca.' });
    }
};

exports.deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;
        
        const [result] = await db.query('DELETE FROM brands WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Marca no encontrada o es de sistema.' });
        }
        res.json({ message: 'Marca eliminada.' });
    } catch (error) {
        console.error('[SERVICES] Error al eliminar marca:', error);
        res.status(500).json({ message: 'Error al eliminar marca.' });
    }
};

