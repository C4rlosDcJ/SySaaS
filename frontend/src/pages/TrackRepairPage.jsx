import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Search, Smartphone, Package, ChevronLeft, Calendar, FileText, Settings, User, Phone, CheckCircle, Clock, Tag, CreditCard, Shield, AlertTriangle, ListTodo, Wrench } from 'lucide-react';
import { publicService } from '../services/api';
import Navbar from '../components/Navbar';
import Tilt3DCard from '../components/Tilt3DCard';
import { useTheme } from '../context/ThemeContext';
import './TrackRepairPage.css';

function TrackRepairPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { businessName } = useTheme();
    
    const [ticketId, setTicketId] = useState(new URLSearchParams(location.search).get('ticketId') || '');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!ticketId.trim()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const data = await publicService.trackRepair(ticketId);
            setResult(data);
        } catch (err) {
            setError(err.message || 'No encontramos ningún registro con ese código.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (ticketId && !result && !loading && !error) {
            handleSearch();
        }
        // eslint-disable-next-line
    }, []);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const translateStatus = (statusStr) => {
        if (!statusStr) return 'Pendiente';
        const clean = statusStr.toLowerCase().trim();
        const map = {
            'received': 'Recibido',
            'recibido': 'Recibido',
            'diagnosing': 'En Revisión',
            'en revisión': 'En Revisión',
            'en revision': 'En Revisión',
            'waiting_approval': 'Esperando Aprobación',
            'esperando aprobación': 'Esperando Aprobación',
            'esperando aprobacion': 'Esperando Aprobación',
            'waiting_parts': 'Esperando Refacciones',
            'esperando refacciones': 'Esperando Refacciones',
            'repairing': 'En Reparación',
            'en reparación': 'En Reparación',
            'en reparacion': 'En Reparación',
            'quality_check': 'Control de Calidad',
            'control de calidad': 'Control de Calidad',
            'ready': 'Listo para Entrega',
            'ready_for_pickup': 'Listo para Entrega',
            'listo para entrega': 'Listo para Entrega',
            'listo': 'Listo para Entrega',
            'delivered': 'Entregado',
            'entregado': 'Entregado',
            'cancelled': 'Cancelado',
            'cancelado': 'Cancelado',
            'pendiente': 'Pendiente',
            'pending': 'Pendiente',
            'paid': 'Pagado',
            'pagado': 'Pagado',
            'shipped': 'Enviado',
            'enviado': 'Enviado',
            'completed': 'Completado',
            'completado': 'Completado'
        };
        return map[clean] || statusStr;
    };

    const getStatusClass = (statusStr) => {
        if (!statusStr) return 'status-received';
        const clean = statusStr.toLowerCase().trim();
        if (clean.includes('recibido') || clean.includes('received')) return 'status-received';
        if (clean.includes('revisión') || clean.includes('revision') || clean.includes('diagnosing')) return 'status-diagnosing';
        if (clean.includes('aprobación') || clean.includes('aprobacion') || clean.includes('approval')) return 'status-waiting_approval';
        if (clean.includes('refacciones') || clean.includes('parts')) return 'status-waiting_parts';
        if (clean.includes('reparación') || clean.includes('reparacion') || clean.includes('repairing')) return 'status-repairing';
        if (clean.includes('calidad') || clean.includes('quality')) return 'status-quality_check';
        if (clean.includes('listo') || clean.includes('ready')) return 'status-ready';
        if (clean.includes('entregado') || clean.includes('delivered') || clean.includes('completado') || clean.includes('completed')) return 'status-delivered';
        if (clean.includes('cancelado') || clean.includes('cancelled')) return 'status-cancelled';
        return 'status-received';
    };

    const repair = (result && result.is_sale && result.repair) ? result.repair : result;

    const getRemainingWarrantyDays = () => {
        if (!repair || !repair.warranty_expires) return null;
        const expiry = new Date(repair.warranty_expires);
        const today = new Date();
        expiry.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const isRepair = result && result.is_repair;
    const isSale = result && result.is_sale;
    const rawStatus = isRepair ? (repair?.status || 'Pendiente') : (result?.status || 'Pendiente');
    const displayStatus = translateStatus(rawStatus);

    const remainingWarranty = isRepair ? getRemainingWarrantyDays() : null;

    // Repair Steps
    const repairSteps = [
        { id: 'Recibido', label: 'Recibido', icon: <Package size={18} /> },
        { id: 'En Revisión', label: 'Revisión', icon: <Search size={18} /> },
        { id: 'En Reparación', label: 'Reparación', icon: <Settings size={18} /> },
        { id: 'Listo para Entrega', label: 'Listo', icon: <CheckCircle size={18} /> },
        { id: 'Entregado', label: 'Entregado', icon: <User size={18} /> }
    ];

    // Sale Steps
    const saleSteps = [
        { id: 'Pendiente', label: 'Pendiente', icon: <Clock size={18} /> },
        { id: 'Pagado', label: 'Pagado', icon: <CheckCircle size={18} /> },
        { id: 'Enviado', label: 'Enviado', icon: <Package size={18} /> },
        { id: 'Completado', label: 'Completado', icon: <User size={18} /> }
    ];

    const currentSteps = isRepair ? repairSteps : saleSteps;
    
    // Find active step index based on translated status mapping
    const getActiveStepIndex = () => {
        const currentMapped = displayStatus;
        if (isRepair) {
            if (currentMapped === 'Recibido') return 0;
            if (currentMapped === 'En Revisión') return 1;
            if (currentMapped === 'Esperando Aprobación' || currentMapped === 'Esperando Refacciones' || currentMapped === 'En Reparación' || currentMapped === 'Control de Calidad') return 2;
            if (currentMapped === 'Listo para Entrega') return 3;
            if (currentMapped === 'Entregado') return 4;
            return 0;
        } else {
            if (currentMapped === 'Pendiente') return 0;
            if (currentMapped === 'Pagado') return 1;
            if (currentMapped === 'Enviado') return 2;
            if (currentMapped === 'Completado') return 3;
            return 0;
        }
    };

    const activeIndex = getActiveStepIndex();
    const progressWidth = (activeIndex / (currentSteps.length - 1)) * 100;

    const translateChecklist = (checklist) => {
        if (!checklist) return null;
        try {
            const parsed = typeof checklist === 'string' ? JSON.parse(checklist) : checklist;
            return Object.entries(parsed).map(([key, value]) => {
                const label = key
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase());
                return { label, ok: !!value };
            });
        } catch (e) {
            return null;
        }
    };

    const checklistItems = isRepair ? translateChecklist(repair.function_checklist) : null;

    return (
        <div className="public-track-page">
            <Navbar />
            
            <main className="track-container animate-fadeIn" style={{ paddingTop: '90px' }}>
                <div className="track-header-section">
                    
                    <span className="nothing-badge pixel-font" style={{ marginBottom: '12px' }}>
                        <span className="glyph-dot" />
                        <span>(01) RASTREO PÚBLICO EN TIEMPO REAL</span>
                    </span>

                    <h1 style={{ marginTop: '8px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        Consulta de Servicio Técnico
                    </h1>
                    <p className="text-muted font-mono" style={{ fontSize: '13px' }}>
                        Ingresa el folio del ticket (ej. REP-1001) para verificar el estatus y diagnóstico del equipo.
                    </p>

                    <div className="track-search-card mt-md">
                        <form className="track-search-form" onSubmit={handleSearch}>
                            <div className="search-box">
                                <Search className="search-icon" size={18} />
                                <input
                                    type="text"
                                    className="input font-mono"
                                    placeholder="Ej. REP-1001 o VTA-1002"
                                    value={ticketId}
                                    onChange={(e) => setTicketId(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ borderRadius: '9999px', padding: '0 22px' }}>
                                Buscar
                            </button>
                        </form>
                        {error && (
                            <div className="error-message mt-sm text-center font-mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <AlertTriangle size={15} />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                </div>

                {loading && (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p style={{ marginTop: '12px', fontSize: '13px' }}>Buscando información en la red...</p>
                    </div>
                )}

                {result && !loading && (
                    <div className="track-content animate-slideUp">
                        
                        {/* =====================================================
                           REPAIR VIEW WITH 3D TILT CARD
                           ===================================================== */}
                        {isRepair && (
                            <>
                                {/* Header Info */}
                                <Tilt3DCard className="card result-card-header mb-md">
                                    <div className="flex items-center justify-between gap-md flex-col-mobile" style={{ padding: '8px' }}>
                                        <div className="flex items-center gap-md">
                                            <div className="device-avatar">
                                                <Smartphone size={24} />
                                            </div>
                                            <div>
                                                <span className="text-primary font-bold text-xs uppercase tracking-wider block">
                                                    ORDEN DE REPARACIÓN
                                                </span>
                                                <h2 className="card-title m-0" style={{ fontSize: '18px', fontWeight: 800 }}>
                                                    {repair.brand_name === 'Otro' ? repair.brand_other : repair.brand_name} {repair.model}
                                                </h2>
                                                <p className="text-muted m-0 font-mono text-sm" style={{ color: 'var(--color-primary)' }}>
                                                    FOLIO: {repair.ticket_number || ticketId}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="status-badge-container">
                                            <span className={`status-badge ${getStatusClass(rawStatus)} pixel-font`} style={{ padding: '6px 14px', borderRadius: '9999px', fontSize: '12px' }}>
                                                {displayStatus}
                                            </span>
                                        </div>
                                    </div>
                                </Tilt3DCard>

                                {/* Banner de garantía si es ingreso por garantía */}
                                {repair.parent_repair_id && (
                                    <div className="card mb-md" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,163,74,0.05))', borderLeft: '4px solid #22c55e', padding: '14px 18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Shield size={20} style={{ color: '#22c55e' }} />
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 700, color: '#22c55e', fontSize: '14px' }}>Ingreso por Garantía</p>
                                                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-text-muted, #999)' }}>
                                                    Este servicio está cubierto por la garantía del ticket original <strong style={{ color: 'var(--color-text, #fff)' }}>#{repair.parent_ticket_number}</strong> — sin costo adicional.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Timeline */}
                                <div className="card mb-md">
                                    <div className="flex justify-between items-center mb-md flex-col-mobile">
                                        <h3 className="card-title font-bold text-base">Progreso de tu Reparación</h3>
                                        <span className="text-sm text-muted flex items-center gap-sm">
                                            <Calendar size={14} /> Actualizado: {formatDate(repair.updated_at || repair.created_at)}
                                        </span>
                                    </div>
                                    
                                    <div className="timeline-wrapper">
                                        <div className="timeline-line-background"></div>
                                        <div className="timeline-line-fill" style={{ width: `${progressWidth}%` }}></div>
                                        
                                        <div className="timeline-steps">
                                            {currentSteps.map((step, idx) => {
                                                const isCompleted = idx < activeIndex;
                                                const isActive = idx === activeIndex;
                                                
                                                return (
                                                    <div key={step.id} className={`timeline-step-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                                                        <div className="timeline-icon-container">
                                                            {step.icon}
                                                        </div>
                                                        <span className="timeline-label">{step.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-2 mb-md">
                                    {/* Client Details */}
                                    <div className="card">
                                        <h3 className="card-title text-base mb-md flex items-center gap-sm">
                                            <User size={18} className="text-primary" /> Datos del Cliente
                                        </h3>
                                        <div className="info-list">
                                            <div className="info-item">
                                                <span className="info-label text-muted">Nombre</span>
                                                <span className="info-value font-bold">{result.customer_first_name || repair.customer_first_name || result.first_name || repair.first_name || 'Mostrador'} {result.customer_last_name || repair.customer_last_name || result.last_name || repair.last_name || ''}</span>
                                            </div>
                                            <div className="info-item">
                                                <span className="info-label text-muted">Fecha de Ingreso</span>
                                                <span className="info-value">{formatDate(repair.created_at || result.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Details */}
                                    <div className="card">
                                        <h3 className="card-title text-base mb-md flex items-center gap-sm">
                                            <Tag size={18} className="text-primary" /> Costos y Presupuesto
                                        </h3>
                                        <div className="info-list">
                                            <div className="info-item">
                                                <span className="info-label text-muted">Presupuesto Total</span>
                                                <span className="info-value font-bold">{formatCurrency(repair.total_cost)}</span>
                                            </div>
                                            {parseFloat(repair.total_cost) - parseFloat(repair.advance_payment || 0) > 0 && (
                                                <div className="info-item total-highlight">
                                                    <span className="info-label font-bold text-primary">Resta por Pagar</span>
                                                    <span className="info-value font-bold text-primary">
                                                        {formatCurrency(parseFloat(repair.total_cost) - parseFloat(repair.advance_payment || 0))}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Checklist & Extra Info */}
                                <div className="grid grid-2 mb-md">
                                    {/* Checklist */}
                                    {checklistItems && checklistItems.length > 0 && (
                                        <div className="card">
                                            <h3 className="card-title text-base mb-md flex items-center gap-sm">
                                                <ListTodo size={18} className="text-primary" /> Inspección de Funciones
                                            </h3>
                                            <div className="checklist-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                {checklistItems.map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-sm" style={{ fontSize: 'var(--font-sm)' }}>
                                                        <span style={{ color: item.ok ? 'var(--color-success)' : 'var(--color-error)' }}>
                                                            {item.ok ? '✓' : '✗'}
                                                        </span>
                                                        <span className="text-muted">{item.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tech Details */}
                                    <div className="card">
                                        <h3 className="card-title text-base mb-md flex items-center gap-sm">
                                            <Shield size={18} className="text-primary" /> Detalles y Garantía
                                        </h3>
                                        <div className="info-list">
                                            <div className="info-item">
                                                <span className="info-label text-muted">Tipo de Equipo</span>
                                                <span className="info-value">{repair.device_type_name || 'Dispositivo'}</span>
                                            </div>
                                            {repair.physical_condition && (
                                                <div className="info-item">
                                                    <span className="info-label text-muted">Estado Estético</span>
                                                    <span className="info-value">{repair.physical_condition} / 5</span>
                                                </div>
                                            )}
                                            {repair.estimated_delivery && (
                                                <div className="info-item">
                                                    <span className="info-label text-muted">Entrega Estimada</span>
                                                    <span className="info-value font-bold text-primary">{formatDate(repair.estimated_delivery)}</span>
                                                </div>
                                            )}
                                            <div className="info-item">
                                                <span className="info-label text-muted">Días de Garantía</span>
                                                <span className="info-value">{repair.warranty_days || 30} días</span>
                                            </div>
                                            {repair.warranty_expires && (
                                                <div className="info-item">
                                                    <span className="info-label text-muted">Vence el</span>
                                                    <span className="info-value font-bold">{new Date(repair.warranty_expires).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                            {remainingWarranty !== null && (
                                                <div className="info-item">
                                                    <span className="info-label text-muted">Garantía Restante</span>
                                                    <span className={`info-value font-bold ${remainingWarranty > 0 ? 'text-success' : 'text-error'}`}>
                                                        {remainingWarranty > 0 ? `${remainingWarranty} días` : 'Expirada'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Observations */}
                                {(repair.problem_description || repair.technical_observations || repair.existing_damage) && (
                                    <div className="card mb-md">
                                        <h3 className="card-title text-base mb-md">Reporte de Estado</h3>
                                        {repair.problem_description && (
                                            <div className="notes-block mb-sm">
                                                <span className="text-xs text-muted block font-bold uppercase tracking-wider">Falla Reportada</span>
                                                <p className="m-0 mt-xs">{repair.problem_description}</p>
                                            </div>
                                        )}
                                        {repair.existing_damage && (
                                            <div className="notes-block mb-sm">
                                                <span className="text-xs text-muted block font-bold uppercase tracking-wider">Daños Existentes</span>
                                                <p className="m-0 mt-xs">{repair.existing_damage}</p>
                                            </div>
                                        )}
                                        {repair.technical_observations && (
                                            <div className="notes-block">
                                                <span className="text-xs text-muted block font-bold uppercase tracking-wider">Observaciones Técnicas</span>
                                                <p className="m-0 mt-xs">{repair.technical_observations}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* If this is also a sale, show sale details and items list below */}
                                {isSale && (
                                    <>
                                        <div className="card mb-md">
                                            <h3 className="card-title text-base mb-md flex items-center gap-sm">
                                                <CreditCard size={18} className="text-primary" /> Datos del Pago / Venta
                                            </h3>
                                            <div className="info-list">
                                                <div className="info-item">
                                                    <span className="info-label text-muted">Folio de Venta</span>
                                                    <span className="info-value font-bold">{result.sale_number}</span>
                                                </div>
                                                <div className="info-item">
                                                    <span className="info-label text-muted">Fecha de Pago</span>
                                                    <span className="info-value">{formatDate(result.created_at)}</span>
                                                </div>
                                                <div className="info-item">
                                                    <span className="info-label text-muted">Total de Adquisición</span>
                                                    <span className="info-value font-bold">{formatCurrency(result.total)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {result.items && result.items.length > 0 && (
                                            <div className="card mb-md">
                                                <h3 className="card-title text-base mb-md">Detalles de la Adquisición</h3>
                                                <div className="table-container">
                                                    <table className="table">
                                                        <thead>
                                                            <tr>
                                                                <th>Descripción</th>
                                                                <th className="text-center">Cantidad</th>
                                                                <th className="text-right">Precio Unitario</th>
                                                                <th className="text-right">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {result.items.map((item, idx) => (
                                                                <tr key={idx}>
                                                                    <td>
                                                                        <span className="font-bold block">{item.description}</span>
                                                                        {item.sku && <span className="text-xs text-muted">SKU: {item.sku}</span>}
                                                                    </td>
                                                                    <td className="text-center">{item.quantity}</td>
                                                                    <td className="text-right">{formatCurrency(item.unit_price || item.price)}</td>
                                                                    <td className="text-right">{formatCurrency(item.total)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* =====================================================
                           PURE SALE VIEW
                           ===================================================== */}
                        {isSale && !isRepair && (
                            <>
                                {/* Header Info */}
                                <div className="card result-card-header mb-md">
                                    <div className="flex items-center justify-between gap-md flex-col-mobile">
                                        <div className="flex items-center gap-md">
                                            <div className="device-avatar">
                                                <Package size={24} />
                                            </div>
                                            <div>
                                                <span className="text-primary font-bold text-xs uppercase tracking-wider block">
                                                    Comprobante de Venta
                                                </span>
                                                <h2 className="card-title m-0">
                                                    Folio de Venta: {result.sale_number || ticketId}
                                                </h2>
                                                <p className="text-muted m-0 text-sm">
                                                    Cajero: {result.cashier_first_name || ''} {result.cashier_last_name || ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="status-badge-container">
                                            <span className={`status-badge ${getStatusClass(rawStatus)}`}>
                                                {displayStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Timeline */}
                                <div className="card mb-md">
                                    <div className="flex justify-between items-center mb-md flex-col-mobile">
                                        <h3 className="card-title font-bold text-base">Estado del Pedido</h3>
                                        <span className="text-sm text-muted flex items-center gap-sm">
                                            <Calendar size={14} /> Fecha de Venta: {formatDate(result.created_at)}
                                        </span>
                                    </div>
                                    
                                    <div className="timeline-wrapper">
                                        <div className="timeline-line-background"></div>
                                        <div className="timeline-line-fill" style={{ width: `${progressWidth}%` }}></div>
                                        
                                        <div className="timeline-steps">
                                            {currentSteps.map((step, idx) => {
                                                const isCompleted = idx < activeIndex;
                                                const isActive = idx === activeIndex;
                                                
                                                return (
                                                    <div key={step.id} className={`timeline-step-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                                                        <div className="timeline-icon-container">
                                                            {step.icon}
                                                        </div>
                                                        <span className="timeline-label">{step.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-2 mb-md">
                                    {/* Client Details */}
                                    <div className="card">
                                        <h3 className="card-title text-base mb-md flex items-center gap-sm">
                                            <User size={18} className="text-primary" /> Datos del Comprador
                                        </h3>
                                        <div className="info-list">
                                            <div className="info-item">
                                                <span className="info-label text-muted">Nombre</span>
                                                <span className="info-value font-bold">{result.customer_first_name || 'Venta de Mostrador'} {result.customer_last_name || ''}</span>
                                            </div>
                                            <div className="info-item">
                                                <span className="info-label text-muted">Email</span>
                                                <span className="info-value">{result.customer_email || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transaction Details */}
                                    <div className="card">
                                        <h3 className="card-title text-base mb-md flex items-center gap-sm">
                                            <CreditCard size={18} className="text-primary" /> Resumen de Pago
                                        </h3>
                                        <div className="info-list">
                                            <div className="info-item">
                                                <span className="info-label text-muted">Total de la Venta</span>
                                                <span className="info-value font-bold">{formatCurrency(result.total)}</span>
                                            </div>
                                            {parseFloat(result.total) - parseFloat(result.paidAmount || result.total) > 0 && (
                                                <div className="info-item total-highlight">
                                                    <span className="info-label font-bold text-primary">Resta por Pagar</span>
                                                    <span className="info-value font-bold text-primary">
                                                        {formatCurrency(parseFloat(result.total) - parseFloat(result.paidAmount || result.total))}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                    {/* If sale is linked to a repair, show repair info card */}
                                    {result.repair_ticket && (
                                        <div className="card mb-md">
                                            <h3 className="card-title text-base mb-md flex items-center gap-sm">
                                                <Smartphone size={18} className="text-primary" /> Reparación Vinculada
                                            </h3>
                                            <div className="info-list">
                                                <div className="info-item">
                                                    <span className="info-label text-muted">Folio de Reparación</span>
                                                    <span className="info-value font-bold text-primary">{result.repair_ticket}</span>
                                                </div>
                                                <div className="info-item">
                                                    <span className="info-label text-muted">Días de Garantía</span>
                                                    <span className="info-value">{result.repair_warranty_days || 30} días</span>
                                                </div>
                                                {result.repair_warranty_expires && (
                                                    <div className="info-item">
                                                        <span className="info-label text-muted">Garantía Restante</span>
                                                        <span className={`info-value font-bold ${
                                                            (() => {
                                                                const expiry = new Date(result.repair_warranty_expires);
                                                                const today = new Date();
                                                                expiry.setHours(0,0,0,0);
                                                                today.setHours(0,0,0,0);
                                                                const diffTime = expiry - today;
                                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                                return diffDays > 0 ? 'text-success' : 'text-error';
                                                            })()
                                                        }`}>
                                                            {(() => {
                                                                const expiry = new Date(result.repair_warranty_expires);
                                                                const today = new Date();
                                                                expiry.setHours(0,0,0,0);
                                                                today.setHours(0,0,0,0);
                                                                const diffTime = expiry - today;
                                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                                return diffDays > 0 ? `${diffDays} días` : 'Expirada';
                                                            })()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items list */}
                                {result.items && result.items.length > 0 && (
                                    <div className="card mb-md">
                                        <h3 className="card-title text-base mb-md">Lista de Productos</h3>
                                        <div className="table-container">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Descripción</th>
                                                        <th className="text-center">Cantidad</th>
                                                        <th className="text-right">Precio Unitario</th>
                                                        <th className="text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.items.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td>
                                                                <span className="font-bold block">{item.description}</span>
                                                                {item.sku && <span className="text-xs text-muted">SKU: {item.sku}</span>}
                                                            </td>
                                                            <td className="text-center">{item.quantity}</td>
                                                            <td className="text-right">{formatCurrency(item.unit_price || item.price)}</td>
                                                            <td className="text-right">{formatCurrency(item.total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* WhatsApp Support Contact Action */}
                        <div className="flex items-center justify-center gap-md flex-col-mobile">
                            <a href="https://wa.me/521234567890" target="_blank" rel="noreferrer" className="btn btn-primary w-full-mobile">
                                <Phone size={16} /> Contactar Soporte por WhatsApp
                            </a>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="footer" style={{ marginTop: '60px' }}>
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-brand">
                            <div className="footer-logo">
                                <Wrench size={24} className="text-primary" />
                                <span>{businessName || 'SySaaS'}</span>
                            </div>
                            <p>Servicio técnico profesional para todos tus dispositivos electrónicos.</p>
                        </div>
                        <div className="footer-links">
                            <div className="footer-col">
                                <h4>Servicios</h4>
                                <Link to="/#servicios">Celulares</Link>
                                <Link to="/#servicios">Laptops</Link>
                                <Link to="/#servicios">Consolas</Link>
                            </div>
                            <div className="footer-col">
                                <h4>Empresa</h4>
                                <Link to="/#proceso">Proceso</Link>
                                <Link to="/#contacto">Contacto</Link>
                                <Link to="/rastrear">Rastrear</Link>
                            </div>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>© {new Date().getFullYear()} {businessName || 'SySaaS'}. Todos los derechos reservados.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default TrackRepairPage;
