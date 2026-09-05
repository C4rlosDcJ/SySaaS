import { useState, useEffect, useMemo } from 'react';
import { branchService } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import {
    GitBranch,
    Plus,
    Building2,
    MapPin,
    Phone,
    Mail,
    Users,
    Wrench,
    DollarSign,
    Edit2,
    RefreshCw,
    Search,
    Store,
    CheckCircle2,
    Power,
    ArrowRightCircle,
    X,
    Filter
} from 'lucide-react';
import { showAlert, showConfirm } from '../../utils/swal';
import { formatCurrency } from '../../utils/constants';

export default function BranchManagementPage() {
    const { activeBranchId, updateActiveBranch, setBranchesList } = useTenant();
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
    const [showNewModal, setShowNewModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);

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
            if (setBranchesList) {
                setBranchesList(data.filter(b => b.is_active));
            }
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cargar sucursales', icon: 'error' });
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
            showAlert({ title: 'Sucursal Creada', text: 'La nueva sucursal ha sido registrada exitosamente.', icon: 'success' });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al crear sucursal', icon: 'error' });
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editingBranch) return;
        try {
            await branchService.update(editingBranch.id, editingBranch);
            setEditingBranch(null);
            loadBranches();
            showAlert({ title: 'Sucursal Actualizada', text: 'Los cambios han sido guardados.', icon: 'success' });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al actualizar sucursal', icon: 'error' });
        }
    };

    const handleToggleStatus = async (branch) => {
        const actionText = branch.is_active ? 'desactivar' : 'reactivar';
        const confirmed = await showConfirm({
            title: `¿Deseas ${actionText} esta sucursal?`,
            text: `La sucursal "${branch.name}" ${branch.is_active ? 'dejará de estar disponible para operaciones diarias' : 'volverá a estar operativa'}.`,
            icon: 'warning',
            confirmText: `Sí, ${actionText}`
        });
        if (!confirmed) return;
        try {
            if (branch.is_active) {
                await branchService.deactivate(branch.id);
            } else {
                await branchService.update(branch.id, { is_active: 1 });
            }
            loadBranches();
            showAlert({
                title: branch.is_active ? 'Sucursal Desactivada' : 'Sucursal Reactivada',
                text: `La sucursal ha sido ${branch.is_active ? 'desactivada' : 'reactivada'} con éxito.`,
                icon: 'success'
            });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || `Error al ${actionText} sucursal`, icon: 'error' });
        }
    };

    // Estadísticas consolidadas
    const globalStats = useMemo(() => {
        const total = branches.length;
        const active = branches.filter(b => b.is_active).length;
        const totalStaff = branches.reduce((acc, b) => acc + (b.staff_count || 0), 0);
        const totalActiveRepairs = branches.reduce((acc, b) => acc + (b.active_repairs || 0), 0);
        const totalRevenue = branches.reduce((acc, b) => acc + (b.total_revenue || 0), 0);
        return { total, active, totalStaff, totalActiveRepairs, totalRevenue };
    }, [branches]);

    const filteredBranches = useMemo(() => {
        return branches.filter(b => {
            const matchesSearch = b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.address?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' ? true : (statusFilter === 'active' ? b.is_active : !b.is_active);
            return matchesSearch && matchesStatus;
        });
    }, [branches, searchTerm, statusFilter]);

    return (
        <div className="container animate-fadeIn" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-8)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px', fontWeight: 800 }}>
                        <GitBranch size={28} className="text-primary" />
                        <span>Gestión de Sucursales</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '4px', margin: 0 }}>
                        Control de sedes físicas, inventarios independientes y asignación de personal
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={loadBranches} title="Recargar">
                        <RefreshCw size={14} />
                        <span>Actualizar</span>
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
                        <Plus size={14} />
                        <span>Nueva Sucursal</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--cool-cyan-bg)', color: 'var(--cool-cyan)', border: '1px solid var(--cool-cyan-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building2 size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total Sucursales</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>
                            {globalStats.total} <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>({globalStats.active} activas)</span>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--cool-slate-blue-bg)', color: 'var(--cool-slate-blue)', border: '1px solid var(--cool-slate-blue-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Users size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Personal Asignado</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>{globalStats.totalStaff} usuarios</div>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--cool-teal-bg)', color: 'var(--cool-teal)', border: '1px solid var(--cool-teal-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Wrench size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>En Taller</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>{globalStats.totalActiveRepairs} equipos</div>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--cool-amber-bg)', color: 'var(--cool-amber)', border: '1px solid var(--cool-amber-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Facturación Red</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>{formatCurrency(globalStats.totalRevenue)}</div>
                    </div>
                </div>
            </div>

            {/* Buscador y Filtros */}
            <div className="card" style={{ padding: '12px 18px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                    <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, código o dirección..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="input"
                        style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', fontSize: '13px' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Filter size={14} style={{ color: 'var(--color-text-secondary)' }} />
                    <select
                        className="select select-sm"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{ width: '130px', fontSize: '12px' }}
                    >
                        <option value="all">Todas</option>
                        <option value="active">Solo Activas</option>
                        <option value="inactive">Inactivas</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>Cargando sucursales...</p>
                </div>
            ) : filteredBranches.length === 0 ? (
                <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                    <Store size={48} style={{ color: 'var(--color-text-secondary)', margin: '0 auto 12px' }} />
                    <h3 style={{ fontSize: '16px', margin: '0 0 6px', fontWeight: 700 }}>No se encontraron sucursales</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '0 0 16px' }}>
                        {searchTerm ? 'Intenta con otro término de búsqueda.' : 'Crea tu primera sucursal adicional para expandir tu red.'}
                    </p>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
                        <Plus size={14} /> <span>Crear Sucursal</span>
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                    {filteredBranches.map(b => {
                        const isCurrentActive = activeBranchId === b.id;
                        return (
                            <div
                                key={b.id}
                                className="card"
                                style={{
                                    padding: '22px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    border: isCurrentActive
                                        ? '2px solid var(--color-primary)'
                                        : '1px solid var(--color-border)',
                                    opacity: b.is_active ? 1 : 0.65,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div>
                                    {/* Header de Tarjeta */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                                                background: b.is_main ? 'rgba(59, 130, 246, 0.15)' : 'var(--color-bg-tertiary)',
                                                color: b.is_main ? '#3b82f6' : 'var(--color-text)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                border: '1px solid var(--color-border)'
                                            }}>
                                                <Store size={20} />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                                                    {b.name}
                                                </h3>
                                                <span style={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '11px',
                                                    color: 'var(--color-text-secondary)',
                                                    background: 'var(--color-bg-tertiary)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px'
                                                }}>
                                                    {b.code}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            {b.is_main && (
                                                <span className="badge-neutral" style={{ fontSize: '10px', fontWeight: 700 }}>
                                                    MATRIZ
                                                </span>
                                            )}
                                            <span className="badge-neutral" style={{ fontSize: '10px', fontWeight: 600 }}>
                                                {b.is_active ? 'ACTIVA' : 'INACTIVA'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Datos de Contacto */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                        {b.address && (
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                <MapPin size={14} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--color-primary)' }} />
                                                <span>{b.address}</span>
                                            </div>
                                        )}
                                        {b.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Phone size={14} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
                                                <span>{b.phone}</span>
                                            </div>
                                        )}
                                        {b.email && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Mail size={14} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
                                                <span>{b.email}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Métricas Operativas */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                                        padding: '10px', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-border)', marginBottom: '16px', textAlign: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Personal</div>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{b.staff_count || 0}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>En Taller</div>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{b.active_repairs || 0}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Ingresos</div>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{formatCurrency(b.total_revenue || 0)}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Botones de Acción */}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                                    {isCurrentActive ? (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)',
                                            padding: '6px 10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-sm)',
                                            flex: 1
                                        }}>
                                            <CheckCircle2 size={14} />
                                            <span>Sede Actual Activa</span>
                                        </div>
                                    ) : (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ flex: 1, fontSize: '12px' }}
                                            onClick={() => updateActiveBranch(b.id)}
                                            disabled={!b.is_active}
                                        >
                                            <ArrowRightCircle size={13} />
                                            <span>Trabajar Aquí</span>
                                        </button>
                                    )}

                                    <button
                                        className="btn btn-secondary btn-sm"
                                        style={{ padding: '6px 10px' }}
                                        onClick={() => setEditingBranch(b)}
                                        title="Editar datos"
                                    >
                                        <Edit2 size={13} />
                                    </button>

                                    {!b.is_main && (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ padding: '6px 10px' }}
                                            onClick={() => handleToggleStatus(b)}
                                            title={b.is_active ? 'Desactivar sucursal' : 'Reactivar sucursal'}
                                        >
                                            <Power size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Crear Sucursal */}
            {showNewModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1050, padding: '20px'
                }}>
                    <div className="card animate-fadeIn" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Registrar Nueva Sucursal</h2>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowNewModal(false)} style={{ padding: '4px' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Código</label>
                                    <input
                                        type="text"
                                        className="input input-sm"
                                        placeholder="SUC-002"
                                        value={newBranch.code}
                                        onChange={e => setNewBranch({ ...newBranch, code: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nombre</label>
                                    <input
                                        type="text"
                                        className="input input-sm"
                                        placeholder="Sucursal Norte"
                                        value={newBranch.name}
                                        onChange={e => setNewBranch({ ...newBranch, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Dirección</label>
                                <input
                                    type="text"
                                    className="input input-sm"
                                    placeholder="Av. Insurgentes 123, Col. Centro"
                                    value={newBranch.address}
                                    onChange={e => setNewBranch({ ...newBranch, address: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Teléfono</label>
                                    <input
                                        type="text"
                                        className="input input-sm"
                                        placeholder="55 1234 5678"
                                        value={newBranch.phone}
                                        onChange={e => setNewBranch({ ...newBranch, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Correo Electrónico</label>
                                    <input
                                        type="email"
                                        className="input input-sm"
                                        placeholder="norte@miempresa.com"
                                        value={newBranch.email}
                                        onChange={e => setNewBranch({ ...newBranch, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary btn-sm">
                                    Guardar Sucursal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Editar Sucursal */}
            {editingBranch && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1050, padding: '20px'
                }}>
                    <div className="card animate-fadeIn" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Editar Sucursal</h2>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingBranch(null)} style={{ padding: '4px' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Código</label>
                                    <input
                                        type="text"
                                        className="input input-sm"
                                        value={editingBranch.code}
                                        onChange={e => setEditingBranch({ ...editingBranch, code: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nombre</label>
                                    <input
                                        type="text"
                                        className="input input-sm"
                                        value={editingBranch.name}
                                        onChange={e => setEditingBranch({ ...editingBranch, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Dirección</label>
                                <input
                                    type="text"
                                    className="input input-sm"
                                    value={editingBranch.address || ''}
                                    onChange={e => setEditingBranch({ ...editingBranch, address: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Teléfono</label>
                                    <input
                                        type="text"
                                        className="input input-sm"
                                        value={editingBranch.phone || ''}
                                        onChange={e => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Correo Electrónico</label>
                                    <input
                                        type="email"
                                        className="input input-sm"
                                        value={editingBranch.email || ''}
                                        onChange={e => setEditingBranch({ ...editingBranch, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingBranch(null)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary btn-sm">
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
