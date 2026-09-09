/**
 * Utilidades para construccion y formato de mensajes y enlaces de WhatsApp
 */

/**
 * Normaliza un numero telefonico para WhatsApp (E.164 sin signos)
 * @param {string} phone
 * @param {string} defaultCountryCode Por defecto '52' para Mexico
 * @returns {string}
 */
export const sanitizeWhatsAppPhone = (phone, defaultCountryCode = '52') => {
    if (!phone) return '';
    const digits = phone.toString().replace(/\D/g, '');
    if (!digits) return '';

    // Si tiene 10 digitos (formato comun de celular en Mexico / Norteamerica), agregar codigo de pais
    if (digits.length === 10) {
        return `${defaultCountryCode}${digits}`;
    }

    return digits;
};

/**
 * Compila una plantilla de WhatsApp sustituyendo variables dinamicas
 * @param {string} template
 * @param {Object} data
 * @param {string} [data.customerName]
 * @param {string} [data.deviceType] Tipo de equipo (ej. Smartphone, Laptop)
 * @param {string} [data.brand] Marca (ej. Apple, Samsung)
 * @param {string} [data.model] Modelo (ej. iPhone 15, 1 Gen)
 * @param {string} [data.fullDevice] Descripcion completa (Tipo + Marca + Modelo)
 * @param {string} [data.ticketNumber]
 * @param {string} [data.businessName]
 * @param {string} [data.trackingUrl]
 * @param {string} [data.statusLabel]
 * @returns {string}
 */
export const compileWhatsAppTemplate = (template, data = {}) => {
    let msg = template || 'Hola {cliente}, tu equipo {equipo} (Folio: {folio}) está listo para entrega en nuestra sucursal. Saludos de {empresa}.';

    const customer = data.customerName || 'Cliente';
    const deviceType = data.deviceType || '';
    const brand = data.brand || '';
    const modelOnly = data.model || '';

    const deviceParts = [deviceType, brand, modelOnly].filter(Boolean);
    const fullDevice = data.fullDevice || (deviceParts.length > 0 ? deviceParts.join(' ') : (modelOnly || 'su equipo'));

    const folio = data.ticketNumber || '';
    const empresa = data.businessName || 'SySaaS';
    const enlace = data.trackingUrl || '';
    const estado = data.statusLabel || '';

    msg = msg.replace(/{cliente}/g, customer);
    msg = msg.replace(/{equipo}/g, fullDevice);
    msg = msg.replace(/{tipo}/g, deviceType);
    msg = msg.replace(/{marca}/g, brand);

    // Si la plantilla no especifica etiquetas individuales ni {equipo},
    // {modelo} se expande con la descripcion completa (tipo + marca + modelo)
    if (template && !template.includes('{tipo}') && !template.includes('{marca}') && !template.includes('{equipo}')) {
        msg = msg.replace(/{modelo}/g, fullDevice);
    } else {
        msg = msg.replace(/{modelo}/g, modelOnly || fullDevice);
    }

    msg = msg.replace(/{folio}/g, folio);
    msg = msg.replace(/{empresa}/g, empresa);
    msg = msg.replace(/{enlace}/g, enlace);
    msg = msg.replace(/{estado}/g, estado);

    return msg;
};

/**
 * Construye el enlace universal a WhatsApp Web / Móvil
 * @param {string} phone
 * @param {string} message
 * @param {string} [defaultCountryCode]
 * @returns {string|null}
 */
export const buildWhatsAppUrl = (phone, message = '', defaultCountryCode = '52') => {
    const cleanPhone = sanitizeWhatsAppPhone(phone, defaultCountryCode);
    if (!cleanPhone) return null;

    const encodedText = encodeURIComponent(message || '');
    return `https://wa.me/${cleanPhone}${encodedText ? `?text=${encodedText}` : ''}`;
};

/**
 * Abre la ventana o aplicacion de WhatsApp en una nueva pestaña
 * @param {string} phone
 * @param {string} message
 * @param {string} [defaultCountryCode]
 * @returns {boolean} true si se pudo abrir
 */
export const openWhatsApp = (phone, message = '', defaultCountryCode = '52') => {
    const url = buildWhatsAppUrl(phone, message, defaultCountryCode);
    if (!url) return false;

    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
};
