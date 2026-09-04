const db = require('../config/database');

// Listar todas las sucursales de mi empresa con métricas operativas
exports.getBranches = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const [branches] = await db.query(`
            SELECT 
                b.*,
                (SELECT COUNT(*) FROM user_branch_assignments uba WHERE uba.branch_id = b.id) as staff_count,
                (SELECT COUNT(*) FROM repairs r WHERE r.branch_id = b.id AND r.status NOT IN ('delivered', 'cancelled')) as active_repairs,
                (SELECT COUNT(*) FROM repairs r WHERE r.branch_id = b.id) as total_repairs,
                (SELECT COUNT(*) FROM sales s WHERE s.branch_id = b.id AND s.status = 'completed') as total_sales,
                (
                    (SELECT COALESCE(SUM(total_cost), 0) FROM repairs r WHERE r.branch_id = b.id) +
                    (SELECT COALESCE(SUM(total), 0) FROM sales s WHERE s.branch_id = b.id AND s.status = 'completed')
                ) as total_revenue
            FROM branches b
            WHERE b.tenant_id = ?
            ORDER BY b.is_main DESC, b.name ASC
        `, [tenantId]);

        const formatted = branches.map(b => ({
            ...b,
            staff_count: parseInt(b.staff_count || 0, 10),
            active_repairs: parseInt(b.active_repairs || 0, 10),
            total_repairs: parseInt(b.total_repairs || 0, 10),
            total_sales: parseInt(b.total_sales || 0, 10),
            total_revenue: parseFloat(b.total_revenue || 0)
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[BRANCHES] Error al obtener sucursales:', error);
        res.status(500).json({ message: 'Error al obtener sucursales.' });
    }
};

// Crear nueva sucursal (TenantAdmin)
exports.createBranch = async (req, res) => {
    try {
        const { code, name, address, phone, email } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        if (!code || !name) {
            return res.status(400).json({ message: 'El código y el nombre son obligatorios.' });
        }

        // Verificar unicidad de código dentro del tenant
        const [existing] = await db.query(
            'SELECT id FROM branches WHERE tenant_id = ? AND code = ?',
            [tenantId, code]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El código de sucursal ya existe en tu empresa.' });
        }

        const [result] = await db.query(`
            INSERT INTO branches (tenant_id, code, name, address, phone, email, is_main, is_active)
            VALUES (?, ?, ?, ?, ?, ?, FALSE, TRUE)
        `, [tenantId, code, name, address || null, phone || null, email || null]);

        res.status(201).json({
            id: result.insertId,
            message: 'Sucursal creada exitosamente.'
        });
    } catch (error) {
        console.error('[BRANCHES] Error al crear sucursal:', error);
        res.status(500).json({ message: 'Error al crear sucursal.' });
    }
};

// Actualizar sucursal (TenantAdmin)
exports.updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, phone, email, is_active } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        const [result] = await db.query(`
            UPDATE branches SET
                name = COALESCE(?, name),
                address = COALESCE(?, address),
                phone = COALESCE(?, phone),
                email = COALESCE(?, email),
                is_active = COALESCE(?, is_active)
            WHERE id = ? AND tenant_id = ?
        `, [name, address, phone, email, is_active, id, tenantId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Sucursal no encontrada o no pertenece a tu empresa.' });
        }

        res.json({ message: 'Sucursal actualizada exitosamente.' });
    } catch (error) {
        console.error('[BRANCHES] Error al actualizar sucursal:', error);
        res.status(500).json({ message: 'Error al actualizar sucursal.' });
    }
};

// Desactivar sucursal (No se elimina físicamente por integridad relacional)
exports.deactivateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        // Verificar que no sea la sucursal matriz/principal
        const [branch] = await db.query('SELECT is_main FROM branches WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (branch.length === 0) {
            return res.status(404).json({ message: 'Sucursal no encontrada.' });
        }
        if (branch[0].is_main) {
            return res.status(400).json({ message: 'No puedes desactivar la sucursal matriz/principal.' });
        }

        await db.query('UPDATE branches SET is_active = FALSE WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        res.json({ message: 'Sucursal desactivada correctamente.' });
    } catch (error) {
        console.error('[BRANCHES] Error al desactivar sucursal:', error);
        res.status(500).json({ message: 'Error al desactivar sucursal.' });
    }
};

// Asignar un usuario del staff a una sucursal
exports.assignUser = async (req, res) => {
    try {
        const { id } = req.params; // branchId
        const { user_id, is_default } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        // Validar que la sucursal pertenece al tenant
        const [branchCheck] = await db.query('SELECT id FROM branches WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (branchCheck.length === 0) {
            return res.status(404).json({ message: 'Sucursal no encontrada.' });
        }

        // Validar que el usuario pertenece al tenant y no sea un cliente
        const [userCheck] = await db.query('SELECT id, role FROM users WHERE id = ? AND tenant_id = ? AND role != "client"', [user_id, tenantId]);
        if (userCheck.length === 0) {
            return res.status(404).json({ message: 'Usuario staff no encontrado en tu empresa.' });
        }

        // Si se marca como predeterminada, quitar el flag default previo del usuario
        if (is_default) {
            await db.query(
                `UPDATE user_branch_assignments uba
                 JOIN branches b ON uba.branch_id = b.id
                 SET uba.is_default = FALSE 
                 WHERE uba.user_id = ? AND b.tenant_id = ?`,
                [user_id, tenantId]
            );
        }

        // Insertar asignación
        await db.query(
            `INSERT INTO user_branch_assignments (user_id, branch_id, is_default)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE is_default = ?`,
            [user_id, id, is_default || false, is_default || false]
        );

        res.json({ message: 'Personal asignado a la sucursal exitosamente.' });
    } catch (error) {
        console.error('[BRANCHES] Error al asignar usuario:', error);
        res.status(500).json({ message: 'Error al asignar personal a la sucursal.' });
    }
};

// Quitar un usuario de una sucursal
exports.removeUser = async (req, res) => {
    try {
        const { id, userId } = req.params; // id = branchId
        const tenantId = req.tenantCtx.tenantId;

        // Validar que la sucursal pertenece al tenant
        const [branchCheck] = await db.query('SELECT id FROM branches WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (branchCheck.length === 0) {
            return res.status(404).json({ message: 'Sucursal no encontrada.' });
        }

        // Borrar asignación
        await db.query(
            'DELETE FROM user_branch_assignments WHERE user_id = ? AND branch_id = ?',
            [userId, id]
        );

        res.json({ message: 'Personal removido de la sucursal correctamente.' });
    } catch (error) {
        console.error('[BRANCHES] Error al remover usuario:', error);
        res.status(500).json({ message: 'Error al remover personal de la sucursal.' });
    }
};

// Listar personal asignado a una sucursal
exports.getBranchUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        // Validar que la sucursal pertenece al tenant
        const [branchCheck] = await db.query('SELECT id FROM branches WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (branchCheck.length === 0) {
            return res.status(404).json({ message: 'Sucursal no encontrada.' });
        }

        const [users] = await db.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.role, uba.is_default
             FROM users u
             JOIN user_branch_assignments uba ON u.id = uba.user_id
             WHERE uba.branch_id = ? AND u.tenant_id = ? AND u.is_active = TRUE`,
            [id, tenantId]
        );

        res.json(users);
    } catch (error) {
        console.error('[BRANCHES] Error al obtener personal de sucursal:', error);
        res.status(500).json({ message: 'Error al obtener personal de la sucursal.' });
    }
};
