const db = require('../config/database');
const { sendEmail } = require('../services/emailService');

// Generar número de ticket único con prefijo de sucursal si está disponible
const generateTicketNumber = (branchCode = 'REP') => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${branchCode}-${year}${month}${day}-${random}`;
};

// Obtener todas las reparaciones (SaaS Scoped)
exports.getAll = async (req, res) => {
    try {
        const { status, customer_id, technician_id, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const tenantId = req.tenantCtx.tenantId;
        const isGlobalAdmin = ['tenant_admin', 'admin', 'superadmin'].includes(req.user.role);
        let branchId = null;

        if (req.user.role === 'client') {
            // El cliente debe ver todas sus reparaciones dentro del tenant
            branchId = null;
        } else if (!isGlobalAdmin && req.tenantCtx.branchId) {
            branchId = req.tenantCtx.branchId;
        } else if (req.query.branch_id) {
            branchId = parseInt(req.query.branch_id, 10);
        } else if (isGlobalAdmin && req.headers['x-branch-id']) {
            branchId = parseInt(req.headers['x-branch-id'], 10);
        }

        let query = `
      SELECT r.*, 
        u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email, u.phone as customer_phone,
        t.first_name as technician_first_name, t.last_name as technician_last_name,
        dt.name as device_type_name,
        b.name as brand_name
      FROM repairs r
      LEFT JOIN users u ON r.customer_id = u.id
      LEFT JOIN users t ON r.technician_id = t.id
      LEFT JOIN device_types dt ON r.device_type_id = dt.id
      LEFT JOIN brands b ON r.brand_id = b.id
      WHERE r.tenant_id = ?
    `;

        const params = [tenantId];

        // Filtrar por sucursal si corresponde
        if (branchId) {
            query += ' AND r.branch_id = ?';
            params.push(branchId);
        }

        // Filtrar por rol
        if (req.user.role === 'client') {
            query += ' AND r.customer_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'technician') {
            query += ' AND r.technician_id = ?';
            params.push(req.user.id);
        }

        // Filtros opcionales
        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }
        if (customer_id && req.user.role !== 'client') {
            query += ' AND r.customer_id = ?';
            params.push(customer_id);
        }
        if (technician_id && req.user.role !== 'client') {
            query += ' AND r.technician_id = ?';
            params.push(technician_id);
        }
        if (req.query.is_warranty === 'true') {
            query += ' AND r.parent_repair_id IS NOT NULL';
        }
        if (req.query.warranty_approved) {
            query += ' AND r.warranty_approved = ?';
            params.push(req.query.warranty_approved);
        }
        if (req.query.search) {
            const searchPattern = `%${req.query.search}%`;
            query += ' AND (r.ticket_number LIKE ? OR r.model LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [repairs] = await db.query(query, params);

        // Contar total
        let countQuery = `
            SELECT COUNT(*) as total FROM repairs r
            LEFT JOIN users u ON r.customer_id = u.id
            WHERE r.tenant_id = ?
        `;
        const countParams = [tenantId];

        if (branchId) {
            countQuery += ' AND r.branch_id = ?';
            countParams.push(branchId);
        }
        if (req.user.role === 'client') {
            countQuery += ' AND r.customer_id = ?';
            countParams.push(req.user.id);
        } else if (req.user.role === 'technician') {
            countQuery += ' AND r.technician_id = ?';
            countParams.push(req.user.id);
        }
        if (status) {
            countQuery += ' AND r.status = ?';
            countParams.push(status);
        }
        if (req.query.is_warranty === 'true') {
            countQuery += ' AND r.parent_repair_id IS NOT NULL';
        }
        if (req.query.warranty_approved) {
            countQuery += ' AND r.warranty_approved = ?';
            countParams.push(req.query.warranty_approved);
        }
        if (req.query.search) {
            const searchPattern = `%${req.query.search}%`;
            countQuery += ' AND (r.ticket_number LIKE ? OR r.model LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
            countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        const [countResult] = await db.query(countQuery, countParams);

        res.json({
            repairs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('[REPAIRS] Error al obtener reparaciones:', error);
        res.status(500).json({ message: 'Error al obtener reparaciones.' });
    }
};

// Obtener una reparación por ID
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [repairs] = await db.query(`
      SELECT r.*, 
        u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email, u.phone as customer_phone, u.address as customer_address,
        t.first_name as technician_first_name, t.last_name as technician_last_name,
        dt.name as device_type_name,
        b.name as brand_name,
        s.name as service_name
      FROM repairs r
      LEFT JOIN users u ON r.customer_id = u.id
      LEFT JOIN users t ON r.technician_id = t.id
      LEFT JOIN device_types dt ON r.device_type_id = dt.id
      LEFT JOIN brands b ON r.brand_id = b.id
      LEFT JOIN services_catalog s ON r.service_id = s.id
      WHERE r.id = ? AND r.tenant_id = ?
    `, [id, tenantId]);

        if (repairs.length === 0) {
            return res.status(404).json({ message: 'Reparación no encontrada.' });
        }

        const repair = repairs[0];

        // Verificar acceso del cliente
        if (req.user.role === 'client' && repair.customer_id !== req.user.id) {
            return res.status(403).json({ message: 'Acceso denegado.' });
        }

        // Obtener imágenes
        const [images] = await db.query(
            'SELECT * FROM repair_images WHERE repair_id = ? ORDER BY uploaded_at',
            [id]
        );

        // Obtener historial de estados
        const [history] = await db.query(`
      SELECT rsh.*, u.first_name, u.last_name
      FROM repair_status_history rsh
      LEFT JOIN users u ON rsh.changed_by = u.id
      WHERE rsh.repair_id = ?
      ORDER BY rsh.created_at DESC
    `, [id]);

        // Obtener notas (solo admin/técnico ven las internas)
        let notesQuery = 'SELECT rn.*, u.first_name, u.last_name FROM repair_notes rn LEFT JOIN users u ON rn.user_id = u.id WHERE rn.repair_id = ?';
        if (req.user.role === 'client') {
            notesQuery += ' AND rn.is_internal = FALSE';
        }
        notesQuery += ' ORDER BY rn.created_at DESC';

        const [notes] = await db.query(notesQuery, [id]);

        // Obtener ticket de reparación padre si existe
        let parentTicket = null;
        if (repair.parent_repair_id) {
            const [parent] = await db.query('SELECT ticket_number FROM repairs WHERE id = ? AND tenant_id = ?', [repair.parent_repair_id, tenantId]);
            if (parent.length > 0) {
                parentTicket = parent[0].ticket_number;
            }
        }

        // Obtener reclamaciones de garantía hijas si existen
        const [children] = await db.query('SELECT id, ticket_number, created_at, status FROM repairs WHERE parent_repair_id = ? AND tenant_id = ? ORDER BY created_at DESC', [id, tenantId]);

        res.json({
            ...repair,
            parent_ticket: parentTicket,
            child_warranties: children,
            images,
            history,
            notes
        });
    } catch (error) {
        console.error('[REPAIRS] Error al obtener reparación:', error);
        res.status(500).json({ message: 'Error al obtener reparación.' });
    }
};

// Crear nueva reparación
exports.create = async (req, res) => {
    try {
        const {
            customer_id,
            device_type_id,
            brand_id,
            brand_other,
            model,
            color,
            storage_capacity,
            serial_number,
            imei,
            device_password,
            accessories_received,
            physical_condition,
            existing_damage,
            function_checklist,
            problem_description,
            service_requested,
            service_id,
            priority,
            estimated_delivery,
            diagnosis_cost,
            labor_cost,
            parts_cost,
            discount,
            advance_payment,
            warranty_days,
            battery_health,
            screen_status,
            account_status,
            technical_observations,
            technician_id
        } = req.body;

        const tenantId = req.tenantCtx.tenantId;
        let branchId = req.body.branch_id || req.tenantCtx.branchId;

        if (!branchId) {
            const [mainBranches] = await db.query(
                'SELECT id FROM branches WHERE tenant_id = ? AND is_main = TRUE LIMIT 1',
                [tenantId]
            );
            branchId = mainBranches.length > 0 ? mainBranches[0].id : null;
        }

        // Obtener garantía por defecto si no se especifica
        let finalWarrantyDays = warranty_days;
        if (!finalWarrantyDays) {
            const [settings] = await db.query('SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = "default_warranty_days"', [tenantId]);
            finalWarrantyDays = settings.length > 0 ? parseInt(settings[0].setting_value) : 30;
        }

        // Si es cliente, usar su propio ID
        const finalCustomerId = req.user.role === 'client' ? req.user.id : customer_id;

        if (!finalCustomerId) {
            return res.status(400).json({ message: 'Se requiere ID del cliente.' });
        }

        // Obtener el código de la sucursal actual para usar de prefijo en el ticket
        const [branchInfo] = await db.query('SELECT code FROM branches WHERE id = ?', [branchId]);
        const branchPrefix = branchInfo.length > 0 ? branchInfo[0].code : 'REP';

        const ticketNumber = generateTicketNumber(branchPrefix);

        // Calcular total
        const total = (parseFloat(diagnosis_cost) || 0) + (parseFloat(labor_cost) || 0) +
            (parseFloat(parts_cost) || 0) - (parseFloat(discount) || 0);

        const [result] = await db.query(`
      INSERT INTO repairs (
        tenant_id, branch_id, ticket_number, customer_id, device_type_id, brand_id, brand_other, model, color,
        storage_capacity, serial_number, imei, device_password, accessories_received,
        physical_condition, existing_damage, function_checklist, problem_description,
        service_requested, service_id, priority, estimated_delivery, diagnosis_cost,
        labor_cost, parts_cost, discount, total_cost, advance_payment, warranty_days, 
        warranty_expires, battery_health, screen_status, account_status, technical_observations, technician_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            tenantId, branchId, ticketNumber, finalCustomerId, 
            (device_type_id === 'other' || !device_type_id) ? null : device_type_id,
            (brand_id === 'other' || !brand_id) ? null : brand_id,
            brand_other || null,
            model, color, storage_capacity, serial_number, imei, device_password, accessories_received,
            physical_condition, existing_damage, JSON.stringify(function_checklist), problem_description,
            service_requested, service_id || null, priority || 'normal', estimated_delivery || null,
            diagnosis_cost || 0, labor_cost || 0, parts_cost || 0, discount || 0, total,
            advance_payment || 0, finalWarrantyDays, null,
            battery_health || null, screen_status || null, account_status || null,
            technical_observations || null, technician_id || null
        ]);

        // Registrar en historial
        await db.query(
            'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [result.insertId, 'received', 'Reparación creada', req.user.id]
        );

        // Obtener datos del cliente para email
        const [customers] = await db.query(
            'SELECT first_name, last_name, email FROM users WHERE id = ? AND tenant_id = ?',
            [finalCustomerId, tenantId]
        );

        // Enviar email de confirmación
        if (customers.length > 0 && customers[0].email) {
            await sendEmail(customers[0].email, 'repairCreated', {
                repair: { ticket_number: ticketNumber, model, problem_description },
                customer: customers[0]
            });
        }

        res.status(201).json({
            message: 'Reparación creada exitosamente.',
            repair: {
                id: result.insertId,
                ticket_number: ticketNumber
            }
        });
    } catch (error) {
        console.error('[REPAIRS] Error al crear reparación:', error);
        res.status(500).json({ message: 'Error al crear reparación.' });
    }
};

