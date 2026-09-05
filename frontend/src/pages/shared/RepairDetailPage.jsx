import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { repairService, userService, settingsService, uploadService, posService, BACKEND_URL } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { STATUS_LABELS, STATUS_COLORS, formatCurrency, formatDate } from '../../utils/constants';
import {
    Wrench, Clock, User, MessageSquare, AlertCircle, CheckCircle2,
    ChevronLeft, Smartphone, CreditCard, ShieldCheck, Send, Plus, X,
    Image as ImageIcon, DollarSign, Save as SaveIcon, ClipboardCheck,
    Printer, PenTool, Edit3, ShoppingCart, Star, Camera
} from 'lucide-react';
import SignatureModal from '../../components/common/SignatureModal';
import CameraCaptureModal from '../../components/CameraCaptureModal';
import { generateServiceTicket } from '../../utils/pdfGenerator';
import PrintReceipt from '../../components/common/PrintReceipt';
import './RepairDetailPage.css';

export default function RepairDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAdmin, user } = useAuth();
    
    const [repair, setRepair] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [technicians, setTechnicians] = useState([]);
    const [settings, setSettings] = useState({});

    const [newStatus, setNewStatus] = useState('');
    const [statusNote, setStatusNote] = useState('');
    const [warrantyDays, setWarrantyDays] = useState(30);

    const [costs, setCosts] = useState({ diagnosis_cost: 0, labor_cost: 0, parts_cost: 0, discount: 0 });
    const [isEditingCosts, setIsEditingCosts] = useState(false);
    
    const [uploadingImages, setUploadingImages] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [showSigModal, setShowSigModal] = useState(false);
    const [sigType, setSigType] = useState(null);
    const [showPrintReceipt, setShowPrintReceipt] = useState(false);
    const [receiptType, setReceiptType] = useState('repair');
    const [receiptData, setReceiptData] = useState(null);

    const [isEditingTechnical, setIsEditingTechnical] = useState(false);
    const [technicalData, setTechnicalData] = useState({});
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const [isEditingInspection, setIsEditingInspection] = useState(false);
    const [inspectionData, setInspectionData] = useState({});

    const [noteText, setNoteText] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [addingNote, setAddingNote] = useState(false);

    // States for client review
    const [clientRating, setClientRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(0);
    const [clientReviewText, setClientReviewText] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    // States for warranty claims
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [warrantyProblem, setWarrantyProblem] = useState('');
    const [warrantyPriority, setWarrantyPriority] = useState('normal');
    const [warrantyDeliveryDate, setWarrantyDeliveryDate] = useState('');
    const [warrantyObservations, setWarrantyObservations] = useState('');
    const [submittingWarranty, setSubmittingWarranty] = useState(false);

    const handleClaimWarrantySubmit = async (e) => {
        e.preventDefault();
        if (!warrantyProblem.trim()) return;

        try {
            setSubmittingWarranty(true);
            const res = await repairService.claimWarranty(id, {
                problem_description: warrantyProblem,
                priority: warrantyPriority,
                estimated_delivery: warrantyDeliveryDate,
                technical_observations: warrantyObservations
            });
            alert('¡Ingreso por garantía registrado con éxito!');
            setShowWarrantyModal(false);
            setWarrantyProblem('');
            setWarrantyObservations('');
            navigate(isAdmin ? `/admin/repairs/${res.repair.id}` : `/dashboard/reparaciones/${res.repair.id}`);
        } catch (err) {
            alert('Error al registrar garantía: ' + err.message);
        } finally {
            setSubmittingWarranty(false);
        }
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!clientRating) return;
        try {
            setSubmittingReview(true);
            await repairService.submitReview(id, clientRating, clientReviewText);
            alert('¡Muchas gracias por tu reseña!');
            await fetchRepairData();
        } catch (err) {
            alert('Error al enviar reseña: ' + err.message);
        } finally {
            setSubmittingReview(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            await fetchRepairData();
            if (isAdmin) {
                await fetchTechnicians();
                await fetchSettings();
            }
        };
        loadData();
    }, [id, isAdmin]);

    const fetchSettings = async () => {
        try { setSettings(await settingsService.getAll()); } catch (err) {}
    };

    const fetchTechnicians = async () => {
        try { setTechnicians(await userService.getTechnicians() || []); } catch (err) {}
    };

    const fetchRepairData = async () => {
        try {
            setLoading(true);
            const data = await repairService.getById(id);
            setRepair(data);
            setNewStatus(data.status);
            setWarrantyDays(data.warranty_days);
            setCosts({
                diagnosis_cost: data.diagnosis_cost || 0,
                labor_cost: data.labor_cost || 0,
                parts_cost: data.parts_cost || 0,
                discount: data.discount || 0
            });
            setTechnicalData({
                battery_health: data.battery_health || '',
                screen_status: data.screen_status || '',
                account_status: data.account_status || '',
                technical_observations: data.technical_observations || '',
                physical_condition: data.physical_condition || 5,
                accessories_received: data.accessories_received || '',
                existing_damage: data.existing_damage || '',
                technician_id: data.technician_id || '',
                model: data.model || '',
                color: data.color || '',
                imei: data.imei || '',
                serial_number: data.serial_number || '',
                storage_capacity: data.storage_capacity || '',
                device_password: data.device_password || '',
                problem_description: data.problem_description || '',
                priority: data.priority || 'normal',
                service_requested: data.service_requested || '',
                estimated_delivery: data.estimated_delivery ? data.estimated_delivery.split('T')[0] : ''
            });
            setInspectionData({
                physical_condition: data.physical_condition || 5,
                accessories_received: data.accessories_received || '',
                existing_damage: data.existing_damage || '',
                technical_observations: data.technical_observations || ''
            });
            setError(null);
        } catch (err) {
            setError('No se pudo cargar la información de la reparación.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignatureSave = async (signatureData) => {
        setShowSigModal(false);
        try {
            setUpdatingStatus(true);
            if (sigType === 'approval') {
                const note = signatureData ? 'Cotización aprobada por el cliente con firma' : 'Cotización aprobada por el cliente (sin firma)';
                await repairService.updateStatus(id, 'repairing', note, technicalData.estimated_delivery, signatureData);
                alert('¡Reparación aprobada correctamente!');
            } else if (sigType === 'delivery') {
                const note = signatureData ? 'Equipo entregado al cliente con firma' : 'Equipo entregado al cliente (sin firma)';
                await repairService.updateStatus(id, 'delivered', note, null, signatureData);
                
                // Cobro automático si no está pagada y tiene costo restante
                const balance = parseFloat(repair.total_cost) - parseFloat(repair.advance_payment || 0);
                if (repair.payment_status !== 'paid' && balance > 0) {
                    try {
                        const device = `${repair.brand_name || repair.brand_other || ''} ${repair.model || ''}`.trim();
                        const serviceName = repair.service_name || repair.service_requested || 'Reparación';
                        const description = `${serviceName} — ${device} (${repair.ticket_number})`;

                        const saleData = {
                            customer_id: repair.customer_id || null,
                            repair_id: repair.id,
                            items: [{
                                product_id: null,
                                service_id: null,
                                description: `Cobro automático de reparación: ${description}`,
                                quantity: 1,
                                unit_price: Math.max(0, balance),
                                discount: 0
                            }],
                            discount: 0,
                            payment_method: 'cash',
                            amount_received: Math.max(0, balance),
                            notes: 'Cobrado automáticamente al entregar equipo'
                        };
                        const saleResult = await posService.createSale(saleData);
                        const saleDetail = await posService.getSaleById(saleResult.sale.id);
                        
                        setReceiptData(saleDetail);
                        setReceiptType('pos');
                        setShowPrintReceipt(true);
                        alert('¡Equipo entregado, garantía activada y cobrado automáticamente en POS!');
                    } catch (posErr) {
                        console.error('Error al cobrar automáticamente en POS:', posErr);
                        alert('El equipo se entregó pero hubo un error al registrar el cobro en el POS: ' + posErr.message);
                    }
                } else {
                    alert('¡Equipo entregado y garantía activada!');
                }
            }
            await fetchRepairData();
        } catch (err) { alert('Error al actualizar estado: ' + err.message); } 
        finally { setUpdatingStatus(false); }
    };

    const handlePrintTicket = async () => {
        try { await generateServiceTicket(repair, settings); } 
        catch (error) { alert('No se pudo generar el ticket. Por favor intenta de nuevo.'); }
    };

    const handleUpdateInspection = async (e) => {
        if(e) e.preventDefault();
        try {
            setUpdatingStatus(true);
            await repairService.update(id, inspectionData);
            setIsEditingInspection(false);
            await fetchRepairData();
            alert('Inspección inicial actualizada correctamente.');
        } catch (err) {
            alert('Error al actualizar la inspección: ' + err.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleUpdateStatus = async (e) => {
        if(e) e.preventDefault();
        try {
            setUpdatingStatus(true);
            const updates = {};
            if (parseInt(warrantyDays) !== parseInt(repair.warranty_days)) updates.warranty_days = warrantyDays;

            if (isEditingCosts) {
                updates.diagnosis_cost = Number(costs.diagnosis_cost) || 0;
                updates.labor_cost = Number(costs.labor_cost) || 0;
                updates.parts_cost = Number(costs.parts_cost) || 0;
                updates.discount = Number(costs.discount) || 0;
            }

            if (isEditingTechnical) {
                Object.assign(updates, technicalData);
                if(!updates.estimated_delivery) updates.estimated_delivery = null;
            }

            if (Object.keys(updates).length > 0) await repairService.update(id, updates);

            if (newStatus !== repair.status) {
                if (newStatus === 'delivered') {
                    const balance = parseFloat(repair.total_cost) - parseFloat(repair.advance_payment || 0);
                    if (repair.payment_status !== 'paid' && balance > 0) {
                        navigate(`/admin/pos?repair_id=${repair.id}`);
                        setIsEditingCosts(false);
                        setIsEditingTechnical(false);
                        setUpdatingStatus(false);
                        return;
                    }
                    setSigType('delivery');
                    setShowSigModal(true);
                    setIsEditingCosts(false);
                    setIsEditingTechnical(false);
                    setUpdatingStatus(false);
                    await fetchRepairData();
                    return;
                }
                await repairService.updateStatus(id, newStatus, statusNote);
                setStatusNote('');
            }

            setIsEditingCosts(false); setIsEditingTechnical(false);
            await fetchRepairData();
        } catch (err) { alert('Error al actualizar: ' + err.message); } 
        finally { setUpdatingStatus(false); }
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        try {
            setUploadingImages(true);
            await uploadService.uploadImages(id, files, 'during');
            await fetchRepairData();
        } catch (err) { alert('Error al subir imágenes: ' + err.message); } 
        finally { setUploadingImages(false); }
    };

    const handleCameraUpload = async (files) => {
        const fileList = Array.isArray(files) ? files : [files];
        if (fileList.length === 0) return;
        try {
            setUploadingImages(true);
            await uploadService.uploadImages(id, fileList, 'during');
            await fetchRepairData();
        } catch (err) { alert('Error al subir imágenes: ' + err.message); }
        finally { setUploadingImages(false); }
    };

    const handleDeleteImage = async (imageId) => {
        if (!window.confirm('¿Estás seguro de eliminar esta imagen?')) return;
        try {
            await uploadService.deleteImage(imageId);
            await fetchRepairData();
        } catch (err) { alert('Error al eliminar imagen: ' + err.message); }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!noteText.trim()) return;
        try {
            setAddingNote(true);
            await repairService.addNote(id, noteText, isInternal);
            setNoteText(''); setIsInternal(false);
            await fetchRepairData();
        } catch (err) { alert('Error al agregar nota: ' + err.message); } 
        finally { setAddingNote(false); }
    };

    // Derived values
    const progressPercent = repair ? Math.min(100, Math.max(0, (Object.keys(STATUS_LABELS).indexOf(repair.status) / (Object.keys(STATUS_LABELS).length - 1)) * 100)) : 0;
    const currentStatusColor = repair ? (STATUS_COLORS[repair.status] || '#6b7280') : '#6b7280';
    const remainingWarranty = (() => {
        if (!repair || !repair.warranty_expires) return null;
        const expiry = new Date(repair.warranty_expires);
        const today = new Date();
        expiry.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        const diffTime = expiry - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    })();

    if (loading) return <div className="loading-state"><div className="spinner"></div><p>Cargando información...</p></div>;
    
    if (error || !repair) return (
        <div className="error-state">
            <AlertCircle size={48} color="var(--color-error)" />
            <h3>Error</h3><p>{error || 'Reparación no encontrada'}</p>
            <button onClick={() => navigate(-1)} className="btn btn-secondary">Regresar</button>
        </div>
    );

    return (
        <div className="repair-detail-page">
            
            {/* Banners de Vinculación de Garantías */}
            {repair.parent_repair_id && (
                <div className="card info-card" style={{ borderLeft: '4px solid var(--color-warning)', background: 'rgba(245, 158, 11, 0.05)', marginBottom: 'var(--sp-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={18} className="text-warning" />
                        <span>
                            Este equipo ingresó por <strong>Garantía</strong> de la reparación original{' '}
                            <Link to={`${isAdmin ? '/admin' : '/dashboard'}/reparaciones/${repair.parent_repair_id}`} style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                #{repair.parent_ticket}
                            </Link>.
                        </span>
                    </div>
                </div>
            )}

            {repair.child_warranties && repair.child_warranties.length > 0 && (
                <div className="card info-card" style={{ borderLeft: '4px solid var(--color-error)', background: 'rgba(230, 51, 88, 0.05)', marginBottom: 'var(--sp-4)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={18} className="text-primary" />
                            <strong>Reclamaciones de Garantía registradas para esta orden:</strong>
                        </div>
                        <ul style={{ margin: '8px 0 0 24px', padding: 0, fontSize: 'var(--font-sm)' }}>
                            {repair.child_warranties.map(child => (
                                <li key={child.id} style={{ marginBottom: '4px' }}>
                                    <Link to={`${isAdmin ? '/admin' : '/dashboard'}/reparaciones/${child.id}`} style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                        #{child.ticket_number}
                                    </Link> — Registrado el {formatDate(child.created_at)} ({STATUS_LABELS[child.status]})
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* ── Page Header & Progress Bar ── */}
            <header className="page-header detail-header">
                <div className="detail-header-top">
                    <div className="flex items-center gap-md">
                        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1>{repair.brand_name || repair.brand_other} {repair.model}</h1>
                            <p className="ticket-id">Ticket #{repair.ticket_number}</p>
                        </div>
                    </div>
                    <div className="detail-header-actions">
                        {(isAdmin || user?.role === 'technician') && (
                            <>
                                <button onClick={handlePrintTicket} className="btn btn-secondary">
                                    <Printer size={16} /> PDF Orden
                                </button>
                                <button onClick={() => { setReceiptType('repair'); setReceiptData(repair); setShowPrintReceipt(true); }} className="btn btn-secondary">
                                    <Printer size={16} /> Ticket
                                </button>
                            </>
                        )}
                        <span className={`badge big-badge status-${repair.status}`}>
                            {STATUS_LABELS[repair.status]}
                        </span>
                    </div>
                </div>

                {/* Progress Bar (Visual) */}
                <div className="status-progress-bar mt-lg">
                    <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progressPercent}%`, backgroundColor: 'var(--color-primary)' }} />
                    </div>
                </div>
            </header>

            {/* ── Action Cards (Admin update / Client approve) ── */}
            <div className="detail-action-cards">
                {isAdmin && (
                    <div className="card highlight-card">
                        <div className="card-header"><Edit3 size={18}/> <h3>Actualizar Estado</h3></div>
                        <div className="update-status-row">
                            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="select">
                                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <input type="text" placeholder="Nota opcional..." value={statusNote} onChange={e => setStatusNote(e.target.value)} className="input flex-1" />
                            <div className="warranty-input">
                                <span className="text-sm text-muted">Garantía (días):</span>
                                <input type="number" value={warrantyDays} onChange={e => setWarrantyDays(e.target.value)} className="input input-sm w-16 text-center" />
                            </div>
                            <button className="btn btn-primary" onClick={handleUpdateStatus} disabled={updatingStatus || (newStatus === repair.status && parseInt(warrantyDays) === parseInt(repair.warranty_days) && !isEditingCosts && !isEditingTechnical)}>
                                <SaveIcon size={16} /> {updatingStatus ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                )}


                {repair.status === 'waiting_approval' && !isAdmin && (
                    <div className="card warning-card">
                        <div className="card-header text-warning"><AlertCircle size={20} /> <h3>Aprobación Pendiente</h3></div>
                        <p className="mt-xs">El costo estimado es de <strong>{formatCurrency(repair.total_cost)}</strong>. Por favor confirma para proceder.</p>
                        <div className="flex gap-md mt-sm">
                            <button className="btn btn-primary" onClick={() => { setSigType('approval'); setShowSigModal(true); }} disabled={updatingStatus}><PenTool size={16} /> Aprobar</button>
                            <button className="btn btn-danger" onClick={async () => {
                                if (window.confirm('¿Rechazar esta cotización? La reparación será cancelada.')) {
                                    setUpdatingStatus(true);
                                    await repairService.updateStatus(id, 'cancelled', 'Rechazada por el cliente');
                                    await fetchRepairData();
                                    setUpdatingStatus(false);
                                }
                            }} disabled={updatingStatus}><X size={16} /> Rechazar</button>
                        </div>
                    </div>
                )}

                {repair.status === 'delivered' && !isAdmin && (
                    <div className="card success-card" style={{ marginTop: 'var(--sp-2)' }}>
                        <div className="card-header text-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Star size={20} fill={repair.rating ? 'var(--color-primary)' : 'none'} color="var(--color-primary)" />
                            <h3>{repair.rating ? 'Tu Reseña de la Reparación' : '¡Tu equipo está listo! Califica nuestro servicio'}</h3>
                        </div>
                        {repair.rating ? (
                            <div className="mt-sm">
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            size={20}
                                            fill={star <= repair.rating ? '#f59e0b' : 'none'}
                                            color={star <= repair.rating ? '#f59e0b' : 'var(--color-text-muted)'}
                                        />
                                    ))}
                                </div>
                                <p style={{ fontStyle: 'italic', color: 'var(--color-text-strong)', fontSize: 'var(--font-sm)', padding: 'var(--sp-2) 0' }}>
                                    "{repair.review_text || 'Sin comentarios adicionales.'}"
                                </p>
                                <p className="text-muted mt-xs" style={{ fontSize: 'var(--font-xs)' }}>
                                    ¡Gracias por tu opinión! Tu comentario nos ayuda a mejorar y se muestra en nuestra página principal.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleReviewSubmit} className="mt-sm">
                                <p className="text-muted" style={{ fontSize: 'var(--font-sm)', marginBottom: '12px' }}>
                                    Queremos conocer tu opinión. Por favor, selecciona una calificación y déjanos un comentario sobre el servicio recibido:
                                </p>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                                    <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>Calificación:</span>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setClientRating(star)}
                                                onMouseEnter={() => setHoverRating(star)}
                                                onMouseLeave={() => setHoverRating(0)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                            >
                                                <Star
                                                    size={24}
                                                    fill={(hoverRating || clientRating) >= star ? '#f59e0b' : 'none'}
                                                    color={(hoverRating || clientRating) >= star ? '#f59e0b' : 'var(--color-text-muted)'}
                                                    style={{ transition: 'transform 0.1s' }}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="input-group" style={{ marginBottom: '12px' }}>
                                    <label>Comentario o Reseña (Opcional)</label>
                                    <textarea
                                        className="input"
                                        placeholder="Ej. Excelente servicio, muy rápidos y profesionales. El equipo quedó como nuevo."
                                        value={clientReviewText}
                                        onChange={(e) => setClientReviewText(e.target.value)}
                                        rows="3"
                                        style={{ resize: 'vertical', width: '100%', padding: 'var(--sp-2)' }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={submittingReview || !clientRating}
                                    style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                                >
                                    {submittingReview ? 'Enviando...' : 'Enviar Reseña'}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>

            {/* ── Main Layout ── */}
            <div className="detail-layout mt-lg">
                <div className="detail-main-col">
                    
                    {/* Dispositivo y Servicio */}
                    <section className="card">
                        <div className="card-header spread">
                            <div className="flex items-center gap-xs"><Smartphone size={18} className="text-primary"/> <h3>Dispositivo y Servicio</h3></div>
                            {(isAdmin || user.role === 'technician') && (
                                <button onClick={() => setIsEditingTechnical(!isEditingTechnical)} className="btn btn-ghost btn-sm text-muted">
                                    {isEditingTechnical ? 'Cancelar' : 'Editar'}
                                </button>
                            )}
                        </div>
                        
                        <div className="info-grid mt-sm">
                            <div className="info-item">
                                <label>Dispositivo</label>
                                <span>{repair.device_type_name} — {repair.brand_name || repair.brand_other} {repair.model}</span>
                            </div>
                            <div className="info-item">
                                <label>Color y Capacidad</label>
                                {isEditingTechnical ? (
                                    <div className="flex gap-xs">
                                        <input type="text" className="input input-sm" value={technicalData.color} onChange={e => setTechnicalData({...technicalData, color: e.target.value})} placeholder="Color"/>
                                        <input type="text" className="input input-sm" value={technicalData.storage_capacity} onChange={e => setTechnicalData({...technicalData, storage_capacity: e.target.value})} placeholder="GB"/>
                                    </div>
                                ) : <span>{repair.color || 'N/A'} • {repair.storage_capacity ? repair.storage_capacity + 'GB' : 'N/A'}</span>}
                            </div>
                            <div className="info-item">
                                <label>IMEI / Serie</label>
                                {isEditingTechnical ? (
                                    <input type="text" className="input input-sm" value={technicalData.imei} onChange={e => setTechnicalData({...technicalData, imei: e.target.value})} />
                                ) : <span>{repair.imei || repair.serial_number || 'N/A'}</span>}
                            </div>
                            <div className="info-item">
                                <label>Contraseña / Patrón</label>
                                {isEditingTechnical ? (
                                    <input type="text" className="input input-sm" value={technicalData.device_password} onChange={e => setTechnicalData({...technicalData, device_password: e.target.value})} />
                                ) : <span>{repair.device_password || 'Ninguna'}</span>}
                            </div>
                            
                            <div className="info-item col-span-full">
                                <label>Problema Reportado</label>
                                {isEditingTechnical ? (
                                    <textarea className="input mt-xs" rows="2" value={technicalData.problem_description} onChange={e => setTechnicalData({...technicalData, problem_description: e.target.value})}></textarea>
                                ) : <p className="text-body mt-xs">{repair.problem_description}</p>}
                            </div>

                            <div className="divider col-span-full"></div>

                            <div className="info-item">
                                <label>Servicio Asignado</label>
                                {isEditingTechnical ? (
                                    <input type="text" className="input input-sm" value={technicalData.service_requested} onChange={e => setTechnicalData({...technicalData, service_requested: e.target.value})} />
                                ) : <span>{repair.service_name || repair.service_requested || 'General'}</span>}
                            </div>
                            <div className="info-item">
                                <label>Técnico a cargo</label>
                                {isEditingTechnical ? (
                                    <select className="select select-sm" value={technicalData.technician_id} onChange={e => setTechnicalData({...technicalData, technician_id: e.target.value})}>
                                        <option value="">No asignado</option>
                                        {technicians.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                                    </select>
                                ) : <span>{repair.technician_first_name ? `${repair.technician_first_name} ${repair.technician_last_name}` : 'No asignado'}</span>}
                            </div>
                            <div className="info-item">
                                <label>Prioridad</label>
                                {isEditingTechnical ? (
                                    <select className="select select-sm" value={technicalData.priority} onChange={e => setTechnicalData({...technicalData, priority: e.target.value})}>
                                        <option value="normal">Normal</option><option value="urgent">Urgente</option>
                                    </select>
                                ) : <span className={`badge ${repair.priority === 'urgent' ? 'bg-error-muted text-error' : 'bg-bg-elevated text-text'}`}>{repair.priority === 'urgent' ? 'Urgente' : 'Normal'}</span>}
                            </div>
                            <div className="info-item">
                                <label>Entrega Estimada</label>
                                {isEditingTechnical ? (
                                    <input type="date" className="input input-sm" value={technicalData.estimated_delivery} onChange={e => setTechnicalData({...technicalData, estimated_delivery: e.target.value})} />
                                ) : <span>{repair.estimated_delivery ? formatDate(repair.estimated_delivery).split(',')[0] : 'No definida'}</span>}
                            </div>
                        </div>

                        {isEditingTechnical && (
                            <div className="flex justify-end mt-md">
                                <button onClick={handleUpdateStatus} className="btn btn-primary" disabled={updatingStatus}>Guardar Cambios</button>
                            </div>
                        )}
                    </section>
                    
                    {/* Inspección */}
                    <section className="card">
                        <div className="card-header spread">
                            <div className="flex items-center gap-xs"><ClipboardCheck size={18} className="text-primary"/> <h3>Inspección Inicial</h3></div>
                            {(isAdmin || user?.role === 'technician') && (
                                <button onClick={() => setIsEditingInspection(!isEditingInspection)} className="btn btn-ghost btn-sm text-muted">
                                    {isEditingInspection ? 'Cancelar' : 'Editar'}
                                </button>
                            )}
                        </div>
                        <div className="info-grid mt-sm">
                            <div className="info-item">
                                <label>Condición Física</label>
                                {isEditingInspection ? (
                                    <select className="select select-sm w-full" value={inspectionData.physical_condition} onChange={e => setInspectionData({...inspectionData, physical_condition: Number(e.target.value)})}>
                                        <option value="1">1/5 (Pésimo)</option>
                                        <option value="2">2/5 (Malo)</option>
                                        <option value="3">3/5 (Regular)</option>
                                        <option value="4">4/5 (Bueno)</option>
                                        <option value="5">5/5 (Excelente)</option>
                                    </select>
                                ) : (
                                    <div className="rating-display mt-xs">
                                        {[1, 2, 3, 4, 5].map(v => <div key={v} className={`rating-dot inline-block w-2 h-2 rounded-full mr-1 ${repair.physical_condition >= v ? 'bg-primary' : 'bg-bg-elevated'}`}></div>)}
                                        <span className="text-xs text-muted ml-sm">{repair.physical_condition}/5</span>
                                    </div>
                                )}
                            </div>
                            <div className="info-item">
                                <label>Accesorios recibidos</label>
                                {isEditingInspection ? (
                                    <input type="text" className="input input-sm w-full" value={inspectionData.accessories_received} onChange={e => setInspectionData({...inspectionData, accessories_received: e.target.value})} />
                                ) : <span>{repair.accessories_received || 'Ninguno'}</span>}
                            </div>
                            <div className="info-item col-span-full">
                                <label>Daños previos</label>
                                {isEditingInspection ? (
                                    <textarea className="input text-sm w-full" rows="2" value={inspectionData.existing_damage} onChange={e => setInspectionData({...inspectionData, existing_damage: e.target.value})} />
                                ) : <span className="text-muted">{repair.existing_damage || 'Sin reporte de daños'}</span>}
                            </div>
                            <div className="info-item col-span-full">
                                <label>Observaciones del técnico</label>
                                {isEditingInspection ? (
                                    <textarea className="input text-sm w-full" rows="2" value={inspectionData.technical_observations} onChange={e => setInspectionData({...inspectionData, technical_observations: e.target.value})} />
                                ) : <span className="text-muted">{repair.technical_observations || 'Ninguna'}</span>}
                            </div>

                            {repair.function_checklist && (
                                <div className="info-item col-span-full mt-sm">
                                    <label>Checklist Funcional</label>
                                    <div className="flex gap-sm flex-wrap mt-xs">
                                        {Object.entries(typeof repair.function_checklist === 'string' ? JSON.parse(repair.function_checklist) : repair.function_checklist).map(([key, value]) => (
                                            <div key={key} className={`badge text-xs ${value ? 'bg-success-muted text-success' : 'bg-error-muted text-error'}`}>
                                                {value ? <CheckCircle2 size={12}/> : <X size={12}/>} <span className="capitalize ml-xs">{key}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {isEditingInspection && (
                            <div className="flex justify-end mt-md">
                                <button onClick={handleUpdateInspection} className="btn btn-primary" disabled={updatingStatus}>Guardar Inspección</button>
                            </div>
                        )}
                    </section>

                    {/* Imágenes */}
                    <section className="card">
                        <div className="card-header spread">
                            <div className="flex items-center gap-xs"><ImageIcon size={18} className="text-primary"/> <h3>Imágenes del Equipo</h3></div>
                            {isAdmin && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm text-primary pointer"
                                        onClick={() => setShowCameraModal(true)}
                                        disabled={uploadingImages}
                                    >
                                        <Camera size={16} /> Cámara
                                    </button>
                                    <label className="btn btn-ghost btn-sm text-muted pointer" style={{ margin: 0 }}>
                                        <Plus size={16} /> Archivo
                                        <input type="file" multiple hidden accept="image/*" onChange={handleFileUpload} disabled={uploadingImages}/>
                                    </label>
                                </div>
                            )}
                        </div>
                        {uploadingImages && <div className="text-center py-md text-sm text-muted">Subiendo imágenes...</div>}
                        
                        <div className="image-gallery mt-md">
                            {repair.images?.length > 0 ? repair.images.map((img) => (
                                <div key={img.id} className="gallery-thumbnail">
                                    <img src={`${BACKEND_URL}${img.image_path}`} alt="Repair" onClick={() => window.open(`${BACKEND_URL}${img.image_path}`, '_blank')} />
                                    {isAdmin && <button className="delete-btn" onClick={() => handleDeleteImage(img.id)}><X size={12}/></button>}
                                </div>
                            )) : <p className="text-muted text-sm text-center py-lg">No hay fotos registradas</p>}
                        </div>
                    </section>

                    {/* Notas */}
                    <section className="card">
                        <div className="card-header"><MessageSquare size={18} className="text-primary"/> <h3>Seguimiento y Notas</h3></div>
                        
                        <div className="notes-list mt-md">
                            {repair.notes?.length > 0 ? repair.notes.map((note) => (
                                <div key={note.id} className={`note-bubble ${note.is_internal ? 'internal-bubble' : ''}`}>
                                    <div className="note-bubble-head">
                                        <strong>{note.first_name} {note.last_name} {note.is_internal && <span className="text-xs text-warning ml-xs">(Interna)</span>}</strong>
                                        <span className="text-xs text-muted">{formatDate(note.created_at)}</span>
                                    </div>
                                    <p>{note.note}</p>
                                </div>
                            )) : <p className="text-muted text-sm text-center py-md">No hay notas registradas</p>}
                        </div>

                        <form onSubmit={handleAddNote} className="note-form mt-md pt-md border-t border-border">
                            <textarea placeholder="Escribe un comentario..." value={noteText} onChange={e => setNoteText(e.target.value)} className="input" rows="2" required></textarea>
                            <div className="flex justify-between items-center mt-sm">
                                {isAdmin && (
                                    <label className="flex items-center gap-xs text-sm text-muted cursor-pointer">
                                        <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)}/> Nota interna (solo staff)
                                    </label>
                                )}
                                <button type="submit" className="btn btn-primary btn-sm ml-auto" disabled={addingNote || !noteText.trim()}>Enviar <Send size={14} className="ml-xs"/></button>
                            </div>
                        </form>
                    </section>

                </div>

                <div className="detail-sidebar-col">
                    
                    {/* Costos */}
                    <div className="card sticky-card">
                        <div className="card-header spread">
                            <div className="flex items-center gap-xs"><DollarSign size={18} className="text-success"/> <h3>Presupuesto</h3></div>
                            {isAdmin && (
                                <button onClick={() => setIsEditingCosts(!isEditingCosts)} className="btn btn-ghost btn-sm text-muted">
                                    {isEditingCosts ? 'Cancelar' : 'Editar'}
                                </button>
                            )}
                        </div>

                        {/* Payment status badge */}
                        {repair.payment_status && (
                            <div className="mt-sm">
                                <span className={`badge text-xs ${
                                    repair.payment_status === 'paid' ? 'bg-success-muted text-success' :
                                    repair.payment_status === 'partial' ? 'bg-warning-muted text-warning' :
                                    'bg-error-muted text-error'
                                }`}>
                                    {repair.payment_status === 'paid' ? '✓ Pagado' :
                                     repair.payment_status === 'partial' ? '◐ Pago Parcial' :
                                     '○ Pendiente de Pago'}
                                </span>
                            </div>
                        )}

                        {isEditingCosts ? (
                            <div className="mt-md flex flex-col gap-sm">
                                <div className="flex justify-between items-center"><span className="text-sm text-muted">Diagnóstico</span> <input type="number" className="input input-sm w-24 text-right" value={costs.diagnosis_cost} onChange={e => setCosts({...costs, diagnosis_cost: e.target.value})}/></div>
                                <div className="flex justify-between items-center"><span className="text-sm text-muted">Mano de Obra</span> <input type="number" className="input input-sm w-24 text-right" value={costs.labor_cost} onChange={e => setCosts({...costs, labor_cost: e.target.value})}/></div>
                                <div className="flex justify-between items-center"><span className="text-sm text-muted">Refacciones</span> <input type="number" className="input input-sm w-24 text-right" value={costs.parts_cost} onChange={e => setCosts({...costs, parts_cost: e.target.value})}/></div>
                                <div className="flex justify-between items-center"><span className="text-sm text-muted">Descuento (-)</span> <input type="number" className="input input-sm w-24 text-right text-error" value={costs.discount} onChange={e => setCosts({...costs, discount: e.target.value})}/></div>
                                <button onClick={handleUpdateStatus} className="btn btn-primary btn-sm mt-sm w-full">Guardar Costos</button>
                            </div>
                        ) : (
                            <div className="mt-md flex flex-col gap-sm">
                                <div className="flex justify-between text-sm"><span>Total Estimado</span> <strong className="text-lg">{formatCurrency(repair.total_cost)}</strong></div>
                                <div className="flex justify-between text-sm text-secondary"><span>Anticipo</span> <span>{formatCurrency(repair.advance_payment)}</span></div>
                                <div className="divider my-1"></div>
                                <div className="flex justify-between text-md font-bold"><span>Restante</span> <span>{formatCurrency(repair.total_cost - repair.advance_payment)}</span></div>
                            </div>
                        )}

                        {/* Cobrar en POS button */}
                        {isAdmin && repair.total_cost > 0 && repair.payment_status !== 'paid' && (
                            <button
                                className="btn btn-primary w-full mt-md"
                                onClick={() => navigate(`/admin/pos?repair_id=${repair.id}`)}
                            >
                                <ShoppingCart size={16} />
                                Cobrar en POS — {formatCurrency(repair.total_cost - (repair.advance_payment || 0))}
                            </button>
                        )}
                    </div>

                    {/* Garantía */}
                    <div className="card">
                        <div className="card-header"><ShieldCheck size={18} className="text-secondary"/> <h3>Garantía</h3></div>
                        <div className="mt-sm flex flex-col gap-sm">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Días pactados</span>
                                <strong>{repair.warranty_days || 30} días</strong>
                            </div>
                            {repair.warranty_expires && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted">Vence el</span>
                                    <span>{new Date(repair.warranty_expires).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                </div>
                            )}
                            {remainingWarranty !== null && (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted">Días restantes</span>
                                        <strong className={remainingWarranty > 0 ? 'text-success' : 'text-error'}>
                                            {remainingWarranty > 0 ? `${remainingWarranty} días` : 'Expirada'}
                                        </strong>
                                    </div>
                                    {/* Barra de progreso de garantía */}
                                    <div style={{ background: 'var(--color-bg-elevated, #2a2a2a)', borderRadius: '6px', height: '8px', overflow: 'hidden', marginTop: '4px' }}>
                                        <div style={{
                                            width: `${Math.max(0, Math.min(100, (remainingWarranty / (repair.warranty_days || 30)) * 100))}%`,
                                            height: '100%',
                                            borderRadius: '6px',
                                            background: remainingWarranty > 7 ? 'var(--cool-teal)' : remainingWarranty > 0 ? 'var(--cool-amber)' : 'var(--cool-rose)',
                                            transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                </>
                            )}

                            {/* Enlace al ticket padre */}
                            {repair.parent_repair_id && (
                                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 12px', marginTop: '4px' }}>
                                    <span className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <AlertCircle size={14} style={{ color: 'var(--color-text-secondary)' }} />
                                        Garantía del ticket{' '}
                                        <Link to={`${isAdmin ? '/admin' : '/dashboard'}/reparaciones/${repair.parent_repair_id}`} style={{ color: 'var(--color-primary)', fontWeight: 700 }}>#{repair.parent_ticket}</Link>
                                    </span>

                                    <div style={{ borderTop: '1px dashed var(--color-border)', marginTop: '8px', paddingTop: '8px' }}>
                                        <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>Resolución de Garantía</span>
                                        {!(isAdmin || user?.role === 'technician') ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span className={`badge text-xs`} style={{
                                                    alignSelf: 'flex-start',
                                                    background: repair.warranty_approved === 'approved' ? 'rgba(255, 255, 255, 0.08)' : repair.warranty_approved === 'rejected' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                                                    color: repair.warranty_approved === 'approved' ? 'var(--color-text)' : repair.warranty_approved === 'rejected' ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                                                    border: '1px solid var(--color-border)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontWeight: 600
                                                }}>
                                                    {repair.warranty_approved === 'approved' ? 'Aceptada (Aplica)' :
                                                     repair.warranty_approved === 'rejected' ? 'Rechazada' : 'Pendiente de Aprobación'}
                                                </span>
                                                {repair.warranty_tech_notes && (
                                                    <p className="text-xs text-muted" style={{ margin: '4px 0 0', fontStyle: 'italic' }}>
                                                        "Observaciones: {repair.warranty_tech_notes}"
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <select 
                                                    className="select select-sm w-full"
                                                    style={{ height: '28px', padding: '0 4px', fontSize: '12px' }}
                                                    value={repair.warranty_approved || 'pending'}
                                                    onChange={async (e) => {
                                                        try {
                                                            await repairService.update(repair.id, { warranty_approved: e.target.value });
                                                            await fetchRepairData();
                                                            alert('Aprobación de garantía actualizada.');
                                                        } catch (err) {
                                                            alert('Error al actualizar: ' + err.message);
                                                        }
                                                    }}
                                                >
                                                    <option value="pending">Pendiente de Aprobación</option>
                                                    <option value="approved">Aceptar (Aplica Garantía)</option>
                                                    <option value="rejected">Rechazar Garantía</option>
                                                </select>
                                                <div>
                                                    <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Notas Técnicas de Garantía</span>
                                                    <textarea
                                                        className="input text-xs w-full"
                                                        style={{ padding: '6px', minHeight: '40px', resize: 'vertical' }}
                                                        placeholder="Describe qué se le va a hacer o por qué no aplica..."
                                                        defaultValue={repair.warranty_tech_notes || ''}
                                                        onBlur={async (e) => {
                                                            if (e.target.value !== (repair.warranty_tech_notes || '')) {
                                                                try {
                                                                    await repairService.update(repair.id, { warranty_tech_notes: e.target.value });
                                                                    await fetchRepairData();
                                                                } catch (err) {
                                                                    alert('Error al guardar notas: ' + err.message);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Reclamaciones hijas */}
                            {repair.child_warranties && repair.child_warranties.length > 0 && (
                                <div style={{ background: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', padding: '10px 12px', marginTop: '4px' }}>
                                    <span className="text-sm" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Reclamaciones registradas:</span>
                                    {repair.child_warranties.map(child => (
                                        <div key={child.id} className="text-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <Link to={`${isAdmin ? '/admin' : '/dashboard'}/reparaciones/${child.id}`} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>#{child.ticket_number}</Link>
                                            <span className={`badge text-xs status-${child.status}`} style={{ fontSize: '10px' }}>{STATUS_LABELS[child.status]}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Botón de reclamación */}
                            {repair.status === 'delivered' && (isAdmin || user?.role === 'client') && (
                                <button type="button" className="btn btn-primary w-full mt-sm" onClick={() => setShowWarrantyModal(true)}>
                                    <Wrench size={16} />
                                    {isAdmin ? 'Registrar Ingreso por Garantía' : 'Solicitar Garantía'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Cliente */}
                    {isAdmin && (
                        <div className="card">
                            <div className="card-header"><User size={18}/> <h3>Cliente</h3></div>
                            <div className="mt-sm text-sm flex flex-col gap-xs">
                                <strong>{repair.customer_first_name} {repair.customer_last_name}</strong>
                                <span className="text-muted">{repair.customer_email}</span>
                                <span className="text-muted">{repair.customer_phone}</span>
                            </div>
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="card bg-transparent border-0 shadow-none px-0">
                        <div className="card-header mb-md px-md"><Clock size={18} className="text-primary"/> <h3 className="m-0">Línea de Tiempo</h3></div>
                        <div className="modern-timeline">
                            {repair.history?.map((item, index) => (
                                <div key={item.id} className={`mtl-item ${index === 0 ? 'mlt-active' : ''}`}>
                                    <div className="mtl-dot" style={{backgroundColor: index === 0 ? 'var(--color-text)' : 'var(--color-bg-elevated)', borderColor: index === 0 ? 'transparent' : 'var(--color-border-strong)'}}></div>
                                    <div className="mtl-content">
                                        <strong>{STATUS_LABELS[item.status]}</strong>
                                        <span className="mtl-date">{formatDate(item.created_at)}</span>
                                        {item.notes && <p className="mtl-notes">{item.notes}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <SignatureModal isOpen={showSigModal} onClose={() => setShowSigModal(false)} onSave={handleSignatureSave} title={sigType === 'approval' ? 'Aprobar Cotización' : 'Confirmar Entrega'} description="..." />
            <PrintReceipt isOpen={showPrintReceipt} onClose={() => setShowPrintReceipt(false)} data={receiptData || repair} type={receiptType} settings={settings} />

            {showWarrantyModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 10000
                }} onClick={() => setShowWarrantyModal(false)}>
                    <div className="card" onClick={(e) => e.stopPropagation()} style={{
                        background: 'var(--color-bg-card, #1a1a1a)',
                        padding: '2rem', borderRadius: '12px',
                        width: '90%', maxWidth: '500px',
                        border: '1px solid var(--color-border, #333)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        color: 'var(--color-text, #fff)'
                    }}>
                        <div className="card-header spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border, #333)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>{isAdmin ? 'Registrar Reingreso por Garantía' : 'Solicitar Aplicación de Garantía'}</h3>
                            <button className="btn btn-ghost btn-sm btn-icon" type="button" onClick={() => setShowWarrantyModal(false)} style={{ color: 'var(--color-text-muted)' }}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleClaimWarrantySubmit}>
                            <p className="text-muted text-sm" style={{ marginBottom: '1.5rem', color: 'var(--color-text-muted)' }}>
                                {isAdmin 
                                    ? `Se generará una nueva orden de servicio con costo $0, vinculada a este ticket #${repair.ticket_number}.`
                                    : `Se enviará una solicitud para ingresar tu dispositivo bajo la garantía del ticket #${repair.ticket_number}.`}
                            </p>
                            <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Falla o Síntoma Reportado *</label>
                                <textarea 
                                    className="input" 
                                    rows="3" 
                                    placeholder={isAdmin ? "Ej. La pantalla no da imagen o presenta parpadeo..." : "Describe detalladamente la falla que presenta tu equipo actualmente..."}
                                    value={warrantyProblem} 
                                    onChange={e => setWarrantyProblem(e.target.value)} 
                                    required 
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border, #444)', background: 'var(--color-bg-input, #222)', color: 'var(--color-text, #fff)' }}
                                />
                            </div>
                            
                            {isAdmin && (
                                <>
                                    <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Prioridad</label>
                                        <select className="select" value={warrantyPriority} onChange={e => setWarrantyPriority(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border, #444)', background: 'var(--color-bg-input, #222)', color: 'var(--color-text, #fff)' }}>
                                            <option value="normal">Normal</option>
                                            <option value="urgent">Urgente</option>
                                        </select>
                                    </div>
                                    <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Fecha de Entrega Estimada</label>
                                        <input 
                                            type="date" 
                                            className="input" 
                                            value={warrantyDeliveryDate} 
                                            onChange={e => setWarrantyDeliveryDate(e.target.value)} 
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border, #444)', background: 'var(--color-bg-input, #222)', color: 'var(--color-text, #fff)' }}
                                        />
                                    </div>
                                    <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Observaciones del Técnico (Opcional)</label>
                                        <textarea 
                                            className="input" 
                                            rows="2" 
                                            placeholder="Detalles sobre el estado actual del dispositivo..." 
                                            value={warrantyObservations} 
                                            onChange={e => setWarrantyObservations(e.target.value)} 
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border, #444)', background: 'var(--color-bg-input, #222)', color: 'var(--color-text, #fff)' }}
                                        />
                                    </div>
                                </>
                            )}
                            
                            <div className="flex gap-md justify-end" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowWarrantyModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={submittingWarranty || !warrantyProblem.trim()}>
                                    {submittingWarranty ? 'Registrando...' : (isAdmin ? 'Registrar Reingreso' : 'Enviar Solicitud')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Captura de Fotografía con Cámara */}
            {showCameraModal && (
                <CameraCaptureModal
                    isOpen={showCameraModal}
                    onClose={() => setShowCameraModal(false)}
                    onCapture={handleCameraUpload}
                    title="Evidencias de Reparación"
                    multiple={true}
                />
            )}
        </div>
    );
}
