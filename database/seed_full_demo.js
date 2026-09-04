const mysql = require('../backend/node_modules/mysql2/promise');

async function runSeed() {
    console.log('===========================================================');
    console.log('   SySaaS SaaS - Generador Permanente de Datos Demo (1 Año)  ');
    console.log('===========================================================');

    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'sysaas_db'
    });

    try {
        const [tenants] = await pool.query('SELECT id, company_name FROM tenants');
        const [branches] = await pool.query('SELECT id, tenant_id, name FROM branches');

        console.log(`[SEED] Empresas encontradas: ${tenants.length}. Iniciando sembrado relacional...`);

        const firstNames = ['Carlos', 'María', 'Juan', 'Ana', 'Luis', 'Sofía', 'Pedro', 'Lucía', 'Diego', 'Elena', 'Javier', 'Carmen', 'Fernando', 'Patricia', 'Roberto', 'Laura', 'Alejandro', 'Gabriel', 'Valentina', 'Mateo', 'Rodrigo', 'Camila', 'Andrés', 'Isabel', 'Esteban'];
        const lastNames = ['García', 'Rodríguez', 'López', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Vásquez', 'Ramos', 'Díaz', 'Morales', 'Reyes', 'Gutiérrez', 'Ortiz', 'Castillo', 'Nava', 'Mendoza', 'Aguilar', 'Medina', 'Vargas', 'Jiménez'];
        const brandsList = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Huawei', 'LG', 'Sony', 'Lenovo', 'HP', 'Dell', 'Asus', 'Acer'];
        const modelsList = ['iPhone 12', 'iPhone 13 Pro', 'iPhone 14', 'Galaxy S21', 'Galaxy S22', 'Redmi Note 11', 'Moto G200', 'P40 Pro', 'MacBook Pro M1', 'Pavilion 15', 'ThinkPad E14', 'ZenBook 14'];
        const failureTypes = ['Pantalla rota / cristal agrietado', 'Batería inflada o degradada', 'No enciende / corto en tarjeta', 'Puerto de carga dañado', 'Limpieza y sulfatado por humedad', 'Cámara principal borrosa', 'Reinstalación de sistema operativo', 'Falla de micrófono / altavoz'];
        const statuses = ['delivered', 'ready', 'repairing', 'diagnosing', 'waiting_parts', 'waiting_approval', 'cancelled'];
        const paymentMethods = ['cash', 'card', 'transfer'];
        const serviceNames = ['Cambio de Pantalla OLED', 'Reemplazo de Batería Original', 'Reparación de Centro de Carga', 'Mantenimiento Preventivo / Limpieza', 'Diagnóstico Técnico Avanzado', 'Reinstalación de Software'];

        const ts = Date.now();
        const now = new Date();

        for (const tenant of tenants) {
            const tenantId = tenant.id;
            const tenantBranches = branches.filter(b => b.tenant_id === tenantId);
            const mainBranchId = tenantBranches.length > 0 ? tenantBranches[0].id : 1;

            console.log(`\n[SEED] ---> Procesando Empresa: "${tenant.company_name}" (ID: ${tenantId})...`);

            // 1. Asegurar Catálogo de Servicios
            console.log(`[SEED] Configurando catálogo de servicios...`);
            const serviceIds = [];
            for (const sName of serviceNames) {
                const [sRes] = await pool.query(`
                    INSERT INTO services_catalog (tenant_id, name, description, base_price, estimated_time, is_active)
                    VALUES (?, ?, ?, ?, '60 min', TRUE)
                `, [tenantId, sName, `Servicio profesional de ${sName}`, 350 + Math.floor(Math.random() * 850)]);
                serviceIds.push(sRes.insertId);
            }

            // 2. Asegurar Usuarios Técnicos y Vendedores
            console.log(`[SEED] Configurando personal (técnicos y vendedores)...`);
            const dummyPass = '$2a$10$DJQLqCu4mcyLL2y7svsl0usx5SuEYO7jGsRr7mKbQLeAbEQUDkDle';
            const [techRes] = await pool.query(`
                INSERT INTO users (tenant_id, branch_id, role, first_name, last_name, email, password, phone, is_active)
                VALUES (?, ?, 'technician', 'Técnico Especialista', ?, ?, ?, '5599001122', TRUE)
            `, [tenantId, mainBranchId, tenant.company_name, `tech_demo_${tenantId}_${ts}@sysaas.com`, dummyPass]);
            const techId = techRes.insertId;

            // 3. Crear 200 Clientes por empresa
            console.log(`[SEED] Generando 200 clientes...`);
            const customerIds = [];
            for (let i = 0; i < 200; i++) {
                const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
                const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
                const phone = `55${Math.floor(10000000 + Math.random() * 90000000)}`;
                const email = `cliente_demo_${tenantId}_${i}_${ts.toString().slice(-4)}@sysaas.com`;
                const targetBranch = tenantBranches[Math.floor(Math.random() * tenantBranches.length)]?.id || mainBranchId;

                const [cRes] = await pool.query(`
                    INSERT INTO users (tenant_id, branch_id, role, first_name, last_name, email, password, phone, is_active)
                    VALUES (?, ?, 'client', ?, ?, ?, ?, ?, TRUE)
                `, [tenantId, targetBranch, fn, ln, email, dummyPass, phone]);
                customerIds.push(cRes.insertId);
            }

            // 4. Crear 1,000 Reparaciones distribuidas uniformemente en 365 días
            console.log(`[SEED] Generando 1,000 reparaciones históricas (365 días)...`);
            for (let i = 0; i < 1000; i++) {
                const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];
                const targetBranch = tenantBranches[Math.floor(Math.random() * tenantBranches.length)]?.id || mainBranchId;
                const ticketNumber = `ST-${tenantId}-${ts.toString().slice(-4)}-${i}`;
                const brand = brandsList[Math.floor(Math.random() * brandsList.length)];
                const model = modelsList[Math.floor(Math.random() * modelsList.length)];
                const problem = failureTypes[Math.floor(Math.random() * failureTypes.length)];
                const status = statuses[Math.floor(Math.random() * statuses.length)];
                const totalCost = Math.floor(400 + Math.random() * 3500);
                const advance = status === 'delivered' ? totalCost : Math.floor(totalCost * (Math.random() > 0.4 ? 0.5 : 0));
                const paymentStatus = advance >= totalCost ? 'paid' : advance > 0 ? 'partial' : 'pending';
                const serviceId = serviceIds[Math.floor(Math.random() * serviceIds.length)];

                // Distribuir de 0 a 365 días atrás
                const daysAgo = Math.floor(Math.random() * 365);
                const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

                await pool.query(`
                    INSERT INTO repairs (
                        tenant_id, branch_id, customer_id, technician_id, service_id, device_type_id, brand_id,
                        ticket_number, brand_other, model, problem_description, total_cost, advance_payment,
                        status, payment_status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [tenantId, targetBranch, customerId, techId, serviceId, ticketNumber, brand, model, problem, totalCost, advance, status, paymentStatus, createdDate, createdDate]);
            }

            // 5. Crear 800 Ventas POS distribuidas uniformemente en 365 días
            console.log(`[SEED] Generando 800 ventas de mostrador POS (365 días)...`);
            for (let i = 0; i < 800; i++) {
                const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];
                const targetBranch = tenantBranches[Math.floor(Math.random() * tenantBranches.length)]?.id || mainBranchId;
                const saleNumber = `VTA-${tenantId}-${ts.toString().slice(-4)}-${i}`;
                const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
                const total = Math.floor(250 + Math.random() * 2500);
                const received = total + (method === 'cash' ? Math.floor(Math.random() * 300) : 0);
                const changeAmt = received - total;

                const daysAgo = Math.floor(Math.random() * 365);
                const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

                await pool.query(`
                    INSERT INTO sales (
                        tenant_id, branch_id, cashier_id, customer_id, sale_number, subtotal, discount, total,
                        payment_method, amount_received, change_amount, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'completed', ?)
                `, [tenantId, targetBranch, techId, customerId, saleNumber, total, total, method, received, changeAmt, createdDate]);
            }

            // 6. Crear Proveedores y Órdenes de Compra
            console.log(`[SEED] Generando órdenes de compra...`);
            const [supRes] = await pool.query(`
                INSERT INTO suppliers (tenant_id, company_name, contact_name, email, phone, tax_id)
                VALUES (?, 'Proveedor Nacional de Repuestos', 'Alonso Gómez', 'contacto@repuestosnacionales.com', '5511447788', 'PNR-880909-XY1')
            `, [tenantId]);
            const supplierId = supRes.insertId;

            for (let i = 0; i < 20; i++) {
                const poNumber = `OC-${tenantId}-${ts.toString().slice(-3)}-${i}`;
                const totalAmt = Math.floor(2000 + Math.random() * 9000);
                const daysAgo = Math.floor(Math.random() * 365);
                const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

                await pool.query(`
                    INSERT INTO purchase_orders (tenant_id, branch_id, supplier_id, po_number, status, total_amount, created_at)
                    VALUES (?, ?, ?, ?, 'received', ?, ?)
                `, [tenantId, mainBranchId, supplierId, poNumber, totalAmt, createdDate]);
            }

            // 7. Registros de Auditoría
            console.log(`[SEED] Generando logs de auditoría...`);
            for (let i = 0; i < 80; i++) {
                const daysAgo = Math.floor(Math.random() * 365);
                const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

                await pool.query(`
                    INSERT INTO activity_logs (user_id, user_email, action, details, created_at)
                    VALUES (?, 'admin@sysaas.com', 'SYSTEM_HEALTH_CHECK', 'Métricas de sistema actualizadas correctamente', ?)
                `, [techId, createdDate]);
            }
        }

        console.log('\n===========================================================');
        console.log('   ✅ PROCESO COMPLETADO: 1 Año de Datos Generados Con Éxito');
        console.log('===========================================================');
        await pool.end();
        process.exit(0);

    } catch (err) {
        console.error('\n[SEED FATAL ERROR]', err);
        await pool.end();
        process.exit(1);
    }
}

runSeed();
