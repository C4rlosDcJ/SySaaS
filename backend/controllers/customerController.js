const db = require('../config/database');

// Obtener todos los clientes (filtrados por tenant y sucursal)
exports.getAll = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        let query = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.address, u.created_at,
        COUNT(r.id) as total_repairs,
        SUM(CASE WHEN r.status NOT IN ('delivered', 'cancelled') THEN 1 ELSE 0 END) as active_repairs
      FROM users u
      LEFT JOIN repairs r ON u.id = r.customer_id
      WHERE u.role = 'client' AND u.tenant_id = ? AND u.branch_id = ?
    `;
        const params = [tenantId, branchId];

        if (search) {
            query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [customers] = await db.query(query, params);

        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM users WHERE role = ? AND tenant_id = ? AND branch_id = ?';
        const countParams = ['client', tenantId, branchId];
        if (search) {
            countQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        const [countResult] = await db.query(countQuery, countParams);

        res.json({
            customers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('[CUSTOMERS] Error al obtener clientes:', error);
        res.status(500).json({ message: 'Error al obtener clientes.' });
    }
};

// Obtener un cliente por ID
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        const [customers] = await db.query(`
      SELECT id, email, first_name, last_name, phone, address, created_at
      FROM users WHERE id = ? AND role = 'client' AND tenant_id = ? AND branch_id = ?
    `, [id, tenantId, branchId]);

        if (customers.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        // Obtener estadísticas (filtradas por tenant y sucursal)
        const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_repairs,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status NOT IN ('delivered', 'cancelled') THEN 1 ELSE 0 END) as active,
        SUM(total_cost) as total_spent
      FROM repairs WHERE customer_id = ? AND tenant_id = ? AND branch_id = ?
    `, [id, tenantId, branchId]);

        res.json({
            ...customers[0],
            stats: stats[0]
        });
    } catch (error) {
        console.error('[CUSTOMERS] Error al obtener cliente:', error);
        res.status(500).json({ message: 'Error al obtener cliente.' });
    }
};

// Obtener reparaciones de un cliente
exports.getRepairs = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        let query = `
      SELECT r.*, dt.name as device_type_name, b.name as brand_name
      FROM repairs r
      LEFT JOIN device_types dt ON r.device_type_id = dt.id
      LEFT JOIN brands b ON r.brand_id = b.id
      WHERE r.customer_id = ? AND r.tenant_id = ? AND r.branch_id = ?
    `;
        const params = [id, tenantId, branchId];

        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }

        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [repairs] = await db.query(query, params);

        res.json(repairs);
    } catch (error) {
        console.error('[CUSTOMERS] Error al obtener reparaciones:', error);
        res.status(500).json({ message: 'Error al obtener reparaciones.' });
    }
};

// Crear cliente (admin crea cliente desde panel)
exports.create = async (req, res) => {
    try {
        const { email, first_name, last_name, phone, address } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        // Verificar si ya existe en esta sucursal (o global, según preferencia, aquí respetamos por email)
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El email ya está registrado.' });
        }

        // Generar contraseña temporal
        const bcrypt = require('bcryptjs');
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const [result] = await db.query(`
      INSERT INTO users (tenant_id, branch_id, email, password, first_name, last_name, phone, address, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'client')
    `, [tenantId, branchId, email, hashedPassword, first_name, last_name, phone || null, address || null]);

        res.status(201).json({
            message: 'Cliente creado exitosamente.',
            customer: {
                id: result.insertId,
                email,
                first_name,
                last_name,
                temp_password: tempPassword // Solo mostrar una vez
            }
        });
    } catch (error) {
        console.error('[CUSTOMERS] Error al crear cliente:', error);
        res.status(500).json({ message: 'Error al crear cliente.' });
    }
};

// Actualizar cliente
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, phone, address } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        const [result] = await db.query(`
      UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ?
      WHERE id = ? AND role = 'client' AND tenant_id = ? AND branch_id = ?
    `, [first_name, last_name, phone, address, id, tenantId, branchId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado o no pertenece a tu sucursal.' });
        }

        res.json({ message: 'Cliente actualizado exitosamente.' });
    } catch (error) {
        console.error('[CUSTOMERS] Error al actualizar cliente:', error);
        res.status(500).json({ message: 'Error al actualizar cliente.' });
    }
};

