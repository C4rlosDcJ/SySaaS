const db = require('../config/database');

// Generar número de venta prefixado
const generateSaleNumber = (branchCode = 'VTA') => {
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${branchCode}-${y}${m}${d}-${rand}`;
};

// =====================================================
// Crear venta (checkout del POS - SaaS & Multi-Branch Scoped)
// =====================================================
exports.createSale = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            customer_id, repair_id, repair_ids, items, discount = 0,
            payment_method, amount_received, change_amount: passedChange,
            notes, pending_sale_id, pending_sale_ids, payment_breakdown, signature
        } = req.body;

        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'La venta debe tener al menos un ítem.' });
        }

        // Calcular subtotal
        let subtotal = 0;
        for (const item of items) {
            const itemTotal = (item.unit_price * item.quantity) - (item.discount || 0);
            subtotal += itemTotal;
        }

        const total = subtotal - (parseFloat(discount) || 0);
        let changeAmount = 0;
        if (payment_method === 'cash') {
            changeAmount = Math.max(0, (parseFloat(amount_received) || 0) - total);
        } else if (payment_method === 'mixed') {
            changeAmount = parseFloat(passedChange) || 0;
        }

        let activeRepairId = repair_id || null;
        let generatedRepairTicket = null;

        // Obtener código de la sucursal activa
        const [branchInfo] = await connection.query('SELECT code FROM branches WHERE id = ?', [branchId]);
        const branchPrefix = branchInfo.length > 0 ? branchInfo[0].code : 'VTA';

        if (!activeRepairId) {
            // Buscar si hay algún ítem de tipo servicio del catálogo
            const serviceItem = items.find(item => item.service_id);
            if (serviceItem) {
                // Obtener detalles de device_type y nombre del servicio
                const [serviceDetails] = await connection.query(
                    'SELECT device_type_id, name FROM services_catalog WHERE id = ? AND tenant_id = ?',
                    [serviceItem.service_id, tenantId]
                );

                let deviceTypeId = null;
                let serviceName = serviceItem.description;

                if (serviceDetails.length > 0) {
                    deviceTypeId = serviceDetails[0].device_type_id;
                    if (!serviceName) {
                        serviceName = serviceDetails[0].name;
                    }
                }

                if (!deviceTypeId) {
                    const [dtRows] = await connection.query('SELECT id FROM device_types WHERE name = "Otro" AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1', [tenantId]);
                    deviceTypeId = dtRows.length > 0 ? dtRows[0].id : null;
                }

                // Obtener cliente por defecto para la sucursal
                let finalCustomerId = customer_id;
                if (!finalCustomerId) {
                    const [custRows] = await connection.query(
                        'SELECT id FROM users WHERE role = "client" AND tenant_id = ? AND branch_id = ? ORDER BY id ASC LIMIT 1',
                        [tenantId, branchId]
                    );
                    if (custRows.length === 0) {
                        await connection.rollback();
                        return res.status(400).json({ message: 'Se necesita registrar al menos un cliente en esta sucursal antes de vender servicios.' });
                    }
                    finalCustomerId = custRows[0].id;
                }

                // Obtener días de garantía por defecto
                const [settings] = await connection.query('SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = "default_warranty_days"', [tenantId]);
                const warrantyDays = settings.length > 0 ? parseInt(settings[0].setting_value) : 30;

                // Generar número de ticket de reparación con prefijo de sucursal
                generatedRepairTicket = `${branchPrefix}-REP-${Date.now().toString().slice(-6)}`;

                const itemPrice = serviceItem.unit_price * serviceItem.quantity - (serviceItem.discount || 0);

                // Insertar registro de reparación del servicio
                const [repairResult] = await connection.query(`
                    INSERT INTO repairs (
                        tenant_id, branch_id, ticket_number, customer_id, device_type_id, model,
                        problem_description, service_requested, service_id,
                        status, payment_status, total_cost, advance_payment,
                        warranty_days, warranty_expires, created_at, started_at, completed_at, delivered_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'delivered', 'paid', ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), NOW(), NOW(), NOW(), NOW())
                `, [
                    tenantId,
                    branchId,
                    generatedRepairTicket,
                    finalCustomerId,
                    deviceTypeId,
                    'Servicio en POS',
                    'Servicio contratado y cobrado directamente en Punto de Venta',
                    serviceName,
                    serviceItem.service_id,
                    itemPrice,
                    itemPrice,
                    warrantyDays,
                    warrantyDays
                ]);

                activeRepairId = repairResult.insertId;

                // Insertar historial de estados
                await connection.query(
                    'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, "received", "Servicio contratado en POS", ?)',
                    [activeRepairId, req.user.id]
                );
                await connection.query(
                    'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, "delivered", "Servicio entregado y pagado en POS", ?)',
                    [activeRepairId, req.user.id]
                );
            }
        }

        const allPendingSaleIds = Array.isArray(pending_sale_ids) && pending_sale_ids.length > 0
            ? pending_sale_ids
            : (pending_sale_id ? [pending_sale_id] : []);

        let saleId = allPendingSaleIds[0] || null;
        let saleNumber;

        if (allPendingSaleIds.length > 0) {
            const primaryPendingId = allPendingSaleIds[0];
            // Obtener número de venta existente de la venta principal
            const [existing] = await connection.query('SELECT sale_number FROM sales WHERE id = ? AND tenant_id = ? AND branch_id = ?', [primaryPendingId, tenantId, branchId]);
            if (existing.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Venta pendiente no encontrada.' });
            }
            saleNumber = existing[0].sale_number;
            saleId = primaryPendingId;

            // Eliminar ítems previos de la venta pendiente principal
            await connection.query('DELETE FROM sale_items WHERE sale_id = ?', [primaryPendingId]);

            // Actualizar la cabecera del registro principal de venta a completada
            await connection.query(
                `UPDATE sales SET customer_id = ?, repair_id = ?, cashier_id = ?, subtotal = ?, discount = ?, total = ?,
                  payment_method = ?, amount_received = ?, change_amount = ?, status = 'completed', notes = ?
                  WHERE id = ? AND tenant_id = ? AND branch_id = ?`,
                [customer_id || null, activeRepairId, req.user.id,
                 subtotal, discount || 0, total, payment_method || 'cash',
                 amount_received || total, changeAmount, notes || null, primaryPendingId, tenantId, branchId]
            );

            // Si se combinaron múltiples pedidos web, consolidar los adicionales
            if (allPendingSaleIds.length > 1) {
                for (let i = 1; i < allPendingSaleIds.length; i++) {
                    const secondaryId = allPendingSaleIds[i];
                    const [secExisting] = await connection.query(
                        'SELECT sale_number FROM sales WHERE id = ? AND tenant_id = ? AND branch_id = ?',
                        [secondaryId, tenantId, branchId]
                    );
                    const secSaleNum = secExisting.length > 0 ? secExisting[0].sale_number : `ID-${secondaryId}`;

                    // Vaciar ítems de la secundaria para no duplicar en auditorías
                    await connection.query('DELETE FROM sale_items WHERE sale_id = ?', [secondaryId]);

                    // Marcar como completada consolidada
                    await connection.query(
                        `UPDATE sales SET status = 'completed', cashier_id = ?, subtotal = 0, discount = 0, total = 0,
                          notes = CONCAT(COALESCE(notes, ''), ' [Consolidado y cobrado en venta principal ${saleNumber}]')
                          WHERE id = ? AND tenant_id = ? AND branch_id = ?`,
                        [req.user.id, secondaryId, tenantId, branchId]
                    );
                }
            }
        } else {
            saleNumber = generateSaleNumber(branchPrefix);

            // Insertar cabecera de venta nueva
            const [saleResult] = await connection.query(
                `INSERT INTO sales (tenant_id, branch_id, sale_number, customer_id, repair_id, cashier_id, subtotal, discount, total,
                  payment_method, amount_received, change_amount, notes, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
                [tenantId, branchId, saleNumber, customer_id || null, activeRepairId, req.user.id,
                 subtotal, discount || 0, total, payment_method || 'cash',
                 amount_received || total, changeAmount, notes || null]
            );
            saleId = saleResult.insertId;
        }

        // Insertar ítems y descontar stock por sucursal
        for (const item of items) {
            const itemTotal = (item.unit_price * item.quantity) - (item.discount || 0);

            await connection.query(
                `INSERT INTO sale_items (sale_id, product_id, service_id, repair_id, description, quantity, unit_price, discount, total)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [saleId, item.product_id || null, item.service_id || null, item.repair_id || null,
                 item.description, item.quantity, item.unit_price, item.discount || 0, itemTotal]
            );

            // Descontar stock si es producto de la sucursal activa
            if (item.product_id) {
                // Verificar que el producto pertenezca al tenant
                const [pRows] = await connection.query('SELECT id FROM products WHERE id = ? AND tenant_id = ?', [item.product_id, tenantId]);
                if (pRows.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ message: `El producto ${item.product_id} no pertenece a esta empresa.` });
                }

                // Descontar stock de branch_inventory
                await connection.query(
                    'UPDATE branch_inventory SET stock = GREATEST(0, stock - ?) WHERE product_id = ? AND branch_id = ?',
                    [item.quantity, item.product_id, branchId]
                );

                // Registrar movimiento de stock
                await connection.query(
                    `INSERT INTO stock_movements (tenant_id, branch_id, product_id, type, quantity, reference, notes, created_by)
                     VALUES (?, ?, ?, 'out', ?, ?, 'Venta POS', ?)`,
                    [tenantId, branchId, item.product_id, item.quantity, saleNumber, req.user.id]
                );
            }
        }

        // Si la venta está vinculada a reparaciones, actualizar estado de pago para TODAS
        // repair_ids es el array completo enviado por el frontend; repair_id es sólo la primera (para compatibilidad de header)
        const allRepairIds = Array.isArray(repair_ids) && repair_ids.length > 0
            ? repair_ids
            : (repair_id ? [repair_id] : []);

        for (const rId of allRepairIds) {
            const [repair] = await connection.query(
                'SELECT total_cost, advance_payment, status, warranty_days, delivered_at, warranty_expires FROM repairs WHERE id = ? AND tenant_id = ?',
                [rId, tenantId]
            );

            if (repair.length > 0) {
                const totalRepairCost = parseFloat(repair[0].total_cost) || 0;
                const previousPayments = parseFloat(repair[0].advance_payment) || 0;

                // Determinar el monto cobrado para esta reparacion especifica
                const repairItem = (items || []).find(i => i.repair_id == rId);
                const repairItemAmount = repairItem
                    ? (parseFloat(repairItem.total) || (parseFloat(repairItem.quantity || 1) * parseFloat(repairItem.unit_price) - (parseFloat(repairItem.discount) || 0)))
                    : 0;

                const repairShare = repairItemAmount > 0
                    ? repairItemAmount
                    : Math.max(0, totalRepairCost - previousPayments);

                const totalPaid = Math.min(totalRepairCost, previousPayments + repairShare);

                let paymentStatus = 'partial';
                let newStatus = repair[0].status;
                if (totalPaid >= totalRepairCost) {
                    paymentStatus = 'paid';
                    newStatus = 'delivered';
                }

                await connection.query(
                    `UPDATE repairs 
                     SET payment_status = ?, 
                         status = ?, 
                         advance_payment = ?,
                         signature_delivery = CASE WHEN ? IS NOT NULL THEN ? ELSE signature_delivery END,
                         delivered_at = CASE WHEN ? = 'delivered' AND delivered_at IS NULL THEN NOW() ELSE delivered_at END,
                         warranty_expires = CASE WHEN ? = 'delivered' AND warranty_expires IS NULL THEN DATE_ADD(NOW(), INTERVAL COALESCE(warranty_days, 30) DAY) ELSE warranty_expires END
                     WHERE id = ? AND tenant_id = ?`,
                    [paymentStatus, newStatus, totalPaid, signature || null, signature || null, newStatus, newStatus, rId, tenantId]
                );

                await connection.query(
                    'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
                    [rId, newStatus, `Cobrado y entregado en POS${signature ? ' con firma de entrega' : ''} (Venta ${saleNumber})`, req.user.id]
                );
            }
        }

        await connection.commit();

        res.status(201).json({
            message: 'Venta registrada exitosamente.',
            sale: {
                id: saleId,
                sale_number: saleNumber,
                total,
                change_amount: changeAmount,
                repair_id: activeRepairId,
                repair_ticket: generatedRepairTicket
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('[POS] Error al crear venta:', error);
        res.status(500).json({ message: 'Error al registrar venta.' });
    } finally {
        connection.release();
    }
};

// =====================================================
// Obtener ventas (historial - SaaS & Multi-Branch Scoped)
// =====================================================
exports.getSales = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, date_from, date_to, payment_method, status, cashier_id } = req.query;
        const offset = (page - 1) * limit;
        const tenantId = req.tenantCtx.tenantId;
        const isGlobalAdmin = ['tenant_admin', 'admin', 'superadmin'].includes(req.user.role);
        let branchId = null;

        if (!isGlobalAdmin && req.tenantCtx.branchId) {
            branchId = req.tenantCtx.branchId;
        } else if (req.query.branch_id) {
            branchId = parseInt(req.query.branch_id, 10);
        } else if (isGlobalAdmin && req.headers['x-branch-id']) {
            branchId = parseInt(req.headers['x-branch-id'], 10);
        }

        let query = `
            SELECT s.*,
                u.first_name as customer_first_name, u.last_name as customer_last_name,
                c.first_name as cashier_first_name, c.last_name as cashier_last_name,
                r.ticket_number as repair_ticket,
                b.name as branch_name
            FROM sales s
            LEFT JOIN users u ON s.customer_id = u.id
            LEFT JOIN users c ON s.cashier_id = c.id
            LEFT JOIN repairs r ON s.repair_id = r.id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE s.tenant_id = ?
        `;
        const params = [tenantId];

        if (branchId) {
            query += ' AND s.branch_id = ?';
            params.push(branchId);
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            query += ' AND (s.sale_number LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name, " ", u.last_name) LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR r.ticket_number LIKE ?)';
            params.push(term, term, term, term, term, term, term);
        }

        if (date_from) {
            query += ' AND DATE(s.created_at) >= ?';
            params.push(date_from);
        }
        if (date_to) {
            query += ' AND DATE(s.created_at) <= ?';
            params.push(date_to);
        }
        if (payment_method) {
            query += ' AND s.payment_method = ?';
            params.push(payment_method);
        }
        if (status) {
            query += ' AND s.status = ?';
            params.push(status);
        }
        if (cashier_id) {
            query += ' AND s.cashier_id = ?';
            params.push(cashier_id);
        }

        // Count first
        let countQuery = query.replace(/SELECT s\.\*,[\s\S]*?FROM sales s/, 'SELECT COUNT(*) as total FROM sales s');
        const [countResult] = await db.query(countQuery, params);

        query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [sales] = await db.query(query, params);

        res.json({
            sales,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('[POS] Error al obtener ventas:', error);
        res.status(500).json({ message: 'Error al obtener ventas.' });
    }
};

// =====================================================
// Obtener detalle de venta (SaaS Scoped)
// =====================================================
exports.getSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [sales] = await db.query(`
            SELECT s.*,
                u.first_name as customer_first_name, u.last_name as customer_last_name,
                u.phone as customer_phone, u.email as customer_email,
                c.first_name as cashier_first_name, c.last_name as cashier_last_name,
                r.ticket_number as repair_ticket,
                r.warranty_days as repair_warranty_days,
                r.warranty_expires as repair_warranty_expires
            FROM sales s
            LEFT JOIN users u ON s.customer_id = u.id
            LEFT JOIN users c ON s.cashier_id = c.id
            LEFT JOIN repairs r ON s.repair_id = r.id
            WHERE s.id = ? AND s.tenant_id = ?
        `, [id, tenantId]);

        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada.' });
        }

        // Obtener ítems
        const [items] = await db.query(
            `SELECT si.*, p.sku, p.name as product_name
             FROM sale_items si
             LEFT JOIN products p ON si.product_id = p.id
             WHERE si.sale_id = ?`,
            [id]
        );

        res.json({ ...sales[0], items });
    } catch (error) {
        console.error('[POS] Error al obtener detalle de venta:', error);
        res.status(500).json({ message: 'Error al obtener venta.' });
    }
};

// =====================================================
// Cancelar venta (SaaS & Multi-Branch Scoped)
// =====================================================
exports.cancelSale = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        const [sales] = await connection.query('SELECT * FROM sales WHERE id = ? AND tenant_id = ? AND branch_id = ?', [id, tenantId, branchId]);

        if (sales.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Venta no encontrada.' });
        }

        if (sales[0].status === 'cancelled') {
            await connection.rollback();
            return res.status(400).json({ message: 'La venta ya está cancelada.' });
        }

        // Obtener items para devolver stock a la sucursal (solo no devueltos previamente)
        const [items] = await connection.query('SELECT si.*, si.repair_id FROM sale_items si WHERE si.sale_id = ?', [id]);

        for (const item of items) {
            if (item.product_id && !item.is_returned) {
                // Devolver stock a branch_inventory
                await connection.query(
                    'UPDATE branch_inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                    [item.quantity, item.product_id, branchId]
                );

                await connection.query(
                    `INSERT INTO stock_movements (tenant_id, branch_id, product_id, type, quantity, reference, notes, created_by)
                     VALUES (?, ?, ?, 'in', ?, ?, 'Cancelación de venta', ?)`,
                    [tenantId, branchId, item.product_id, item.quantity, sales[0].sale_number, req.user.id]
                );
            }
        }

        // Revertir reparaciones vinculadas a la venta que no hayan sido devueltas individualmente
        const linkedRepairIds = new Set();
        for (const item of items) {
            if (item.repair_id && !item.is_returned) {
                linkedRepairIds.add(item.repair_id);
            }
        }
        if (sales[0].repair_id && linkedRepairIds.size === 0) {
            const hasReturnedGlobal = items.some(i => i.repair_id === sales[0].repair_id && i.is_returned);
            if (!hasReturnedGlobal) {
                linkedRepairIds.add(sales[0].repair_id);
            }
        }

        for (const rId of linkedRepairIds) {
            // Revertir estado a 'ready' y pago a 'partial' si tenía anticipo, o 'pending' si no
            const [repairRows] = await connection.query(
                'SELECT advance_payment, total_cost, status FROM repairs WHERE id = ? AND tenant_id = ?',
                [rId, tenantId]
            );
            if (repairRows.length > 0) {
                const rep = repairRows[0];
                const revertStatus = (rep.status === 'delivered') ? 'ready' : rep.status;
                const advance = parseFloat(rep.advance_payment) || 0;
                const itemForRepair = items.find(i => i.repair_id === rId);
                const paidInSale = itemForRepair ? (parseFloat(itemForRepair.total) || 0) : 0;
                const newAdvance = Math.max(0, advance - paidInSale);
                const revertPayment = newAdvance > 0 ? 'partial' : 'pending';

                await connection.query(
                    'UPDATE repairs SET status = ?, payment_status = ?, advance_payment = ? WHERE id = ? AND tenant_id = ?',
                    [revertStatus, revertPayment, newAdvance, rId, tenantId]
                );

                await connection.query(
                    'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
                    [rId, revertStatus, `Estado revertido por cancelación de venta ${sales[0].sale_number}`, req.user.id]
                );
            }
        }

        // Marcar todos los ítems como devueltos
        await connection.query(
            'UPDATE sale_items SET is_returned = 1, returned_at = COALESCE(returned_at, NOW()), return_reason = COALESCE(return_reason, \'Cancelación total de venta\') WHERE sale_id = ?',
            [id]
        );

        await connection.query('UPDATE sales SET status = ? WHERE id = ? AND tenant_id = ? AND branch_id = ?', ['cancelled', id, tenantId, branchId]);

        await connection.commit();
        res.json({ message: 'Venta cancelada exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('[POS] Error al cancelar venta:', error);
        res.status(500).json({ message: 'Error al cancelar venta.' });
    } finally {
        connection.release();
    }
};

// =====================================================
// Devolución / Descarte de ítem individual (SaaS & Multi-Branch Scoped)
// =====================================================
exports.returnSaleItem = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id: saleId, itemId } = req.params;
        const { reason } = req.body || {};
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        // Verificar que la venta exista y pertenezca al tenant y sucursal
        const [sales] = await connection.query(
            'SELECT * FROM sales WHERE id = ? AND tenant_id = ? AND branch_id = ?',
            [saleId, tenantId, branchId]
        );

        if (sales.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Venta no encontrada.' });
        }

        const sale = sales[0];
        if (sale.status === 'cancelled') {
            await connection.rollback();
            return res.status(400).json({ message: 'No se puede devolver un ítem de una venta ya cancelada.' });
        }

        // Obtener el ítem específico
        const [items] = await connection.query(
            'SELECT * FROM sale_items WHERE id = ? AND sale_id = ?',
            [itemId, saleId]
        );

        if (items.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Ítem no encontrado en esta venta.' });
        }

        const item = items[0];
        if (item.is_returned) {
            await connection.rollback();
            return res.status(400).json({ message: 'Este ítem ya ha sido devuelto anteriormente.' });
        }

        // 1. Si es producto, reponer stock a branch_inventory y registrar movimiento
        if (item.product_id) {
            await connection.query(
                'UPDATE branch_inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                [item.quantity, item.product_id, branchId]
            );

            await connection.query(
                `INSERT INTO stock_movements (tenant_id, branch_id, product_id, type, quantity, reference, notes, created_by)
                 VALUES (?, ?, ?, 'in', ?, ?, ?, ?)`,
                [tenantId, branchId, item.product_id, item.quantity, sale.sale_number, `Devolución de ítem: ${item.description}${reason ? ` (${reason})` : ''}`, req.user.id]
            );
        }

        // 2. Si es reparación, revertir estado a ready y ajustar anticipo / estatus de pago
        const targetRepairId = item.repair_id || (sale.repair_id ? sale.repair_id : null);
        if (targetRepairId) {
            const [repairRows] = await connection.query(
                'SELECT advance_payment, total_cost, status FROM repairs WHERE id = ? AND tenant_id = ?',
                [targetRepairId, tenantId]
            );

            if (repairRows.length > 0) {
                const rep = repairRows[0];
                const revertStatus = (rep.status === 'delivered') ? 'ready' : rep.status;
                const currentAdvance = parseFloat(rep.advance_payment) || 0;
                const itemTotal = parseFloat(item.total) || 0;
                const newAdvance = Math.max(0, currentAdvance - itemTotal);
                const newPayment = newAdvance > 0 ? 'partial' : 'pending';

                await connection.query(
                    'UPDATE repairs SET status = ?, payment_status = ?, advance_payment = ? WHERE id = ? AND tenant_id = ?',
                    [revertStatus, newPayment, newAdvance, targetRepairId, tenantId]
                );

                await connection.query(
                    'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
                    [targetRepairId, revertStatus, `Ítem retirado por devolución de venta ${sale.sale_number}${reason ? `: ${reason}` : ''}`, req.user.id]
                );
            }
        }

        // 3. Marcar el ítem como devuelto en sale_items
        const returnReason = reason && reason.trim() ? reason.trim() : 'Devolución de cliente';
        await connection.query(
            'UPDATE sale_items SET is_returned = 1, returned_at = NOW(), return_reason = ? WHERE id = ?',
            [returnReason, itemId]
        );

        // 4. Recalcular montos de la venta
        const itemTotal = parseFloat(item.total) || 0;
        const itemDiscount = parseFloat(item.discount) || 0;
        const itemSubtotal = (parseFloat(item.unit_price) * parseInt(item.quantity)) || itemTotal;

        const newTotal = Math.max(0, parseFloat(sale.total) - itemTotal);
        const newSubtotal = Math.max(0, parseFloat(sale.subtotal) - itemSubtotal);
        const newDiscount = Math.max(0, parseFloat(sale.discount) - itemDiscount);

        // Verificar si quedan ítems activos no devueltos
        const [remainingRows] = await connection.query(
            'SELECT COUNT(*) as activeCount FROM sale_items WHERE sale_id = ? AND (is_returned = 0 OR is_returned IS NULL)',
            [saleId]
        );

        const isFullyReturned = remainingRows[0].activeCount === 0;
        const newStatus = isFullyReturned ? 'refunded' : sale.status;

        await connection.query(
            'UPDATE sales SET total = ?, subtotal = ?, discount = ?, status = ? WHERE id = ? AND tenant_id = ? AND branch_id = ?',
            [newTotal, newSubtotal, newDiscount, newStatus, saleId, tenantId, branchId]
        );

        await connection.commit();

        res.json({
            message: 'Ítem devuelto exitosamente.',
            isFullyReturned,
            newStatus,
            newTotal,
            returnedItemId: itemId
        });
    } catch (error) {
        await connection.rollback();
        console.error('[POS] Error al devolver ítem de venta:', error);
        res.status(500).json({ message: 'Error al procesar la devolución del ítem.' });
    } finally {
        connection.release();
    }
};

// =====================================================
// Estadísticas de ventas (SaaS & Multi-Branch Scoped)
// =====================================================
exports.getSalesStats = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const isGlobalAdmin = ['tenant_admin', 'admin', 'superadmin'].includes(req.user.role);
        let branchId = null;

        if (!isGlobalAdmin && req.tenantCtx.branchId) {
            branchId = req.tenantCtx.branchId;
        } else if (req.query.branch_id) {
            branchId = parseInt(req.query.branch_id, 10);
        } else if (isGlobalAdmin && req.headers['x-branch-id']) {
            branchId = parseInt(req.headers['x-branch-id'], 10);
        }

        const branchCondition = branchId ? ' AND branch_id = ?' : '';
        const branchParams = branchId ? [tenantId, branchId] : [tenantId];

        // Ventas de hoy
        const [todaySales] = await db.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
             FROM sales WHERE DATE(created_at) = CURDATE() AND status = 'completed' AND tenant_id = ? ${branchCondition}`,
            branchParams
        );

        // Ventas de la semana
        const [weekSales] = await db.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
             FROM sales WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) AND status = 'completed' AND tenant_id = ? ${branchCondition}`,
            branchParams
        );

        // Ventas del mes
        const [monthSales] = await db.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
             FROM sales WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND status = 'completed' AND tenant_id = ? ${branchCondition}`,
            branchParams
        );

        // Ventas totales históricas
        const [totalSales] = await db.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
             FROM sales WHERE status = 'completed' AND tenant_id = ? ${branchCondition}`,
            branchParams
        );

        // Ventas por día (últimos 30 días)
        const [dailySales] = await db.query(
            `SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total) as total
             FROM sales WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status = 'completed' AND tenant_id = ? ${branchCondition}
             GROUP BY DATE(created_at) ORDER BY date ASC`,
            branchParams
        );

        // Ventas por método de pago (mes actual)
        const [byPaymentMethod] = await db.query(
            `SELECT payment_method, COUNT(*) as count, SUM(total) as total
             FROM sales WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND status = 'completed' AND tenant_id = ? ${branchCondition}
             GROUP BY payment_method`,
            branchParams
        );

        // Productos más vendidos (mes actual)
        const [topProducts] = await db.query(
            `SELECT si.description, SUM(si.quantity) as total_qty, SUM(si.total) as total_revenue
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE YEAR(s.created_at) = YEAR(CURDATE()) AND MONTH(s.created_at) = MONTH(CURDATE()) AND s.status = 'completed' AND s.tenant_id = ? ${branchCondition.replace('branch_id', 's.branch_id')}
             GROUP BY si.description
             ORDER BY total_qty DESC LIMIT 10`,
            branchParams
        );

        const monthTotal = parseFloat(monthSales[0]?.total || 0);
        const monthCount = parseInt(monthSales[0]?.count || 0, 10);
        const avgTicket = monthCount > 0 ? (monthTotal / monthCount) : 0;

        res.json({
            today: { count: parseInt(todaySales[0]?.count || 0, 10), total: parseFloat(todaySales[0]?.total || 0) },
            week: { count: parseInt(weekSales[0]?.count || 0, 10), total: parseFloat(weekSales[0]?.total || 0) },
            month: { count: monthCount, total: monthTotal, averageTicket: avgTicket },
            allTime: { count: parseInt(totalSales[0]?.count || 0, 10), total: parseFloat(totalSales[0]?.total || 0) },
            dailySales: dailySales.map(d => ({ date: d.date, count: parseInt(d.count || 0, 10), total: parseFloat(d.total || 0) })),
            byPaymentMethod,
            topProducts
        });
    } catch (error) {
        console.error('[POS] Error al obtener estadísticas:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas de ventas.' });
    }
};

// =====================================================
// Obtener reparaciones cobrables (para pestaña en POS)
// =====================================================
exports.getBillableRepairs = async (req, res) => {
    try {
        const { search } = req.query;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        let query = `
            SELECT r.id, r.ticket_number, r.status, r.payment_status,
                r.total_cost, r.advance_payment, r.diagnosis_cost, r.labor_cost,
                r.parts_cost, r.discount,
                r.model, r.problem_description, r.service_requested,
                u.first_name as customer_first_name, u.last_name as customer_last_name,
                u.id as customer_id, u.phone as customer_phone,
                dt.name as device_type_name,
                b.name as brand_name, r.brand_other,
                sc.name as service_name
            FROM repairs r
            LEFT JOIN users u ON r.customer_id = u.id
            LEFT JOIN device_types dt ON r.device_type_id = dt.id
            LEFT JOIN brands b ON r.brand_id = b.id
            LEFT JOIN services_catalog sc ON r.service_id = sc.id
            WHERE r.status IN ('ready', 'quality_check', 'waiting_approval', 'repairing')
              AND (r.payment_status IS NULL OR r.payment_status != 'paid')
              AND r.total_cost > 0
              AND r.tenant_id = ? AND r.branch_id = ?
        `;
        const params = [tenantId, branchId];

        if (search) {
            query += ` AND (r.ticket_number LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR r.model LIKE ?)`;
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += ' ORDER BY FIELD(r.status, "ready", "quality_check", "repairing", "waiting_approval"), r.created_at DESC LIMIT 50';

        const [repairs] = await db.query(query, params);

        // Calculate balance for each
        const result = repairs.map(r => ({
            ...r,
            balance: Math.max(0, (parseFloat(r.total_cost) || 0) - (parseFloat(r.advance_payment) || 0))
        }));

        res.json(result);
    } catch (error) {
        console.error('[POS] Error al obtener reparaciones cobrables:', error);
        res.status(500).json({ message: 'Error al obtener reparaciones.' });
    }
};

// =====================================================
// Obtener una reparación específica para POS (deep-link)
// =====================================================
exports.getRepairForPOS = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        const [repairs] = await db.query(`
            SELECT r.id, r.ticket_number, r.status, r.payment_status,
                r.total_cost, r.advance_payment, r.diagnosis_cost, r.labor_cost,
                r.parts_cost, r.discount,
                r.model, r.problem_description, r.service_requested,
                u.first_name as customer_first_name, u.last_name as customer_last_name,
                u.id as customer_id, u.phone as customer_phone, u.email as customer_email,
                dt.name as device_type_name,
                b.name as brand_name, r.brand_other,
                sc.name as service_name
            FROM repairs r
            LEFT JOIN users u ON r.customer_id = u.id
            LEFT JOIN device_types dt ON r.device_type_id = dt.id
            LEFT JOIN brands b ON r.brand_id = b.id
            LEFT JOIN services_catalog sc ON r.service_id = sc.id
            WHERE r.id = ? AND r.tenant_id = ? AND r.branch_id = ?
        `, [id, tenantId, branchId]);

        if (repairs.length === 0) {
            return res.status(404).json({ message: 'Reparación no encontrada.' });
        }

        const r = repairs[0];
        r.balance = Math.max(0, (parseFloat(r.total_cost) || 0) - (parseFloat(r.advance_payment) || 0));

        res.json(r);
    } catch (error) {
        console.error('[POS] Error al obtener reparación para POS:', error);
        res.status(500).json({ message: 'Error al obtener reparación.' });
    }
};
