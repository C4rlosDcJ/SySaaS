import { useState, useEffect } from 'react';
import { branchService } from '../../services/api';
import { GitBranch, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function BranchManagementPage() {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewModal, setShowNewModal] = useState(false);
    
    // Formulario de nueva sucursal
    const [newBranch, setNewBranch] = useState({
        code: '',
        name: '',
        address: '',
        phone: '',
        email: ''
    });

    useEffect(() => {
        loadBranches();
    }, []);

    const loadBranches = async () => {
        try {
            setLoading(true);
            const data = await branchService.getAll();
            setBranches(data);
        } catch (err) {
            alert(err.message || 'Error al cargar sucursales');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await branchService.create(newBranch);
            setNewBranch({ code: '', name: '', address: '', phone: '', email: '' });
            setShowNewModal(false);
            loadBranches();
        } catch (err) {
            alert(err.message || 'Error al crear sucursal');
        }
    };

    const handleDeactivate = async (id) => {
        if (!window.confirm('¿Estás seguro de que deseas desactivar esta sucursal?')) return;
        try {
            await branchService.deactivate(id);
            loadBranches();
        } catch (err) {
            alert(err.message || 'Error al desactivar sucursal');
        }
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <GitBranch size={20} className="logo-icon" />
                        <span>Sucursales de la Empresa</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Administra las ubicaciones físicas y asignaciones de stock de tu negocio.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} />
                    <span>Nueva Sucursal</span>
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {branches.map(branch => (
                        <div key={branch.id} className="card" style={{ border: branch.is_main ? '1px solid var(--color-primary)' : '1px solid var(--color-border)', position: 'relative' }}>
                            {branch.is_main && (
                                <span style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text)', backgroundColor: 'var(--color-primary-muted)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-strong)', fontWeight: 600 }}>
                                    <CheckCircle2 size={12} /> Matriz
                                </span>
                            )}
                            <h3 style={{ margin: '0 0 8px 0', fontSize: 'var(--font-lg)', fontFamily: 'var(--font-mono)' }}>{branch.name}</h3>
                            <p style={{ margin: '0 0 16px 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>CÓDIGO: {branch.code}</p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                                <div><strong style={{ color: 'var(--color-text)' }}>Dirección:</strong> {branch.address || 'Sin registrar'}</div>
                                <div><strong style={{ color: 'var(--color-text)' }}>Teléfono:</strong> {branch.phone || 'Sin registrar'}</div>
                                <div><strong style={{ color: 'var(--color-text)' }}>Email:</strong> {branch.email || 'Sin registrar'}</div>
                                <div><strong style={{ color: 'var(--color-text)' }}>Estado:</strong> <span style={{ color: branch.is_active ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>{branch.is_active ? 'Activa' : 'Inactiva'}</span></div>
                            </div>

                            {!branch.is_main && branch.is_active && (
                                <button className="btn btn-secondary w-full" onClick={() => handleDeactivate(branch.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--color-error)' }}>
                                    <Trash2 size={16} /> Desactivar Sucursal
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Nueva Sucursal */}
            {showNewModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '450px', background: 'var(--color-bg)' }}>
                        <h2 className="card-title" style={{ marginTop: 0, marginBottom: '20px' }}>Agregar Sucursal</h2>
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="input-group">
                                <label>Código de Sucursal * (Ej: SUC-NORTE)</label>
                                <input type="text" className="input" value={newBranch.code} onChange={e => setNewBranch(p => ({ ...p, code: e.target.value.toUpperCase() }))} required />
                            </div>
                            <div className="input-group">
                                <label>Nombre de la Sucursal *</label>
                                <input type="text" className="input" value={newBranch.name} onChange={e => setNewBranch(p => ({ ...p, name: e.target.value }))} required />
                            </div>
                            <div className="input-group">
                                <label>Dirección</label>
                                <textarea className="input" value={newBranch.address} onChange={e => setNewBranch(p => ({ ...p, address: e.target.value }))} rows="2" />
                            </div>
                            <div className="input-group">
                                <label>Teléfono</label>
                                <input type="text" className="input" value={newBranch.phone} onChange={e => setNewBranch(p => ({ ...p, phone: e.target.value }))} />
                            </div>
                            <div className="input-group">
                                <label>Email de Contacto</label>
                                <input type="email" className="input" value={newBranch.email} onChange={e => setNewBranch(p => ({ ...p, email: e.target.value }))} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button type="button" className="btn btn-secondary w-full" onClick={() => setShowNewModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary w-full">Crear</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
