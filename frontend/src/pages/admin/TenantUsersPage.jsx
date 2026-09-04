import { useState, useEffect, useMemo } from 'react';
import { userService, branchService } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import {
    Users, UserPlus, Shield, Edit2, UserCheck, UserX,
    Check, X, AlertCircle, Search, Store, Briefcase, Key, RefreshCw
} from 'lucide-react';
import { showAlert, showConfirm } from '../../utils/swal';

const ROLE_INFO = {
    tenant_admin: {
        label: 'Administrador de Empresa',
        desc: 'Acceso total a la empresa, finanzas, sucursales y personal.'
    },
    branch_manager: {
        label: 'Gerente de Sucursal',
        desc: 'Administración de inventario, cajas y personal de su sede.'
    },
    technician: {
        label: 'Técnico de Taller',
        desc: 'Atención a diagnósticos, avances y órdenes de reparación.'
    },
    cashier: {
        label: 'Cajero / Punto de Venta',
        desc: 'Cobros en mostrador, apertura/cierre de caja y tickets POS.'
    },
    salesperson: {
        label: 'Vendedor',
        desc: 'Atención a clientes, ventas y presupuestos.'
    }
};

export default function TenantUsersPage() {
    const { user: currentUser, isTenantAdmin } = useAuth();
    const isBranchManager = currentUser?.role === 'branch_manager';
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const { tenant, activeBranchId } = useTenant();

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone: '',
        role: 'technician',
        branch_id: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [usersRes, branchesRes] = await Promise.allSettled([
                userService.getTenantUsers(),
                branchService.getAll()
            ]);

            if (usersRes.status === 'fulfilled') setUsers(usersRes.value || []);
            if (branchesRes.status === 'fulfilled') {
                const branchData = branchesRes.value;
                setBranches(Array.isArray(branchData) ? branchData : (branchData?.branches || []));
            }
        } catch (err) {
            console.error('Error al cargar personal:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesSearch = !search || `${u.first_name} ${u.last_name} ${u.email} ${u.phone || ''}`.toLowerCase().includes(search.toLowerCase());
            const userRole = u.role === 'admin' ? 'tenant_admin' : u.role;
            const matchesRole = !roleFilter || userRole === roleFilter;
            const matchesBranch = !branchFilter || String(u.branch_id) === String(branchFilter);
            return matchesSearch && matchesRole && matchesBranch;
        });
    }, [users, search, roleFilter, branchFilter]);

    const handleOpenCreateModal = () => {
        setEditingUser(null);
        setFormData({
            first_name: '',
            last_name: '',
            email: '',
            password: '',
            phone: '',
            role: 'technician',
            branch_id: isBranchManager ? (currentUser?.branch_id || activeBranchId || branches[0]?.id || '') : (branches[0]?.id || '')
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (user) => {
        setEditingUser(user);
        setFormData({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            password: '', // Opcional al editar
            phone: user.phone || '',
            role: user.role === 'admin' ? 'tenant_admin' : (user.role || 'technician'),
            branch_id: user.branch_id || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingUser) {
                await userService.updateTenantUser(editingUser.id, formData);
                showAlert({ title: 'Usuario Actualizado', text: 'Los permisos y datos del usuario han sido guardados.', icon: 'success' });
            } else {
                await userService.createTenantUser(formData);
                showAlert({ title: 'Usuario Creado', text: 'El nuevo miembro de personal ha sido registrado exitosamente.', icon: 'success' });
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al procesar usuario', icon: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (user) => {
        const confirmed = await showConfirm({
            title: user.is_active ? '¿Desactivar Usuario?' : '¿Activar Usuario?',
            text: user.is_active 
                ? `El usuario ${user.first_name} ya no podrá ingresar a la plataforma.`
                : `Se restaurará el acceso a la plataforma para ${user.first_name}.`,
            icon: 'warning',
            confirmText: user.is_active ? 'Sí, desactivar' : 'Sí, activar'
        });
        if (!confirmed) return;

        try {
            await userService.toggleTenantUserStatus(user.id);
            loadData();
            showAlert({ 
                title: 'Estado Actualizado', 
                text: `El usuario ahora se encuentra ${user.is_active ? 'inactivo' : 'activo'}.`, 
                icon: 'success' 
            });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cambiar estado', icon: 'error' });
        }
    };

    const maxUsers = tenant?.planLimits?.maxUsers || tenant?.max_users || 'Sin límite';
    const currentUsers = users.length;

    const getRoleBadge = (role) => {
        const normalizedRole = role === 'admin' ? 'tenant_admin' : role;
        const config = ROLE_INFO[normalizedRole] || { label: normalizedRole };

        return (
            <span style={{
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                display: 'inline-block'
            }}>
                {config.label}
            </span>
        );
    };

    return (
        <div className="container animate-fadeIn" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-8)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Users size={28} className="text-primary" />
                        <span>Gestión de Personal & Roles</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Asigna roles específicos (Técnicos, Cajeros, Vendedores, Gerentes) y sucursal a cada empleado.
                    </p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--color-bg-card)', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '13px', fontWeight: 600 }}>
                        Cuota de Personal: <strong style={{ color: 'var(--color-text)' }}>{currentUsers}</strong> / {maxUsers}
                    </div>
                    <button className="btn btn-secondary" onClick={loadData} title="Recargar">
                        <RefreshCw size={15} />
                    </button>
                    <button className="btn btn-primary" onClick={handleOpenCreateModal}>
                        <UserPlus size={16} /> 
                        <span>Nuevo Empleado</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ padding: '12px 18px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '0 12px', height: '38px', border: '1px solid var(--color-border)' }}>
                    <Search size={16} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, correo o teléfono..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        className="select select-sm"
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        style={{ width: 'auto', minWidth: '160px', height: '38px', fontSize: '13px' }}
                    >
                        <option value="">Todos los Roles</option>
                        <option value="tenant_admin">Administradores</option>
                        <option value="branch_manager">Gerentes de Sucursal</option>
                        <option value="technician">Técnicos</option>
                        <option value="cashier">Cajeros</option>
                        <option value="salesperson">Vendedores</option>
                    </select>

                    {branches.length > 0 && (
                        <select
                            className="select select-sm"
                            value={branchFilter}
                            onChange={e => setBranchFilter(e.target.value)}
                            style={{ width: 'auto', minWidth: '160px', height: '38px', fontSize: '13px' }}
                        >
                            <option value="">Todas las Sucursales</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Content Table */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)' }}>Cargando personal...</p>
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '50px', color: 'var(--color-text-secondary)' }}>
                    <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>No se encontró personal registrado</div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>Agrega nuevos empleados o ajusta tus filtros.</div>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-responsive">
                        <table className="table" style={{ width: '100%', margin: 0 }}>
                            <thead>
                                <tr>
                                    <th>Empleado</th>
                                    <th>Correo Electrónico</th>
                                    <th>Teléfono</th>
                                    <th>Rol Asignado</th>
                                    <th>Sucursal Asignada</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(u => (
                                    <tr key={u.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--color-bg-tertiary)', display: 'flex',
                                                    alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px'
                                                }}>
                                                    {u.first_name?.charAt(0).toUpperCase()}
                                                </div>
                                                <span style={{ fontWeight: 700 }}>{u.first_name} {u.last_name}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{u.email}</td>
                                        <td style={{ fontSize: '13px' }}>{u.phone || 'N/A'}</td>
                                        <td>{getRoleBadge(u.role)}</td>
                                        <td>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                                                <Store size={13} style={{ color: 'var(--color-text-secondary)' }} />
                                                {u.branch_name || 'Matriz'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                                background: u.is_active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                                color: u.is_active ? '#10b981' : '#ef4444'
                                            }}>
                                                {u.is_active ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {(() => {
                                                const isHigher = ['tenant_admin', 'admin', 'superadmin', 'branch_manager'].includes(u.role);
                                                const canEdit = !isBranchManager || (!isHigher || u.id === currentUser?.id);
                                                const canToggle = !isBranchManager || !isHigher;

                                                return (
                                                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                        <button 
                                                            className="btn btn-secondary btn-sm" 
                                                            onClick={() => handleOpenEditModal(u)}
                                                            title={canEdit ? "Editar rol y sucursal" : "Solo el administrador de empresa puede editar este usuario"}
                                                            disabled={!canEdit}
                                                            style={!canEdit ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button 
                                                            className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-primary'}`} 
                                                            onClick={() => handleToggleStatus(u)}
                                                            title={canToggle ? (u.is_active ? 'Desactivar usuario' : 'Activar usuario') : "Solo el administrador de empresa puede cambiar el estado de este usuario"}
                                                            disabled={!canToggle}
                                                            style={!canToggle ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                                                        >
                                                            {u.is_active ? 'Desactivar' : 'Activar'}
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Crear / Editar Empleado */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '28px', position: 'relative' }}>
                        <button
                            onClick={() => setShowModal(false)}
                            style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>

                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={20} className="text-primary" /> 
                            <span>{editingUser ? 'Editar Empleado y Rol' : 'Registrar Nuevo Empleado'}</span>
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 18px 0' }}>
                            {isBranchManager 
                                ? 'Como Gerente de Sucursal, puedes registrar Técnicos, Vendedores y Cajeros para tu sede.'
                                : 'Configura los accesos, rol de puesto y sucursal de trabajo.'}
                        </p>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Nombre *</label>
                                    <input type="text" className="input" placeholder="Nombre" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="label">Apellido *</label>
                                    <input type="text" className="input" placeholder="Apellido" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} required />
                                </div>
                            </div>

                            <div>
                                <label className="label">Correo Electrónico de Acceso *</label>
                                <input type="email" className="input" placeholder="empleado@empresa.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={!!editingUser} required />
                            </div>

                            <div>
                                <label className="label">Contraseña {editingUser ? '(dejar en blanco para conservar actual)' : '*'}</label>
                                <input type="password" className="input" placeholder="Mínimo 6 caracteres" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} minLength={6} required={!editingUser} />
                            </div>

                            <div>
                                <label className="label">Teléfono de Contacto</label>
                                <input type="text" className="input" placeholder="Ej. 55-1234-5678" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Rol en la Empresa *</label>
                                    <select className="select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                        <option value="technician">Técnico de Taller</option>
                                        <option value="cashier">Cajero / POS</option>
                                        <option value="salesperson">Vendedor</option>
                                        {!isBranchManager && (
                                            <>
                                                <option value="branch_manager">Gerente de Sucursal</option>
                                                <option value="tenant_admin">Administrador de Empresa</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className="label">Sucursal Asignada *</label>
                                    <select 
                                        className="select" 
                                        value={formData.branch_id} 
                                        onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                                        disabled={isBranchManager}
                                        style={isBranchManager ? { opacity: 0.8, cursor: 'not-allowed' } : {}}
                                    >
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Info del rol seleccionado */}
                            <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-tertiary)', fontSize: '12px', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                                <strong style={{ color: 'var(--color-text)' }}>Permisos: </strong>
                                {ROLE_INFO[formData.role]?.desc}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Registrar Empleado')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
