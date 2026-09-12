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

        // Fuente única: tabla sales completadas (incluye tanto mostrador como taller cobrado en POS)
        // No se suma repairs.total_cost porque cada reparación cobrada ya genera un registro en sales
        const [salesRows] = await db.query(`
            SELECT date, SUM(amount) as amount
            FROM (
                SELECT DATE(created_at) as date, SUM(total) as amount
                FROM sales
                WHERE tenant_id = ? AND status = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
                GROUP BY DATE(created_at)
            ) combined
            GROUP BY date
            ORDER BY date ASC
        `, [tenantId]);

        if (salesRows.length === 0) {
            return res.json({
                historical_days: 0,
                total_predicted_30d: 0,
                daily_avg_predicted: 0,
                forecast: [],
                message: 'No hay suficiente historial de ventas finalizadas para entrenar el modelo de Machine Learning.'
            });
        }

        const formattedData = salesRows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            amount: parseFloat(row.amount) || 0
        }));

        const mlResult = await runPythonML('forecast_sales', formattedData);
        res.json(mlResult);
    } catch (error) {
        console.error('[ANALYTICS] Error al calcular pronóstico ML:', error);
        res.status(500).json({ message: 'Error al generar pronóstico predictivo con Machine Learning.' });
    }
};

// Segmentación de Clientes con Algoritmo K-Means Clustering (RFM)
exports.getCustomerSegmentation = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;

        const [customersData] = await db.query(`
            SELECT 
                c.id,
                CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) as name,
                COALESCE(SUM(s.total), 0) as total_spent,
                COUNT(s.id) as total_orders,
                DATEDIFF(NOW(), COALESCE(MAX(s.created_at), c.created_at)) as recency_days
            FROM users c
            LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'completed'
            WHERE c.role = 'client' AND c.tenant_id = ?
            GROUP BY c.id
        `, [tenantId]);

        if (customersData.length === 0) {
            return res.json({
                total_customers: 0,
                segment_summary: {},
                customers: []
            });
        }

        const mlResult = await runPythonML('segment_customers', customersData);
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
