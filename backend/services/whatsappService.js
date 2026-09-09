/**
 * Servicio modular de WhatsApp (Scaffolding para Enfoque 2 / Envíos Automáticos)
 * 
 * Soporta integración futura con:
 * 1. Meta WhatsApp Cloud API (Graph API v19+)
 * 2. Twilio WhatsApp API
 * 
 * Si no se configuran credenciales en variables de entorno, la función sendWhatsAppMessage
 * registrará de manera informativa que el servicio está en modo interactivo (Enfoque 1).
 */

const db = require('../config/database');
const settingsController = require('../controllers/settingsController');

/**
 * Normaliza un número de teléfono a formato internacional E.164 (solo dígitos)
 * @param {string} phone
 * @param {string} defaultCountryCode
 * @returns {string}
 */
function sanitizePhoneNumber(phone, defaultCountryCode = '52') {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        cleaned = `${defaultCountryCode}${cleaned}`;
    }
    return cleaned;
}

/**
 * Reemplaza variables dinámicas en una plantilla de mensaje
 * @param {string} template
 * @param {Object} data
 * @returns {string}
 */
function compileMessage(template, data = {}) {
    let msg = template || '';
    const deviceParts = [data.deviceType, data.brand, data.model].filter(Boolean);
    const fullDevice = data.fullDevice || (deviceParts.length > 0 ? deviceParts.join(' ') : (data.model || 'su equipo'));

    msg = msg.replace(/{cliente}/g, data.customerName || 'Cliente');
    msg = msg.replace(/{equipo}/g, fullDevice);
    msg = msg.replace(/{tipo}/g, data.deviceType || '');
    msg = msg.replace(/{marca}/g, data.brand || '');

    if (template && !template.includes('{tipo}') && !template.includes('{marca}') && !template.includes('{equipo}')) {
        msg = msg.replace(/{modelo}/g, fullDevice);
    } else {
        msg = msg.replace(/{modelo}/g, data.model || fullDevice);
    }

    msg = msg.replace(/{folio}/g, data.ticketNumber || '');
    msg = msg.replace(/{empresa}/g, data.businessName || 'SySaaS');
    if (data.trackingUrl) {
        msg = msg.replace(/{enlace}/g, data.trackingUrl);
    }
    return msg;
}

/**
 * Envío de mensaje vía WhatsApp Cloud API (Meta Graph API)
 * @param {Object} params
 * @returns {Promise<boolean>}
 */
async function sendViaMetaCloudApi({ to, text }) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
        return false;
    }

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: true, body: text }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errData = await response.json();
        console.error('[WHATSAPP SERVICE] Error en Meta Cloud API:', errData);
        throw new Error(errData?.error?.message || 'Error al enviar por Meta Cloud API');
    }

    return true;
}

/**
 * Envío de mensaje vía Twilio WhatsApp API
 * @param {Object} params
 * @returns {Promise<boolean>}
 */
async function sendViaTwilio({ to, text }) {
    const accountSid = process.env.WHATSAPP_ACCOUNT_SID;
    const authToken = process.env.WHATSAPP_AUTH_TOKEN;
    const fromNumber = process.env.WHATSAPP_FROM_NUMBER; // ej. whatsapp:+14155238886

    if (!accountSid || !authToken || !fromNumber) {
        return false;
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', `whatsapp:+${to}`);
    params.append('From', fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`);
    params.append('Body', text);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const errData = await response.json();
        console.error('[WHATSAPP SERVICE] Error en Twilio WhatsApp:', errData);
        throw new Error(errData?.message || 'Error al enviar por Twilio WhatsApp');
    }

    return true;
}

/**
 * Enviar mensaje de WhatsApp (Punto de entrada unificado)
 * 
 * Si no existen credenciales de API configuradas en .env, retorna false de forma silenciosa
 * para no interrumpir el flujo del sistema.
 * 
 * @param {Object} options
 * @param {string} options.to Telefono destino
 * @param {string} [options.text] Texto directo
 * @param {string} [options.templateKey] Clave de plantilla ('whatsapp_ready_template', etc.)
 * @param {Object} [options.templateData] Datos para compilacion de plantilla
 * @param {number|null} [options.tenantId] ID del tenant para cargar plantilla personalizada
 * @returns {Promise<{ success: boolean, method: string, message?: string }>}
 */
async function sendWhatsAppNotification({ to, text, templateKey, templateData = {}, tenantId = null }) {
    try {
        const cleanPhone = sanitizePhoneNumber(to);
        if (!cleanPhone) {
            return { success: false, method: 'none', message: 'Numero de telefono no proporcionado o invalido' };
        }

        let finalMessage = text || '';

        // Si se especifico una clave de plantilla, obtenerla de base de datos
        if (templateKey) {
            let templateStr = null;
            if (tenantId) {
                templateStr = await settingsController.getSettingValue(tenantId, templateKey);
            }
            if (!templateStr) {
                templateStr = 'Hola {cliente}, tu equipo {modelo} (Folio: {folio}) esta listo para entrega en nuestra sucursal. Saludos de {empresa}.';
            }
            finalMessage = compileMessage(templateStr, templateData);
        }

        const provider = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();

        // 1. Meta WhatsApp Cloud API
        if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
            await sendViaMetaCloudApi({ to: cleanPhone, text: finalMessage });
            console.log(`[WHATSAPP SERVICE] Mensaje enviado exitosamente a ${cleanPhone} via Meta Cloud API.`);
            return { success: true, method: 'meta_cloud_api' };
        }

        // 2. Twilio WhatsApp
        if (process.env.WHATSAPP_ACCOUNT_SID && process.env.WHATSAPP_AUTH_TOKEN) {
            await sendViaTwilio({ to: cleanPhone, text: finalMessage });
            console.log(`[WHATSAPP SERVICE] Mensaje enviado exitosamente a ${cleanPhone} via Twilio.`);
            return { success: true, method: 'twilio' };
        }

        // Si no hay proveedor configurado, no es un error critico (Modo Enfoque 1 activo)
        return {
            success: false,
            method: 'interactive_only',
            message: 'Sin proveedor de WhatsApp configurado en .env (Modo interactivo activo).'
        };
    } catch (error) {
        console.error('[WHATSAPP SERVICE] Error al procesar envio automatico:', error.message);
        return { success: false, method: 'error', message: error.message };
    }
}

module.exports = {
    sendWhatsAppNotification,
    sanitizePhoneNumber,
    compileMessage
};
