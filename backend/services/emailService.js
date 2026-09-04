const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Permitir en desarrollo
  }
});

const settingsController = require('../controllers/settingsController');

// Helper para obtener nombre del negocio
async function getBusinessName() {
  return await settingsController.getSettingValue('business_name', 'SySaaS');
}

// Templates de email (ahora son funciones async o reciben businessName)
const emailTemplates = {
  repairCreated: (repair, customer, businessName) => ({
    subject: `${businessName} - Tu reparación ha sido registrada #${repair.ticket_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #171717; color: #EDEDED; padding: 20px; border-radius: 10px;">
        <h1 style="color: #DA0037; text-align: center;">${businessName}</h1>
        <h2>¡Hola ${customer.first_name}!</h2>
        <p>Tu dispositivo ha sido registrado para reparación.</p>
        <div style="background: #444444; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número de ticket:</strong> ${repair.ticket_number}</p>
          <p><strong>Dispositivo:</strong> ${repair.model || 'N/A'}</p>
          <p><strong>Problema:</strong> ${repair.problem_description}</p>
          <p><strong>Estado actual:</strong> Recibido</p>
        </div>
        <p>Te notificaremos cuando haya actualizaciones en tu reparación.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Este es un correo automático de ${businessName}, por favor no responder.</p>
      </div>
    `
  }),

  statusChanged: (repair, customer, newStatus, businessName) => ({
    subject: `${businessName} - Actualización de tu reparación #${repair.ticket_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #171717; color: #EDEDED; padding: 20px; border-radius: 10px;">
        <h1 style="color: #DA0037; text-align: center;">${businessName}</h1>
        <h2>¡Hola ${customer.first_name}!</h2>
        <p>El estado de tu reparación ha sido actualizado.</p>
        <div style="background: #444444; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número de ticket:</strong> ${repair.ticket_number}</p>
          <p><strong>Nuevo estado:</strong> <span style="color: #DA0037;">${getStatusLabel(newStatus)}</span></p>
          ${repair.estimated_delivery ? `<p><strong>Fecha estimada de entrega:</strong> ${new Date(repair.estimated_delivery).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
        </div>
        <p>Gracias por confiar en nosotros.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Este es un correo automático de ${businessName}, por favor no responder.</p>
      </div>
    `
  }),

  repairReady: (repair, customer, businessName) => ({
    subject: `${businessName} - ¡Tu reparación está lista! #${repair.ticket_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #171717; color: #EDEDED; padding: 20px; border-radius: 10px;">
        <h1 style="color: #DA0037; text-align: center;">${businessName}</h1>
        <h2>¡Hola ${customer.first_name}!</h2>
        <p style="font-size: 18px; color: #4CAF50;">¡Tu dispositivo está listo para ser recogido!</p>
        <div style="background: #444444; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número de ticket:</strong> ${repair.ticket_number}</p>
          <p><strong>Dispositivo:</strong> ${repair.model || 'N/A'}</p>
          <p><strong>Total a pagar:</strong> $${repair.total_cost}</p>
        </div>
        <p>Puedes pasar a recogerlo en nuestro horario de atención.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Este es un correo automático de ${businessName}, por favor no responder.</p>
      </div>
    `
  }),

  deliveryRescheduled: (repair, customer, businessName) => ({
    subject: `${businessName} - Actualización de Fecha - Reparación #${repair.ticket_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #171717; color: #EDEDED; padding: 20px; border-radius: 10px;">
        <h1 style="color: #DA0037; text-align: center;">${businessName}</h1>
        <h2>¡Hola ${customer.first_name}!</h2>
        <p>La fecha de entrega/recolección para tu dispositivo ha sido actualizada.</p>
        <div style="background: #444444; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número de ticket:</strong> ${repair.ticket_number}</p>
          <p><strong>Dispositivo:</strong> ${repair.model || 'N/A'}</p>
          <p><strong>Nueva fecha de entrega/recolección:</strong> <span style="color: #DA0037;">${new Date(repair.estimated_delivery).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
        </div>
        <p>Si tienes dudas, contáctanos.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Este es un correo automático de ${businessName}, por favor no responder.</p>
      </div>
    `
  }),

  pickupScheduled: (repair, customer, businessName) => ({
    subject: `${businessName} - Cita de Recolección Confirmada #${repair.ticket_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #171717; color: #EDEDED; padding: 20px; border-radius: 10px;">
        <h1 style="color: #DA0037; text-align: center;">${businessName}</h1>
        <h2>¡Hola ${customer.first_name}!</h2>
        <p>Has agendado la recolección de tu dispositivo.</p>
        <div style="background: #444444; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número de ticket:</strong> ${repair.ticket_number}</p>
          <p><strong>Fecha acordada:</strong> <span style="color: #4CAF50;">${new Date(repair.estimated_delivery).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
          <p>Te esperamos en nuestro horario de servicio.</p>
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Este es un correo automático de ${businessName}, por favor no responder.</p>
      </div>
    `
  }),

  repairDelivered: (repair, customer, businessName) => ({
    subject: `${businessName} - ¡Gracias por tu preferencia! - Reparación #${repair.ticket_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #171717; color: #EDEDED; padding: 20px; border-radius: 10px;">
        <h1 style="color: #DA0037; text-align: center;">${businessName}</h1>
        <h2>¡Gracias ${customer.first_name}!</h2>
        <p>Hemos marcado tu dispositivo como entregado. Esperamos que disfrutes de tu equipo funcionando al 100%.</p>
        
        <div style="background: #444444; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número de ticket:</strong> ${repair.ticket_number}</p>
          <p><strong>Dispositivo:</strong> ${repair.model || 'N/A'}</p>
          <p><strong>Garantía:</strong> ${repair.warranty_days} días</p>
          <p style="font-size: 0.9em; color: #aaa;">La garantía cubre defectos de mano de obra y refacciones. No cubre daños por líquidos, caídas o mal uso.</p>
        </div>

        <p>Agradecemos tu confianza. Si tienes algún problema, no dudes en contactarnos.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Este es un correo automático de ${businessName}, por favor no responder.</p>
      </div>
    `
  }),

  warrantyResolved: (repair, customer, statusApproved, businessName) => {
    const isApproved = statusApproved === 'approved';
    const statusText = isApproved ? 'APROBADA' : 'RECHAZADA';
    const statusColor = isApproved ? '#4CAF50' : '#DA0037';
    return {
      subject: `${businessName} - Resolución de Garantía para el Ticket #${repair.ticket_number} - ${statusText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #171717; color: #EDEDED; padding: 20px; border-radius: 10px;">
          <h1 style="color: #DA0037; text-align: center;">${businessName}</h1>
          <h2>Hola ${customer.first_name},</h2>
          <p>Hemos revisado tu solicitud de garantía para la reparación del dispositivo <strong>${repair.model || 'Equipo'}</strong>.</p>
          
          <div style="background: #444444; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Número de ticket de garantía:</strong> ${repair.ticket_number}</p>
            <p><strong>Resolución de Garantía:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
            ${repair.warranty_tech_notes ? `<p><strong>Observaciones técnicas:</strong> ${repair.warranty_tech_notes}</p>` : ''}
          </div>

          ${isApproved 
            ? '<p>Nuestros técnicos ya están trabajando en tu equipo bajo cobertura de garantía. Te avisaremos en cuanto esté listo para entrega.</p>' 
            : '<p>Lamentablemente, el reporte técnico indica que la falla no cumple con las condiciones de cobertura de garantía. Si tienes dudas, puedes responder a este correo o contactarnos directamente.</p>'
          }
          <p style="color: #888; font-size: 12px; margin-top: 30px;">Este es un correo automático de ${businessName}, por favor no responder.</p>
        </div>
      `
    };
  }
};

// Mapeo de estados
function getStatusLabel(status) {
  const labels = {
    received: 'Recibido',
    diagnosing: 'En Diagnóstico',
    waiting_approval: 'Esperando Aprobación',
    waiting_parts: 'Esperando Refacciones',
    repairing: 'En Reparación',
    quality_check: 'Control de Calidad',
    ready: 'Listo para Entrega',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
  };
  return labels[status] || status;
}

// Enviar email
async function sendEmail(to, template, data) {
  try {
    const businessName = await getBusinessName();
    const emailContent = emailTemplates[template](data.repair, data.customer, data.newStatus || null, businessName);

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"${businessName}" <noreply@sysaas.com>`,
      to: to,
      subject: emailContent.subject,
      html: emailContent.html
    });

    console.log('[EMAIL] Email enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Error al enviar email:', error);
    return { success: false, error: error.message };
  }
}

// Enviar email de restablecimiento de contraseña
async function sendPasswordResetEmail(to, token, customer) {
  try {
    const businessName = await getBusinessName();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #171717; color: #EDEDED; padding: 20px; border-radius: 10px;">
        <h1 style="color: #DA0037; text-align: center;">${businessName}</h1>
        <h2>Restablecimiento de Contraseña</h2>
        <p>¡Hola ${customer.first_name || 'Usuario'}!</p>
        <p>Has solicitado restablecer tu contraseña para tu cuenta en <strong>${businessName}</strong>.</p>
        <p>Por favor, haz clic en el siguiente botón para crear una nueva contraseña. Este enlace expira en 1 hora:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #DA0037; color: #EDEDED; text-decoration: none; padding: 12px 24px; border-radius: 5px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
        </div>
        <p>Si no solicitaste esto, puedes ignorar este correo de forma segura.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Este es un correo automático de ${businessName}, por favor no responder.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"${businessName}" <noreply@sysaas.com>`,
      to: to,
      subject: `${businessName} - Restablecer tu contraseña`,
      html: htmlContent
    });

    console.log('[EMAIL] Correo de restablecimiento enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Error al enviar correo de restablecimiento:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  emailTemplates,
  getStatusLabel
};
