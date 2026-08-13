const db = require('../config/database');

// Listar traslados de inventario del tenant
exports.getTransfers = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const [transfers] = await db.query(
            `SELECT t.*, 
                    sb.name as source_branch_name, db.name as destination_branch_name,
                    CONCAT(u.first_name, ' ', u.last_name) as requested_by_name,
                    CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
             FROM inventory_transfers t
             JOIN branches sb ON t.source_branch_id = sb.id
             JOIN branches db ON t.destination_branch_id = db.id
             LEFT JOIN users u ON t.requested_by = u.id
             LEFT JOIN users a ON t.approved_by = a.id
             WHERE t.tenant_id = ?
             ORDER BY t.created_at DESC`,
            [tenantId]
        );
        res.json(transfers);
    } catch (error) {
        console.error('[TRANSFERS] Error al obtener traslados:', error);
        res.status(500).json({ message: 'Error al obtener traslados.' });
    }
};

// Crear solicitud de traspaso
exports.createTransfer = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { source_branch_id, destination_branch_id, notes, items } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        if (!source_branch_id || !destination_branch_id || !items || items.length === 0) {
            return res.status(400).json({ message: 'Rellena todos los campos e incluye al menos un producto.' });
        }

        if (source_branch_id === destination_branch_id) {
            return res.status(400).json({ message: 'La sucursal de origen y destino no pueden ser la misma.' });
        }

        // 1. Validar que ambas sucursales pertenezcan al tenant
        const [branches] = await connection.query(
            'SELECT id FROM branches WHERE id IN (?, ?) AND tenant_id = ? AND is_active = TRUE',
            [source_branch_id, destination_branch_id, tenantId]
        );
        if (branches.length < 2) {
            await connection.rollback();
            return res.status(400).json({ message: 'Una o ambas sucursales son inválidas.' });
        }

        // 2. Validar stock de origen y existencia de productos
        const validatedItems = [];
        for (const item of items) {
            const [stockRows] = await connection.query(
                `SELECT stock FROM branch_inventory WHERE product_id = ? AND branch_id = ?`,
                [item.product_id, source_branch_id]
            );

            const availableStock = stockRows.length > 0 ? stockRows[0].stock : 0;
            if (availableStock < item.quantity) {
                await connection.rollback();
                return res.status(400).json({ 
                    message: `Stock insuficiente en origen para el producto ID ${item.product_id}. Disponible: ${availableStock}` 
                });
            }

            validatedItems.push({
                product_id: item.product_id,
                quantity: item.quantity
            });
        }

        // 3. Registrar traspaso
        const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;
        const [transferResult] = await connection.query(
            `INSERT INTO inventory_transfers (tenant_id, transfer_number, source_branch_id, destination_branch_id, notes, requested_by, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [tenantId, transferNumber, source_branch_id, destination_branch_id, notes || null, req.user.id]
        );

        const transferId = transferResult.insertId;

        // 4. Registrar items del traspaso
        for (const item of validatedItems) {
            await connection.query(
                `INSERT INTO inventory_transfer_items (transfer_id, product_id, quantity)
                 VALUES (?, ?, ?)`,
                [transferId, item.product_id, item.quantity]
            );
        }

        await connection.commit();
        res.status(201).json({ id: transferId, transfer_number: transferNumber, message: 'Solicitud de traspaso registrada.' });
    } catch (error) {
        await connection.rollback();
        console.error('[TRANSFERS] Error al crear traspaso:', error);
        res.status(500).json({ message: 'Error al registrar traspaso.' });
    } finally {
        connection.release();
    }
};

// Aprobar solicitud (Pone en transito y descuenta del origen)
exports.approveTransfer = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        // Obtener traspaso
        const [transfers] = await connection.query(
            'SELECT * FROM inventory_transfers WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );

        if (transfers.length === 0) {
            return res.status(404).json({ message: 'Traspaso no encontrado.' });
        }

        const transfer = transfers[0];
        if (transfer.status !== 'pending') {
            return res.status(400).json({ message: 'Solo puedes aprobar traspasos pendientes.' });
        }

        // Obtener items
        const [items] = await connection.query(
            'SELECT product_id, quantity FROM inventory_transfer_items WHERE transfer_id = ?',
            [id]
        );

        // Descontar stock de origen y verificar que sigue habiendo stock
        for (const item of items) {
            const [stockRows] = await connection.query(
                'SELECT stock FROM branch_inventory WHERE product_id = ? AND branch_id = ?',
                [item.product_id, transfer.source_branch_id]
            );
            const currentStock = stockRows.length > 0 ? stockRows[0].stock : 0;
            if (currentStock < item.quantity) {
                await connection.rollback();
                return res.status(400).json({ message: `El stock cambió y ya no hay suficiente saldo en origen.` });
            }

            // Descontar
            await connection.query(
                'UPDATE branch_inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                [item.quantity, item.product_id, transfer.source_branch_id]
            );

            // Registrar movimiento de stock de salida
            await connection.query(
                `INSERT INTO stock_movements (tenant_id, branch_id, product_id, type, quantity, reference, notes, created_by)
                 VALUES (?, ?, ?, 'out', ?, ?, 'Traspaso en tránsito', ?)`,
                [tenantId, transfer.source_branch_id, item.product_id, item.quantity, transfer.transfer_number, req.user.id]
            );
        }

        // Actualizar estado a 'in_transit'
        await connection.query(
            `UPDATE inventory_transfers 
             SET status = 'in_transit', approved_by = ? 
             WHERE id = ?`,
            [req.user.id, id]
        );

        await connection.commit();
        res.json({ message: 'Traspaso aprobado. Stock en tránsito.' });
    } catch (error) {
        await connection.rollback();
        console.error('[TRANSFERS] Error al aprobar traspaso:', error);
        res.status(500).json({ message: 'Error al aprobar traspaso.' });
    } finally {
        connection.release();
    }
};

// Completar/Recibir traspaso (Suma stock en destino)
exports.completeTransfer = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        // Obtener traspaso
        const [transfers] = await connection.query(
            'SELECT * FROM inventory_transfers WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );

        if (transfers.length === 0) {
            return res.status(404).json({ message: 'Traspaso no encontrado.' });
        }

        const transfer = transfers[0];
        if (transfer.status !== 'in_transit') {
            return res.status(400).json({ message: 'Solo puedes recibir traspasos que están en tránsito.' });
        }

        // Obtener items
        const [items] = await connection.query(
            'SELECT product_id, quantity FROM inventory_transfer_items WHERE transfer_id = ?',
            [id]
        );

        // Sumar stock en destino (asegurando insertar fila si no existe el registro en la sucursal)
        for (const item of items) {
            const [existing] = await connection.query(
                'SELECT stock FROM branch_inventory WHERE product_id = ? AND branch_id = ?',
                [item.product_id, transfer.destination_branch_id]
            );

            if (existing.length > 0) {
                await connection.query(
                    'UPDATE branch_inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                    [item.quantity, item.product_id, transfer.destination_branch_id]
                );
            } else {
                await connection.query(
                    'INSERT INTO branch_inventory (product_id, branch_id, stock) VALUES (?, ?, ?)',
                    [item.product_id, transfer.destination_branch_id, item.quantity]
                );
            }

            // Registrar movimiento de stock de entrada
            await connection.query(
                `INSERT INTO stock_movements (tenant_id, branch_id, product_id, type, quantity, reference, notes, created_by)
                 VALUES (?, ?, ?, 'in', ?, ?, 'Traspaso recibido', ?)`,
                [tenantId, transfer.destination_branch_id, item.product_id, item.quantity, transfer.transfer_number, req.user.id]
            );
        }

        // Actualizar estado a 'completed'
        await connection.query(
            `UPDATE inventory_transfers 
             SET status = 'completed', completed_at = NOW() 
             WHERE id = ?`,
            [id]
        );

        await connection.commit();
        res.json({ message: 'Traspaso completado correctamente. Stock disponible en destino.' });
    } catch (error) {
        await connection.rollback();
        console.error('[TRANSFERS] Error al recibir traspaso:', error);
        res.status(500).json({ message: 'Error al completar traspaso.' });
    } finally {
        connection.release();
    }
};

// Cancelar traspaso (Solo si está pendiente, o si está en tránsito devuelve stock al origen)
exports.cancelTransfer = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        // Obtener traspaso
        const [transfers] = await connection.query(
            'SELECT * FROM inventory_transfers WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );

        if (transfers.length === 0) {
            return res.status(404).json({ message: 'Traspaso no encontrado.' });
        }

        const transfer = transfers[0];
        if (['completed', 'cancelled'].includes(transfer.status)) {
            return res.status(400).json({ message: 'No puedes cancelar un traspaso ya completado o cancelado.' });
        }

        // Si estaba en tránsito, devolver el stock a la sucursal de origen
        if (transfer.status === 'in_transit') {
            const [items] = await connection.query(
                'SELECT product_id, quantity FROM inventory_transfer_items WHERE transfer_id = ?',
                [id]
            );

            for (const item of items) {
                await connection.query(
                    'UPDATE branch_inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                    [item.quantity, item.product_id, transfer.source_branch_id]
                );

                await connection.query(
                    `INSERT INTO stock_movements (tenant_id, branch_id, product_id, type, quantity, reference, notes, created_by)
                     VALUES (?, ?, ?, 'in', ?, ?, 'Traspaso cancelado (retorno stock)', ?)`,
                    [tenantId, transfer.source_branch_id, item.product_id, item.quantity, transfer.transfer_number, req.user.id]
                );
            }
        }

        // Actualizar estado a 'cancelled'
        await connection.query(
            `UPDATE inventory_transfers SET status = 'cancelled' WHERE id = ?`,
            [id]
        );

        await connection.commit();
        res.json({ message: 'Traspaso cancelado correctamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('[TRANSFERS] Error al cancelar traspaso:', error);
        res.status(500).json({ message: 'Error al cancelar traspaso.' });
    } finally {
        connection.release();
    }
};
