const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const { limiter } = require('./middleware/rateLimiter');
const activityLogger = require('./middleware/activityLogger');
require('dotenv').config();

const app = express();

// Confiar en el proxy (necesario en Render, Heroku, etc., para rate limiters)
app.set('trust proxy', 1);

// Helmet.js para cabeceras de seguridad HTTP
app.use(helmet({
    crossOriginResourcePolicy: false, // Permitir cargar imágenes locales en frontend
}));

// Rate limiting general
app.use('/api/', limiter);

// Middleware
const allowedOrigins = [
    'http://localhost:5173',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.includes(origin) || 
                          origin.endsWith('.vercel.app') || 
                          origin.includes('vercel.app') ||
                          origin.startsWith('http://localhost:');
        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed for origin: ' + origin));
        }
    },
    credentials: true
}));
// Capturar rawBody para verificacion de firma en webhook de Stripe
// El webhook de Stripe requiere el body crudo antes de que JSON.parse lo consuma
app.use((req, res, next) => {
    if (req.path.startsWith('/api/billing/webhook')) {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => {
            req.rawBody = data;
            req.body = data;
            next();
        });
    } else {
        express.json({ limit: '50mb' })(req, res, next);
    }
});
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Activity logger para operaciones CRUD
app.use('/api', activityLogger);

// Rutas de la API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/repairs', require('./routes/repairs'));
app.use('/api/services', require('./routes/services'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/pos', require('./routes/pos'));
app.use('/api/public', require('./routes/public'));
app.use('/api/search', require('./routes/search'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/orders', require('./routes/orders'));

// Rutas SaaS Multi-Tenant
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/broadcasts', require('./routes/broadcasts'));
app.use('/api/analytics', require('./routes/analytics'));



// Ruta de salud
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SySaaS API funcionando correctamente' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(err.status || 500).json({
        message: err.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // 1. Inicializar base de datos si no existe
        const dbInit = require('./config/dbInit');
        await dbInit();

        // 2. Verificar la conexión del pool
        const db = require('./config/database');
        const connection = await db.getConnection();
        console.log('[DB] Conexión a MySQL verificada y lista para consultas.');
        connection.release();

        // 3. Levantar el servidor Express
        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                           ║
║   SySaaS API Server                                     ║
║   ───────────────────────────────────────────────────    ║
║   Servidor corriendo en: http://localhost:${PORT}          ║
║   Ambiente: ${process.env.NODE_ENV || 'development'}                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('[ERROR] Error fatal al arrancar el servidor backend:', error);
        process.exit(1);
    }
}

startServer();

// Manejadores globales de errores del proceso
process.on('unhandledRejection', (reason, promise) => {
    console.error('[WARN] Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // Nota: Dependiendo de tu estrategia de despliegue, podrías querer hacer un process.exit(1)
    // para permitir que un gestor de procesos (como pm2 o nodemon) reinicie la instancia limpia.
});

process.on('uncaughtException', (error) => {
    console.error('[WARN] Uncaught Exception thrown:', error);
    // Es buena práctica salir del proceso ante excepciones no controladas para evitar un estado inconsistente
    process.exit(1);
});

module.exports = app;
