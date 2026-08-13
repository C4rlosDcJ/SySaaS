const db = require('../config/database');

// Rastrear reparación o venta/compra por número de ticket (público, sin auth)
exports.trackRepair = async (req, res) => {
    try {
        const ticketCode = req.params.ticket.trim().toUpperCase();

        if (!ticketCode || ticketCode.length < 5) {
            return res.status(400).json({ message: 'Número de ticket inválido.' });
        }

        // Si empieza con VTA- o algún prefijo de sucursal de venta, buscamos en la tabla de ventas
        if (ticketCode.includes('-VTA-') || ticketCode.startsWith('VTA-')) {
            const [sales] = await db.query(`
                SELECT 
                    s.id, s.sale_number, s.subtotal, s.discount, s.tax, s.total,
                    s.payment_method, s.amount_received, s.change_amount, s.status,
                    s.notes, s.created_at, s.repair_id,
                    u.first_name as customer_first_name, u.last_name as customer_last_name,
                    c.first_name as cashier_first_name, c.last_name as cashier_last_name
                FROM sales s
                LEFT JOIN users u ON s.customer_id = u.id
                LEFT JOIN users c ON s.cashier_id = c.id
                WHERE s.sale_number = ?
            `, [ticketCode]);

            if (sales.length === 0) {
                return res.status(404).json({ message: 'No se encontró ningún pedido o venta con ese número.' });
            }

            const sale = sales[0];

            // Obtener ítems de la venta
            const [items] = await db.query(`
                SELECT 
                    si.id, si.description, si.quantity, si.unit_price, si.discount, si.total,
                    p.name as product_name, p.sku,
                    sc.name as service_name
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                LEFT JOIN services_catalog sc ON si.service_id = sc.id
                WHERE si.sale_id = ?
            `, [sale.id]);

            // Si tiene reparación asociada, traemos los datos completos
            let repairData = null;
            if (sale.repair_id) {
                const [repairs] = await db.query(`
                    SELECT 
                        r.id, r.ticket_number, r.model, r.status, r.payment_status,
                        r.priority, r.estimated_delivery, r.warranty_days, r.warranty_expires,
                        r.physical_condition, r.existing_damage, r.function_checklist,
                        r.problem_description, r.service_requested, r.technical_observations,
                        r.diagnosis_cost, r.labor_cost, r.parts_cost, r.discount, r.total_cost,
                        r.advance_payment, r.created_at, r.started_at, r.completed_at, r.delivered_at,
                        dt.name as device_type_name, b.name as brand_name, r.brand_other
                    FROM repairs r
                    LEFT JOIN device_types dt ON r.device_type_id = dt.id
                    LEFT JOIN brands b ON r.brand_id = b.id
                    WHERE r.id = ?
                `, [sale.repair_id]);

                if (repairs.length > 0) {
                    repairData = repairs[0];
                    // Historial de estados
                    const [history] = await db.query(`
                        SELECT status, notes, created_at
                        FROM repair_status_history
                        WHERE repair_id = ?
                        ORDER BY created_at ASC
                    `, [sale.repair_id]);
                    // Notas públicas
                    const [notes] = await db.query(`
                        SELECT rn.note, rn.created_at, u.first_name
                        FROM repair_notes rn
                        LEFT JOIN users u ON rn.user_id = u.id
                        WHERE rn.repair_id = ? AND rn.is_internal = FALSE
                        ORDER BY rn.created_at DESC
                    `, [sale.repair_id]);

                    repairData.history = history;
                    repairData.notes = notes;
                }
            }

            return res.json({
                is_sale: true,
                is_repair: !!repairData,
                repair: repairData,
                ...sale,
                items
            });
        }

        // De lo contrario, buscamos en la tabla de reparaciones
        const [repairs] = await db.query(`
            SELECT 
                r.id, r.ticket_number, r.model, r.status, r.payment_status,
                r.priority, r.estimated_delivery, r.warranty_days, r.warranty_expires,
                r.physical_condition, r.existing_damage, r.function_checklist,
                r.problem_description, r.service_requested, r.technical_observations,
                r.diagnosis_cost, r.labor_cost, r.parts_cost, r.discount, r.total_cost,
                r.advance_payment, r.created_at, r.started_at, r.completed_at, r.delivered_at,
                dt.name as device_type_name, b.name as brand_name, r.brand_other,
                u.first_name as customer_first_name, u.last_name as customer_last_name
            FROM repairs r
            LEFT JOIN device_types dt ON r.device_type_id = dt.id
            LEFT JOIN brands b ON r.brand_id = b.id
            LEFT JOIN users u ON r.customer_id = u.id
            WHERE r.ticket_number = ?
        `, [ticketCode]);

        if (repairs.length === 0) {
            return res.status(404).json({ message: 'No se encontró ninguna reparación con ese número de ticket.' });
        }

        const repair = repairs[0];

        // Obtener historial de estados (sin datos internos)
        const [history] = await db.query(`
            SELECT status, notes, created_at
            FROM repair_status_history
            WHERE repair_id = ?
            ORDER BY created_at ASC
        `, [repair.id]);

        // Obtener notas públicas (no internas)
        const [notes] = await db.query(`
            SELECT rn.note, rn.created_at, u.first_name
            FROM repair_notes rn
            LEFT JOIN users u ON rn.user_id = u.id
            WHERE rn.repair_id = ? AND rn.is_internal = FALSE
            ORDER BY rn.created_at DESC
        `, [repair.id]);

        res.json({
            is_sale: false,
            is_repair: true,
            ...repair,
            history,
            notes
        });
    } catch (error) {
        console.error('[PUBLIC] Error al rastrear:', error);
        res.status(500).json({ message: 'Error al realizar el rastreo.' });
    }
};

