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
    data, // Soporte genérico para reparación o venta
    type = 'repair', // 'repair' | 'pos' | 'sale'
    settings = {}
}) {
    const cardRef = useRef(null);
    const [generatingImage, setGeneratingImage] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [mobileTab, setMobileTab] = useState('preview'); // 'preview' | 'actions'

    // Unificar ticket data
    const ticketData = data || repair;
    if (!isOpen || !ticketData) return null;

    const isSale = type === 'pos' || type === 'sale' || Boolean(ticketData.sale_number && !ticketData.ticket_number);

    const businessName = settings.business_name || settings.company_name || ticketData.company_name || ticketData.tenant_name || 'SySaaS';
    const contactPhone = settings.contact_phone || ticketData.tenant_phone || '';
    const contactEmail = settings.contact_email || ticketData.tenant_email || '';
    const contactAddress = settings.business_address || ticketData.tenant_address || 'Dirección de la empresa';
    const defaultWarrantyDays = settings.default_warranty_days || 30;

    const customerName = `${ticketData.customer_first_name || ticketData.first_name || 'Cliente'} ${ticketData.customer_last_name || ticketData.last_name || ''}`.trim();
    const customerPhone = ticketData.customer_phone || ticketData.phone || '';
    const customerEmail = ticketData.customer_email || ticketData.email || '';

    const ticketNumber = ticketData.ticket_number || ticketData.sale_number || `#${ticketData.id}`;
    const trackingCode = ticketData.ticket_number || ticketData.sale_number;
    const trackingUrl = `${window.location.origin}/rastrear?ticketId=${encodeURIComponent(trackingCode || '')}`;
    const qrImageUrl = trackingCode ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(trackingUrl)}&margin=0` : '';

    // Datos específicos de reparación
    const deviceName = `${ticketData.brand_name === 'Otro' ? ticketData.brand_other : (ticketData.brand_name || ticketData.brand || '')} ${ticketData.model || ''}`.trim() || 'Dispositivo';
    const serviceName = ticketData.service_name || ticketData.service_requested || 'Reparación General';
    const totalCost = parseFloat(ticketData.total_cost || ticketData.total || 0);
    const diagCost = parseFloat(ticketData.diagnosis_cost || 0);
    const serviceCost = Math.max(0, totalCost - diagCost);
    const discount = parseFloat(ticketData.discount || 0);
    const advancePayment = parseFloat(ticketData.advance_payment || 0);
    const balance = Math.max(0, totalCost - advancePayment);
    const warrantyDays = ticketData.warranty_days || ticketData.repair_warranty_days || defaultWarrantyDays;
    const isDelivered = ticketData.status === 'delivered';
    const statusLabel = (STATUS_LABELS[ticketData.status] || ticketData.status || 'Recibido').toUpperCase();

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
                                    <span className="checklist-text">{label}</span>
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

    // Renderizar la tarjeta como imagen PNG en alta definición nítida (3x escala)
    const captureTicketCanvas = async () => {
        if (!cardRef.current) return null;
        return await html2canvas(cardRef.current, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 5000,
            onclone: (clonedDoc) => {
                // Asegurar que el elemento clonado tenga dimensiones fijas y legibles
                const el = clonedDoc.querySelector('.share-thermal-ticket');
                if (el) {
                    el.style.width = '380px';
                    el.style.boxSizing = 'border-box';
                    el.style.backgroundColor = '#ffffff';
                    el.style.color = '#000000';
                }
            }
        });
    };

    // Descargar imagen PNG directamente
    const handleDownloadImage = async () => {
        try {
            setGeneratingImage(true);
            const canvas = await captureTicketCanvas();
            if (!canvas) return;
            const imgData = canvas.toDataURL('image/png', 1.0);
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

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
            const file = new File([blob], `Ticket_${ticketNumber}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Ticket ${ticketNumber} - ${businessName}`,
                    text: `Hola ${customerName}, adjuntamos tu comprobante en ${businessName} (Folio: ${ticketNumber}). Rastreo y detalles: ${trackingUrl}`
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
        let textMessage = '';

        if (isSale) {
            textMessage = 
`*${businessName.toUpperCase()}* 🧾
*COMPROBANTE DE COMPRA*

