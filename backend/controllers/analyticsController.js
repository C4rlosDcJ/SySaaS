const db = require('../config/database');
const { execFile } = require('child_process');
const path = require('path');

// Función helper para invocar el motor Python de Machine Learning
function runPythonML(action, inputData) {
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, '../services/analytics_engine.py');
        const inputJson = JSON.stringify(inputData);

        execFile('python3', [pythonScript, '--action', action, '--input', inputJson], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error('[PYTHON-ML ERROR]', stderr || error.message);
                return reject(error);
            }
            try {
                const jsonRes = JSON.parse(stdout.trim());
                resolve(jsonRes);
            } catch (e) {
                reject(new Error('Respuesta inválida del motor de analítica Python'));
            }
        });
    });
}

// Pronóstico de ventas a 30 días utilizando Scikit-Learn
exports.getSalesForecast = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;

        let branchFilter = '';
        const params = [tenantId];
        if (branchId) {
            branchFilter = 'AND branch_id = ?';
            params.push(branchId);
        }

        // Fuente única: tabla sales completadas (incluye mostrador y taller cobrado en POS)
        const [salesRows] = await db.query(`
            SELECT date, SUM(amount) as amount
            FROM (
                SELECT DATE(created_at) as date, SUM(total) as amount
                FROM sales
                WHERE tenant_id = ? AND status = 'completed' ${branchFilter} AND created_at >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
                GROUP BY DATE(created_at)
            ) combined
            GROUP BY date
            ORDER BY date ASC
        `, params);

        if (salesRows.length === 0) {
            return res.json({
                historical_days: 0,
                total_predicted_30d: 0,
                daily_avg_predicted: 0,
                forecast: [],
                trend: 'neutral',
                confidence: 0,
                r2_score: 0,
                model_type: 'Sin datos',
                message: 'No hay suficiente historial de ventas finalizadas para entrenar el modelo de Machine Learning.'
            });
        }

        const formattedData = salesRows.map(row => ({
            date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
            amount: parseFloat(row.amount) || 0
        }));

        const mlResult = await runPythonML('forecast_sales', formattedData);
        res.json(mlResult);
    } catch (error) {
        console.error('[ANALYTICS] Error al calcular pronóstico ML:', error);
        res.status(500).json({ message: 'Error al generar pronóstico predictivo con Machine Learning.' });
    }
};

// Segmentación de Clientes con Algoritmo K-Means Clustering y RFM
exports.getCustomerSegmentation = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;

        let branchFilterSales = '';
        let branchFilterRepairs = '';
        const params = [tenantId, tenantId, tenantId];

        if (branchId) {
            branchFilterSales = 'AND s.branch_id = ?';
            branchFilterRepairs = 'AND r.branch_id = ?';
            // Inyectar branchId a subqueries si se especifica
        }

        const [customersData] = await db.query(`
            SELECT 
                c.id,
                CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) as name,
                ROUND(COALESCE(s.sales_total, 0) + COALESCE(r.repairs_total, 0), 2) as total_spent,
                COALESCE(s.sales_count, 0) + COALESCE(r.repairs_count, 0) as total_orders,
                DATEDIFF(NOW(), COALESCE(GREATEST(COALESCE(s.last_sale, '1970-01-01'), COALESCE(r.last_repair, '1970-01-01')), c.created_at)) as recency_days
            FROM users c
            LEFT JOIN (
                SELECT customer_id, SUM(total) as sales_total, COUNT(id) as sales_count, MAX(created_at) as last_sale
                FROM sales
                WHERE status = 'completed' AND tenant_id = ? ${branchId ? 'AND branch_id = ' + parseInt(branchId, 10) : ''}
                GROUP BY customer_id
            ) s ON s.customer_id = c.id
            LEFT JOIN (
                SELECT customer_id, SUM(total_cost) as repairs_total, COUNT(id) as repairs_count, MAX(created_at) as last_repair
                FROM repairs
                WHERE status NOT IN ('cancelled') AND tenant_id = ? ${branchId ? 'AND branch_id = ' + parseInt(branchId, 10) : ''}
                GROUP BY customer_id
            ) r ON r.customer_id = c.id
            WHERE c.role = 'client' AND c.tenant_id = ?
            GROUP BY c.id
            ORDER BY total_spent DESC
        `, params);

        if (customersData.length === 0) {
            return res.json({
                total_customers: 0,
                segment_summary: {},
                customers: []
            });
        }

        const formattedCustomers = customersData.map(c => ({
            id: c.id,
            name: (c.name || 'Cliente').trim(),
            total_spent: parseFloat(c.total_spent) || 0,
            total_orders: parseInt(c.total_orders, 10) || 0,
            recency_days: Math.min(parseInt(c.recency_days, 10) || 0, 365)
        }));

        const mlResult = await runPythonML('segment_customers', formattedCustomers);
        res.json(mlResult);
    } catch (error) {
        console.error('[ANALYTICS] Error al ejecutar segmentación K-Means:', error);
        res.status(500).json({ message: 'Error al calcular segmentación de clientes con K-Means.' });
    }
};

// Generar Gráfico Matplotlib en formato PNG/Base64 para reportes
exports.getChartPng = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;

        const [salesRows] = await db.query(`
            SELECT DATE(created_at) as date, SUM(total) as amount
            FROM sales
            WHERE tenant_id = ? AND status = 'completed'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [tenantId]);

        const formattedData = salesRows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            amount: parseFloat(row.amount) || 0
        }));

        const forecastData = await runPythonML('forecast_sales', formattedData);
        const chartResult = await runPythonML('generate_chart_png', forecastData);

        res.json(chartResult);
    } catch (error) {
        console.error('[ANALYTICS] Error al generar gráfico Matplotlib:', error);
        res.status(500).json({ message: 'Error al generar imagen de gráfico.' });
    }
};
