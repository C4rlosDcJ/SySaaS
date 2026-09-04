import { Printer, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/constants';
import { useTenant } from '../../context/TenantContext';
import './PrintReceipt.css';

export default function PrintReceipt({ isOpen, onClose, data, type = 'repair', settings = {} }) {
    const { tenant } = useTenant();
    if (!isOpen || !data) return null;

    const businessName = tenant?.company_name || tenant?.name || settings.business_name || data.tenant_name || data.company_name || 'Mi Empresa';
    const contactEmail = settings.contact_email || tenant?.email || '';
    const contactPhone = settings.contact_phone || tenant?.phone || '';
    const contactAddress = settings.business_address || tenant?.address || 'Dirección de la empresa';

    const trackingCode = data.ticket_number || data.sale_number;
    const trackingUrl = `${window.location.origin}/rastrear?ticketId=${encodeURIComponent(trackingCode || '')}`;
    const qrImageUrl = trackingCode ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(trackingUrl)}&margin=0` : '';

    const handlePrint = () => {
        window.print();
    };

    const renderChecklist = (checklist) => {
        if (!checklist) return null;
        try {
            const parsed = typeof checklist === 'string' ? JSON.parse(checklist) : checklist;
            const entries = Object.entries(parsed);
            if (entries.length === 0) return null;
            return (
                <div className="receipt-section">
                    <p className="bold uppercase block-text text-center" style={{ letterSpacing: '0.1em', fontSize: '10px', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
                        [ CHECKLIST DE DIAGNÓSTICO ]
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', fontSize: '9px', marginTop: '6px' }}>
                        {entries.map(([key, value]) => {
                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                            return (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>{value ? '✓' : '✗'}</span>
                                    <span>{label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        } catch (e) {
            return null;
        }
    };

    const translatePriority = (priority) => {
        if (!priority) return 'Normal';
        const p = priority.toLowerCase();
        if (p === 'high' || p === 'alta') return 'ALTA';
        if (p === 'urgent' || p === 'urgente') return 'URGENTE';
        if (p === 'low' || p === 'baja') return 'BAJA';
        return 'NORMAL';
    };

    // Calculate remaining balance to determine payment status tag
    const totalCost = parseFloat(data.total_cost || 0);
    const advancePayment = parseFloat(data.advance_payment || 0);
    const balance = totalCost - advancePayment;

    let paymentStatusText = 'PENDIENTE';
    if (advancePayment > 0) {
        paymentStatusText = balance <= 0 ? 'PAGADO' : 'ANTICIPO PAGADO';
    }

    return (
        <div className="print-receipt-overlay" onClick={onClose}>
            <div className="print-receipt-modal" onClick={(e) => e.stopPropagation()}>
                <div className="print-receipt-actions">
                    <button className="btn-secondary" onClick={onClose}>
                        <X size={16} /> Cerrar
                    </button>
                    <button className="btn-primary" onClick={handlePrint}>
                        <Printer size={16} /> Imprimir Ticket
                    </button>
                </div>

                <div className="receipt-print-area">
                    {type === 'repair' ? (
                        /* ================= REPAIR RECEIPT (ORDER / DELIVERY) ================= */
                        <div className="thermal-receipt">
                            <div className="receipt-header-info">
                                <h2>{businessName}</h2>
                                <p className="bold">{contactAddress}</p>
                                {contactPhone && <p>Teléfono: {contactPhone}</p>}
                                {contactEmail && <p>{contactEmail}</p>}
                                
                                <h3>ORDEN DE SERVICIO</h3>
                                
                                <p className="bold uppercase" style={{ fontSize: '13px', marginTop: '6px' }}>TICKET: {data.ticket_number}</p>
                                <p>Ingreso: {formatDateTime(data.created_at)}</p>
                                {data.estimated_delivery && (
                                    <p className="bold">Entrega Estimada: {formatDateTime(data.estimated_delivery)}</p>
                                )}
                                
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                                    <span className="bold-badge">ESTADO: {paymentStatusText}</span>
                                    {data.priority && (
                                        <span className="bold-badge priority-badge">PRIORIDAD: {translatePriority(data.priority)}</span>
                                    )}
                                </div>
                                {data.parent_repair_id && (
                                    <p className="bold" style={{ textAlign: 'center', marginTop: '6px', fontSize: '11px', border: '1px solid #000', padding: '4px', background: '#f0f0f0' }}>
                                        INGRESO POR GARANTÍA — Ticket Original: {data.parent_ticket || `#${data.parent_repair_id}`}
                                    </p>
                                )}
                            </div>

                            <div className="divider-double"></div>

                            <div className="receipt-section">
                                <p className="bold uppercase block-text" style={{ borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '4px' }}>
                                    Cliente
                                </p>
                                <p>
                                    <span>Nombre:</span> 
                                    <span className="bold">{data.customer_first_name || data.first_name} {data.customer_last_name || data.last_name}</span>
                                </p>
                                {data.customer_phone && (
                                    <p><span>Contacto:</span> <span className="bold">{data.customer_phone}</span></p>
                                )}
                            </div>

                            <div className="divider-dashed"></div>

                            <div className="receipt-section">
                                <p className="bold uppercase block-text" style={{ borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '4px' }}>
                                    Equipo Recibido
                                </p>
                                <p>
                                    <span>Modelo:</span>
                                    <span className="bold">{data.brand_name === 'Otro' ? data.brand_other : data.brand_name} {data.model}</span>
                                </p>
                                {data.color && <p><span>Color:</span> <span>{data.color}</span></p>}
                                {(data.imei || data.serial_number) && (
                                    <p><span>S/N o IMEI:</span> <span className="bold">{data.imei || data.serial_number}</span></p>
                                )}
                                {data.physical_condition && <p><span>Estado Estético:</span> <span>{data.physical_condition}/5</span></p>}
                                <p><span>Garantía Aplicable:</span> <span className="bold">{data.warranty_days || settings.default_warranty_days || 30} días</span></p>
                                {data.warranty_expires && (
                                    <p><span>Vence el:</span> <span className="bold">{new Date(data.warranty_expires).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                                )}
                                {data.accessories_received && <p><span>Accesorios:</span> <span className="bold">{data.accessories_received}</span></p>}
                            </div>

                            {data.function_checklist && (
                                <>
                                    <div className="divider-dashed"></div>
                                    {renderChecklist(data.function_checklist)}
                                </>
                            )}

                            <div className="divider-dashed"></div>

                            <div className="receipt-section">
                                <p className="bold uppercase block-text" style={{ borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '4px' }}>
                                    Servicio Solicitado
                                </p>
                                <p className="bold block-text">{data.service_name || data.service_requested || 'Reparación General'}</p>
                                {data.problem_description && (
                                    <p className="italic block-text" style={{ marginTop: '4px', background: '#f4f4f4', padding: '4px' }}>
                                        "Falla: {data.problem_description}"
                                    </p>
                                )}
                                {data.technical_observations && (
                                    <p className="block-text" style={{ marginTop: '6px', fontSize: '9.5px' }}>
                                        <span className="bold">Diagnóstico Técnico:</span> {data.technical_observations}
                                    </p>
                                )}
                            </div>

                            <div className="divider-double"></div>

                            <div className="receipt-section costs-summary">
                                <div className="cost-row">
                                    <span>Mano de Obra</span>
                                    <span>{formatCurrency(data.labor_cost)}</span>
                                </div>
                                <div className="cost-row">
                                    <span>Refacciones</span>
                                    <span>{formatCurrency(data.parts_cost)}</span>
                                </div>
                                <div className="cost-row">
                                    <span>Diagnóstico</span>
                                    <span>{formatCurrency(data.diagnosis_cost)}</span>
                                </div>
                                {parseFloat(data.discount) > 0 && (
                                    <div className="cost-row discount">
                                        <span>Descuento</span>
                                        <span>-{formatCurrency(data.discount)}</span>
                                    </div>
                                )}
                                
                                <div className="cost-row total-row">
                                    <span>TOTAL NETO</span>
                                    <span>{formatCurrency(data.total_cost)}</span>
                                </div>
                                
                                {parseFloat(data.advance_payment) > 0 && (
                                    <div className="cost-row">
                                        <span>Anticipo</span>
                                        <span>-{formatCurrency(data.advance_payment)}</span>
                                    </div>
                                )}
                                
                                <div className="cost-row balance-row">
                                    <span>RESTA POR LIQUIDAR</span>
                                    <span>{formatCurrency(balance)}</span>
                                </div>
                            </div>

                            {data.signature_approval && (
                                <div className="signature-area">
                                    <p className="bold block-text">FIRMA CLIENTE</p>
                                    <img src={data.signature_approval} alt="Firma" className="signature-img" />
                                </div>
                            )}

                            {!data.signature_approval && (
                                <div className="signature-area">
                                    <div className="signature-line"></div>
                                    <p className="bold block-text">FIRMA DE CONFORMIDAD</p>
                                </div>
                            )}

                            <div className="receipt-footer-notes">
                                <p className="bold" style={{ borderBottom: '1px solid #000', paddingBottom: '2px' }}>TÉRMINOS Y CONDICIONES</p>
                                <div style={{ textAlign: 'left', fontSize: '8.5px', marginTop: '6px' }}>
                                    <p>1. Toda reparación cuenta con <b>{data.warranty_days || settings.default_warranty_days || 30} días de garantía</b> exclusiva sobre refacciones instaladas y mano de obra.</p>
                                    <p>2. No nos hacemos responsables por pérdida de datos. Respalde su equipo antes de dejarlo.</p>
                                    <p>3. Equipos no reclamados tras 30 días generarán cargos de almacenaje de $50.00 diarios.</p>
                                    <p>4. La garantía se anula si el equipo presenta sellos violados, humedad o golpes posteriores.</p>
                                </div>
                                <p className="bold" style={{ marginTop: '12px', fontSize: '10px' }}>¡GRACIAS POR SU PREFERENCIA!</p>
                            </div>

                            {/* Decorative Monospace Barcode */}
                            <div style={{ textAlign: 'center', marginTop: '20px', letterSpacing: '2px', fontSize: '10px' }}>
                                ||||| | |||| ||| || | |||| || ||| | |||
                                <p style={{ fontSize: '8px', margin: 0, letterSpacing: 'normal' }}>{data.ticket_number}</p>
                            </div>

                            {qrImageUrl && (
                                <div className="receipt-qr-code">
                                    <h4>RASTREA TU SERVICIO</h4>
                                    <img src={qrImageUrl} alt="QR Tracking" />
                                    <p className="qr-url">{trackingCode}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ================= POS / SALE RECEIPT ================= */
                        <div className="thermal-receipt">
                            <div className="receipt-header-info">
                                <h2>{businessName}</h2>
                                <p className="bold">{contactAddress}</p>
                                {contactPhone && <p>Teléfono: {contactPhone}</p>}
                                {contactEmail && <p>{contactEmail}</p>}
                                
                                <h3>COMPROBANTE DE COMPRA</h3>
                                
                                <p className="bold uppercase" style={{ fontSize: '13px', marginTop: '6px' }}>FOLIO: {data.sale_number}</p>
                                <p>Fecha: {formatDateTime(data.created_at)}</p>
                                
                                <div style={{ marginTop: '12px', textAlign: 'left' }}>
                                    {data.customer_first_name && (
                                        <p><span>Cliente:</span> <span className="bold">{data.customer_first_name} {data.customer_last_name}</span></p>
                                    )}
                                    <p><span>Cajero:</span> <span className="bold">{data.cashier_first_name} {data.cashier_last_name}</span></p>
                                    {data.repair_ticket ? (
                                        <>
                                            <p><span>Folio Reparación:</span> <span className="bold">{data.repair_ticket}</span></p>
                                            <p><span>Garantía Reparación:</span> <span className="bold">{data.repair_warranty_days || settings.default_warranty_days || 30} días</span></p>
                                        </>
                                    ) : (
                                        <p><span>Garantía Aplicable:</span> <span className="bold">{settings.default_warranty_days || 30} días</span></p>
                                    )}
                                </div>
                            </div>

                            <div className="divider-double"></div>

                            <p className="bold uppercase block-text" style={{ marginBottom: '8px', fontSize: '10px' }}>Lista de Artículos</p>
                            <div className="receipt-items-list">
                                {data.items?.map((item, idx) => (
                                    <div key={idx} className="receipt-item-row">
                                        <div className="item-main-line">
                                            <span className="item-desc">{item.description}</span>
                                            <span className="item-price">{formatCurrency(item.total)}</span>
                                        </div>
                                        <div className="item-meta">
                                            {item.quantity} x {formatCurrency(item.price)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="divider-solid"></div>

                            <div className="receipt-section costs-summary">
                                <div className="cost-row">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(data.subtotal)}</span>
                                </div>
                                {parseFloat(data.discount) > 0 && (
                                    <div className="cost-row discount">
                                        <span>Descuento</span>
                                        <span>-{formatCurrency(data.discount)}</span>
                                    </div>
                                )}
                                <div className="cost-row total-row">
                                    <span>TOTAL COMPRA</span>
                                    <span>{formatCurrency(data.total)}</span>
                                </div>
                                <div className="cost-row" style={{ marginTop: '6px' }}>
                                    <span>Forma de Pago:</span>
                                    <span className="bold uppercase">
                                        {data.payment_method === 'cash' ? 'EFECTIVO' :
                                         data.payment_method === 'card' ? 'TARJETA' : 'TRANSFERENCIA'}
                                    </span>
                                </div>
                                {data.payment_method === 'cash' && (
                                    <>
                                        <div className="cost-row">
                                            <span>Efectivo Recibido</span>
                                            <span>{formatCurrency(data.amount_received)}</span>
                                        </div>
                                        <div className="cost-row bold uppercase" style={{ marginTop: '4px' }}>
                                            <span>CAMBIO ENTREGADO</span>
                                            <span>{formatCurrency(data.change_amount)}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {data.notes && (
                                <>
                                    <div className="divider-dashed"></div>
                                    <div className="receipt-section">
                                        <p className="bold block-text">Notas:</p>
                                        <p className="block-text italic">{data.notes}</p>
                                    </div>
                                </>
                            )}

                            <div className="divider-double" style={{ marginTop: '20px' }}></div>

                            <div className="receipt-footer-notes">
                                <p>Conserve este ticket como comprobante de su compra.</p>
                                <p>Cualquier cambio o devolución se realiza en los primeros 7 días naturales presentando este ticket impreso en buen estado.</p>
                                <p className="bold" style={{ marginTop: '12px', fontSize: '10px' }}>¡MUCHAS GRACIAS POR SU COMPRA!</p>
                            </div>

                            {/* Decorative Monospace Barcode */}
                            <div style={{ textAlign: 'center', marginTop: '20px', letterSpacing: '2px', fontSize: '10px' }}>
                                ||||| | |||| ||| || | |||| || ||| | |||
                                <p style={{ fontSize: '8px', margin: 0, letterSpacing: 'normal' }}>{data.sale_number}</p>
                            </div>

                            {qrImageUrl && (
                                <div className="receipt-qr-code">
                                    <h4>DESCARGAR TICKET DIGITAL</h4>
                                    <img src={qrImageUrl} alt="QR Digital" />
                                    <p className="qr-url">{trackingCode}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
