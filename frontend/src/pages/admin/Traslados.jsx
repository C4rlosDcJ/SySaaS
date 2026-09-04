import { useState, useEffect } from 'react';
import { transferService, inventoryService, branchService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { ArrowLeftRight, Plus, Check, X, Store, Box, AlertCircle, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';
import { showAlert, showConfirm } from '../../utils/swal';

export default function TransfersPage() {
    const { user, isTenantAdmin } = useAuth();
    const { activeBranchId } = useTenant();

    const [transfers, setTransfers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewModal, setShowNewModal] = useState(false);

    // Formulario de traslado
    const [sourceBranch, setSourceBranch] = useState('');
    const [destBranch, setDestBranch] = useState('');
    const [notes, setNotes] = useState('');
    const [transferItems, setTransferItems] = useState([{ product_id: '', quantity: 1 }]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadTransfers();
        loadCatalogData();
    }, []);

    const loadTransfers = async () => {
        try {
            setLoading(true);
            const data = await transferService.getAll();
            setTransfers(Array.isArray(data) ? data : (data?.transfers || []));
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cargar traslados', icon: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const loadCatalogData = async () => {
        try {
            const [bRes, pRes] = await Promise.all([
                branchService.getAll(),
                inventoryService.getProducts()
            ]);
            const branchesList = Array.isArray(bRes) ? bRes : (bRes?.branches || []);
            setBranches(branchesList.filter(b => b.is_active));
            const productsList = Array.isArray(pRes) ? pRes : (pRes?.products || []);
            setProducts(productsList);
        } catch (err) {
            console.error('Error al cargar catálogo:', err);
        }
    };

    const handleOpenModal = () => {
        const userBranch = String(user?.branch_id || activeBranchId || '');
        if (userBranch) {
            setDestBranch(userBranch);
            const other = branches.find(b => String(b.id) !== userBranch);
            if (other) setSourceBranch(String(other.id));
        }
        setNotes('');
        setTransferItems([{ product_id: '', quantity: 1 }]);
        setShowNewModal(true);
    };

    const handleAddItem = () => {
        setTransferItems([...transferItems, { product_id: '', quantity: 1 }]);
    };

    const handleRemoveItem = (index) => {
        setTransferItems(transferItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, field, value) => {
        const copy = [...transferItems];
        copy[index][field] = value;
        setTransferItems(copy);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!sourceBranch || !destBranch) {
            showAlert({ title: 'Atención', text: 'Selecciona las sucursales de origen y destino.', icon: 'warning' });
            return;
        }
        if (String(sourceBranch) === String(destBranch)) {
            showAlert({ title: 'Atención', text: 'La sucursal de origen y destino no pueden ser iguales.', icon: 'warning' });
            return;
        }
        const filteredItems = transferItems.filter(item => item.product_id !== '');
        if (filteredItems.length === 0) {
            showAlert({ title: 'Atención', text: 'Debes incluir al menos un producto en la solicitud.', icon: 'warning' });
            return;
        }

        setSubmitting(true);
        try {
            await transferService.create({
                source_branch_id: parseInt(sourceBranch, 10),
                destination_branch_id: parseInt(destBranch, 10),
                notes,
                items: filteredItems.map(item => ({
                    product_id: parseInt(item.product_id, 10),
                    quantity: parseInt(item.quantity, 10) || 1
                }))
            });
            setShowNewModal(false);
            setNotes('');
            setTransferItems([{ product_id: '', quantity: 1 }]);
            await loadTransfers();
            showAlert({ title: 'Solicitud Creada', text: 'La solicitud de traslado ha sido registrada correctamente.', icon: 'success' });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al registrar solicitud de traslado.', icon: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (id) => {
        const confirmed = await showConfirm({
            title: '¿Aprobar Traslado?',
            text: 'Esto deducirá el stock de la sucursal de origen y pondrá la mercancía En Tránsito. ¿Deseas continuar?',
            icon: 'warning',
            confirmText: 'Sí, aprobar salida'
        });
        if (!confirmed) return;
        try {
            await transferService.approve(id);
            await loadTransfers();
            showAlert({ title: 'Traslado Aprobado', text: 'El traslado ha sido aprobado y el stock está en tránsito.', icon: 'success' });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al aprobar traslado.', icon: 'error' });
        }
    };

    const handleComplete = async (id) => {
        const confirmed = await showConfirm({
            title: '¿Confirmar Recepción?',
            text: 'Esto ingresará el stock a la sucursal de destino y dará por finalizado el traslado. ¿Continuar?',
            icon: 'question',
            confirmText: 'Sí, recepcionar mercancía'
        });
        if (!confirmed) return;
        try {
            await transferService.complete(id);
            await loadTransfers();
            showAlert({ title: 'Traslado Completado', text: 'Stock recepcionado correctamente en la sucursal destino.', icon: 'success' });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al completar traslado.', icon: 'error' });
        }
    };

    const handleCancel = async (id) => {
        const confirmed = await showConfirm({
            title: '¿Cancelar Traslado?',
            text: 'Si el traslado está En Tránsito, el stock se devolverá automáticamente a la sucursal de origen.',
            icon: 'warning',
            confirmText: 'Sí, cancelar'
        });
        if (!confirmed) return;
        try {
            await transferService.cancel(id);
            await loadTransfers();
            showAlert({ title: 'Traslado Cancelado', text: 'El traslado ha sido cancelado.', icon: 'info' });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cancelar traslado.', icon: 'error' });
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}><CheckCircle2 size={12} /> RECIBIDO</span>;
            case 'in_transit':
                return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}><ArrowLeftRight size={12} /> EN TRÁNSITO</span>;
            case 'pending':
                return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}><AlertCircle size={12} /> PENDIENTE</span>;
            default:
                return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}><X size={12} /> CANCELADO</span>;
        }
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <ArrowLeftRight size={22} className="text-primary" />
                        <span>Traspasos de Stock entre Sucursales</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Solicita, despacha y recibe inventario entre las sedes de tu empresa con trazabilidad total.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleOpenModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} />
                    <span>Nuevo Traspaso</span>
                </button>
            </div>

            {/* Listado */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table className="table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Folio</th>
                                    <th>Sucursal Origen</th>
                                    <th>Sucursal Destino</th>
                                    <th>Estado</th>
                                    <th>Solicitado Por</th>
                                    <th>Fecha</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transfers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-secondary)' }}>
                                            No se han registrado traspasos de inventario. Haz clic en "Nuevo Traspaso" para crear una solicitud.
                                        </td>
                                    </tr>
                                ) : (
                                    transfers.map(t => (
                                        <tr key={t.id}>
                                            <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                                                {t.transfer_number}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                                    <Store size={14} className="text-primary" />
                                                    <span>{t.source_branch_name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                                    <Store size={14} style={{ color: '#10b981' }} />
                                                    <span>{t.destination_branch_name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {getStatusBadge(t.status)}
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                                    {t.requested_by_name || 'Personal'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                                {new Date(t.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    {t.status === 'pending' && (
                                                        <>
                                                            <button 
                                                                className="btn btn-primary btn-sm" 
                                                                onClick={() => handleApprove(t.id)} 
                                                                title="Aprobar salida y poner en tránsito"
                                                                style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                            >
                                                                <Check size={14} /> <span>Aprobar Salida</span>
                                                            </button>
                                                            <button 
                                                                className="btn btn-secondary btn-sm" 
                                                                onClick={() => handleCancel(t.id)} 
                                                                style={{ color: 'var(--color-error)' }} 
                                                                title="Cancelar solicitud"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {t.status === 'in_transit' && (
                                                        <>
                                                            <button 
                                                                className="btn btn-primary btn-sm" 
                                                                onClick={() => handleComplete(t.id)} 
                                                                style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} 
                                                                title="Confirmar recepción en destino"
                                                            >
                                                                <Check size={14} /> <span>Recibir en Destino</span>
                                                            </button>
                                                            <button 
                                                                className="btn btn-secondary btn-sm" 
                                                                onClick={() => handleCancel(t.id)} 
                                                                style={{ color: 'var(--color-error)' }} 
                                                                title="Cancelar y retornar stock a origen"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {t.status === 'completed' && (
                                                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Completado</span>
                                                    )}
                                                    {t.status === 'cancelled' && (
                                                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Cancelado</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Nuevo Traslado */}
            {showNewModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1050, padding: '16px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                            <h2 className="card-title" style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ArrowLeftRight size={18} className="text-primary" />
                                <span>Solicitar Traspaso de Stock</span>
                            </h2>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowNewModal(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group">
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Sucursal Origen (Despacha) *</label>
                                    <select className="select" value={sourceBranch} onChange={e => setSourceBranch(e.target.value)} required>
                                        <option value="">Selecciona origen...</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Sucursal Destino (Recibe) *</label>
                                    <select className="select" value={destBranch} onChange={e => setDestBranch(e.target.value)} required>
                                        <option value="">Selecciona destino...</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ background: 'var(--color-bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>Artículos a Traspasar</label>
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary btn-sm" 
                                        onClick={handleAddItem}
                                        style={{ fontSize: '12px', padding: '3px 8px' }}
                                    >
                                        + Agregar Fila
                                    </button>
                                </div>

                                {transferItems.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                        <select 
                                            className="select" 
                                            value={item.product_id}
                                            onChange={e => handleItemChange(idx, 'product_id', e.target.value)}
                                            style={{ flex: 1, fontSize: '13px' }}
                                            required
                                        >
                                            <option value="">Seleccionar producto...</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                                            ))}
                                        </select>
                                        <input 
                                            type="number" 
                                            className="input" 
                                            value={item.quantity}
                                            onChange={e => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                            style={{ width: '80px', fontSize: '13px', textAlign: 'center' }}
                                            min="1"
                                            placeholder="Cant."
                                            required
                                        />
                                        {transferItems.length > 1 && (
                                            <button 
                                                type="button" 
                                                className="btn btn-secondary btn-sm" 
                                                onClick={() => handleRemoveItem(idx)}
                                                style={{ color: 'var(--color-error)', padding: '6px' }}
                                                title="Quitar ítem"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="input-group">
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Motivo u Observaciones</label>
                                <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} rows="2" placeholder="Ej: Reabastecimiento de pantallas para taller..." />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                                <button type="button" className="btn btn-secondary w-full" onClick={() => setShowNewModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                                    {submitting ? 'Registrando...' : 'Confirmar Solicitud'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
