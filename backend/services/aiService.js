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

    // Lista de modelos ordenados por preferencia
    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-pro'
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
                
                // Si es un error de modelo no encontrado o cuota excedida (429), intentamos con el siguiente modelo
                const isRetryable = response.status === 404 || response.status === 429 || 
                                    errMessage.includes('not found') || errMessage.includes('not supported') || 
                                    errMessage.includes('quota') || errMessage.includes('rate limit') || errMessage.includes('limit:');
                                    
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
                                errStr.includes('rate limit') || errStr.includes('429');
                                
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

// 3. Chat de Soporte Virtual con contexto completo de la base de datos
exports.chatSupport = async (message, history = []) => {
    // ─── 1. Cargar configuraciones del negocio ───
    let shopInfo = {};
    try {
        const [settings] = await db.query(
            `SELECT setting_key, setting_value FROM settings 
             WHERE setting_key IN ('company_name','company_phone','company_email','company_address',
                                   'business_hours','shop_logo','default_warranty_days')`
        );
        for (const s of settings) {
            shopInfo[s.setting_key] = s.setting_value;
        }
    } catch (e) {
        console.error('[CHAT] Error al cargar settings:', e);
    }

    const companyName = shopInfo.company_name || 'SySaaS';
    const companyPhone = shopInfo.company_phone || 'No registrado';
    const companyEmail = shopInfo.company_email || 'No registrado';
    const companyAddress = shopInfo.company_address || 'No registrada';
    const businessHours = shopInfo.business_hours || 'No registrado';
    const warrantyDays = shopInfo.default_warranty_days || '30';

    // ─── 2. Cargar catálogo de servicios activos ───
    let servicesText = 'No hay servicios registrados.';
    try {
        const [services] = await db.query(
            `SELECT sc.name, sc.base_price, sc.estimated_time, sc.description,
                    dt.name as device_type
             FROM services_catalog sc
             LEFT JOIN device_types dt ON sc.device_type_id = dt.id
             WHERE sc.is_active = TRUE
             ORDER BY sc.name`
        );
        if (services.length > 0) {
            servicesText = services.map(s => {
                let line = `• ${s.name}`;
                if (s.device_type) line += ` (${s.device_type})`;
                line += ` — Precio base: $${s.base_price} MXN`;
                if (s.estimated_time) line += `, Tiempo estimado: ${s.estimated_time}`;
                if (s.description) line += `. ${s.description}`;
                return line;
            }).join('\n');
        }
    } catch (e) {
        console.error('[CHAT] Error al cargar servicios:', e);
    }

    // ─── 3. Cargar inventario de productos con stock ───
    let productsText = 'No hay productos registrados.';
    try {
        const [products] = await db.query(
            `SELECT p.name, p.sale_price, p.stock, p.description, p.sku,
                    pc.name as category
             FROM products p
             LEFT JOIN product_categories pc ON p.category_id = pc.id
             WHERE p.is_active = TRUE AND p.stock > 0
             ORDER BY pc.name, p.name`
        );
        if (products.length > 0) {
            productsText = products.map(p => {
                let line = `• ${p.name}`;
                if (p.category) line += ` [${p.category}]`;
                line += ` — $${p.sale_price} MXN (Stock: ${p.stock})`;
                if (p.description) line += `. ${p.description}`;
                return line;
            }).join('\n');
        }
    } catch (e) {
        console.error('[CHAT] Error al cargar productos:', e);
    }

    // ─── 4. Detectar números de ticket (REP-...) o pedido (VTA-...) ───
    let ticketContext = '';
    const repairMatch = message.match(/REP-\d{6}-\d{4}/i);
    const orderMatch = message.match(/VTA-\d{6}-\d{4}/i);

    if (repairMatch) {
        try {
            const ticketNum = repairMatch[0].toUpperCase();
            const [repairs] = await db.query(
                `SELECT r.ticket_number, r.status, r.problem_description, r.technical_observations,
                        r.total_cost, r.estimated_delivery, r.warranty_days, r.warranty_expires,
                        r.priority, r.advance_payment, r.created_at,
                        dt.name as device_type, b.name as brand, r.model, r.color,
                        sc.name as service_name,
                        u_tech.first_name as tech_name
                 FROM repairs r
                 LEFT JOIN device_types dt ON r.device_type_id = dt.id
                 LEFT JOIN brands b ON r.brand_id = b.id
                 LEFT JOIN services_catalog sc ON r.service_id = sc.id
                 LEFT JOIN users u_tech ON r.technician_id = u_tech.id
                 WHERE r.ticket_number = ?`,
                [ticketNum]
            );
            if (repairs.length > 0) {
                const rep = repairs[0];
                const statusLabels = {
                    received: 'Recibido', diagnosing: 'En diagnóstico', waiting_approval: 'Esperando aprobación',
                    waiting_parts: 'Esperando refacciones', repairing: 'En reparación', quality_check: 'Control de calidad',
                    ready: 'Listo para entrega', delivered: 'Entregado', cancelled: 'Cancelado'
                };
                ticketContext = `\n\nINFORMACION DEL TICKET ${ticketNum}:\n` +
                    `- Estado: ${statusLabels[rep.status] || rep.status}\n` +
                    `- Equipo: ${rep.device_type || ''} ${rep.brand || ''} ${rep.model || ''} ${rep.color || ''}\n` +
                    `- Servicio: ${rep.service_name || 'No asignado'}\n` +
                    `- Problema reportado: ${rep.problem_description || 'No especificado'}\n` +
                    `- Observaciones tecnicas: ${rep.technical_observations || 'Sin observaciones aun'}\n` +
                    `- Costo total estimado: $${rep.total_cost || 0} MXN\n` +
                    `- Anticipo recibido: $${rep.advance_payment || 0} MXN\n` +
                    `- Prioridad: ${rep.priority === 'urgent' ? 'Urgente' : 'Normal'}\n` +
                    `- Fecha de ingreso: ${rep.created_at ? new Date(rep.created_at).toLocaleDateString('es-MX') : 'N/A'}\n` +
                    `- Entrega estimada: ${rep.estimated_delivery ? new Date(rep.estimated_delivery).toLocaleDateString('es-MX') : 'Pendiente'}\n` +
                    `- Garantía: ${rep.warranty_days || warrantyDays} días\n` +
                    `- Técnico asignado: ${rep.tech_name || 'Pendiente de asignación'}`;
            } else {
                ticketContext = `\n\nNo se encontro ningun ticket con el numero ${ticketNum}. Verifica que sea correcto.`;
            }
        } catch (e) {
            console.error('[CHAT] Error al buscar ticket:', e);
            ticketContext = '\n\nError al consultar el ticket en la base de datos.';
        }
    }

    if (orderMatch) {
        try {
            const orderNum = orderMatch[0].toUpperCase();
            const [orders] = await db.query(
                `SELECT s.sale_number, s.status, s.subtotal, s.total, s.notes, s.created_at,
                        u.first_name as customer_name
                 FROM sales s
                 LEFT JOIN users u ON s.customer_id = u.id
                 WHERE s.sale_number = ?`,
                [orderNum]
            );
            if (orders.length > 0) {
                const ord = orders[0];
                // Buscar ítems del pedido
                const [items] = await db.query(
                    `SELECT si.description, si.quantity, si.unit_price, si.total
                     FROM sale_items si
                     JOIN sales s ON si.sale_id = s.id
                     WHERE s.sale_number = ?`,
                    [orderNum]
                );
                const statusLabels = {
                    pending: 'Pendiente', completed: 'Completado', cancelled: 'Cancelado', refunded: 'Reembolsado'
                };
                let itemsList = items.map(i => `  - ${i.description} x${i.quantity} — $${i.total} MXN`).join('\n');
                ticketContext += `\n\nINFORMACION DEL PEDIDO ${orderNum}:\n` +
                    `- Estado: ${statusLabels[ord.status] || ord.status}\n` +
                    `- Cliente: ${ord.customer_name || 'N/A'}\n` +
                    `- Total: $${ord.total} MXN\n` +
                    `- Fecha: ${ord.created_at ? new Date(ord.created_at).toLocaleDateString('es-MX') : 'N/A'}\n` +
                    `- Notas: ${ord.notes || 'Sin notas'}\n` +
                    `- Productos/Servicios:\n${itemsList || '  (sin ítems)'}`;
            } else {
                ticketContext += `\n\nNo se encontro ningun pedido con el numero ${orderNum}.`;
            }
        } catch (e) {
            console.error('[CHAT] Error al buscar pedido:', e);
            ticketContext += '\n\nError al consultar el pedido en la base de datos.';
        }
    }

    // ─── 5. Construir system instruction con TODO el contexto ───
    const systemInstruction = `Eres el asistente virtual oficial de "${companyName}", un taller profesional de servicio técnico y reparación de dispositivos electrónicos. Tu nombre es "${companyName} AI".

INFORMACIÓN DEL NEGOCIO (datos REALES, usa SOLO estos):
- Nombre: ${companyName}
- Teléfono: ${companyPhone}
- Correo electrónico: ${companyEmail}
- Dirección: ${companyAddress}
- Horario de atención: ${businessHours}
- Garantía estándar en reparaciones: ${warrantyDays} días

CATÁLOGO DE SERVICIOS DE REPARACIÓN DISPONIBLES:
${servicesText}

PRODUCTOS EN VENTA (INVENTARIO ACTUAL CON STOCK DISPONIBLE):
${productsText}

REGLAS ESTRICTAS:
1. SOLO responde con informacion que este en los datos proporcionados arriba. NUNCA inventes servicios, productos, precios, horarios o datos de contacto que NO esten en la lista anterior.
2. Si un cliente pregunta por un servicio o producto que NO existe en la lista, dile amablemente que no lo tienes disponible actualmente y sugiere contactar a la tienda para mas informacion.
3. Cuando menciones precios, siempre aclara que son precios base/de referencia y que el costo final puede variar segun el diagnostico.
4. Si el cliente proporciona un numero de ticket (formato REP-YYMMDD-XXXX) o de pedido (formato VTA-YYMMDD-XXXX), usa EXCLUSIVAMENTE la informacion del ticket/pedido consultada de la base de datos para responder. No inventes estados ni datos.
5. Responde SIEMPRE en espanol, con un tono calido, profesional y empatico.
6. Si el cliente necesita una cotizacion o quiere solicitar una reparacion, guiale a la seccion de "Cotizar" en la pagina web o sugiere que registre una cuenta.
7. Se breve y conciso en tus respuestas. NO uses emojis bajo ninguna circunstancia. NO uses formato markdown (nada de **, *, #, ni viñetas con asterisco). Responde en texto plano limpio.
8. Si no tienes la informacion para responder algo, dilo honestamente y sugiere contactar directamente a la tienda.
9. Nunca compartas contrasenas, datos bancarios o informacion sensible de ningun tipo.
10. Cuando listes servicios o productos, usa guiones simples (-) para cada item, uno por linea. No uses asteriscos ni negritas.${ticketContext}`;

    // ─── 6. Construir historial de conversación para multi-turn ───
    const contents = [];
    for (const msg of history) {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        });
    }
    // Agregar el mensaje actual del usuario
    contents.push({
        role: 'user',
        parts: [{ text: message }]
    });

    // ─── 7. Llamar a Gemini con historial completo ───
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('API Key de Gemini no configurada.');
    }

    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro'];
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
                const isRetryable = response.status === 404 || response.status === 429 ||
                    errMessage.includes('not found') || errMessage.includes('not supported') ||
                    errMessage.includes('quota') || errMessage.includes('rate limit');

                if (isRetryable) {
                    console.warn(`[CHAT] Modelo ${modelName} falló (${response.status}): ${errMessage}. Probando siguiente...`);
                    lastError = new Error(errMessage);
                    continue;
                }
                throw new Error(errMessage);
            }

            const data = await response.json();
            const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResult) {
                throw new Error('No se recibió respuesta válida del modelo.');
            }
            return textResult;
        } catch (error) {
            lastError = error;
            const errStr = error.message || '';
            const isRetryable = errStr.includes('not found') || errStr.includes('not supported') ||
                errStr.includes('404') || errStr.includes('quota') || errStr.includes('429');
            if (!isRetryable) throw error;
        }
    }

    throw new Error(`No se pudo conectar con el servicio de IA. Detalles: ${lastError?.message}`);
};
