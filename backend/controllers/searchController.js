const db = require('../config/database');

// Búsqueda global (SaaS & Multi-Branch Scoped)
exports.search = async (req, res) => {
    try {
        const { q } = req.query;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        if (!q || q.trim().length < 2) {
            return res.json({ repairs: [], customers: [], products: [] });
        }

        const searchTerm = `%${q.trim()}%`;

        // Buscar reparaciones del tenant (y opcionalmente sucursal)
        let repairsQuery = `
            SELECT r.id, r.ticket_number, r.model, r.status, r.created_at,
                u.first_name as customer_first_name, u.last_name as customer_last_name,
                b.name as brand_name, dt.name as device_type_name
            FROM repairs r
            LEFT JOIN users u ON r.customer_id = u.id
            LEFT JOIN brands b ON r.brand_id = b.id
            LEFT JOIN device_types dt ON r.device_type_id = dt.id
            WHERE r.tenant_id = ? 
              AND (
                r.ticket_number LIKE ?
                OR r.model LIKE ?
                OR r.imei LIKE ?
                OR r.serial_number LIKE ?
                OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?
              )
        `;
        const repairsParams = [tenantId, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
        if (branchId) {
            repairsQuery += ' AND r.branch_id = ?';
            repairsParams.push(branchId);
        }
        repairsQuery += ' ORDER BY r.created_at DESC LIMIT 10';

        const [repairs] = await db.query(repairsQuery, repairsParams);

        // Buscar clientes del tenant
        const isGlobalAdmin = ['tenant_admin', 'admin', 'superadmin'].includes(req.user.role);
        let customersQuery = `
            SELECT id, first_name, last_name, email, phone,
                (SELECT COUNT(*) FROM repairs WHERE customer_id = users.id AND tenant_id = ?) as total_repairs
            FROM users
            WHERE role = 'client' AND tenant_id = ? AND is_active = TRUE
        `;
        const customersParams = [tenantId, tenantId];
        if (!isGlobalAdmin && branchId) {
            customersQuery += ' AND (branch_id = ? OR branch_id IS NULL)';
            customersParams.push(branchId);
        }
        customersQuery += `
            AND (
                CONCAT(first_name, ' ', last_name) LIKE ?
                OR email LIKE ?
                OR phone LIKE ?
            )
            ORDER BY first_name ASC
            LIMIT 8
        `;
        customersParams.push(searchTerm, searchTerm, searchTerm);

        const [customers] = await db.query(customersQuery, customersParams);

        // Buscar productos del inventario (con stock correspondiente a la sucursal activa)
        let products = [];
        try {
            const [prodResults] = await db.query(`
                SELECT p.id, p.name, p.sku, p.sale_price, COALESCE(bi.stock, 0) as stock,
                    c.name as category_name
                FROM products p
                LEFT JOIN product_categories c ON p.category_id = c.id
                LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = ?
                WHERE p.tenant_id = ? AND p.is_active = TRUE
                  AND (p.name LIKE ?
                    OR p.sku LIKE ?
                    OR p.barcode LIKE ?)
                ORDER BY p.name ASC
                LIMIT 8
            `, [branchId, tenantId, searchTerm, searchTerm, searchTerm]);
            products = prodResults;
        } catch (e) {
            console.error('[SEARCH] Error consultando productos:', e.message);
        }

        res.json({ repairs, customers, products });
    } catch (error) {
        console.error('[SEARCH] Error en búsqueda global:', error);
        res.status(500).json({ message: 'Error en la búsqueda.' });
    }
};