// Actualizar reparación
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const tenantId = req.tenantCtx.tenantId;

        // Verificar que existe y pertenece al tenant
        const [existing] = await db.query('SELECT * FROM repairs WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Reparación no encontrada.' });
        }

        // Recalcular total si hay cambios en costos
        if (updates.diagnosis_cost !== undefined || updates.labor_cost !== undefined ||
            updates.parts_cost !== undefined || updates.discount !== undefined) {

            const diag = updates.diagnosis_cost !== undefined ? parseFloat(updates.diagnosis_cost) : parseFloat(existing[0].diagnosis_cost);
            const labor = updates.labor_cost !== undefined ? parseFloat(updates.labor_cost) : parseFloat(existing[0].labor_cost);
            const parts = updates.parts_cost !== undefined ? parseFloat(updates.parts_cost) : parseFloat(existing[0].parts_cost);
            const disc = updates.discount !== undefined ? parseFloat(updates.discount) : parseFloat(existing[0].discount);

            updates.total_cost = (diag || 0) + (labor || 0) + (parts || 0) - (disc || 0);
        }

        // Construir query dinámico
        const allowedFields = [
            'technician_id', 'brand_id', 'brand_other', 'model', 'color', 'storage_capacity',
            'serial_number', 'imei', 'device_password', 'accessories_received', 'physical_condition',
            'existing_damage', 'function_checklist', 'problem_description', 'service_requested',
            'service_id', 'priority', 'estimated_delivery', 'diagnosis_cost', 'labor_cost',
            'parts_cost', 'discount', 'status', 'total_cost', 'advance_payment', 'warranty_days',
            'warranty_expires', 'battery_health', 'screen_status', 'account_status', 'technical_observations',
            'warranty_approved', 'warranty_tech_notes'
        ];

        const setClauses = [];
        const values = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                setClauses.push(`${field} = ?`);
                let val = updates[field];
                if (field === 'function_checklist') {
                    val = JSON.stringify(val);
                } else if ((field === 'brand_id' || field === 'device_type_id') && val === 'other') {
                    val = null;
                }
                values.push(val);
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ message: 'No hay campos para actualizar.' });
        }

        values.push(id, tenantId);
        await db.query(`UPDATE repairs SET ${setClauses.join(', ')} WHERE id = ? AND tenant_id = ?`, values);

        // Notificar al cliente y loggear en historial si cambia la aprobación de garantía
        if (updates.warranty_approved && updates.warranty_approved !== existing[0].warranty_approved) {
            const [customer] = await db.query('SELECT email, first_name FROM users WHERE id = ? AND tenant_id = ?', [existing[0].customer_id, tenantId]);
            const statusText = updates.warranty_approved === 'approved' ? 'Aprobada' : updates.warranty_approved === 'rejected' ? 'Rechazada' : 'Pendiente';
            
            // 1. Registrar en historial de estados de la reparación
            await db.query(
                'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
                [id, existing[0].status, `Garantía marcada como: ${statusText}. Nota: ${updates.warranty_tech_notes || 'Sin observaciones'}`, req.user.id]
            );

            // 2. Enviar correo al cliente
            if (customer.length > 0 && customer[0].email) {
                try {
                    await sendEmail(customer[0].email, 'warrantyResolved', {
                        repair: {
                            ticket_number: existing[0].ticket_number,
                            model: existing[0].model,
                            warranty_tech_notes: updates.warranty_tech_notes || updates.warranty_tech_notes === '' ? updates.warranty_tech_notes : existing[0].warranty_tech_notes
                        },
                        customer: customer[0],
                        newStatus: updates.warranty_approved
                    });
                } catch (emailErr) {
                    console.error('[REPAIRS] Error al enviar email de resolución de garantía:', emailErr.message);
                }
            }
        }

        // Notificar cambio de fecha de entrega si cambió
        if (updates.estimated_delivery && updates.estimated_delivery !== existing[0].estimated_delivery) {
            const [customer] = await db.query('SELECT email, first_name FROM users WHERE id = ? AND tenant_id = ?', [existing[0].customer_id, tenantId]);
            if (customer.length > 0 && customer[0].email) {
                await sendEmail(customer[0].email, 'deliveryRescheduled', {
                    repair: {
                        ticket_number: existing[0].ticket_number,
                        model: existing[0].model,
                        estimated_delivery: updates.estimated_delivery
                    },
                    customer: customer[0]
                });
            }
        }

        res.json({ message: 'Reparación actualizada exitosamente.' });
    } catch (error) {
        console.error('[REPAIRS] Error al actualizar reparación:', error);
        res.status(500).json({ message: 'Error al actualizar reparación.' });
    }
};

