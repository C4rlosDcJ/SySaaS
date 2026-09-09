const db = require('../config/database');

// Helper para obtener la API key de la base de datos o variables de entorno
async function getApiKey() {
    try {
        const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = ?', ['gemini_api_key']);
        if (rows.length > 0 && rows[0].setting_value) {
            return rows[0].setting_value.trim();
        }
    } catch (e) {
        console.error('Error al leer gemini_api_key de settings:', e);
    }
    return process.env.GEMINI_API_KEY || null;
}

// Helper para hacer llamadas directas a la API de Gemini mediante fetch con fallback de modelos
async function callGemini(prompt, systemInstruction = '', jsonMode = false) {
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('API Key de Gemini no configurada. Por favor ve a Ajustes o configura GEMINI_API_KEY en el archivo .env del backend.');
    }

    // Lista de modelos ordenados por preferencia y velocidad
    const modelsToTry = [
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite'
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            const requestBody = {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {}
            };

            if (systemInstruction) {
                requestBody.systemInstruction = {
                    parts: [{ text: systemInstruction }]
                };
            }

            if (jsonMode) {
                requestBody.generationConfig.responseMimeType = 'application/json';
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMessage = errData?.error?.message || 'Error desconocido';
                
                // Si es un error de modelo no encontrado, cuota excedida (429) o alta demanda temporal (503), intentamos con el siguiente modelo
                const isRetryable = response.status === 404 || response.status === 429 || response.status === 503 ||
                                    errMessage.includes('not found') || errMessage.includes('not supported') || 
                                    errMessage.includes('quota') || errMessage.includes('rate limit') || errMessage.includes('limit:') ||
                                    errMessage.includes('demand') || errMessage.includes('temporary') || errMessage.includes('try again later');
                                    
                if (isRetryable) {
                    console.warn(`[AI SERVICE] El modelo ${modelName} falló con error (${response.status}): ${errMessage}. Intentando con el siguiente...`);
                    lastError = new Error(errMessage);
                    continue;
                }
                
                throw new Error(errMessage);
            }

            const data = await response.json();
            const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!textResult) {
                throw new Error('No se recibió respuesta válida del modelo de IA.');
            }

            return textResult;
        } catch (error) {
            lastError = error;
            const errStr = error.message || '';
            const isRetryable = errStr.includes('not found') || errStr.includes('not supported') || 
                                errStr.includes('404') || errStr.includes('quota') || 
                                errStr.includes('rate limit') || errStr.includes('429') ||
                                errStr.includes('503') || errStr.includes('demand') ||
                                errStr.includes('temporary') || errStr.includes('try again later');
                                
            if (!isRetryable) {
                throw error;
            }
        }
    }

    throw new Error(`Se excedió la cuota o falló el acceso a la API de Gemini. Detalles: ${lastError?.message}`);
}

// 1. Diagnóstico Inteligente
exports.generateDiagnosis = async (deviceType, brand, model, description, serviceRequested = '') => {
    // Consultar catálogo de servicios disponibles para contextualizar precios e ideas de servicios
    let servicesContext = '';
    try {
        const [services] = await db.query('SELECT name, base_price, estimated_time FROM services_catalog WHERE is_active = TRUE');
        if (services.length > 0) {
            servicesContext = 'Catálogo de servicios disponibles en nuestra tienda:\n' + 
                services.map(s => `- ${s.name}: precio base $${s.base_price}, tiempo estimado ${s.estimated_time}`).join('\n');
        }
    } catch (e) {
        console.error('Error al cargar catálogo para contexto de IA:', e);
    }

    const systemInstruction = `Eres un asesor de servicio técnico experto en explicar reparaciones a clientes finales sin conocimientos técnicos.
Tu tarea es analizar la falla reportada y predecir el diagnóstico, costos estimados y tiempo de reparación.
Debes usar un lenguaje sumamente amigable, claro, y libre de tecnicismos complejos. En lugar de términos de ingeniería o microelectrónica, usa explicaciones sencillas (ej. en lugar de "daño en el IC de carga en la placa base", di "un problema en el componente interno encargado de recibir la energía de la batería").
Responde únicamente en formato JSON válido con los campos exactos descritos abajo. No agregues markdown ni explicaciones adicionales fuera del JSON.

Estructura del JSON:
{
  "diagnosis": "Un diagnóstico extremadamente simple y claro de entender para cualquier persona común (ej. 'La pieza que conecta el cargador está dañada internamente y debe cambiarse').",
  "recommended_service_name": "Nombre de un servicio recomendado de nuestro catálogo o uno que describa bien la acción.",
  "estimated_total_cost": 450.00, // Número decimal. Costo TOTAL estimado de la reparación basado en mercado o catálogo (en pesos mexicanos/moneda local).
  "estimated_time": "1-2 horas", // Texto corto ej. "30 min", "2-3 horas", "1-2 días".
  "technical_observations": "Recomendaciones sencillas, consejos y pasos a seguir explicados de forma muy amigable para el cliente."
}`;

    const prompt = `Analiza el siguiente equipo con falla:
- Tipo de Dispositivo: ${deviceType || 'No especificado'}
- Marca: ${brand || 'No especificado'}
- Modelo: ${model || 'No especificado'}
- Servicio base sugerido/seleccionado: ${serviceRequested || 'No especificado'}
- Falla reportada: ${description}

${servicesContext}

Proporciona tu diagnóstico estimado ajustando los costos a montos lógicos de mercado (valores en pesos mexicanos/moneda local razonable).`;

    const resultText = await callGemini(prompt, systemInstruction, true);
    const parsed = JSON.parse(resultText);

    const rawCost = parsed.estimated_total_cost || parsed.estimated_cost || parsed.total_cost || parsed.cost || parsed.estimated_labor_cost || 0;
    const cleanCost = typeof rawCost === 'string' ? parseFloat(rawCost.replace(/[^0-9.]/g, '')) : parseFloat(rawCost);
    const finalCost = isNaN(cleanCost) ? 0 : cleanCost;

    return {
        diagnosis: parsed.diagnosis || '',
        recommended_service_name: parsed.recommended_service_name || '',
        estimated_total_cost: finalCost,
        estimated_time: parsed.estimated_time || '1-2 horas',
        technical_observations: parsed.technical_observations || ''
    };
};

