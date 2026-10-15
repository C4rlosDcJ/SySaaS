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
    Printer,
    Ticket
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { STATUS_LABELS, formatCurrency, formatDate, formatDateTime } from '../../utils/constants';
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
    const contactAddress = settings.business_address || repair.tenant_address || 'Dirección de la empresa';
    const defaultWarrantyDays = settings.default_warranty_days || 30;

    const customerName = `${repair.customer_first_name || repair.first_name || 'Cliente'} ${repair.customer_last_name || repair.last_name || ''}`.trim();
    const customerPhone = repair.customer_phone || repair.phone || '';
    const customerEmail = repair.customer_email || repair.email || '';

    const deviceName = `${repair.brand_name === 'Otro' ? repair.brand_other : (repair.brand_name || repair.brand || '')} ${repair.model || ''}`.trim() || 'Dispositivo';
    const serviceName = repair.service_name || repair.service_requested || 'Reparación General';
    const ticketNumber = repair.ticket_number || `#${repair.id}`;

    const trackingUrl = `${window.location.origin}/rastrear?ticketId=${encodeURIComponent(repair.ticket_number || '')}`;
    const qrImageUrl = repair.ticket_number ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(trackingUrl)}&margin=0` : '';

    const totalCost = parseFloat(repair.total_cost || 0);
    const diagCost = parseFloat(repair.diagnosis_cost || 0);
    const serviceCost = Math.max(0, totalCost - diagCost);
    const discount = parseFloat(repair.discount || 0);
    const advancePayment = parseFloat(repair.advance_payment || 0);
    const balance = Math.max(0, totalCost - advancePayment);
    const warrantyDays = repair.warranty_days || defaultWarrantyDays;
    const isDelivered = repair.status === 'delivered';
    const statusLabel = (STATUS_LABELS[repair.status] || repair.status || 'Recibido').toUpperCase();

    let paymentStatusText = 'PENDIENTE';
    if (advancePayment > 0) {
        paymentStatusText = balance <= 0 ? 'PAGADO' : 'ANTICIPO PAGADO';
    }

    const translatePriority = (priority) => {
        if (!priority) return 'NORMAL';
        const p = priority.toLowerCase();
        if (p === 'high' || p === 'alta') return 'ALTA';
        if (p === 'urgent' || p === 'urgente') return 'URGENTE';
        if (p === 'low' || p === 'baja') return 'BAJA';
        return 'NORMAL';
    };

    const renderChecklist = (checklist) => {
        if (!checklist) return null;
        try {
            const parsed = typeof checklist === 'string' ? JSON.parse(checklist) : checklist;
            const entries = Object.entries(parsed);
            if (entries.length === 0) return null;
            return (
                <div className="share-ticket-section">
                    <p className="share-ticket-sec-title text-center">[ CHECKLIST DE INGRESO ]</p>
                    <div className="share-ticket-checklist-grid">
                        {entries.map(([key, value]) => {
                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                            return (
                                <div key={key} className="checklist-item">
                                    <span className={value ? 'check-yes' : 'check-no'}>{value ? '✓' : '✗'}</span>
                                    <span>{label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        } catch {
            return null;
        }
    };

    // Renderizar la tarjeta como imagen PNG en alta definición (2.5x escala retina)
    const captureTicketCanvas = async () => {
        if (!cardRef.current) return null;
        return await html2canvas(cardRef.current, {
            scale: 2.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false
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
            link.download = `Ticket_${ticketNumber}.png`;
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

    // Compartir imagen mediante Web Share API
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
                    title: `Ticket ${ticketNumber} - ${businessName}`,
                    text: `Hola ${customerName}, adjuntamos tu ticket de servicio en ${businessName} (Folio: ${ticketNumber}). Rastrea en vivo: ${trackingUrl}`
                });
            } else {
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

    // Compartir por WhatsApp con texto formateado completo
    const handleShareWhatsApp = () => {
        const textMessage = 
`*${businessName.toUpperCase()}* 🧾
*${isDelivered ? 'COMPROBANTE DE ENTREGA Y GARANTÍA' : 'ORDEN DE SERVICIO'}*