// Cambiar estado de reparación
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, estimated_delivery } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        const validStatuses = [
            'received', 'diagnosing', 'waiting_approval', 'waiting_parts',
            'repairing', 'quality_check', 'ready', 'delivered', 'cancelled'
        ];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Estado inválido.' });
        }

        // Verificar que existe y pertenece al tenant
        const [existing] = await db.query(`
      SELECT r.*, u.first_name, u.last_name, u.email 
      FROM repairs r 
      LEFT JOIN users u ON r.customer_id = u.id 
      WHERE r.id = ? AND r.tenant_id = ?
    `, [id, tenantId]);

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Reparación no encontrada.' });
        }

        const repair = existing[0];

        // Validar permisos si el usuario es cliente
        if (req.user.role === 'client') {
            if (repair.customer_id !== req.user.id) {
                return res.status(403).json({ message: 'No tienes permiso para modificar esta reparación.' });
            }

            // Caso 1: Aprobación de cotización
            if (repair.status === 'waiting_approval') {
                if (status !== 'repairing' && status !== 'cancelled') {
                    return res.status(400).json({ message: 'Acción no permitida.' });
                }
            }
            // Caso 2: Agendar recolección cuando está listo
            else if (repair.status === 'ready') {
                if (status !== 'ready') {
                    return res.status(400).json({ message: 'No puedes cambiar el estado de una reparación lista.' });
                }
            } else {
                return res.status(400).json({ message: 'No puedes modificar el estado de esta reparación.' });
            }
        }

        // Actualizar estado
        let updateQuery = 'UPDATE repairs SET status = ?';
        const updateParams = [status];

        if (estimated_delivery) {
            updateQuery += ', estimated_delivery = ?';
            updateParams.push(estimated_delivery);
        }

        if (req.body.signature) {
            if (status === 'repairing') {
                updateQuery += ', signature_approval = ?';
                updateParams.push(req.body.signature);
            } else if (status === 'delivered') {
                updateQuery += ', signature_delivery = ?';
                updateParams.push(req.body.signature);
            }
        }

        if (status === 'repairing' && !repair.started_at) {
            updateQuery += ', started_at = NOW()';
        } else if (status === 'ready' || status === 'delivered') {
            updateQuery += ', completed_at = NOW()';
            if (status === 'delivered') {
                updateQuery += ', delivered_at = NOW(), warranty_expires = DATE_ADD(NOW(), INTERVAL warranty_days DAY)';
            }
        }

        updateQuery += ' WHERE id = ? AND tenant_id = ?';
        updateParams.push(id, tenantId);

        await db.query(updateQuery, updateParams);

        // Registrar en historial si cambió el estado
        if (status !== repair.status || (req.user.role === 'client' && estimated_delivery)) {
            await db.query(
                'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
                [id, status, notes || (estimated_delivery ? 'Fecha de entrega/recolección actualizada' : null), req.user.id]
            );
        }

        // Enviar email de notificación
        if (repair.email) {
            if (status !== repair.status) {
                let template = 'statusChanged';
                if (status === 'ready') template = 'repairReady';
                if (status === 'delivered') template = 'repairDelivered';

                await sendEmail(repair.email, template, {
                    repair: {
                        ticket_number: repair.ticket_number,
                        model: repair.model,
                        total_cost: repair.total_cost,
                        estimated_delivery: estimated_delivery || repair.estimated_delivery,
                        warranty_days: repair.warranty_days
                    },
                    customer: { first_name: repair.first_name },
                    newStatus: status
                });
            }
        }

        res.json({ message: 'Estado actualizado exitosamente.' });
    } catch (error) {
        console.error('[REPAIRS] Error al actualizar estado:', error);
        res.status(500).json({ message: 'Error al actualizar estado.' });
    }
};

