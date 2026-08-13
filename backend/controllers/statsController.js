const db = require('../config/database');

// Obtener estadísticas del dashboard (SaaS & Multi-Branch Scoped)
exports.getDashboard = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        // Base where condition for query segments
        let baseWhere = 'WHERE tenant_id = ?';
        const params = [tenantId];

        if (branchId) {
            baseWhere += ' AND branch_id = ?';
            params.push(branchId);
        }

        // Total de reparaciones por estado
        const [statusCounts] = await db.query(`
          SELECT status, COUNT(*) as count
          FROM repairs
          ${baseWhere}
          GROUP BY status
        `, params);

        // Reparaciones este mes
        const [thisMonth] = await db.query(`
          SELECT COUNT(*) as count, SUM(total_cost) as revenue
          FROM repairs
          ${baseWhere}
          AND MONTH(created_at) = MONTH(CURRENT_DATE())
          AND YEAR(created_at) = YEAR(CURRENT_DATE())
        `, params);

        // Reparaciones mes anterior
        const [lastMonth] = await db.query(`
          SELECT COUNT(*) as count, SUM(total_cost) as revenue
          FROM repairs
          ${baseWhere}
          AND MONTH(created_at) = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
          AND YEAR(created_at) = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
        `, params);

        // Total de clientes (los clientes están aislados por sucursal en esta arquitectura)
        let customersWhere = 'WHERE role = \'client\' AND tenant_id = ?';
        const customersParams = [tenantId];
        if (branchId) {
            customersWhere += ' AND branch_id = ?';
            customersParams.push(branchId);
        }
        const [customers] = await db.query(`
          SELECT COUNT(*) as count FROM users ${customersWhere}
        `, customersParams);

        // Reparaciones en proceso
        const [inProgress] = await db.query(`
          SELECT COUNT(*) as count FROM repairs 
          ${baseWhere}
          AND status NOT IN ('delivered', 'cancelled')
        `, params);

        // Reparaciones recientes
        const [recentRepairs] = await db.query(`
          SELECT r.id, r.ticket_number, r.model, r.status, r.created_at, r.total_cost,
            u.first_name, u.last_name
          FROM repairs r
          LEFT JOIN users u ON r.customer_id = u.id
          ${baseWhere.replace('tenant_id', 'r.tenant_id').replace('branch_id', 'r.branch_id')}
          ORDER BY r.created_at DESC
          LIMIT 10
        `, params);

        // Ingresos por mes (últimos 6 meses)
        const [monthlyRevenue] = await db.query(`
          SELECT 
            DATE_FORMAT(created_at, '%Y-%m') as month,
            SUM(total_cost) as revenue,
            COUNT(*) as repairs_count
          FROM repairs
          ${baseWhere}
          AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
          GROUP BY DATE_FORMAT(created_at, '%Y-%m')
          ORDER BY month
        `, params);

        // Servicios más solicitados
        const [topServices] = await db.query(`
          SELECT s.name, COUNT(*) as count
          FROM repairs r
          JOIN services_catalog s ON r.service_id = s.id
          ${baseWhere.replace('tenant_id', 'r.tenant_id').replace('branch_id', 'r.branch_id')}
          GROUP BY r.service_id
          ORDER BY count DESC
          LIMIT 5
        `, params);

        // Técnicos con más reparaciones
        const [topTechnicians] = await db.query(`
          SELECT u.first_name, u.last_name, COUNT(*) as repairs_count
          FROM repairs r
          JOIN users u ON r.technician_id = u.id
          ${baseWhere.replace('tenant_id', 'r.tenant_id').replace('branch_id', 'r.branch_id')}
          GROUP BY r.technician_id
          ORDER BY repairs_count DESC
          LIMIT 5
        `, params);

        res.json({
            statusSummary: statusCounts.reduce((acc, curr) => {
                acc[curr.status] = curr.count;
                return acc;
            }, {}),
            thisMonth: {
                repairs: thisMonth[0].count || 0,
                revenue: parseFloat(thisMonth[0].revenue) || 0
            },
            lastMonth: {
                repairs: lastMonth[0].count || 0,
                revenue: parseFloat(lastMonth[0].revenue) || 0
            },
            totalCustomers: customers[0].count,
            inProgress: inProgress[0].count,
            recentRepairs,
            monthlyRevenue,
            topServices,
            topTechnicians
        });
    } catch (error) {
        console.error('[STATS] Error al obtener estadísticas:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas.' });
    }
};

// Obtener ingresos por período
exports.getRevenue = async (req, res) => {
    try {
        const { start_date, end_date, group_by = 'day' } = req.query;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        let dateFormat;
        switch (group_by) {
            case 'month': dateFormat = '%Y-%m'; break;
            case 'week': dateFormat = '%Y-%u'; break;
            default: dateFormat = '%Y-%m-%d';
        }

        let query = `
      SELECT 
        DATE_FORMAT(created_at, '${dateFormat}') as period,
        SUM(total_cost) as revenue,
        SUM(advance_payment) as collected,
        COUNT(*) as repairs_count
      FROM repairs
      WHERE tenant_id = ?
    `;
        const params = [tenantId];

        if (branchId) {
            query += ' AND branch_id = ?';
            params.push(branchId);
        }
        if (start_date) {
            query += ' AND created_at >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND created_at <= ?';
            params.push(end_date);
        }

        query += ` GROUP BY DATE_FORMAT(created_at, '${dateFormat}') ORDER BY period`;

        const [revenue] = await db.query(query, params);
        res.json(revenue);
    } catch (error) {
        console.error('[STATS] Error al obtener ingresos:', error);
        res.status(500).json({ message: 'Error al obtener ingresos.' });
    }
};

// Obtener rendimiento de técnicos
exports.getTechniciansStats = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        let query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        COUNT(r.id) as total_repairs,
        SUM(CASE WHEN r.status = 'delivered' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN r.status NOT IN ('delivered', 'cancelled') THEN 1 ELSE 0 END) as in_progress,
        AVG(DATEDIFF(r.completed_at, r.started_at)) as avg_repair_time
      FROM users u
      LEFT JOIN repairs r ON u.id = r.technician_id AND r.tenant_id = ?
    `;
        const params = [tenantId];

        if (branchId) {
            query += ' AND r.branch_id = ?';
            params.push(branchId);
        }

        query += `
          WHERE u.role IN ('technician', 'tenant_admin', 'branch_manager') AND u.tenant_id = ?
          GROUP BY u.id
          ORDER BY total_repairs DESC
        `;
        params.push(tenantId);

        const [stats] = await db.query(query, params);
        res.json(stats);
    } catch (error) {
        console.error('[STATS] Error al obtener estadísticas de técnicos:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas.' });
    }
};
