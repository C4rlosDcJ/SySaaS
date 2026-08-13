import { useState, useEffect } from 'react';
import { transferService, inventoryService, branchService } from '../../services/api';
import { ArrowLeftRight, Plus, Check, X } from 'lucide-react';

export default function TransfersPage() {
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

    useEffect(() => {
        loadTransfers();
        loadMetadata();
    }, []);

    const loadTransfers = async () => {
        try {
            setLoading(true);
            const data = await transferService.getAll();
            setTransfers(data);
        } catch (err) {
            alert(err.message || 'Error al cargar traslados');
        } finally {
            setLoading(false);
        }
    };

    const loadMetadata = async () => {
        try {
            const branchList = await branchService.getAll();
            setBranches(branchList.filter(b => b.is_active));
            
            const prodList = await inventoryService.getProducts({ limit: 100 });
            setProducts(prodList.products || []);
        } catch (err) {
            console.error('Error al cargar datos auxiliares:', err);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        
        if (sourceBranch === destBranch) {
            alert('La sucursal de origen y destino no pueden ser iguales.');
            return;
        }

        const filteredItems = transferItems.filter(item => item.product_id !== '');
        if (filteredItems.length === 0) {
            alert('Debes incluir al menos un producto para trasladar.');
            return;
        }

        try {
            await transferService.create({
                source_branch_id: sourceBranch,
                destination_branch_id: destBranch,
                notes,
                items: filteredItems
            });
            setShowNewModal(false);
            setNotes('');
            setTransferItems([{ product_id: '', quantity: 1 }]);
            loadTransfers();
        } catch (err) {
            alert(err.message || 'Error al enviar solicitud de traslado');
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm('¿Aprobar traslado? Esto deducirá el stock del origen y lo pondrá En Tránsito.')) return;
        try {
            await transferService.approve(id);
            loadTransfers();
        } catch (err) {
            alert(err.message || 'Error al aprobar traslado');
        }
    };

    const handleComplete = async (id) => {
        if (!window.confirm('¿Confirmar recepción del traslado? Esto añadirá el stock a la sucursal destino.')) return;
        try {
            await transferService.complete(id);
            loadTransfers();
        } catch (err) {
            alert(err.message || 'Error al completar traslado');
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('¿Deseas cancelar este traslado? Si está En Tránsito, el stock se devolverá al origen.')) return;
        try {
            await transferService.cancel(id);
            loadTransfers();
        } catch (err) {
            alert(err.message || 'Error al cancelar traslado');
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'completed': return { color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--color-success)' };
            case 'in_transit': return { color: 'var(--color-warning)', background: 'rgba(245, 166, 35, 0.08)', border: '1px solid var(--color-warning)' };
            case 'pending': return { color: 'var(--color-info)', background: 'rgba(0, 112, 243, 0.08)', border: '1px solid var(--color-info)' };
            default: return { color: 'var(--color-error)', background: 'rgba(255, 0, 60, 0.08)', border: '1px solid var(--color-error)' };
        }
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <ArrowLeftRight size={20} className="logo-icon" />
                        <span>Traslados de Inventario</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Moviliza stock de productos entre sucursales de forma controlada.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} />
                    <span>Solicitar Traslado</span>
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table className="table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Folio</th>
                                    <th>Origen</th>
                                    <th>Destino</th>
                                    <th>Estado</th>
                                    <th>Solicitado Por</th>
                                    <th>Fecha</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transfers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                            No se han registrado traslados de mercancía.
                                        </td>
                                    </tr>
                                ) : (
                                    transfers.map(t => (
                                        <tr key={t.id}>
                                            <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{t.transfer_number}</td>
                                            <td>{t.source_branch_name}</td>
                                            <td>{t.destination_branch_name}</td>
                                            <td>
                                                <span className="status-badge" style={getStatusStyle(t.status)}>{t.status.toUpperCase()}</span>
                                            </td>
                                            <td>{t.requested_by_name || 'Sistema'}</td>
                                            <td>{new Date(t.created_at).toLocaleDateString()}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    {t.status === 'pending' && (
                                                        <>
                                                            <button className="btn btn-primary btn-sm" onClick={() => handleApprove(t.id)} title="Aprobar salida">
                                                                <Check size={14} />
                                                            </button>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => handleCancel(t.id)} style={{ color: 'var(--color-error)' }} title="Cancelar">
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {t.status === 'in_transit' && (
                                                        <>
                                                            <button className="btn btn-primary btn-sm" onClick={() => handleComplete(t.id)} style={{ background: 'var(--color-success)', color: '#fff' }} title="Recibir en destino">
                                                                <Check size={14} />
                                                            </button>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => handleCancel(t.id)} style={{ color: 'var(--color-error)' }} title="Cancelar y retornar stock">
                                                                <X size={14} />
                                                            </button>
                                                        </>
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
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--color-bg)' }}>
                        <h2 className="card-title" style={{ marginTop: 0, marginBottom: '20px' }}>Solicitar Traslado</h2>
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="input-group">
                                <label>Sucursal Origen *</label>
                                <select className="select" value={sourceBranch} onChange={e => setSourceBranch(e.target.value)} required>
                                    <option value="">Selecciona origen...</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Sucursal Destino *</label>
                                <select className="select" value={destBranch} onChange={e => setDestBranch(e.target.value)} required>
                                    <option value="">Selecciona destino...</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginTop: '8px' }}>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>Productos a trasladar</label>
                                {transferItems.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                                        <select 
                                            className="select" 
                                            value={item.product_id}
                                            onChange={e => {
                                                const newItems = [...transferItems];
                                                newItems[idx].product_id = e.target.value;
                                                setTransferItems(newItems);
                                            }}
                                            style={{ flex: 1 }}
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
                                            onChange={e => {
                                                const newItems = [...transferItems];
                                                newItems[idx].quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
                                                setTransferItems(newItems);
                                            }}
                                            style={{ width: '80px' }}
                                            min="1"
                                            required
                                        />
                                        {transferItems.length > 1 && (
                                            <button 
                                                type="button" 
                                                className="btn btn-secondary" 
                                                onClick={() => setTransferItems(transferItems.filter((_, i) => i !== idx))}
                                                style={{ color: 'var(--color-error)' }}
                                            >
                                                Quitar
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button 
                                    type="button" 
                                    className="btn btn-secondary w-full" 
                                    onClick={() => setTransferItems([...transferItems, { product_id: '', quantity: 1 }])}
                                    style={{ marginTop: '4px' }}
                                >
                                    + Agregar Producto
                                </button>
                            </div>

                            <div className="input-group">
                                <label>Notas u Observaciones</label>
                                <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} rows="2" placeholder="Motivo del traslado..." />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button type="button" className="btn btn-secondary w-full" onClick={() => setShowNewModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary w-full">Solicitar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