// Agregar nota
exports.addNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { note, is_internal } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        // Validar propiedad del ticket
        const [repairs] = await db.query('SELECT customer_id FROM repairs WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (repairs.length === 0) {
            return res.status(404).json({ message: 'Reparación no encontrada.' });
        }

        if (req.user.role === 'client' && repairs[0].customer_id !== req.user.id) {
            return res.status(403).json({ message: 'Acceso denegado.' });
        }

        // Solo admin/técnico pueden agregar notas internas
        const finalIsInternal = req.user.role !== 'client' && is_internal;

        await db.query(
            'INSERT INTO repair_notes (repair_id, user_id, note, is_internal) VALUES (?, ?, ?, ?)',
            [id, req.user.id, note, finalIsInternal]
        );

        res.status(201).json({ message: 'Nota agregada exitosamente.' });
    } catch (error) {
        console.error('[REPAIRS] Error al agregar nota:', error);
        res.status(500).json({ message: 'Error al agregar nota.' });
    }
};

// Eliminar reparación (solo tenant_admin)
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [result] = await db.query('DELETE FROM repairs WHERE id = ? AND tenant_id = ?', [id, tenantId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Reparación no encontrada.' });
        }

        res.json({ message: 'Reparación eliminada exitosamente.' });
    } catch (error) {
        console.error('[REPAIRS] Error al eliminar reparación:', error);
        res.status(500).json({ message: 'Error al eliminar reparación.' });
    }
};

