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
            customer_id, repair_id, items, discount = 0,
            payment_method, amount_received, notes, pending_sale_id
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
        const changeAmount = payment_method === 'cash'
            ? Math.max(0, (parseFloat(amount_received) || 0) - total)
            : 0;

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

        let saleId = pending_sale_id;
        let saleNumber;

        if (pending_sale_id) {
            // Obtener número de venta existente
            const [existing] = await connection.query('SELECT sale_number FROM sales WHERE id = ? AND tenant_id = ? AND branch_id = ?', [pending_sale_id, tenantId, branchId]);
            if (existing.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Venta pendiente no encontrada.' });
            }
            saleNumber = existing[0].sale_number;

            // Eliminar ítems previos de esta venta pendiente
            await connection.query('DELETE FROM sale_items WHERE sale_id = ?', [pending_sale_id]);

            // Actualizar la cabecera del registro existente de venta
            await connection.query(
                `UPDATE sales SET customer_id = ?, repair_id = ?, cashier_id = ?, subtotal = ?, discount = ?, total = ?,
                  payment_method = ?, amount_received = ?, change_amount = ?, status = 'completed', notes = ?
                  WHERE id = ? AND tenant_id = ? AND branch_id = ?`,
                [customer_id || null, activeRepairId, req.user.id,
                 subtotal, discount || 0, total, payment_method || 'cash',
                 amount_received || total, changeAmount, notes || null, pending_sale_id, tenantId, branchId]
            );
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
                `INSERT INTO sale_items (sale_id, product_id, service_id, description, quantity, unit_price, discount, total)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [saleId, item.product_id || null, item.service_id || null,
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

        // Si la venta está vinculada a una reparación, actualizar estado de pago
        if (activeRepairId && repair_id) {
            const [repair] = await connection.query(
                'SELECT total_cost, advance_payment FROM repairs WHERE id = ? AND tenant_id = ?',
                [activeRepairId, tenantId]
            );

            if (repair.length > 0) {
                const totalRepairCost = parseFloat(repair[0].total_cost) || 0;
                const previousPayments = parseFloat(repair[0].advance_payment) || 0;
                const totalPaid = previousPayments + total;

                let paymentStatus = 'partial';
                if (totalPaid >= totalRepairCost) {
                    paymentStatus = 'paid';
                }

                await connection.query(
                    'UPDATE repairs SET payment_status = ?, advance_payment = ? WHERE id = ? AND tenant_id = ?',
                    [paymentStatus, totalPaid, activeRepairId, tenantId]
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
        const { page = 1, limit = 20, date_from, date_to, payment_method, cashier_id } = req.query;
        const offset = (page - 1) * limit;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        let query = `
            SELECT s.*,
                u.first_name as customer_first_name, u.last_name as customer_last_name,
                c.first_name as cashier_first_name, c.last_name as cashier_last_name,
                r.ticket_number as repair_ticket
            FROM sales s
            LEFT JOIN users u ON s.customer_id = u.id
            LEFT JOIN users c ON s.cashier_id = c.id
            LEFT JOIN repairs r ON s.repair_id = r.id
            WHERE s.tenant_id = ? AND s.branch_id = ?
        `;
        const params = [tenantId, branchId];

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

        // Obtener items para devolver stock a la sucursal
        const [items] = await connection.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

        for (const item of items) {
            if (item.product_id) {
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
// Estadísticas de ventas (SaaS & Multi-Branch Scoped)
// =====================================================
exports.getSalesStats = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        // Ventas de hoy
        const [todaySales] = await db.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
             FROM sales WHERE DATE(created_at) = CURDATE() AND status = 'completed' AND tenant_id = ? AND branch_id = ?`,
            [tenantId, branchId]
        );

        // Ventas de la semana
        const [weekSales] = await db.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
             FROM sales WHERE YEARWEEK(created_at) = YEARWEEK(CURDATE()) AND status = 'completed' AND tenant_id = ? AND branch_id = ?`,
            [tenantId, branchId]
        );

        // Ventas del mes
        const [monthSales] = await db.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
             FROM sales WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND status = 'completed' AND tenant_id = ? AND branch_id = ?`,
            [tenantId, branchId]
        );

        // Ventas por día (últimos 30 días)
        const [dailySales] = await db.query(
            `SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total) as total
             FROM sales WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status = 'completed' AND tenant_id = ? AND branch_id = ?
             GROUP BY DATE(created_at) ORDER BY date ASC`,
            [tenantId, branchId]
        );

        // Ventas por método de pago (mes actual)
        const [byPaymentMethod] = await db.query(
            `SELECT payment_method, COUNT(*) as count, SUM(total) as total
             FROM sales WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND status = 'completed' AND tenant_id = ? AND branch_id = ?
             GROUP BY payment_method`,
            [tenantId, branchId]
        );

        // Productos más vendidos (mes actual)
        const [topProducts] = await db.query(
            `SELECT si.description, SUM(si.quantity) as total_qty, SUM(si.total) as total_revenue
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE YEAR(s.created_at) = YEAR(CURDATE()) AND MONTH(s.created_at) = MONTH(CURDATE()) AND s.status = 'completed' AND s.tenant_id = ? AND s.branch_id = ?
             GROUP BY si.description
             ORDER BY total_qty DESC LIMIT 10`,
            [tenantId, branchId]
        );

        res.json({
            today: todaySales[0],
            week: weekSales[0],
            month: monthSales[0],
            dailySales,
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
