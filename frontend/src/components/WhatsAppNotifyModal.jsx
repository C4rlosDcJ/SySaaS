import React, { useState, useEffect } from 'react';
import { X, Copy, Check, MessageSquare, ExternalLink, AlertTriangle } from 'lucide-react';
import { compileWhatsAppTemplate, sanitizeWhatsAppPhone, openWhatsApp } from '../utils/whatsappUtils';
import { STATUS_LABELS } from '../utils/constants';
import './WhatsAppNotifyModal.css';

export default function WhatsAppNotifyModal({
    isOpen,
    onClose,
    customerPhone,
    customerName,
    repair,
    settings = {},
    initialTemplateType = 'ready'
}) {
    const [templateType, setTemplateType] = useState(initialTemplateType);
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);

    const cleanPhone = sanitizeWhatsAppPhone(customerPhone);
    const hasPhone = Boolean(cleanPhone);

    const businessName = settings.business_name || 'SySaaS';
    const trackingUrl = repair?.ticket_number ? `${window.location.origin}/rastreo?ticketId=${repair.ticket_number}` : '';
    const statusLabel = repair?.status ? (STATUS_LABELS[repair.status] || repair.status) : '';

    const deviceType = repair?.device_type_name || repair?.device_type || '';
    const brand = repair?.brand_name || repair?.brand_other || repair?.brand || '';
    const model = repair?.model || '';

    const deviceParts = [deviceType, brand, model].filter(Boolean);
    const fullDeviceName = deviceParts.length > 0 ? deviceParts.join(' ') : (model || 'su equipo');

    const buildTemplateContent = (type) => {
        const data = {
            customerName: customerName || 'Estimado cliente',
            deviceType: deviceType,
            brand: brand,
            model: model,
            fullDevice: fullDeviceName,
            ticketNumber: repair?.ticket_number || '',
            businessName: businessName,
            trackingUrl: trackingUrl,
            statusLabel: statusLabel
        };

        if (type === 'ready') {
            const rawTemplate = settings.whatsapp_ready_template || 
                'Hola {cliente}, tu equipo {equipo} (Folio: {folio}) está listo para entrega en nuestra sucursal. Saludos de {empresa}.';
            return compileWhatsAppTemplate(rawTemplate, data);
        }

        if (type === 'status') {
            return `Hola ${data.customerName}, te informamos que tu equipo ${fullDeviceName} (Folio: ${data.ticketNumber}) ha actualizado su estado a: ${statusLabel}. Puedes consultar los detalles aquí: ${trackingUrl} . Saludos de ${businessName}.`;
        }

        if (type === 'budget') {
            const cost = repair?.total_cost ? `$${repair.total_cost}` : '';
            return `Hola ${data.customerName}, el diagnóstico y cotización para tu equipo ${fullDeviceName} (Folio: ${data.ticketNumber}) están listos${cost ? ` por un total de ${cost}` : ''}. Puedes revisar y aprobar tu cotización aquí: ${trackingUrl} . Saludos de ${businessName}.`;
        }

        if (type === 'custom') {
            return `Hola ${data.customerName}, nos comunicamos de ${businessName} con respecto a tu orden #${data.ticketNumber} (${fullDeviceName}).`;
        }

        return '';
    };

    useEffect(() => {
        if (isOpen) {
            setTemplateType(initialTemplateType);
            setMessage(buildTemplateContent(initialTemplateType));
            setCopied(false);
        }
    }, [isOpen, initialTemplateType, customerName, repair, settings]);

    const handleTypeChange = (type) => {
        setTemplateType(type);
        setMessage(buildTemplateContent(type));
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Error al copiar:', err);
        }
    };

    const handleSend = () => {
        if (!hasPhone) return;
        openWhatsApp(cleanPhone, message);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="wa-modal-overlay" onClick={onClose}>
            <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="wa-modal-header">
                    <div className="wa-modal-title">
                        <MessageSquare size={20} className="text-primary" />
                        <span>Notificar por WhatsApp</span>
                    </div>
                    <button 
                        type="button" 
                        className="btn btn-ghost btn-sm btn-icon" 
                        onClick={onClose} 
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Destinatario */}
                <div className="wa-modal-recipient">
                    <div>
                        <div className="wa-recipient-name">{customerName || 'Cliente sin nombre'}</div>
                        <div className="wa-recipient-meta">
                            Folio: {repair?.ticket_number || 'N/A'} - {fullDeviceName}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        {hasPhone ? (
                            <span className="wa-phone-badge">
                                +{cleanPhone}
                            </span>
                        ) : (
                            <span 
                                style={{ 
                                    color: '#ef4444', 
                                    fontSize: '12px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px' 
                                }}
                            >
                                <AlertTriangle size={13} /> Sin teléfono
                            </span>
                        )}
                    </div>
                </div>

                {/* Selector de plantilla */}
                <div style={{ marginBottom: '14px' }}>
                    <label className="wa-section-label">
                        Seleccionar plantilla
                    </label>
                    <div className="wa-template-grid">
                        <button
                            type="button"
                            className={`wa-template-btn ${templateType === 'ready' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('ready')}
                        >
                            Listo para entrega
                        </button>
                        <button
                            type="button"
                            className={`wa-template-btn ${templateType === 'status' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('status')}
                        >
                            Cambio de estado
                        </button>
                        <button
                            type="button"
                            className={`wa-template-btn ${templateType === 'budget' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('budget')}
                        >
                            Cotización lista
                        </button>
                        <button
                            type="button"
                            className={`wa-template-btn ${templateType === 'custom' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('custom')}
                        >
                            Personalizado
                        </button>
                    </div>
                </div>

                {/* Mensaje editable */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="wa-section-label" style={{ marginBottom: 0 }}>
                            Mensaje a enviar
                        </label>
                        <span className="wa-char-count">
                            {message.length} caracteres
                        </span>
                    </div>
                    <textarea
                        className="wa-textarea"
                        rows="5"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                </div>

                {!hasPhone && (
                    <div className="wa-warning-alert">
                        <AlertTriangle size={16} />
                        <span>Este cliente no tiene un teléfono registrado. Puedes copiar el mensaje manualmente.</span>
                    </div>
                )}

                {/* Botones de acción */}
                <div className="wa-actions-row">
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleCopy}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        <span>{copied ? 'Copiado' : 'Copiar texto'}</span>
                    </button>

                    <div className="wa-actions-group">
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={onClose}
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleSend}
                            disabled={!hasPhone}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            <ExternalLink size={14} />
                            <span>Abrir WhatsApp</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