Hola *${customerName || 'Cliente'}*, adjuntamos tu ticket de venta:
━━━━━━━━━━━━━━━━━
📌 *Folio de Venta:* ${ticketNumber}
📅 *Fecha:* ${formatDateTime(ticketData.created_at || new Date())}
👤 *Atendió:* ${ticketData.cashier_first_name || 'Caja'} ${ticketData.cashier_last_name || ''}
${ticketData.repair_ticket ? `🔧 *Reparación Asociada:* ${ticketData.repair_ticket}\n` : ''}
🛒 *Artículos:*
${ticketData.items?.map(it => `• ${it.quantity}x ${it.description} - ${formatCurrency(it.total)}`).join('\n') || '• Venta mostrador'}
━━━━━━━━━━━━━━━━━
💰 *Total Compra:* ${formatCurrency(ticketData.total || 0)}
💳 *Método de Pago:* ${(ticketData.payment_method || 'efectivo').toUpperCase()}
━━━━━━━━━━━━━━━━━
🔍 *Consulta tu ticket digital y garantía aquí:*
${trackingUrl}

_¡Muchas gracias por su compra!_`;
        } else {
            textMessage = 
`*${businessName.toUpperCase()}* 🧾
*${isDelivered ? 'COMPROBANTE DE ENTREGA Y GARANTÍA' : 'ORDEN DE SERVICIO'}*

Hola *${customerName}*, adjuntamos el detalle de tu ticket:
━━━━━━━━━━━━━━━━━
📌 *Folio:* ${ticketNumber}
📱 *Equipo:* ${deviceName}
${ticketData.imei || ticketData.serial_number ? `🔢 *IMEI/Serie:* ${ticketData.imei || ticketData.serial_number}\n` : ''}${ticketData.color ? `🎨 *Color:* ${ticketData.color}\n` : ''}🔧 *Servicio:* ${serviceName}
${ticketData.problem_description ? `⚠️ *Falla:* "${ticketData.problem_description}"\n` : ''}🚦 *Estado:* ${statusLabel}
💵 *Total:* ${formatCurrency(totalCost)}
${advancePayment > 0 ? `💰 *Anticipo:* ${formatCurrency(advancePayment)}\n` : ''}💳 *Resta:* ${formatCurrency(balance)}
🛡️ *Garantía:* ${warrantyDays} días
━━━━━━━━━━━━━━━━━
🔍 *Rastrea tu equipo en vivo y consulta tu ticket digital aquí:*
${trackingUrl}

