const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Obtener todos los clientes (filtrados por tenant y opcionalmente sucursal)
exports.getAll = async (req, res) => {
    try {
        const { search, page = 1, limit = 10, branch_id } = req.query;
        const offset = (page - 1) * limit;
        const tenantId = req.tenantCtx.tenantId;
        const userRole = req.user?.role || '';
        const isGlobalAdmin = ['tenant_admin', 'admin', 'superadmin'].includes(userRole);

        let query = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.address, u.created_at, u.branch_id,
        b.name as branch_name, b.code as branch_code,
        COUNT(r.id) as total_repairs,
        SUM(CASE WHEN r.status NOT IN ('delivered', 'cancelled') THEN 1 ELSE 0 END) as active_repairs
      FROM users u
      LEFT JOIN repairs r ON u.id = r.customer_id AND r.tenant_id = ?
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.role = 'client' AND u.tenant_id = ? AND u.is_active = TRUE
    `;
        const params = [tenantId, tenantId];

        // Filtro opcional por sucursal
        if (branch_id) {
            query += ' AND (u.branch_id = ? OR u.branch_id IS NULL)';
            params.push(parseInt(branch_id, 10));
        } else if (!isGlobalAdmin && req.tenantCtx.branchId) {
            // Staff restringido a sede específica
            query += ' AND (u.branch_id = ? OR u.branch_id IS NULL)';
            params.push(req.tenantCtx.branchId);
        }

        if (search) {
            query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const [customers] = await db.query(query, params);

        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM users WHERE role = "client" AND tenant_id = ? AND is_active = TRUE';
        const countParams = [tenantId];

        if (branch_id) {
            countQuery += ' AND (branch_id = ? OR branch_id IS NULL)';
            countParams.push(parseInt(branch_id, 10));
        } else if (!isGlobalAdmin && req.tenantCtx.branchId) {
            countQuery += ' AND (branch_id = ? OR branch_id IS NULL)';
            countParams.push(req.tenantCtx.branchId);
        }

        if (search) {
            countQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        const [countResult] = await db.query(countQuery, countParams);

        res.json({
            customers,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
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

        const [customers] = await db.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.address, u.created_at, u.branch_id,
             b.name as branch_name, b.code as branch_code
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.id = ? AND u.role = 'client' AND u.tenant_id = ? AND u.is_active = TRUE
    `, [id, tenantId]);

        if (customers.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        // Obtener estadísticas en toda la empresa
        const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_repairs,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status NOT IN ('delivered', 'cancelled') THEN 1 ELSE 0 END) as active,
        COALESCE(SUM(total_cost), 0) as total_spent
      FROM repairs WHERE customer_id = ? AND tenant_id = ?
    `, [id, tenantId]);

        res.json({
            ...customers[0],
            stats: stats[0] || { total_repairs: 0, completed: 0, active: 0, total_spent: 0 }
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
        const { status, page = 1, limit = 10, branch_id } = req.query;
        const offset = (page - 1) * limit;
        const tenantId = req.tenantCtx.tenantId;

        let query = `
      SELECT r.*, dt.name as device_type_name, b.name as brand_name, br.name as branch_name, br.code as branch_code
      FROM repairs r
      LEFT JOIN device_types dt ON r.device_type_id = dt.id
      LEFT JOIN brands b ON r.brand_id = b.id
      LEFT JOIN branches br ON r.branch_id = br.id
      WHERE r.customer_id = ? AND r.tenant_id = ?
    `;
        const params = [id, tenantId];

        if (branch_id) {
            query += ' AND r.branch_id = ?';
            params.push(parseInt(branch_id, 10));
        }

        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }

        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

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
        const { email, first_name, last_name, phone, address, branch_id, password } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        let targetBranchId = null;

        if (!email || !first_name || !last_name) {
            return res.status(400).json({ message: 'Email, nombre y apellido son requeridos.' });
        }

        // Si se proporciona contraseña a mano, validar longitud
        if (password && password.trim() && password.trim().length < 6) {
            return res.status(400).json({ message: 'La contraseña manual debe tener al menos 6 caracteres.' });
        }

        // Si el admin seleccionó una sucursal, verificar que pertenezca a su empresa
        if (branch_id) {
            const [selectedBranch] = await db.query(
                'SELECT id FROM branches WHERE id = ? AND tenant_id = ? AND is_active = TRUE',
                [branch_id, tenantId]
            );
            if (selectedBranch.length > 0) {
                targetBranchId = selectedBranch[0].id;
            }
        }

        // Si no se especificó o no es válida, usar la sucursal de contexto o la matriz
        if (!targetBranchId) {
            if (req.tenantCtx.branchId) {
                targetBranchId = req.tenantCtx.branchId;
            } else {
                const [mainBranches] = await db.query(
                    'SELECT id FROM branches WHERE tenant_id = ? AND is_main = TRUE LIMIT 1',
                    [tenantId]
                );
                targetBranchId = mainBranches.length > 0 ? mainBranches[0].id : null;
            }
        }

        // Verificar si ya existe el correo
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
        }

        // Generar o usar contraseña manual
        const finalPassword = (password && password.trim())
            ? password.trim()
            : Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(finalPassword, 10);

        const [result] = await db.query(`
      INSERT INTO users (tenant_id, branch_id, email, password, first_name, last_name, phone, address, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'client', TRUE)
    `, [tenantId, targetBranchId, email, hashedPassword, first_name, last_name, phone || null, address || null]);

        res.status(201).json({
            message: 'Cliente creado exitosamente.',
            customer: {
                id: result.insertId,
                email,
                first_name,
                last_name,
                phone: phone || null,
                address: address || null,
                branch_id: targetBranchId,
                temp_password: finalPassword
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
        const { first_name, last_name, phone, address, branch_id, password } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        let query = 'UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ?';
        const params = [first_name, last_name, phone, address];

        if (branch_id !== undefined) {
            let validBranchId = null;
            if (branch_id) {
                const [b] = await db.query('SELECT id FROM branches WHERE id = ? AND tenant_id = ?', [branch_id, tenantId]);
                if (b.length > 0) validBranchId = b[0].id;
            }
            query += ', branch_id = ?';
            params.push(validBranchId);
        }

        // Si se envía una nueva contraseña para el cliente
        if (password && password.trim()) {
            if (password.trim().length < 6) {
                return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            }
            const hashedPassword = await bcrypt.hash(password.trim(), 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }

        query += " WHERE id = ? AND role = 'client' AND tenant_id = ?";
        params.push(id, tenantId);

        const [result] = await db.query(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado o no pertenece a tu empresa.' });
        }

        res.json({ message: 'Cliente actualizado exitosamente.' });
    } catch (error) {
        console.error('[CUSTOMERS] Error al actualizar cliente:', error);
        res.status(500).json({ message: 'Error al actualizar cliente.' });
    }
};

// Eliminar / dar de baja cliente
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        // Verificar que pertenezca al tenant
        const [customer] = await db.query(
            'SELECT id FROM users WHERE id = ? AND role = "client" AND tenant_id = ?',
            [id, tenantId]
        );

        if (customer.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        // Verificar si tiene reparaciones activas
        const [activeRepairs] = await db.query(
            'SELECT id FROM repairs WHERE customer_id = ? AND tenant_id = ? AND status NOT IN ("delivered", "cancelled") LIMIT 1',
            [id, tenantId]
        );

        if (activeRepairs.length > 0) {
            return res.status(400).json({
                message: 'No es posible eliminar el cliente porque tiene órdenes de reparación activas en curso.'
            });
        }

        // Si tiene historial histórico de reparaciones o ventas, marcar como inactivo para no romper integridad referencial
        const [anyRepairs] = await db.query('SELECT id FROM repairs WHERE customer_id = ? LIMIT 1', [id]);
        const [anySales] = await db.query('SELECT id FROM sales WHERE customer_id = ? LIMIT 1', [id]);

        if (anyRepairs.length > 0 || anySales.length > 0) {
            await db.query('UPDATE users SET is_active = FALSE WHERE id = ? AND tenant_id = ?', [id, tenantId]);
            return res.json({ message: 'Cliente desactivado exitosamente manteniendo su historial contable.' });
        }

        // Si no tiene registros asociados, eliminar permanentemente
        await db.query('DELETE FROM users WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        res.json({ message: 'Cliente eliminado correctamente.' });
    } catch (error) {
        console.error('[CUSTOMERS] Error al eliminar cliente:', error);
        res.status(500).json({ message: 'Error al eliminar cliente.' });
    }
};