// Obtener configuración de tema (público, sin auth, basado en el slug del tenant)
exports.getTheme = async (req, res) => {
    try {
        const { slug } = req.params;

        // Buscar tenant por slug
        const [tenants] = await db.query('SELECT id, company_name, logo_url, primary_color FROM tenants WHERE slug = ?', [slug]);
        if (tenants.length === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }

        const tenant = tenants[0];

        // Obtener configuraciones de settings de este tenant
        const [rows] = await db.query('SELECT setting_key, setting_value FROM settings WHERE tenant_id = ?', [tenant.id]);

        const theme = {
            accent_color: tenant.primary_color || '#e63358',
            border_radius: '12px',
            business_name: tenant.company_name,
            business_logo: tenant.logo_url || '',
            landing_show_stats: 'true',
            landing_show_why: 'true',
            landing_show_services: 'true',
            landing_show_process: 'true',
            landing_show_testimonials: 'true',
            landing_show_cta: 'true',
            landing_show_contact: 'true'
        };

        rows.forEach(row => {
            theme[row.setting_key] = row.setting_value;
        });

        // Obtener reseñas reales de clientes del tenant
        let reviews = [];
        try {
            const [reviewRows] = await db.query(`
                SELECT 
                    CONCAT(u.first_name, ' ', SUBSTRING(u.last_name, 1, 1), '.') as name,
                    r.review_text as text,
                    CONCAT(COALESCE(b.name, r.brand_other, 'Equipo'), ' ', r.model) as device,
                    r.rating
                FROM repairs r
                JOIN users u ON r.customer_id = u.id
                LEFT JOIN brands b ON r.brand_id = b.id
                WHERE r.tenant_id = ? AND r.rating IS NOT NULL AND r.review_text IS NOT NULL AND r.review_text != ''
                ORDER BY r.updated_at DESC
                LIMIT 6
            `, [tenant.id]);
            reviews = reviewRows;
        } catch (e) {
            console.warn('[PUBLIC] Error al consultar reseñas de base de datos:', e.message);
        }

        theme.reviews = reviews;

        res.json(theme);
    } catch (error) {
        console.error('[PUBLIC] Error al obtener tema:', error);
        res.status(500).json({ message: 'Error al obtener la configuración visual.' });
    }
};

// =====================================================
// Catálogo público de servicios (sin auth, por tenant slug)
// =====================================================
exports.getCatalogServices = async (req, res) => {
    try {
        const { slug } = req.params;
        const { device_type_id } = req.query;

        // Buscar tenant por slug
        const [tenants] = await db.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
        if (tenants.length === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }
        const tenantId = tenants[0].id;

        let query = `
            SELECT s.id, s.name, s.description, s.base_price, s.estimated_time,
                   s.device_type_id, dt.name as device_type_name, dt.icon as device_type_icon
            FROM services_catalog s
            LEFT JOIN device_types dt ON s.device_type_id = dt.id
            WHERE s.tenant_id = ? AND s.is_active = TRUE
        `;
        const params = [tenantId];

        if (device_type_id) {
            query += ' AND (s.device_type_id = ? OR s.device_type_id IS NULL)';
            params.push(device_type_id);
        }

        query += ' ORDER BY dt.name, s.name';

        const [services] = await db.query(query, params);

        // Obtener tipos de dispositivo activos del tenant para filtros
        const [deviceTypes] = await db.query(
            'SELECT id, name, icon FROM device_types WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_active = TRUE ORDER BY name',
            [tenantId]
        );

        res.json({ services, deviceTypes });
    } catch (error) {
        console.error('[PUBLIC] Error al obtener catálogo de servicios:', error);
        res.status(500).json({ message: 'Error al obtener servicios.' });
    }
};

// =====================================================
// Catálogo público de productos (sin auth, por tenant slug)
// =====================================================
exports.getCatalogProducts = async (req, res) => {
    try {
        const { slug } = req.params;
        const { category_id, search, branch_id, page = 1, limit = 24 } = req.query;
        const offset = (page - 1) * limit;

        // Buscar tenant por slug
        const [tenants] = await db.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
        if (tenants.length === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }
        const tenantId = tenants[0].id;

        // Si no se pasa branch_id, usar la sucursal matriz principal del tenant
        let targetBranchId = branch_id;
        if (!targetBranchId) {
            const [branches] = await db.query('SELECT id FROM branches WHERE tenant_id = ? AND is_main = TRUE LIMIT 1', [tenantId]);
            targetBranchId = branches.length > 0 ? branches[0].id : null;
        }

        let query = `
            SELECT p.id, p.name, p.description, p.sale_price, COALESCE(bi.stock, 0) as stock, p.is_unique,
                   p.category_id, pc.name as category_name, pc.color as category_color
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = ?
            WHERE p.tenant_id = ? AND p.is_active = TRUE
        `;
        const params = [targetBranchId, tenantId];

        if (category_id) {
            query += ' AND p.category_id = ?';
            params.push(category_id);
        }
        if (search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term);
        }

        // Count
        let countQuery = query.replace(/SELECT p\.id,[\s\S]*?FROM products p/, 'SELECT COUNT(*) as total FROM products p');
        const [countResult] = await db.query(countQuery, params);

        query += ' ORDER BY p.name ASC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [products] = await db.query(query, params);

        // Obtener categorías activas para filtros
        const [categories] = await db.query(
            'SELECT id, name, color FROM product_categories WHERE tenant_id = ? AND is_active = TRUE ORDER BY name',
            [tenantId]
        );

        res.json({
            products,
            categories,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('[PUBLIC] Error al obtener catálogo de productos:', error);
        res.status(500).json({ message: 'Error al obtener productos.' });
    }
};
