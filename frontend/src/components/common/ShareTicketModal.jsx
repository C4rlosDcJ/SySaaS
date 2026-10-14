import { useRef, useState } from 'react';
import { 
    X, 
    Share2, 
    Download, 
    Copy, 
    Check, 
    MessageCircle, 
    Mail, 
    FileText, 
    Sparkles, 
    ShieldCheck, 
    Smartphone, 
    User, 
    Wrench
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { STATUS_LABELS, formatCurrency, formatDate } from '../../utils/constants';
import { generateServiceTicket } from '../../utils/pdfGenerator';
import { buildWhatsAppUrl } from '../../utils/whatsappUtils';
import './ShareTicketModal.css';

export default function ShareTicketModal({
    isOpen,
    onClose,
    repair,
    settings = {}
}) {
    const cardRef = useRef(null);
    const [generatingImage, setGeneratingImage] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedSummary, setCopiedSummary] = useState(false);

    if (!isOpen || !repair) return null;

    const businessName = settings.business_name || settings.company_name || repair.company_name || repair.tenant_name || 'SySaaS';
    const contactPhone = settings.contact_phone || repair.tenant_phone || '';
    const contactEmail = settings.contact_email || repair.tenant_email || '';

    const customerName = `${repair.customer_first_name || repair.first_name || 'Cliente'} ${repair.customer_last_name || repair.last_name || ''}`.trim();
    const customerPhone = repair.customer_phone || repair.phone || '';
    const customerEmail = repair.customer_email || repair.email || '';

    const deviceName = `${repair.brand_name === 'Otro' ? repair.brand_other : (repair.brand_name || repair.brand || '')} ${repair.model || ''}`.trim() || 'Dispositivo';
    const serviceName = repair.service_name || repair.service_requested || 'Servicio Técnico';
    const ticketNumber = repair.ticket_number || `#${repair.id}`;

    const trackingUrl = `${window.location.origin}/rastrear?ticketId=${encodeURIComponent(repair.ticket_number || '')}`;
    const qrImageUrl = repair.ticket_number ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(trackingUrl)}&margin=0` : '';

    const totalCost = parseFloat(repair.total_cost || 0);
    const advancePayment = parseFloat(repair.advance_payment || 0);
    const balance = Math.max(0, totalCost - advancePayment);
    const warrantyDays = repair.warranty_days || settings.default_warranty_days || 30;
    const isDelivered = repair.status === 'delivered';
    const statusLabel = (STATUS_LABELS[repair.status] || repair.status || 'Recibido').toUpperCase();

    // Renderizar la tarjeta como imagen PNG en alta definición (2x escala retina)
    const captureTicketCanvas = async () => {
        if (!cardRef.current) return null;
        return await html2canvas(cardRef.current, {
            scale: 2.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0f172a',
            logging: false,
            windowWidth: 460
        });
    };

    // Descargar imagen PNG directamente
    const handleDownloadImage = async () => {
        try {
            setGeneratingImage(true);
            const canvas = await captureTicketCanvas();
            if (!canvas) return;
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = imgData;
            link.download = `Comprobante_${ticketNumber}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error al generar imagen de ticket:', err);
            alert('No se pudo generar la imagen. Intenta con la opción PDF.');
        } finally {
            setGeneratingImage(false);
        }
    };

    // Compartir imagen mediante Web Share API (celulares/tablets/navegadores compatibles)
    const handleNativeShare = async () => {
        try {
            setGeneratingImage(true);
            const canvas = await captureTicketCanvas();
            if (!canvas) return;

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], `Ticket_${ticketNumber}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Comprobante ${ticketNumber} - ${businessName}`,
                    text: `Hola ${customerName}, te compartimos el comprobante de tu servicio en ${businessName} (Folio: ${ticketNumber}). Rastrea en línea: ${trackingUrl}`
                });
            } else {
                // Fallback: descargar imagen y abrir WhatsApp
                handleDownloadImage();
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error al compartir nativamente:', err);
                handleDownloadImage();
            }
        } finally {
            setGeneratingImage(false);
        }
    };

    // Compartir por WhatsApp con texto formateado y enlace al rastreo en vivo
    const handleShareWhatsApp = () => {
        const textMessage = 
`*${businessName.toUpperCase()}* 🧾
*Comprobante Digital de Servicio*

Hola *${customerName}*, adjuntamos el detalle de tu orden:
━━━━━━━━━━━━━━━━━
📌 *Folio:* ${ticketNumber}
📱 *Equipo:* ${deviceName}
🔧 *Servicio:* ${serviceName}
🚦 *Estado:* ${statusLabel}
💰 *Total:* ${formatCurrency(totalCost)}
💵 *Anticipo:* ${formatCurrency(advancePayment)}
💳 *Resta:* ${formatCurrency(balance)}
🛡️ *Garantía:* ${warrantyDays} días
━━━━━━━━━━━━━━━━━
🔍 *Rastrea tu equipo en vivo y descarga tu recibo aquí:*
${trackingUrl}

_Gracias por tu preferencia._`;

        const waUrl = buildWhatsAppUrl(customerPhone, textMessage);
        if (waUrl) {
            window.open(waUrl, '_blank', 'noopener,noreferrer');
        } else {
            // Si el cliente no tiene teléfono guardado, abrir WhatsApp Web para seleccionar chat
            window.open(`https://wa.me/?text=${encodeURIComponent(textMessage)}`, '_blank', 'noopener,noreferrer');
        }
    };

    // Compartir por correo con mailto
    const handleShareEmail = () => {
        const subject = encodeURIComponent(`Comprobante de Orden ${ticketNumber} - ${businessName}`);
        const body = encodeURIComponent(
`Hola ${customerName},

Te compartimos la información de tu orden de servicio en ${businessName}:

• Folio de Ticket: ${ticketNumber}
• Equipo: ${deviceName}
• Servicio: ${serviceName}
• Estado Actual: ${statusLabel}
• Total Estimado: ${formatCurrency(totalCost)}
• Anticipo Cubierto: ${formatCurrency(advancePayment)}
• Saldo Pendiente: ${formatCurrency(balance)}
• Garantía Aplicable: ${warrantyDays} días

Puedes consultar los avances técnicos y descargar tu comprobante en cualquier momento desde el siguiente enlace:
${trackingUrl}

Atentamente,
${businessName}
${contactPhone ? `Teléfono: ${contactPhone}` : ''}`
        );

        window.open(`mailto:${customerEmail || ''}?subject=${subject}&body=${body}`, '_blank');
    };

    // Copiar resumen de texto
    const handleCopySummary = async () => {
        const summary = `${businessName} | Folio: ${ticketNumber} | Equipo: ${deviceName} | Total: ${formatCurrency(totalCost)} | Saldo: ${formatCurrency(balance)} | Rastreo: ${trackingUrl}`;
        try {
            await navigator.clipboard.writeText(summary);
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2000);
        } catch (e) {
            console.error(e);
        }
    };

    // Copiar solo enlace
    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(trackingUrl);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch (e) {
            console.error(e);
        }
    };

    // Descargar PDF tradicional
    const handleDownloadPDF = async () => {
        try {
            await generateServiceTicket(repair, settings);
        } catch (e) {
            console.error(e);
            alert('Error generando PDF');
        }
    };

    return (
        <div className="share-ticket-overlay" onClick={onClose}>
            <div className="share-ticket-modal" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="share-ticket-header">
                    <div className="share-ticket-title">
                        <div className="share-ticket-icon-wrap">
                            <Sparkles size={20} className="text-primary" />
                        </div>
                        <div>
                            <h3>Comprobante Digital</h3>
                            <p>Listo para enviar a tu cliente por WhatsApp, Correo o Redes</p>
                        </div>
                    </div>
                    <button className="btn-close-modal" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                <div className="share-ticket-body">
                    {/* Left/Top: Digital Card Preview (Este elemento es el que se convierte a imagen PNG) */}
                    <div className="share-ticket-preview-pane">
                        <div className="ticket-card-wrapper">
                            <div className="ticket-digital-card" ref={cardRef}>
                                {/* Header del Comprobante */}
                                <div className="card-top-bar">
                                    <div className="card-brand-info">
                                        <h4 className="card-business-name">{businessName}</h4>
                                        <p className="card-business-contact">
                                            {contactPhone ? `Tel: ${contactPhone}` : ''}
                                            {contactPhone && contactEmail ? ' | ' : ''}
                                            {contactEmail || ''}
                                        </p>
                                    </div>
                                    <div className="card-ticket-badge">
                                        <span className="card-badge-label">{isDelivered ? 'COMPROBANTE' : 'ORDEN DIGITAL'}</span>
                                        <span className="card-badge-number">{ticketNumber}</span>
                                    </div>
                                </div>

                                {/* Status banner */}
                                <div className={`card-status-strip status-${repair.status || 'received'}`}>
                                    <span className="status-dot"></span>
                                    <span className="status-text">ESTADO: {statusLabel}</span>
                                    <span className="card-date">{formatDate(repair.created_at || new Date())}</span>
                                </div>

                                {/* Cliente y Equipo */}
                                <div className="card-info-grid">
                                    <div className="info-cell">
                                        <span className="cell-label"><User size={12} /> Cliente</span>
                                        <span className="cell-value font-medium">{customerName}</span>
                                    </div>
                                    <div className="info-cell">
                                        <span className="cell-label"><Smartphone size={12} /> Equipo</span>
                                        <span className="cell-value font-medium">{deviceName}</span>
                                    </div>
                                    <div className="info-cell full-width">
                                        <span className="cell-label"><Wrench size={12} /> Servicio Solicitado</span>
                                        <span className="cell-value">{serviceName}</span>
                                        {repair.problem_description && (
                                            <p className="cell-subvalue">"{repair.problem_description}"</p>
                                        )}
                                    </div>
                                </div>

                                {/* Desglose Financiero */}
                                <div className="card-financial-box">
                                    <div className="fin-row">
                                        <span>Total Estimado</span>
                                        <span className="fin-val">{formatCurrency(totalCost)}</span>
                                    </div>
                                    {advancePayment > 0 && (
                                        <div className="fin-row advance">
                                            <span>Anticipo Pagado</span>
                                            <span className="fin-val">-{formatCurrency(advancePayment)}</span>
                                        </div>
                                    )}
                                    <div className="fin-row total-highlight">
                                        <span>Resta por Liquidar</span>
                                        <span className="fin-val-bold">{formatCurrency(balance)}</span>
                                    </div>
                                </div>

                                {/* QR y Garantía */}
                                <div className="card-footer-section">
                                    <div className="card-qr-box">
                                        {qrImageUrl ? (
                                            <img src={qrImageUrl} alt="QR Rastreo" className="card-qr-img" />
                                        ) : (
                                            <div className="qr-placeholder">QR</div>
                                        )}
                                    </div>
                                    <div className="card-footer-text">
                                        <div className="warranty-tag">
                                            <ShieldCheck size={14} />
                                            <span>Garantía: {warrantyDays} días</span>
                                        </div>
                                        <p className="qr-hint">Escanea para rastrear avances y estado en tiempo real</p>
                                        <p className="card-domain-hint">{window.location.host}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="ticket-card-caption">
                            Formato vertical optimizado para pantalla de celular y estados de WhatsApp.
                        </p>
                    </div>

                    {/* Right/Bottom: Sharing Actions */}
                    <div className="share-ticket-actions-pane">
                        <div className="action-section">
                            <h4 className="section-title">Envío Inmediato</h4>
                            <p className="section-subtitle">
                                Envíale el ticket a {customerName} con un solo toque:
                            </p>

                            <div className="action-buttons-grid">
                                <button 
                                    className="btn-action-primary wa-btn"
                                    onClick={handleShareWhatsApp}
                                    title="Enviar por WhatsApp"
                                >
                                    <MessageCircle size={18} />
                                    <div className="btn-label-wrap">
                                        <strong>WhatsApp Directo</strong>
                                        <small>{customerPhone ? `A: ${customerPhone}` : 'Abrir chat con texto listo'}</small>
                                    </div>
                                </button>

                                <button 
                                    className="btn-action-primary email-btn"
                                    onClick={handleShareEmail}
                                    title="Enviar por correo"
                                >
                                    <Mail size={18} />
                                    <div className="btn-label-wrap">
                                        <strong>Enviar por Correo</strong>
                                        <small>{customerEmail || 'Redactar en cliente de correo'}</small>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="action-section mt-md">
                            <h4 className="section-title">Descargar & Compartir Imagen</h4>
                            <div className="action-buttons-grid">
                                {typeof navigator !== 'undefined' && navigator.canShare && (
                                    <button 
                                        className="btn-action-secondary share-native-btn"
                                        onClick={handleNativeShare}
                                        disabled={generatingImage}
                                    >
                                        <Share2 size={16} />
                                        <span>{generatingImage ? 'Generando...' : 'Compartir Imagen'}</span>
                                    </button>
                                )}

                                <button 
                                    className="btn-action-secondary download-img-btn"
                                    onClick={handleDownloadImage}
                                    disabled={generatingImage}
                                >
                                    <Download size={16} />
                                    <span>{generatingImage ? 'Procesando...' : 'Descargar Imagen PNG'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="action-section mt-md">
                            <h4 className="section-title">Opciones Adicionales</h4>
                            <div className="utility-buttons-row">
                                <button 
                                    className="btn-utility"
                                    onClick={handleCopyLink}
                                >
                                    {copiedLink ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                    <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace de rastreo'}</span>
                                </button>

                                <button 
                                    className="btn-utility"
                                    onClick={handleCopySummary}
                                >
                                    {copiedSummary ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                    <span>{copiedSummary ? '¡Resumen copiado!' : 'Copiar texto'}</span>
                                </button>

                                <button 
                                    className="btn-utility"
                                    onClick={handleDownloadPDF}
                                >
                                    <FileText size={14} />
                                    <span>Descargar PDF tradicional</span>
                                </button>
                            </div>
                        </div>

                        {/* Customer Direct Info Box */}
                        <div className="customer-info-box">
                            <div className="info-row">
                                <span className="text-muted">Cliente:</span>
                                <strong>{customerName}</strong>
                            </div>
                            {customerPhone && (
                                <div className="info-row">
                                    <span className="text-muted">Teléfono:</span>
                                    <span>{customerPhone}</span>
                                </div>
                            )}
                            {customerEmail && (
                                <div className="info-row">
                                    <span className="text-muted">Email:</span>
                                    <span>{customerEmail}</span>
                                </div>
                            )}
                            <div className="info-row link-row">
                                <span className="text-muted">Folio:</span>
                                <span className="font-mono text-primary font-bold">{ticketNumber}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