// 1b. Procesar y Auto-completar desde descripción (Conversacional)
exports.parseQuote = async (rawDescription) => {
    // 1. Obtener tipos de dispositivos, marcas y catálogo de servicios de la DB
    const [deviceTypes] = await db.query('SELECT id, name FROM device_types WHERE is_active = TRUE');
    const [brands] = await db.query('SELECT id, name FROM brands WHERE is_active = TRUE');
    const [services] = await db.query('SELECT id, name, base_price, estimated_time FROM services_catalog WHERE is_active = TRUE');

    const deviceTypesList = deviceTypes.map(t => t.name).join(', ');
    const brandsList = brands.map(b => b.name).join(', ');
    const servicesList = services.map(s => `- ID: ${s.id}, Nombre: "${s.name}", Precio Base: $${s.base_price}`).join('\n');

    const systemInstruction = `Eres un asistente de recepción de taller técnico. Analiza la descripción libre del cliente e identifica de manera estructurada los campos del dispositivo y el problema.
Debes encajar el "device_type" y la "brand" dentro de las listas permitidas si coinciden. Si no coinciden con ninguna de la lista, devuélvelos como "Otro" o la marca que corresponda.

Catálogo de servicios disponibles en nuestra tienda:
${servicesList}

Revisa si el problema del cliente coincide o es muy similar a alguno de los servicios de nuestro catálogo. Si coincide fuertemente con alguno, indica el "matched_service_id" exacto de la lista. Si no coincide con ninguno, déjalo como null.

Estima un costo total razonable para la reparación (mano de obra + refacción si aplica) basado en precios de mercado comunes o el precio del servicio de nuestro catálogo si coincide.
Responde estrictamente en formato JSON válido sin markdown.

Estructura del JSON:
{
  "device_type": "Uno de la lista de tipos de dispositivo permitidos, o 'Otro'.",
  "brand": "Una de la lista de marcas permitidas, o 'Otro'.",
  "brand_other": "Nombre de la marca si no está en la lista permitida y elegiste 'Otro'. Si está en la lista, déjalo vacío.",
  "model": "El modelo exacto detectado (ej: 'iPhone 13 Pro Max', 'Pavilion 15-eg', etc.).",
  "color": "Color del equipo si se menciona, sino vacío.",
  "problem": "Un resumen muy simple de la falla en lenguaje común y no técnico.",
  "diagnosis": "Diagnóstico inicial muy simple explicado en lenguaje común, libre de tecnicismos complejos.",
  "matched_service_id": 12, // El ID del servicio del catálogo si coincide, sino null.
  "estimated_total_cost": 850.00, // Número decimal estimando el costo TOTAL de la reparación (en pesos mexicanos/moneda local). Basado en mercado y catálogo.
  "estimated_time": "1-2 horas" // Texto corto aproximado.
}`;

    const prompt = `Analiza la siguiente solicitud de cotización libre del cliente:
"${rawDescription}"`;

    const resultText = await callGemini(prompt, systemInstruction, true);
    const parsed = JSON.parse(resultText);

    // 2. Resolver IDs en base de datos
    let matchedDeviceTypeId = null;
    let matchedBrandId = null;
    let matchedServiceId = null;
    let matchedServiceName = '';

    // Buscar coincidencia exacta o parecida para device_type
    const deviceTypeVal = parsed.device_type || parsed.deviceType || '';
    const foundType = deviceTypes.find(t => t.name.toLowerCase() === deviceTypeVal.toLowerCase());
    if (foundType) {
        matchedDeviceTypeId = foundType.id;
    } else {
        const otherType = deviceTypes.find(t => t.name.toLowerCase() === 'otro');
        matchedDeviceTypeId = otherType ? otherType.id : null;
    }

    // Buscar coincidencia exacta o parecida para brand
    const brandVal = parsed.brand || parsed.brand_name || parsed.brandName || '';
    const foundBrand = brands.find(b => b.name.toLowerCase() === brandVal.toLowerCase());
    if (foundBrand) {
        matchedBrandId = foundBrand.id;
    } else {
        const otherBrand = brands.find(b => b.name.toLowerCase() === 'otro');
        matchedBrandId = otherBrand ? otherBrand.id : null;
    }

    // Validar y resolver el servicio sugerido
    const serviceIdVal = parsed.matched_service_id || parsed.service_id || null;
    if (serviceIdVal) {
        const foundService = services.find(s => s.id === parseInt(serviceIdVal));
        if (foundService) {
            matchedServiceId = foundService.id;
            matchedServiceName = foundService.name;
        }
    }

    const rawCost = parsed.estimated_total_cost || parsed.estimated_cost || parsed.total_cost || parsed.cost || parsed.estimated_labor_cost || 0;
    const cleanCost = typeof rawCost === 'string' ? parseFloat(rawCost.replace(/[^0-9.]/g, '')) : parseFloat(rawCost);
    const finalCost = isNaN(cleanCost) ? 0 : cleanCost;

    return {
        device_type_id: matchedDeviceTypeId,
        device_type_name: foundType ? foundType.name : (parsed.device_type || 'Otro'),
        brand_id: matchedBrandId,
        brand_name: foundBrand ? foundBrand.name : (parsed.brand || 'Otro'),
        brand_other: foundBrand ? '' : (parsed.brand_other || parsed.brand || ''),
        model: parsed.model || 'Desconocido',
        color: parsed.color || '',
        problem_description: parsed.problem || rawDescription,
        diagnosis: parsed.diagnosis || 'Pendiente de revisión física',
        service_id: matchedServiceId,
        service_name: matchedServiceName,
        estimated_total_cost: finalCost,
        estimated_time: parsed.estimated_time || '1-2 horas'
    };
};