Hola *${customerName}*, adjuntamos el detalle de tu ticket:
━━━━━━━━━━━━━━━━━
📌 *Folio:* ${ticketNumber}
📱 *Equipo:* ${deviceName}
${repair.imei || repair.serial_number ? `🔢 *IMEI/Serie:* ${repair.imei || repair.serial_number}\n` : ''}${repair.color ? `🎨 *Color:* ${repair.color}\n` : ''}🔧 *Servicio:* ${serviceName}
${repair.problem_description ? `⚠️ *Falla:* "${repair.problem_description}"\n` : ''}🚦 *Estado:* ${statusLabel}
💵 *Total:* ${formatCurrency(totalCost)}
${advancePayment > 0 ? `💰 *Anticipo:* ${formatCurrency(advancePayment)}\n` : ''}💳 *Resta:* ${formatCurrency(balance)}
🛡️ *Garantía:* ${warrantyDays} días
━━━━━━━━━━━━━━━━━
🔍 *Rastrea tu equipo en vivo y consulta tu ticket digital aquí:*
${trackingUrl}

_Gracias por tu preferencia._`;

        const waUrl = buildWhatsAppUrl(customerPhone, textMessage);
        if (waUrl) {
            window.open(waUrl, '_blank', 'noopener,noreferrer');
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(textMessage)}`, '_blank', 'noopener,noreferrer');
        }
    };

    // Compartir por correo con mailto
    const handleShareEmail = () => {
        const subject = encodeURIComponent(`Ticket de Servicio ${ticketNumber} - ${businessName}`);
        const body = encodeURIComponent(
`Hola ${customerName},

Te compartimos la información completa de tu ticket en ${businessName}:

• Folio de Ticket: ${ticketNumber}
• Fecha: ${formatDateTime(repair.created_at || new Date())}
• Equipo: ${deviceName}
${repair.imei || repair.serial_number ? `• IMEI/Serie: ${repair.imei || repair.serial_number}\n` : ''}${repair.color ? `• Color: ${repair.color}\n` : ''}• Servicio: ${serviceName}
${repair.problem_description ? `• Falla Reportada: ${repair.problem_description}\n` : ''}• Estado Actual: ${statusLabel}
• Total Estimado: ${formatCurrency(totalCost)}
• Anticipo Pagado: ${formatCurrency(advancePayment)}
• Resta por Liquidar: ${formatCurrency(balance)}
• Garantía Aplicable: ${warrantyDays} días

Puedes consultar los avances técnicos y rastrear tu servicio en vivo desde este enlace:
${trackingUrl}

Atentamente,
${businessName}
${contactAddress}
${contactPhone ? `Tel: ${contactPhone}` : ''}`
        );

        window.open(`mailto:${customerEmail || ''}?subject=${subject}&body=${body}`, '_blank');
    };

    const handleCopySummary = async () => {
        const summary = `${businessName} | Ticket: ${ticketNumber} | Equipo: ${deviceName} | Total: ${formatCurrency(totalCost)} | Saldo: ${formatCurrency(balance)} | Rastreo: ${trackingUrl}`;
        try {
            await navigator.clipboard.writeText(summary);
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2000);
        } catch (e) {
            console.error(e);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(trackingUrl);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch (e) {
            console.error(e);
        }
    };

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
                {/* Header del Modal */}
                <div className="share-ticket-header">
                    <div className="share-ticket-title">
                        <div className="share-ticket-icon-wrap">
                            <Ticket size={18} />
                        </div>
                        <div>
                            <h3>Compartir Ticket Digital</h3>
                            <p>Envía o descarga el ticket oficial con toda la información de la orden</p>
                        </div>
                    </div>
                    <button className="btn-close-modal" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                <div className="share-ticket-body">
                    {/* Panel Izquierdo: Ticket Térmico Oficial Idéntico al de la Plataforma */}
                    <div className="share-ticket-preview-pane">
                        <div className="share-ticket-paper-wrapper">
                            <div className="share-thermal-ticket" ref={cardRef}>
                                {/* Cabecera del Negocio */}
                                <div className="st-header">
                                    <h2 className="st-business-name">{businessName}</h2>
                                    <p className="st-bold">{contactAddress}</p>
                                    {contactPhone && <p>Teléfono: {contactPhone}</p>}
                                    {contactEmail && <p>{contactEmail}</p>}

                                    <h3 className="st-doc-title">
                                        {isDelivered ? 'COMPROBANTE DE ENTREGA Y GARANTÍA' : 'ORDEN DE SERVICIO'}
                                    </h3>

                                    <p className="st-bold st-ticket-num">TICKET: {ticketNumber}</p>
                                    <p>Ingreso: {formatDateTime(repair.created_at || new Date())}</p>
                                    {repair.completed_at && (
                                        <p className="st-bold">Finalizado: {formatDateTime(repair.completed_at)}</p>
                                    )}
                                    {repair.delivered_at && (
                                        <p className="st-bold">Entregado: {formatDateTime(repair.delivered_at)}</p>
                                    )}
                                    {repair.estimated_delivery && (
                                        <p className="st-bold">Entrega Estimada: {formatDateTime(repair.estimated_delivery)}</p>
                                    )}

                                    <div className="st-badges-row">
                                        <span className="st-badge">SERVICIO: {statusLabel}</span>
                                        <span className="st-badge">PAGO: {paymentStatusText}</span>
                                        {repair.priority && (
                                            <span className="st-badge">PRIORIDAD: {translatePriority(repair.priority)}</span>
                                        )}
                                    </div>

                                    {repair.parent_repair_id && (
                                        <p className="st-warranty-banner">
                                            INGRESO POR GARANTÍA — Ticket Original: {repair.parent_ticket || `#${repair.parent_repair_id}`}
                                        </p>
                                    )}
                                </div>

                                <div className="st-divider-double"></div>

                                {/* Cliente */}
                                <div className="st-section">
                                    <p className="st-sec-title">Cliente</p>
                                    <p className="st-row">
                                        <span>Nombre:</span> 
                                        <span className="st-bold">{customerName}</span>
                                    </p>
                                    {customerPhone && (
                                        <p className="st-row">
                                            <span>Teléfono:</span>
                                            <span className="st-bold">{customerPhone}</span>
                                        </p>
                                    )}
                                    {customerEmail && (
                                        <p className="st-row">
                                            <span>Correo:</span>
                                            <span>{customerEmail}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="st-divider-dashed"></div>

                                {/* Equipo Recibido */}
                                <div className="st-section">
                                    <p className="st-sec-title">Equipo Recibido</p>
                                    <p className="st-row">
                                        <span>Modelo:</span>
                                        <span className="st-bold">{deviceName}</span>
                                    </p>
                                    {repair.color && (
                                        <p className="st-row">
                                            <span>Color:</span>
                                            <span>{repair.color}</span>
                                        </p>
                                    )}
                                    {(repair.imei || repair.serial_number) && (
                                        <p className="st-row">
                                            <span>S/N o IMEI:</span>
                                            <span className="st-bold">{repair.imei || repair.serial_number}</span>
                                        </p>
                                    )}
                                    {repair.physical_condition && (
                                        <p className="st-row">
                                            <span>Estado Estético:</span>
                                            <span>{repair.physical_condition}/5</span>
                                        </p>
                                    )}
                                    <p className="st-row">
                                        <span>Garantía Aplicable:</span>
                                        <span className="st-bold">{warrantyDays} días</span>
                                    </p>
                                    {repair.warranty_expires && (
                                        <p className="st-row">
                                            <span>Vence el:</span>
                                            <span className="st-bold">{formatDate(repair.warranty_expires, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </p>
                                    )}
                                    {repair.accessories_received && (
                                        <p className="st-row">
                                            <span>Accesorios:</span>
                                            <span className="st-bold">{repair.accessories_received}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Checklist de Diagnóstico */}
                                {repair.function_checklist && renderChecklist(repair.function_checklist)}

                                <div className="st-divider-dashed"></div>

                                {/* Servicio Solicitado & Falla */}
                                <div className="st-section">
                                    <p className="st-sec-title">Servicio Solicitado</p>
                                    <p className="st-bold">{serviceName}</p>
                                    {repair.problem_description && (
                                        <p className="st-problem-box">
                                            "Falla: {repair.problem_description}"
                                        </p>
                                    )}
                                    {repair.technical_observations && (
                                        <p className="st-observations">
                                            <span className="st-bold">Diagnóstico Técnico:</span> {repair.technical_observations}
                                        </p>
                                    )}
                                </div>

                                <div className="st-divider-double"></div>

                                {/* Desglose Financiero */}
                                <div className="st-section st-costs">
                                    {serviceCost > 0 && (
                                        <div className="st-cost-row">
                                            <span>{serviceName}</span>
                                            <span>{formatCurrency(serviceCost)}</span>
                                        </div>
                                    )}
                                    {diagCost > 0 && (
                                        <div className="st-cost-row">
                                            <span>Diagnóstico Técnico</span>
                                            <span>{formatCurrency(diagCost)}</span>
                                        </div>
                                    )}
                                    {discount > 0 && (
                                        <div className="st-cost-row st-discount">
                                            <span>Descuento</span>
                                            <span>-{formatCurrency(discount)}</span>
                                        </div>
                                    )}
                                    <div className="st-cost-row st-total-row">
                                        <span>TOTAL NETO</span>
                                        <span>{formatCurrency(totalCost)}</span>
                                    </div>
                                    {advancePayment > 0 && (
                                        <div className="st-cost-row">
                                            <span>Anticipo Pagado</span>
                                            <span>-{formatCurrency(advancePayment)}</span>
                                        </div>
                                    )}
                                    <div className="st-cost-row st-balance-row">
                                        <span>RESTA POR LIQUIDAR</span>
                                        <span>{formatCurrency(balance)}</span>
                                    </div>
                                </div>

                                {/* Firma de Conformidad */}
                                <div className="st-signature-area">
                                    {(repair.signature_delivery || repair.signature_approval) ? (
                                        <img 
                                            src={repair.signature_delivery || repair.signature_approval} 
                                            alt="Firma" 
                                            className="st-signature-img"
                                        />
                                    ) : (
                                        <div className="st-signature-line"></div>
                                    )}
                                    <p className="st-bold">FIRMA DE CONFORMIDAD</p>
                                </div>

                                {/* Términos y Condiciones */}
                                <div className="st-terms-area">
                                    <p className="st-bold st-sec-title">TÉRMINOS Y CONDICIONES</p>
                                    <div className="st-terms-text">
                                        {settings.ticket_terms_conditions ? (
                                            <p style={{ whiteSpace: 'pre-line' }}>{settings.ticket_terms_conditions}</p>
                                        ) : (
                                            <>
                                                <p>1. Toda reparación cuenta con <b>{warrantyDays} días de garantía</b> exclusiva sobre refacciones instaladas y mano de obra.</p>
                                                <p>2. No nos hacemos responsables por pérdida de datos. Respalde su equipo antes de dejarlo.</p>
                                                <p>3. Equipos no reclamados tras 30 días generarán cargos de almacenaje de $50.00 diarios.</p>
                                                <p>4. La garantía se anula si el equipo presenta sellos violados, humedad o golpes posteriores.</p>
                                            </>
                                        )}
                                    </div>
                                    <p className="st-bold st-footer-note">
                                        {settings.ticket_footer_note || '¡GRACIAS POR SU PREFERENCIA!'}
                                    </p>
                                </div>

                                {/* Código de barras decorativo */}
                                <div className="st-barcode-area">
                                    ||||| | |||| ||| || | |||| || ||| | |||
                                    <p className="st-barcode-num">{ticketNumber}</p>
                                </div>

                                {/* Código QR de Rastreo */}
                                {qrImageUrl && (
                                    <div className="st-qr-area">
                                        <h4>RASTREA TU SERVICIO</h4>
                                        <img src={qrImageUrl} alt="QR Tracking" className="st-qr-img" />
                                        <p className="st-qr-url">{ticketNumber}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Panel Derecho: Acciones de Compartir */}
                    <div className="share-ticket-actions-pane">
                        <div className="share-action-group">
                            <h4 className="share-group-title">Envío Rápido</h4>
                            <p className="share-group-desc">
                                Envía este ticket con toda la información directamente al cliente:
                            </p>

                            <div className="share-buttons-stack">
                                <button 
                                    className="btn-share-primary btn-share-wa"
                                    onClick={handleShareWhatsApp}
                                >
                                    <MessageCircle size={18} />
                                    <div className="btn-share-text">
                                        <strong>Enviar por WhatsApp</strong>
                                        <small>{customerPhone ? `A ${customerPhone}` : 'Abrir chat con datos de la orden'}</small>
                                    </div>
                                </button>

                                <button 
                                    className="btn-share-primary btn-share-email"
                                    onClick={handleShareEmail}
                                >
                                    <Mail size={18} />
                                    <div className="btn-share-text">
                                        <strong>Enviar por Correo</strong>
                                        <small>{customerEmail || 'Redactar correo con plantilla'}</small>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="share-action-group">
                            <h4 className="share-group-title">Descargar Comprobante</h4>
                            <div className="share-buttons-row">
                                <button 
                                    className="btn-share-action"
                                    onClick={handleDownloadImage}
                                    disabled={generatingImage}
                                >
                                    <Download size={16} />
                                    <span>{generatingImage ? 'Generando...' : 'Descargar Imagen'}</span>
                                </button>

                                {typeof navigator !== 'undefined' && navigator.canShare && (
                                    <button 
                                        className="btn-share-action"
                                        onClick={handleNativeShare}
                                        disabled={generatingImage}
                                    >
                                        <Share2 size={16} />
                                        <span>Compartir Imagen</span>
                                    </button>
                                )}

                                <button 
                                    className="btn-share-action"
                                    onClick={handleDownloadPDF}
                                >
                                    <FileText size={16} />
                                    <span>Descargar PDF</span>
                                </button>
                            </div>
                        </div>

                        <div className="share-action-group">
                            <h4 className="share-group-title">Copiar al Portapapeles</h4>
                            <div className="share-buttons-stack">
                                <button 
                                    className="btn-share-utility"
                                    onClick={handleCopyLink}
                                >
                                    {copiedLink ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                    <span>{copiedLink ? '¡Enlace de rastreo copiado!' : 'Copiar enlace de rastreo'}</span>
                                </button>

                                <button 
                                    className="btn-share-utility"
                                    onClick={handleCopySummary}
                                >
                                    {copiedSummary ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                    <span>{copiedSummary ? '¡Resumen copiado!' : 'Copiar resumen para WhatsApp / Notas'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Ficha Resumen del Cliente y Ticket */}
                        <div className="share-summary-card">
                            <div className="share-summary-item">
                                <span className="label">Folio:</span>
                                <strong className="value-code">{ticketNumber}</strong>
                            </div>
                            <div className="share-summary-item">
                                <span className="label">Cliente:</span>
                                <span>{customerName}</span>
                            </div>
                            <div className="share-summary-item">
                                <span className="label">Equipo:</span>
                                <span>{deviceName}</span>
                            </div>
                            <div className="share-summary-item">
                                <span className="label">Saldo:</span>
                                <strong className="value-balance">{formatCurrency(balance)}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