_Gracias por tu preferencia._`;
        }

        const waUrl = buildWhatsAppUrl(customerPhone, textMessage);
        if (waUrl) {
            window.open(waUrl, '_blank', 'noopener,noreferrer');
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(textMessage)}`, '_blank', 'noopener,noreferrer');
        }
    };

    // Compartir por correo con mailto
    const handleShareEmail = () => {
        const subject = encodeURIComponent(
            isSale 
                ? `Comprobante de Compra ${ticketNumber} - ${businessName}` 
                : `Ticket de Servicio ${ticketNumber} - ${businessName}`
        );

        let body = '';
        if (isSale) {
            body = encodeURIComponent(
`Hola ${customerName || 'Cliente'},

Te compartimos el comprobante de tu compra en ${businessName}:

• Folio de Compra: ${ticketNumber}
• Fecha: ${formatDateTime(ticketData.created_at || new Date())}
• Atendió: ${ticketData.cashier_first_name || 'Caja'} ${ticketData.cashier_last_name || ''}
${ticketData.repair_ticket ? `• Folio Reparación: ${ticketData.repair_ticket}\n` : ''}
Artículos:
${ticketData.items?.map(it => `• ${it.quantity}x ${it.description}: ${formatCurrency(it.total)}`).join('\n') || ''}

Total: ${formatCurrency(ticketData.total || 0)}
Forma de Pago: ${(ticketData.payment_method || 'efectivo').toUpperCase()}

Consulta y descarga tu ticket digital aquí:
${trackingUrl}

Atentamente,
${businessName}
${contactAddress}
${contactPhone ? `Tel: ${contactPhone}` : ''}`
            );
        } else {
            body = encodeURIComponent(
`Hola ${customerName},

Te compartimos la información completa de tu ticket en ${businessName}:

• Folio de Ticket: ${ticketNumber}
• Fecha: ${formatDateTime(ticketData.created_at || new Date())}
• Equipo: ${deviceName}
${ticketData.imei || ticketData.serial_number ? `• IMEI/Serie: ${ticketData.imei || ticketData.serial_number}\n` : ''}${ticketData.color ? `• Color: ${ticketData.color}\n` : ''}• Servicio: ${serviceName}
${ticketData.problem_description ? `• Falla Reportada: ${ticketData.problem_description}\n` : ''}• Estado Actual: ${statusLabel}
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
        }

        window.open(`mailto:${customerEmail || ''}?subject=${subject}&body=${body}`, '_blank');
    };

    const handleCopySummary = async () => {
        const summary = isSale
            ? `${businessName} | Folio: ${ticketNumber} | Total: ${formatCurrency(ticketData.total || 0)} | Rastreo: ${trackingUrl}`
            : `${businessName} | Ticket: ${ticketNumber} | Equipo: ${deviceName} | Total: ${formatCurrency(totalCost)} | Saldo: ${formatCurrency(balance)} | Rastreo: ${trackingUrl}`;
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
        if (isSale) {
            window.print();
        } else {
            try {
                await generateServiceTicket(ticketData, settings);
            } catch (e) {
                console.error(e);
                alert('Error generando PDF');
            }
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
                            <h3>{isSale ? 'Compartir Ticket de Venta' : 'Compartir Ticket Digital'}</h3>
                            <p>{isSale ? 'Envía o descarga el comprobante oficial de compra' : 'Envía o descarga el ticket oficial con toda la información de la orden'}</p>
                        </div>
                    </div>
                    <button className="btn-close-modal" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                {/* Mobile Tabs Switcher */}
                <div className="share-ticket-mobile-tabs">
                    <button
                        type="button"
                        className={`share-mobile-tab-btn ${mobileTab === 'preview' ? 'active' : ''}`}
                        onClick={() => setMobileTab('preview')}
                    >
                        <Ticket size={15} />
                        <span>Ver Ticket</span>
                    </button>
                    <button
                        type="button"
                        className={`share-mobile-tab-btn ${mobileTab === 'actions' ? 'active' : ''}`}
                        onClick={() => setMobileTab('actions')}
                    >
                        <Share2 size={15} />
                        <span>Opciones de Envío</span>
                    </button>
                </div>

                <div className="share-ticket-body">
                    {/* Panel Izquierdo: Ticket Térmico Oficial Idéntico al de la Plataforma */}
                    <div className={`share-ticket-preview-pane ${mobileTab === 'preview' ? 'mobile-visible' : 'mobile-hidden'}`}>
                        <div className="share-ticket-paper-wrapper">
                            <div className="share-thermal-ticket" ref={cardRef}>
                                {/* Cabecera del Negocio */}
                                <div className="st-header">
                                    <h2 className="st-business-name">{businessName}</h2>
                                    <p className="st-bold">{contactAddress}</p>
                                    {contactPhone && <p>Teléfono: {contactPhone}</p>}
                                    {contactEmail && <p>{contactEmail}</p>}

                                    <h3 className="st-doc-title">
                                        {isSale 
                                            ? 'COMPROBANTE DE COMPRA'
                                            : (isDelivered ? 'COMPROBANTE DE ENTREGA Y GARANTÍA' : 'ORDEN DE SERVICIO')}
                                    </h3>

                                    <p className="st-bold st-ticket-num">{isSale ? 'FOLIO:' : 'TICKET:'} {ticketNumber}</p>
                                    <p>{isSale ? 'Fecha:' : 'Ingreso:'} {formatDateTime(ticketData.created_at || new Date())}</p>
                                    
                                    {!isSale && ticketData.completed_at && (
                                        <p className="st-bold">Finalizado: {formatDateTime(ticketData.completed_at)}</p>
                                    )}
                                    {!isSale && ticketData.delivered_at && (
                                        <p className="st-bold">Entregado: {formatDateTime(ticketData.delivered_at)}</p>
                                    )}
                                    {!isSale && ticketData.estimated_delivery && (
                                        <p className="st-bold">Entrega Estimada: {formatDateTime(ticketData.estimated_delivery)}</p>
                                    )}

                                    {!isSale && (
                                        <div className="st-badges-row">
                                            <span className="st-badge">SERVICIO: {statusLabel}</span>
                                            <span className="st-badge">PAGO: {paymentStatusText}</span>
                                            {ticketData.priority && (
                                                <span className="st-badge">PRIORIDAD: {translatePriority(ticketData.priority)}</span>
                                            )}
                                        </div>
                                    )}

                                    {!isSale && ticketData.parent_repair_id && (
                                        <p className="st-warranty-banner">
                                            INGRESO POR GARANTÍA — Ticket Original: {ticketData.parent_ticket || `#${ticketData.parent_repair_id}`}
                                        </p>
                                    )}
                                </div>

                                <div className="st-divider-double"></div>

                                {isSale ? (
                                    /* ================= SECCIONES VENTA / POS ================= */
                                    <>
                                        <div className="st-section">
                                            {ticketData.customer_first_name && (
                                                <p className="st-row">
                                                    <span>Cliente:</span>
                                                    <span className="st-bold">{ticketData.customer_first_name} {ticketData.customer_last_name || ''}</span>
                                                </p>
                                            )}
                                            <p className="st-row">
                                                <span>Cajero:</span>
                                                <span className="st-bold">{ticketData.cashier_first_name || 'Caja'} {ticketData.cashier_last_name || ''}</span>
                                            </p>
                                            {ticketData.repair_ticket && (
                                                <>
                                                    <p className="st-row">
                                                        <span>Folio Reparación:</span>
                                                        <span className="st-bold">{ticketData.repair_ticket}</span>
                                                    </p>
                                                    <p className="st-row">
                                                        <span>Garantía Reparación:</span>
                                                        <span className="st-bold">{ticketData.repair_warranty_days || defaultWarrantyDays} días</span>
                                                    </p>
                                                </>
                                            )}
                                        </div>

                                        <div className="st-divider-double"></div>

                                        <p className="st-sec-title">Lista de Artículos</p>
                                        <div className="st-items-list">
                                            {ticketData.items?.map((item, idx) => {
                                                const isRet = Boolean(item.is_returned);
                                                return (
                                                    <div key={idx} className="st-item-row" style={isRet ? { opacity: 0.6 } : {}}>
                                                        <div className="st-item-main">
                                                            <span className="st-item-desc" style={isRet ? { textDecoration: 'line-through' } : {}}>
                                                                {item.description} {isRet ? ' [DEVUELTO]' : ''}
                                                            </span>
                                                            <span className="st-item-price" style={isRet ? { textDecoration: 'line-through' } : {}}>
                                                                {formatCurrency(item.total)}
                                                            </span>
                                                        </div>
                                                        <div className="st-item-meta">
                                                            {item.quantity} x {formatCurrency(item.price || item.unit_price)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="st-divider-dashed"></div>

                                        <div className="st-section st-costs">
                                            <div className="st-cost-row">
                                                <span>Subtotal</span>
                                                <span>{formatCurrency(ticketData.subtotal || ticketData.total || 0)}</span>
                                            </div>
                                            {parseFloat(ticketData.discount) > 0 && (
                                                <div className="st-cost-row st-discount">
                                                    <span>Descuento</span>
                                                    <span>-{formatCurrency(ticketData.discount)}</span>
                                                </div>
                                            )}
                                            <div className="st-cost-row st-total-row">
                                                <span>TOTAL COMPRA</span>
                                                <span>{formatCurrency(ticketData.total || 0)}</span>
                                            </div>
                                            <div className="st-cost-row" style={{ marginTop: '4px' }}>
                                                <span>Forma de Pago:</span>
                                                <span className="st-bold uppercase">
                                                    {ticketData.payment_method === 'cash' ? 'EFECTIVO' :
                                                     ticketData.payment_method === 'card' ? 'TARJETA' :
                                                     ticketData.payment_method === 'transfer' ? 'TRANSFERENCIA' : 'MIXTO'}
                                                </span>
                                            </div>
                                            {(ticketData.payment_method === 'cash' || ticketData.payment_method === 'mixed') && (
                                                <>
                                                    <div className="st-cost-row">
                                                        <span>Monto Recibido</span>
                                                        <span>{formatCurrency(ticketData.amount_received || ticketData.total || 0)}</span>
                                                    </div>
                                                    {parseFloat(ticketData.change_amount) > 0 && (
                                                        <div className="st-cost-row st-bold" style={{ marginTop: '2px' }}>
                                                            <span>CAMBIO ENTREGADO</span>
                                                            <span>{formatCurrency(ticketData.change_amount)}</span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {ticketData.notes && (
                                            <>
                                                <div className="st-divider-dashed"></div>
                                                <div className="st-section">
                                                    <p className="st-bold">Notas:</p>
                                                    <p className="st-problem-box">{ticketData.notes}</p>
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    /* ================= SECCIONES REPARACIÓN / ORDEN ================= */
                                    <>
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
                                            {ticketData.color && (
                                                <p className="st-row">
                                                    <span>Color:</span>
                                                    <span>{ticketData.color}</span>
                                                </p>
                                            )}
                                            {(ticketData.imei || ticketData.serial_number) && (
                                                <p className="st-row">
                                                    <span>S/N o IMEI:</span>
                                                    <span className="st-bold">{ticketData.imei || ticketData.serial_number}</span>
                                                </p>
                                            )}
                                            {ticketData.physical_condition && (
                                                <p className="st-row">
                                                    <span>Estado Estético:</span>
                                                    <span>{ticketData.physical_condition}/5</span>
                                                </p>
                                            )}
                                            <p className="st-row">
                                                <span>Garantía Aplicable:</span>
                                                <span className="st-bold">{warrantyDays} días</span>
                                            </p>
                                            {ticketData.warranty_expires && (
                                                <p className="st-row">
                                                    <span>Vence el:</span>
                                                    <span className="st-bold">{formatDate(ticketData.warranty_expires, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                </p>
                                            )}
                                            {ticketData.accessories_received && (
                                                <p className="st-row">
                                                    <span>Accesorios:</span>
                                                    <span className="st-bold">{ticketData.accessories_received}</span>
                                                </p>
                                            )}
                                        </div>

                                        {/* Checklist de Diagnóstico */}
                                        {ticketData.function_checklist && renderChecklist(ticketData.function_checklist)}

                                        <div className="st-divider-dashed"></div>

                                        {/* Servicio Solicitado & Falla */}
                                        <div className="st-section">
                                            <p className="st-sec-title">Servicio Solicitado</p>
                                            <p className="st-bold">{serviceName}</p>
                                            {ticketData.problem_description && (
                                                <p className="st-problem-box">
                                                    "Falla: {ticketData.problem_description}"
                                                </p>
                                            )}
                                            {ticketData.technical_observations && (
                                                <p className="st-observations">
                                                    <span className="st-bold">Diagnóstico Técnico:</span> {ticketData.technical_observations}
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
                                    </>
                                )}

                                {/* Firma de Conformidad */}
                                <div className="st-signature-area">
                                    {(ticketData.signature_delivery || ticketData.signature_approval) ? (
                                        <img 
                                            src={ticketData.signature_delivery || ticketData.signature_approval} 
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
                                        {isSale ? (
                                            <p>Conserve este ticket como comprobante de su compra.</p>
                                        ) : (
                                            settings.ticket_terms_conditions ? (
                                                <p style={{ whiteSpace: 'pre-line' }}>{settings.ticket_terms_conditions}</p>
                                            ) : (
                                                <>
                                                    <p>1. Toda reparación cuenta con <b>{warrantyDays} días de garantía</b> exclusiva sobre refacciones instaladas y mano de obra.</p>
                                                    <p>2. No nos hacemos responsables por pérdida de datos. Respalde su equipo antes de dejarlo.</p>
                                                    <p>3. Equipos no reclamados tras 30 días generarán cargos de almacenaje de $50.00 diarios.</p>
                                                    <p>4. La garantía se anula si el equipo presenta sellos violados, humedad o golpes posteriores.</p>
                                                </>
                                            )
                                        )}
                                    </div>
                                    <p className="st-bold st-footer-note">
                                        {settings.ticket_footer_note || (isSale ? '¡MUCHAS GRACIAS POR SU COMPRA!' : '¡GRACIAS POR SU PREFERENCIA!')}
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
                                        <h4>{isSale ? 'DESCARGAR TICKET DIGITAL' : 'RASTREA TU SERVICIO'}</h4>
                                        <img src={qrImageUrl} alt="QR Tracking" className="st-qr-img" />
                                        <p className="st-qr-url">{trackingCode}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Panel Derecho: Acciones de Compartir */}
                    <div className={`share-ticket-actions-pane ${mobileTab === 'actions' ? 'mobile-visible' : 'mobile-hidden'}`}>
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
                                    {isSale ? <Printer size={16} /> : <FileText size={16} />}
                                    <span>{isSale ? 'Imprimir Ticket' : 'Descargar PDF'}</span>
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
                            {isSale ? (
                                <div className="share-summary-item">
                                    <span className="label">Total Venta:</span>
                                    <strong className="value-balance">{formatCurrency(ticketData.total || 0)}</strong>
                                </div>
                            ) : (
                                <>
                                    <div className="share-summary-item">
                                        <span className="label">Equipo:</span>
                                        <span>{deviceName}</span>
                                    </div>
                                    <div className="share-summary-item">
                                        <span className="label">Saldo:</span>
                                        <strong className="value-balance">{formatCurrency(balance)}</strong>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
