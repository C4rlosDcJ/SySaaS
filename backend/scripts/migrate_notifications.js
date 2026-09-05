// Script para ejecutar la migracion de la tabla notifications
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sysaas_db',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        multipleStatements: true
    });

    try {
        const sql = fs.readFileSync(
            path.join(__dirname, '../../database/add_notifications_table.sql'),
            'utf8'
        );
        await connection.query(sql);
        console.log('[MIGRATION] Tabla notifications creada correctamente.');
    } catch (err) {
        console.error('[MIGRATION] Error:', err.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

runMigration();