// 2. Profesionalización de Notas Técnicas
exports.improveNote = async (shorthandNote) => {
    const systemInstruction = `Eres un asistente de comunicación profesional para un taller de servicio técnico.
Tu objetivo es reescribir notas técnicas rápidas o abreviadas de los técnicos para convertirlas en un mensaje claro, amable y profesional que pueda ser compartido con el cliente final.
Mantén los detalles técnicos importantes pero exprésalos de forma educada y entendible. Responde ÚNICAMENTE con la nota mejorada en español, sin preámbulos ni explicaciones.`;

    const prompt = `Mejora la siguiente nota técnica: "${shorthandNote}"`;
    return await callGemini(prompt, systemInstruction, false);
};

// 3. Chat de Soporte y Asistente Virtual Multi-Rol y Multi-Empresa
exports.chatSupport = async (message, history = [], sessionInfo = {}) => {
    const user = sessionInfo.user || null;
    const context = sessionInfo.context || {};
    const branchId = sessionInfo.branchId || (user ? user.branch_id : null);
    const role = user ? user.role : 'public_visitor';
    const userTenantId = user ? user.tenant_id : null;

    let systemInstruction = '';
    let ticketContext = '';

    // Detección de números de ticket (REP-...) o pedidos (VTA-...)
    const repairMatch = message.match(/REP-\d{6}-\d{4}/i);
    const orderMatch = message.match(/VTA-\d{6}-\d{4}/i);

    if (repairMatch) {
        try {
            const ticketNum = repairMatch[0].toUpperCase();
            let query = `
                SELECT r.ticket_number, r.status, r.problem_description, r.technical_observations,
                       r.total_cost, r.estimated_delivery, r.warranty_days, r.warranty_expires,
                       r.priority, r.advance_payment, r.created_at, r.tenant_id, r.customer_id,
                       dt.name as device_type, b.name as brand, r.model, r.color,
                       sc.name as service_name,
                       u_tech.first_name as tech_name,
                       t.company_name
                FROM repairs r
                LEFT JOIN device_types dt ON r.device_type_id = dt.id
                LEFT JOIN brands b ON r.brand_id = b.id
                LEFT JOIN services_catalog sc ON r.service_id = sc.id
                LEFT JOIN users u_tech ON r.technician_id = u_tech.id
                LEFT JOIN tenants t ON r.tenant_id = t.id
                WHERE r.ticket_number = ?
            `;
            const params = [ticketNum];

            if (role === 'client') {
                query += ' AND r.customer_id = ? AND r.tenant_id = ?';
                params.push(user.id, userTenantId);
            } else if (userTenantId && role !== 'superadmin') {
                query += ' AND r.tenant_id = ?';
                params.push(userTenantId);
            }

            const [repairs] = await db.query(query, params);
            if (repairs.length > 0) {
                const rep = repairs[0];
                const statusLabels = {
                    received: 'Recibido', diagnosing: 'En diagnóstico', waiting_approval: 'Esperando aprobación',
                    waiting_parts: 'Esperando refacciones', repairing: 'En reparación', quality_check: 'Control de calidad',
                    ready: 'Listo para entrega', delivered: 'Entregado', cancelled: 'Cancelado'
                };
                if (!user) {
                    // Consulta pública en Landing Page
                    ticketContext = `\n\nCONSULTA DE TICKET ${ticketNum} (PÚBLICO):\n` +
                        `- Estado: ${statusLabels[rep.status] || rep.status}\n` +
                        `- Equipo: ${rep.device_type || ''} ${rep.brand || ''} ${rep.model || ''}\n` +
                        `- Taller / Negocio: ${rep.company_name || 'Taller afiliado'}\n` +
                        `- Fecha de ingreso: ${rep.created_at ? new Date(rep.created_at).toLocaleDateString('es-MX') : 'N/A'}\n` +
                        `- Entrega estimada: ${rep.estimated_delivery ? new Date(rep.estimated_delivery).toLocaleDateString('es-MX') : 'Pendiente'}\n` +
                        `Nota: Para consultar detalles de costos o recoger tu equipo, visita directamente la tienda o inicia sesión en tu cuenta.`;
                } else {
                    ticketContext = `\n\nINFORMACION DEL TICKET ${ticketNum}:\n` +
                        `- Estado: ${statusLabels[rep.status] || rep.status}\n` +
                        `- Equipo: ${rep.device_type || ''} ${rep.brand || ''} ${rep.model || ''} ${rep.color || ''}\n` +
                        `- Servicio: ${rep.service_name || 'No asignado'}\n` +
                        `- Problema reportado: ${rep.problem_description || 'No especificado'}\n` +
                        `- Observaciones técnicas: ${rep.technical_observations || 'Sin observaciones aún'}\n` +
                        `- Costo total: $${rep.total_cost || 0} MXN\n` +
                        `- Anticipo recibido: $${rep.advance_payment || 0} MXN\n` +
                        `- Prioridad: ${rep.priority === 'urgent' ? 'Urgente' : 'Normal'}\n` +
                        `- Fecha de ingreso: ${rep.created_at ? new Date(rep.created_at).toLocaleDateString('es-MX') : 'N/A'}\n` +
                        `- Entrega estimada: ${rep.estimated_delivery ? new Date(rep.estimated_delivery).toLocaleDateString('es-MX') : 'Pendiente'}\n` +
                        `- Garantía: ${rep.warranty_days || 30} días\n` +
                        `- Técnico asignado: ${rep.tech_name || 'Pendiente de asignación'}`;
                }
            } else {
                ticketContext = `\n\nNo se encontró ningún ticket con el número ${ticketNum}${role === 'client' ? ' asociado a tu cuenta' : ''}.`;
            }
        } catch (e) {
            console.error('[CHAT] Error al buscar ticket:', e);
        }
    }

    if (orderMatch) {
        try {
            const orderNum = orderMatch[0].toUpperCase();
            let query = `
                SELECT s.sale_number, s.status, s.subtotal, s.total, s.notes, s.created_at
                FROM sales s
                WHERE s.sale_number = ?
            `;
            const params = [orderNum];

            if (role === 'client') {
                query += ' AND s.customer_id = ? AND s.tenant_id = ?';
                params.push(user.id, userTenantId);
            } else if (userTenantId && role !== 'superadmin') {
                query += ' AND s.tenant_id = ?';
                params.push(userTenantId);
            }

            const [orders] = await db.query(query, params);
            if (orders.length > 0) {
                const ord = orders[0];
                const [items] = await db.query(
                    `SELECT si.description, si.quantity, si.unit_price, si.total
                     FROM sale_items si JOIN sales s ON si.sale_id = s.id
                     WHERE s.sale_number = ?`,
                    [orderNum]
                );
                const statusLabels = { pending: 'Pendiente', completed: 'Completado', cancelled: 'Cancelado', refunded: 'Reembolsado' };
                let itemsList = items.map(i => `  - ${i.description} x${i.quantity} — $${i.total} MXN`).join('\n');
                ticketContext += `\n\nINFORMACION DEL PEDIDO ${orderNum}:\n` +
                    `- Estado: ${statusLabels[ord.status] || ord.status}\n` +
                    `- Total: $${ord.total} MXN\n` +
                    `- Fecha: ${ord.created_at ? new Date(ord.created_at).toLocaleDateString('es-MX') : 'N/A'}\n` +
                    `- Ítems:\n${itemsList || '  (sin ítems)'}`;
            } else {
                ticketContext += `\n\nNo se encontró ningún pedido con el número ${orderNum}.`;
            }
        } catch (e) {
            console.error('[CHAT] Error al buscar pedido:', e);
        }
    }

    // ─── CONSTRUCCIÓN DEL CONTEXTO SEGÚN EL ROL ───

    // MODO 1: PÚBLICO EN LANDING PAGE / NO AUTENTICADO
    if (!user) {
        let plansSummary = '';
        try {
            const [plans] = await db.query(
                'SELECT name, price_monthly, price_yearly, max_branches, max_users, max_monthly_repairs, features FROM saas_plans WHERE is_active = 1 ORDER BY price_monthly ASC'
            );
            plansSummary = plans.map(p => {
                let f = {};
                try { f = typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || {}); } catch (e) {}
                const branchDesc = p.max_branches >= 99 ? 'Sucursales ilimitadas' : `Hasta ${p.max_branches} sucursal(es)`;
                const userDesc = p.max_users >= 999 ? 'Usuarios ilimitados' : `Hasta ${p.max_users} usuarios`;
                const repairDesc = p.max_monthly_repairs ? `${p.max_monthly_repairs} tickets/mes` : 'Tickets ilimitados';
                return `- ${p.name}: $${p.price_monthly} MXN/mes ($${p.price_yearly} MXN/año). ${branchDesc}, ${userDesc}, ${repairDesc}. Incluye: ${f.ecommerce ? 'Tienda web y pedidos, ' : ''}${f.ai_assistant ? 'Diagnósticos con IA, ' : ''}${f.transfers ? 'Traspasos entre sucursales, ' : ''}${f.whatsapp_notifications ? 'Avisos automáticos por WhatsApp, ' : ''}${f.advanced_reports ? 'Reportes con Machine Learning, ' : ''}${f.support_tier || 'Soporte estándar'}.`;
            }).join('\n');
        } catch (e) {
            console.error('[CHAT-PUBLIC] Error al cargar planes:', e);
        }

        systemInstruction = `Eres el Asistente Oficial de SySaaS (Plataforma SaaS para Talleres de Soporte Técnico y Reparaciones).
Tu misión es atender a prospectos y visitantes en la página principal, explicar los beneficios de SySaaS, asesorar sobre planes comerciales y resolver dudas sobre la prueba gratuita o rastreo de tickets.

INFORMACIÓN COMERCIAL DE SYSAAS:
- Qué es SySaaS: Software SaaS multi-empresa todo-en-uno para administrar talleres de reparación, soporte técnico, telefonía y cómputo. Permite controlar múltiples sucursales, punto de venta (POS), inventario descentralizado, avisos por WhatsApp y diagnósticos asistidos por IA.
- Periodo de prueba gratuito: 30 días de acceso completo sin requerir tarjeta de crédito en cualquiera de los planes (Básico, Pro o Enterprise). Periodo de prueba único por empresa.
- Enlace para registrar empresa: /register
- Enlace para iniciar sesión: /login
- Enlace para rastreo de tickets: /rastrear

PLANES Y PRECIOS COMERCIALES:
${plansSummary}

REGLAS ESTRICTAS:
1. Responde de forma cálida, profesional y orientada a mostrar el valor de SySaaS para negocios de soporte técnico.
2. Si preguntan por precios, planes o cuotas, básate exclusivamente en la información oficial provista arriba.
3. Si el usuario proporciona un ticket de reparación (formato REP-AAMMDD-XXXX), responde con la información del ticket consultada si está disponible.
4. NO USES EMOJIS bajo ninguna circunstancia.
5. NO uses formato markdown complejo (nada de **, *, #). Usa guiones simples (-) para viñetas. Responde en texto plano limpio.
6. Responde siempre en español.${ticketContext}`;
    }

    // MODO 2: SUPERADMIN DE PLATAFORMA SAAS
    else if (role === 'superadmin') {
        let globalStats = '';
        try {
            const [[tCount]] = await db.query('SELECT COUNT(*) as total FROM tenants');
            const [statusRows] = await db.query('SELECT subscription_status, COUNT(*) as count FROM tenants GROUP BY subscription_status');
            const [planRows] = await db.query('SELECT sp.name, COUNT(*) as count FROM tenants t JOIN saas_plans sp ON t.plan_id = sp.id GROUP BY sp.name');
            const [recentTenants] = await db.query('SELECT company_name, slug, subscription_status, created_at FROM tenants ORDER BY id DESC LIMIT 5');

            const statusText = statusRows.map(r => `${r.subscription_status}: ${r.count}`).join(', ');
            const planText = planRows.map(r => `${r.name}: ${r.count}`).join(', ');
            const recentText = recentTenants.map(r => `- ${r.company_name} (${r.subscription_status})`).join('\n');

            globalStats = `ESTADÍSTICAS GLOBALES DE LA PLATAFORMA:
- Total empresas registradas: ${tCount.total}
- Empresas por estado de suscripción: ${statusText}
- Empresas por plan contratado: ${planText}
- Empresas registradas recientemente:\n${recentText}`;
        } catch (e) {
            console.error('[CHAT-SUPERADMIN] Error al cargar stats:', e);
        }

        systemInstruction = `Eres el Copiloto Ejecutivo SuperAdmin de SySaaS.
Tu rol es asistir al superadministrador en la supervisión global de la plataforma, análisis de métricas, suscripciones, empresas y configuración.

${globalStats}

RUTAS DEL PANEL SUPERADMIN:
- Gestión de planes y precios: /admin/super-planes
- Gestión de empresas SaaS: /admin/super-empresas
- Usuarios globales de plataforma: /admin/super-usuarios
- Comunicados del sistema: /admin/super-comunicados
- Registro de auditoría global: /admin/super-auditoria
- Configuración global de plataforma: /admin/super-configuracion

REGLAS ESTRICTAS:
1. Responde de manera profesional, directa, precisa y ejecutiva.
2. Ayuda al SuperAdmin a resolver consultas sobre métricas globales, administración y configuración de la infraestructura.
3. NO USES EMOJIS bajo ninguna circunstancia.
4. NO uses markdown complejo. Usa guiones simples (-) para viñetas. Responde en texto plano limpio.${ticketContext}`;
    }

    // MODO 3: ADMINISTRADOR DE EMPRESA / DUEÑO DE TALLER
    else if (role === 'admin' || role === 'tenant_admin') {
        let tenantInfo = { company_name: 'Mi Empresa', plan_name: 'Pro', subscription_status: 'active' };
        let repairsSummary = '';
        let urgentText = '';
        let lowStockText = '';
        let salesText = '';

        try {
            const [[tData]] = await db.query(
                'SELECT t.company_name, t.slug, t.subscription_status, sp.name as plan_name FROM tenants t JOIN saas_plans sp ON t.plan_id = sp.id WHERE t.id = ?',
                [userTenantId]
            );
            if (tData) tenantInfo = tData;

            const [statusCounts] = await db.query(
                `SELECT status, COUNT(*) as count FROM repairs 
                 WHERE tenant_id = ? AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE()) 
                 GROUP BY status`,
                [userTenantId]
            );
            repairsSummary = statusCounts.map(s => `${s.status}: ${s.count}`).join(', ') || 'Sin órdenes este mes.';

            const [urgentRepairs] = await db.query(
                `SELECT ticket_number, model, problem_description, status FROM repairs 
                 WHERE tenant_id = ? AND priority = 'urgent' AND status NOT IN ('delivered', 'cancelled') 
                 LIMIT 5`,
                [userTenantId]
            );
            urgentText = urgentRepairs.length > 0
                ? urgentRepairs.map(u => `- Ticket ${u.ticket_number} (${u.model || 'Equipo'}): ${u.problem_description || 'Sin descripción'} [Estado: ${u.status}]`).join('\n')
                : 'No hay reparaciones urgentes pendientes en este momento.';

            const [lowStock] = await db.query(
                `SELECT name, stock, min_stock, sale_price FROM products 
                 WHERE tenant_id = ? AND is_active = 1 AND stock <= min_stock 
                 LIMIT 6`,
                [userTenantId]
            );
            lowStockText = lowStock.length > 0
                ? lowStock.map(p => `- ${p.name}: ${p.stock} unidades restantes (mínimo: ${p.min_stock})`).join('\n')
                : 'Inventario en niveles adecuados.';

            const [[salesMonth]] = await db.query(
                `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM sales 
                 WHERE tenant_id = ? AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
                [userTenantId]
            );
            salesText = `${salesMonth.count} ventas registradas con un monto acumulado de $${salesMonth.total} MXN.`;
        } catch (e) {
            console.error('[CHAT-ADMIN] Error al cargar contexto de empresa:', e);
        }

        systemInstruction = `Eres el Copiloto Gerencial de "${tenantInfo.company_name}".
Tu misión es asistir al administrador y dueño del negocio en la supervisión de operaciones, control de reparaciones, inventario, ventas y equipo de trabajo.

RESUMEN OPERATIVO DE TU EMPRESA (${tenantInfo.company_name}):
- Plan contratado: ${tenantInfo.plan_name} (Estado: ${tenantInfo.subscription_status})
- Reparaciones del mes en curso: ${repairsSummary}
- Reparaciones urgentes activas:\n${urgentText}
- Alertas de inventario con stock bajo:\n${lowStockText}
- Ventas del mes en curso: ${salesText}

REGLAS ESTRICTAS:
1. Responde de forma ejecutiva, ágil y constructiva.
2. Tienes acceso exclusivo a los datos de "${tenantInfo.company_name}". No mezcles ni menciones datos de otras empresas.
3. Si el usuario pregunta por un ticket o pedido específico, utiliza la información consultada arriba.
4. NO USES EMOJIS bajo ninguna circunstancia.
5. NO uses formato markdown (nada de **, *, #). Usa guiones simples (-) para viñetas. Responde en texto plano limpio.${ticketContext}`;
    }

    // MODO 4: TÉCNICO DE TALLER
    else if (role === 'technician') {
        let techRepairs = '';
        let catalogSummary = '';
        let companyName = 'Taller';

        try {
            const [[tData]] = await db.query('SELECT company_name FROM tenants WHERE id = ?', [userTenantId]);
            if (tData) companyName = tData.company_name;

            const [assigned] = await db.query(`
                SELECT r.ticket_number, r.status, r.model, r.problem_description, r.priority, r.estimated_delivery
                FROM repairs r
                WHERE r.tenant_id = ? AND r.technician_id = ? AND r.status NOT IN ('delivered', 'cancelled')
                ORDER BY (r.priority = 'urgent') DESC, r.created_at ASC
                LIMIT 8
            `, [userTenantId, user.id]);

            techRepairs = assigned.length > 0
                ? assigned.map(a => `- Ticket ${a.ticket_number} (${a.model || 'Equipo'}): ${a.status} [${a.priority === 'urgent' ? 'URGENTE' : 'Normal'}]. Falla: ${a.problem_description || 'No especificada'}. Entrega: ${a.estimated_delivery ? new Date(a.estimated_delivery).toLocaleDateString('es-MX') : 'Pendiente'}`).join('\n')
                : 'No tienes equipos pendientes asignados a ti en este momento.';

            const [services] = await db.query(
                'SELECT name, base_price, estimated_time FROM services_catalog WHERE tenant_id = ? AND is_active = 1 ORDER BY name LIMIT 10',
                [userTenantId]
            );
            catalogSummary = services.map(s => `- ${s.name}: $${s.base_price} MXN (${s.estimated_time || '1-2h'})`).join('\n') || 'Catálogo estándar';
        } catch (e) {
            console.error('[CHAT-TECH] Error al cargar contexto de técnico:', e);
        }

        systemInstruction = `Eres el Asistente Técnico de Banco de "${companyName}".
Tu misión es apoyar a los técnicos en banco de trabajo con diagnósticos electrónicos, sugerencias técnicas de solución, verificación de refacciones y profesionalización de notas para clientes.

DATOS DE BANCO DE TRABAJO:
- Técnico: ${user.first_name || ''} ${user.last_name || ''}
- Taller: ${companyName}
- Equipos asignados a ti actualmente:\n${techRepairs}
- Servicios frecuentes del catálogo:\n${catalogSummary}

REGLAS ESTRICTAS:
1. Brinda explicaciones técnicas precisas, prácticas y pasos ordenados de solución para fallas de hardware y software.
2. Si te piden redactar una nota técnica para el cliente, conviértela en un mensaje claro, formal, educado y sin tecnicismos confusos.
3. Si el técnico consulta sus asignaciones, indícale sus equipos asignados listados arriba.
4. NO USES EMOJIS bajo ninguna circunstancia.
5. NO uses markdown complejo. Responde en texto plano limpio con guiones simples (-).${ticketContext}`;
    }

    // MODO 5: CAJERO / VENTAS / RECEPCIÓN
    else if (role === 'cashier' || role === 'salesperson') {
        let servicesText = '';
        let productsText = '';
        let companyName = 'Taller';

        try {
            const [[tData]] = await db.query('SELECT company_name FROM tenants WHERE id = ?', [userTenantId]);
            if (tData) companyName = tData.company_name;

            const [services] = await db.query(
                'SELECT name, base_price, estimated_time, description FROM services_catalog WHERE tenant_id = ? AND is_active = 1 ORDER BY name LIMIT 12',
                [userTenantId]
            );
            servicesText = services.map(s => `- ${s.name}: $${s.base_price} MXN (${s.estimated_time || '1-2h'})`).join('\n') || 'Sin servicios registrados.';

            const [products] = await db.query(
                'SELECT name, sale_price, stock FROM products WHERE tenant_id = ? AND is_active = 1 AND stock > 0 ORDER BY name LIMIT 12',
                [userTenantId]
            );
            productsText = products.map(p => `- ${p.name}: $${p.sale_price} MXN (Stock disponible: ${p.stock})`).join('\n') || 'Sin productos con stock.';
        } catch (e) {
            console.error('[CHAT-CASHIER] Error al cargar contexto de mostrador:', e);
        }

        systemInstruction = `Eres el Asistente de Mostrador y POS de "${companyName}".
Tu misión es asistir al personal de recepción y caja en cotizaciones rápidas, consulta de servicios, existencias y estado de órdenes para clientes en sucursal.

CATÁLOGO DE SERVICIOS DISPONIBLES:
${servicesText}

PRODUCTOS EN VENTA CON STOCK:
${productsText}

REGLAS ESTRICTAS:
1. Facilita cotizaciones rápidas y confirma existencias basándote en la información oficial anterior.
2. Si el cliente pregunta por el estado de una reparación, consulta el ticket indicado arriba.
3. Responde siempre con amabilidad y precisión en montos monetarios (pesos mexicanos MXN).
4. NO USES EMOJIS bajo ninguna circunstancia.
5. NO uses formato markdown. Usa guiones simples (-) para viñetas. Responde en texto plano limpio.${ticketContext}`;
    }

    // MODO 6: CLIENTE FINAL AUTENTICADO
    else if (role === 'client') {
        let myRepairsText = '';
        let myOrdersText = '';
        let companyName = 'Taller';

        try {
            const [[tData]] = await db.query('SELECT company_name FROM tenants WHERE id = ?', [userTenantId]);
            if (tData) companyName = tData.company_name;

            const [repairs] = await db.query(`
                SELECT r.ticket_number, r.status, r.model, r.total_cost, r.advance_payment, r.created_at, r.estimated_delivery, r.warranty_days
                FROM repairs r
                WHERE r.customer_id = ? AND r.tenant_id = ?
                ORDER BY r.created_at DESC LIMIT 5
            `, [user.id, userTenantId]);

            const statusLabels = {
                received: 'Recibido', diagnosing: 'En diagnóstico', waiting_approval: 'Esperando tu aprobación',
                waiting_parts: 'Esperando refacciones', repairing: 'En reparación', quality_check: 'Control de calidad',
                ready: 'Listo para recoger', delivered: 'Entregado', cancelled: 'Cancelado'
            };

            myRepairsText = repairs.length > 0
                ? repairs.map(r => `- Ticket ${r.ticket_number} (${r.model || 'Equipo'}): Estado "${statusLabels[r.status] || r.status}". Costo: $${r.total_cost || 0} MXN (Anticipo: $${r.advance_payment || 0} MXN). Entrega estimada: ${r.estimated_delivery ? new Date(r.estimated_delivery).toLocaleDateString('es-MX') : 'Por definir'}. Garantía: ${r.warranty_days || 30} días`).join('\n')
                : 'No tienes reparaciones registradas actualmente.';

            const [orders] = await db.query(`
                SELECT sale_number, status, total, created_at FROM sales 
                WHERE customer_id = ? AND tenant_id = ? 
                ORDER BY created_at DESC LIMIT 4
            `, [user.id, userTenantId]);

            myOrdersText = orders.length > 0
                ? orders.map(o => `- Pedido ${o.sale_number}: $${o.total} MXN (Estado: ${o.status})`).join('\n')
                : 'Sin pedidos de compra recientes.';
        } catch (e) {
            console.error('[CHAT-CLIENT] Error al cargar contexto de cliente:', e);
        }

        systemInstruction = `Eres el Asistente Virtual de Atención al Cliente de "${companyName}".
Tu misión es atender amablemente a ${user.first_name || 'nuestro cliente'}, informarle sobre el estado de sus equipos en reparación, sus pedidos y resolver dudas sobre garantías y servicios.

TUS EQUIPOS EN REPARACIÓN:
${myRepairsText}

TUS PEDIDOS RECIENTES:
${myOrdersText}

REGLAS ESTRICTAS:
1. Responde de forma muy amable, clara y en lenguaje comprensible sin tecnicismos complejos.
2. Si el cliente pregunta por su equipo, utiliza exclusivamente la información de sus tickets listada arriba.
3. Si el estado es "Listo para recoger", indícale con alegría que su equipo ya está listo en sucursal.
4. Si el estado es "Esperando tu aprobación", explícale que puede revisar la cotización en su portal para autorizar el inicio de la reparación.
5. NO USES EMOJIS bajo ninguna circunstancia.
6. NO uses formato markdown (nada de **, *, #). Usa guiones simples (-) para viñetas. Responde en texto plano limpio.${ticketContext}`;
    }

    // ─── CONSTRUCCIÓN DEL HISTORIAL Y LLAMADA A GEMINI ───
    const contents = [];
    for (const msg of history) {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        });
    }
    contents.push({
        role: 'user',
        parts: [{ text: message }]
    });

    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('API Key de Gemini no configurada.');
    }

    const modelsToTry = [
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite'
    ];
    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            const requestBody = {
                contents,
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                },
                generationConfig: {}
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMessage = errData?.error?.message || 'Error desconocido';
                const isRetryable = response.status === 404 || response.status === 429 || response.status === 503 ||
                    errMessage.includes('not found') || errMessage.includes('not supported') ||
                    errMessage.includes('quota') || errMessage.includes('rate limit') ||
                    errMessage.includes('demand') || errMessage.includes('temporary') || errMessage.includes('try again later');

                if (isRetryable) {
                    console.warn(`[CHAT] Modelo ${modelName} falló (${response.status}): ${errMessage}. Probando siguiente...`);
                    lastError = new Error(errMessage);
                    continue;
                }
                throw new Error(errMessage);
            }

            const data = await response.json();
            let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResult) {
                throw new Error('No se recibió respuesta válida del modelo.');
            }

            // Filtrar emojis residuales de forma estricta
            textResult = textResult.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, '');

            return textResult.trim();
        } catch (error) {
            lastError = error;
            const errStr = error.message || '';
            const isRetryable = errStr.includes('not found') || errStr.includes('not supported') ||
                errStr.includes('404') || errStr.includes('quota') || errStr.includes('429') ||
                errStr.includes('503') || errStr.includes('demand') ||
                errStr.includes('temporary') || errStr.includes('try again later');
            if (!isRetryable) throw error;
        }
    }

    throw new Error(`No se pudo conectar con el servicio de IA. Detalles: ${lastError?.message}`);
};
