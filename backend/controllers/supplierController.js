const db = require('../config/database');

// =====================================================
// PROVEEDORES (SaaS Scoped)
// =====================================================

// Obtener proveedores de la empresa
exports.getSuppliers = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const [suppliers] = await db.query(
            'SELECT * FROM suppliers WHERE tenant_id = ? AND is_active = TRUE ORDER BY company_name ASC',
            [tenantId]
        );
        res.json(suppliers);
    } catch (error) {
        console.error('[SUPPLIERS] Error al obtener proveedores:', error);
        res.status(500).json({ message: 'Error al obtener proveedores.' });
    }
};

// Crear nuevo proveedor
exports.createSupplier = async (req, res) => {
    try {
        const { company_name, contact_name, email, phone, tax_id, address, notes } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        if (!company_name) {
            return res.status(400).json({ message: 'El nombre de la empresa proveedora es obligatorio.' });
        }

        const [result] = await db.query(`
            INSERT INTO suppliers (tenant_id, company_name, contact_name, email, phone, tax_id, address, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [tenantId, company_name, contact_name || null, email || null, phone || null, tax_id || null, address || null, notes || null]);

        res.status(201).json({
            id: result.insertId,
            message: 'Proveedor registrado exitosamente.'
        });
    } catch (error) {
        console.error('[SUPPLIERS] Error al crear proveedor:', error);
        res.status(500).json({ message: 'Error al registrar proveedor.' });
    }
};

// Actualizar proveedor
exports.updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const { company_name, contact_name, email, phone, tax_id, address, notes, is_active } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        await db.query(`
            UPDATE suppliers SET
                company_name = COALESCE(?, company_name),
                contact_name = COALESCE(?, contact_name),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                tax_id = COALESCE(?, tax_id),
                address = COALESCE(?, address),
                notes = COALESCE(?, notes),
                is_active = COALESCE(?, is_active)
            WHERE id = ? AND tenant_id = ?
        `, [company_name, contact_name, email, phone, tax_id, address, notes, is_active, id, tenantId]);

        res.json({ message: 'Proveedor actualizado exitosamente.' });
    } catch (error) {
        console.error('[SUPPLIERS] Error al actualizar proveedor:', error);
        res.status(500).json({ message: 'Error al actualizar proveedor.' });
    }
};

// Desactivar proveedor
exports.deleteSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        await db.query(
            'UPDATE suppliers SET is_active = FALSE WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );

        res.json({ message: 'Proveedor desactivado.' });
    } catch (error) {
        console.error('[SUPPLIERS] Error al eliminar proveedor:', error);
        res.status(500).json({ message: 'Error al desactivar proveedor.' });
    }
};

// =====================================================
// ÓRDENES DE COMPRA (SaaS & Multi-Branch Scoped)
// =====================================================

// Listar órdenes de compra
exports.getPurchaseOrders = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        const [orders] = await db.query(`
            SELECT po.*, s.company_name as supplier_name, b.name as branch_name
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            JOIN branches b ON po.branch_id = b.id
            WHERE po.tenant_id = ? AND po.branch_id = ?
            ORDER BY po.created_at DESC
        `, [tenantId, branchId]);

        res.json(orders);
    } catch (error) {
        console.error('[SUPPLIERS] Error al obtener órdenes de compra:', error);
        res.status(500).json({ message: 'Error al obtener órdenes de compra.' });
    }
};

// Crear Orden de Compra
exports.createPurchaseOrder = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { supplier_id, items, notes } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;
        const userId = req.user.id;

        if (!supplier_id || !items || items.length === 0) {
            return res.status(400).json({ message: 'Proveedor e ítems son requeridos.' });
        }

        const poNumber = `OC-${Date.now().toString().slice(-6)}`;
        let totalAmount = 0;

        items.forEach(item => {
            totalAmount += (parseFloat(item.unit_cost) || 0) * (parseInt(item.quantity) || 1);
        });

        const [poResult] = await connection.query(`
            INSERT INTO purchase_orders (tenant_id, branch_id, supplier_id, po_number, status, total_amount, notes, created_by, ordered_at)
            VALUES (?, ?, ?, ?, 'ordered', ?, ?, ?, NOW())
        `, [tenantId, branchId, supplier_id, poNumber, totalAmount, notes || null, userId]);

        const poId = poResult.insertId;

        for (const item of items) {
            const qty = parseInt(item.quantity) || 1;
            const cost = parseFloat(item.unit_cost) || 0;
            const subtotal = qty * cost;

            await connection.query(`
                INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost, subtotal)
                VALUES (?, ?, ?, ?, ?)
            `, [poId, item.product_id, qty, cost, subtotal]);
        }

        await connection.commit();
        res.status(201).json({ id: poId, po_number: poNumber, message: 'Orden de compra generada exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('[SUPPLIERS] Error al crear orden de compra:', error);
        res.status(500).json({ message: 'Error al crear orden de compra.' });
    } finally {
        connection.release();
    }
};

// Recibir Orden de Compra (incrementa inventario de sucursal)
exports.receivePurchaseOrder = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [poRows] = await connection.query(
            'SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ? FOR UPDATE',
            [id, tenantId]
        );

        if (poRows.length === 0) {
            return res.status(404).json({ message: 'Orden de compra no encontrada.' });
        }

        const po = poRows[0];
        if (po.status === 'received') {
            return res.status(400).json({ message: 'La orden de compra ya fue recibida anteriormente.' });
        }

        // Obtener ítems
        const [items] = await connection.query(
            'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
            [id]
        );

        for (const item of items) {
            // Actualizar o crear stock en branch_inventory
            const [stockRows] = await connection.query(
                'SELECT stock FROM branch_inventory WHERE product_id = ? AND branch_id = ?',
                [item.product_id, po.branch_id]
            );

            if (stockRows.length > 0) {
                await connection.query(
                    'UPDATE branch_inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                    [item.quantity, item.product_id, po.branch_id]
                );
            } else {
                await connection.query(
                    'INSERT INTO branch_inventory (product_id, branch_id, stock, min_stock) VALUES (?, ?, ?, 5)',
                    [item.product_id, po.branch_id, item.quantity]
                );
            }

            // Registrar movimiento de stock
            await connection.query(`
                INSERT INTO stock_movements (tenant_id, product_id, type, quantity, reference, notes)
                VALUES (?, ?, 'in', ?, ?, ?)
            `, [tenantId, item.product_id, item.quantity, po.po_number, `Recepción de Orden de Compra #${po.po_number}`]);
        }

        // Marcar orden como recibida
        await connection.query(
            "UPDATE purchase_orders SET status = 'received', received_at = NOW() WHERE id = ?",
            [id]
        );

        await connection.commit();
        res.json({ message: 'Mercadería recibida e inventario de sucursal actualizado.' });
    } catch (error) {
        await connection.rollback();
        console.error('[SUPPLIERS] Error al recibir orden de compra:', error);
        res.status(500).json({ message: 'Error al procesar recepción de orden de compra.' });
    } finally {
        connection.release();
    }
};
