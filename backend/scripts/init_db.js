const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
};

async function initDB() {
    let connection;
    try {
        console.log('Conectando a MySQL...');
        connection = await mysql.createConnection(dbConfig);

        console.log(`Creando base de datos ${process.env.DB_NAME} si no existe...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        await connection.query(`USE ${process.env.DB_NAME}`);

        console.log('Configurando tablas...');

        // 1. Usuarios
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                role ENUM('admin', 'technician', 'receptionist') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Clientes
        await connection.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(255) NOT NULL,
                last_name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(20),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Servicios (Catálogo)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS services (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                base_price DECIMAL(10, 2) NOT NULL,
                estimated_hours INT DEFAULT 1,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Reparaciones (Tabla Principal)
        // Incluye las columnas nuevas: status (VARCHAR), signatures, costs extended
        await connection.query(`
            CREATE TABLE IF NOT EXISTS repairs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticket_number VARCHAR(20) NOT NULL UNIQUE,
                customer_id INT NOT NULL,
                device_type ENUM('smartphone', 'tablet', 'laptop', 'desktop', 'console', 'other') NOT NULL,
                model VARCHAR(255) NOT NULL,
                serial_number VARCHAR(255),
                imei VARCHAR(255),
                device_password VARCHAR(255),
                problem_description TEXT NOT NULL,
                technical_observations TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'received', 
                priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
                
                -- Costos
                diagnosis_cost DECIMAL(10, 2) DEFAULT 0.00,
                labor_cost DECIMAL(10, 2) DEFAULT 0.00,
                parts_cost DECIMAL(10, 2) DEFAULT 0.00,
                discount DECIMAL(10, 2) DEFAULT 0.00,
                tax_rate DECIMAL(5, 2) DEFAULT 0.16,
                total_cost DECIMAL(10, 2) DEFAULT 0.00,
                advance_payment DECIMAL(10, 2) DEFAULT 0.00,
                
                -- Fechas
                estimated_delivery DATETIME,
                completed_at DATETIME,
                delivered_at DATETIME,
                
                -- Técnicos y Garantía
                technician_id INT,
                warranty_days INT DEFAULT 30,
                warranty_notes TEXT,
                
                -- Detalles Físicos
                color VARCHAR(50),
                storage_capacity VARCHAR(50),
                battery_health VARCHAR(50),
                screen_status VARCHAR(255),
                account_status VARCHAR(255),
                accessories_received TEXT,
                physical_condition INT DEFAULT 5,
                existing_damage TEXT,
                service_requested VARCHAR(255),
                
                -- Firmas
                signature_approval LONGTEXT,
                signature_delivery LONGTEXT,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
                FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // 5. Historial de Estados
        await connection.query(`
            CREATE TABLE IF NOT EXISTS repair_updates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                repair_id INT NOT NULL,
                status VARCHAR(50) NOT NULL,
                comment TEXT,
                user_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // 6. Archivos/Evidencias
        await connection.query(`
            CREATE TABLE IF NOT EXISTS repair_files (
                id INT AUTO_INCREMENT PRIMARY KEY,
                repair_id INT NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                file_type VARCHAR(50),
                upload_stage ENUM('reception', 'diagnosis', 'repair', 'completion') NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
            )
        `);

        // 7. Configuración (Settings)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(50) UNIQUE NOT NULL,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Insertar usuario admin default si no existe
        const [users] = await connection.query("SELECT * FROM users WHERE username = 'admin'");
        if (users.length === 0) {
            // password: admin123 (bcrypt hash generado correctamente)
            const adminPasswordHash = '$2a$10$5HjXkF/XpIdTcLEzlKG8ZeSVY33xY.YINlb6K1O6wwt03ljX3CiZm';
            await connection.query(`
                INSERT INTO users (username, password, name, role) 
                VALUES ('admin', ?, 'Administrador', 'admin')
            `, [adminPasswordHash]);
            console.log('Usuario admin creado con credenciales: admin / admin123');
        }

        // Insertar settings default
        await connection.query(`
            INSERT IGNORE INTO settings (setting_key, setting_value) VALUES 
            ('business_name', 'SySaaS'),
            ('default_warranty_days', '30'),
            ('contact_email', ''),
            ('contact_phone', '')
        `);

        console.log('✅ Base de datos inicializada correctamente.');

    } catch (error) {
        console.error('Error inicializando BD:', error);
    } finally {
        if (connection) await connection.end();
    }
}

initDB();