// Agregar reseña de reparación (solo clientes, para su propia reparación)
exports.addReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, review_text } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Calificación inválida (debe ser entre 1 y 5).' });
        }

        // Obtener la reparación
        const [repairs] = await db.query('SELECT * FROM repairs WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (repairs.length === 0) {
            return res.status(404).json({ message: 'Reparación no encontrada.' });
        }

        const repair = repairs[0];

        // Verificar que pertenezca al cliente actual
        if (repair.customer_id !== req.user.id) {
            return res.status(403).json({ message: 'No tienes permiso para calificar esta reparación.' });
        }

        // Guardar reseña
        await db.query(
            'UPDATE repairs SET rating = ?, review_text = ? WHERE id = ? AND tenant_id = ?',
            [rating, review_text || '', id, tenantId]
        );

        res.json({ message: 'Reseña enviada exitosamente.' });
    } catch (error) {
        console.error('[REPAIRS] Error al agregar reseña:', error);
        res.status(500).json({ message: 'Error al agregar reseña.' });
    }
};

// Procesar un ingreso por garantía
exports.claimWarranty = async (req, res) => {
    try {
        const { id } = req.params;
        const { problem_description, priority, estimated_delivery, technical_observations } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        // 1. Obtener reparación original
        const [repairs] = await db.query('SELECT * FROM repairs WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (repairs.length === 0) {
            return res.status(404).json({ message: 'Reparación original no encontrada.' });
        }

        const original = repairs[0];

        // Validar permisos si el usuario es cliente
        if (req.user.role === 'client' && original.customer_id !== req.user.id) {
            return res.status(403).json({ message: 'No tienes permiso para reclamar garantía de esta reparación.' });
        }

        // 2. Verificar que el estado es 'delivered'
        if (original.status !== 'delivered') {
            return res.status(400).json({ message: 'Solo se puede procesar garantía para equipos ya entregados.' });
        }

        // 3. Verificar que la garantía no haya expirado
        if (original.warranty_expires) {
            const expiryDate = new Date(original.warranty_expires);
            expiryDate.setHours(23, 59, 59, 999);
            if (new Date() > expiryDate) {
                const expiredDate = expiryDate.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
                return res.status(400).json({ 
                    message: `La garantía de esta reparación expiró el ${expiredDate}. No es posible registrar un ingreso por garantía.` 
                });
            }
        }

        // 4. Generar nuevo ticket prefixado
        const [branchInfo] = await db.query('SELECT code FROM branches WHERE id = ?', [branchId]);
        const branchPrefix = branchInfo.length > 0 ? branchInfo[0].code : 'REP';
        const ticketNumber = generateTicketNumber(branchPrefix);

        // 5. Copiar datos y crear nuevo registro
        const [result] = await db.query(`
            INSERT INTO repairs (
                tenant_id, branch_id, ticket_number, customer_id, device_type_id, brand_id, brand_other, model, color,
                storage_capacity, serial_number, imei, device_password, accessories_received,
                physical_condition, existing_damage, problem_description, service_requested,
                service_id, priority, estimated_delivery, diagnosis_cost, labor_cost, parts_cost,
                discount, total_cost, advance_payment, warranty_days, status, payment_status,
                parent_repair_id, technical_observations, warranty_approved, warranty_tech_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, 'received', 'paid', ?, ?, 'pending', null)
        `, [
            tenantId,
            branchId,
            ticketNumber,
            original.customer_id,
            original.device_type_id,
            original.brand_id,
            original.brand_other,
            original.model,
            original.color,
            original.storage_capacity,
            original.serial_number,
            original.imei,
            original.device_password,
            original.accessories_received,
            original.physical_condition,
            original.existing_damage,
            `[GARANTÍA] ${problem_description}`,
            `Garantía de: ${original.service_requested || 'Reparación General'}`,
            original.service_id,
            priority || 'normal',
            estimated_delivery || null,
            original.warranty_days || 30,
            original.id,
            technical_observations || null
        ]);

        // Registrar en historial de la nueva reparación
        await db.query(
            'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, "received", ?, ?)',
            [result.insertId, `Ingreso por garantía vinculado al ticket original ${original.ticket_number}`, req.user.id]
        );

        // Registrar nota en la reparación original
        await db.query(
            'INSERT INTO repair_notes (repair_id, user_id, note, is_internal) VALUES (?, ?, ?, TRUE)',
            [original.id, req.user.id, `Se registró un ingreso por garantía con el ticket ${ticketNumber}`, true]
        );

        // Enviar email de notificación al cliente
        try {
            const [customers] = await db.query('SELECT first_name, email FROM users WHERE id = ? AND tenant_id = ?', [original.customer_id, tenantId]);
            if (customers.length > 0 && customers[0].email) {
                await sendEmail(customers[0].email, 'repairCreated', {
                    repair: { ticket_number: ticketNumber, model: original.model, problem_description: `[GARANTÍA] ${problem_description}` },
                    customer: customers[0]
                });
            }
        } catch (emailErr) {
            console.error('[REPAIRS] Error al enviar email de garantía al cliente (no crítico):', emailErr.message);
        }

        // Notificar al técnico original y a los administradores de la empresa (tenant)
        try {
            const emailsToNotify = [];

            // 1. Obtener email del técnico original
            if (original.technician_id) {
                const [techs] = await db.query('SELECT email FROM users WHERE id = ? AND tenant_id = ? AND role = "technician"', [original.technician_id, tenantId]);
                if (techs.length > 0 && techs[0].email) {
                    emailsToNotify.push(techs[0].email);
                }
            }

            // 2. Obtener emails de los administradores del tenant
            const [admins] = await db.query('SELECT email FROM users WHERE tenant_id = ? AND role IN ("tenant_admin", "branch_manager")', [tenantId]);
            admins.forEach(admin => {
                if (admin.email && !emailsToNotify.includes(admin.email)) {
                    emailsToNotify.push(admin.email);
                }
            });

            for (const email of emailsToNotify) {
                await sendEmail(email, 'repairCreated', {
                    repair: {
                        ticket_number: ticketNumber,
                        model: `${original.model} (RECLAMO DE GARANTÍA PENDIENTE)`,
                        problem_description: `Se ha reportado un reclamo de garantía para el ticket original ${original.ticket_number}. Falla reportada: ${problem_description}`
                    },
                    customer: { first_name: 'Equipo de Soporte' }
                });
            }
        } catch (notifErr) {
            console.error('[REPAIRS] Error al enviar email de notificación a técnicos/admins:', notifErr.message);
        }

        res.status(201).json({
            message: 'Ingreso por garantía registrado exitosamente.',
            repair: {
                id: result.insertId,
                ticket_number: ticketNumber
            }
        });
    } catch (error) {
        console.error('[REPAIRS] Error al reclamar garantía:', error);
        res.status(500).json({ message: 'Error al procesar ingreso por garantía.' });
    }
};
