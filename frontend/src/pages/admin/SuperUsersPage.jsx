import { useState, useEffect } from 'react';
import { superAdminService, tenantService } from '../../services/api';
import { Users, Search, RefreshCw, Shield, Building2, Key, UserCheck, UserX, Filter, X, Edit2 } from 'lucide-react';
import { showAlert } from '../../utils/swal';

export default function SuperUsersPage() {
    const [users, setUsers] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [resetModal, setResetModal] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [editModal, setEditModal] = useState(null);
    const [editForm, setEditForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: 'client',
        tenant_id: '',
        is_active: 1,
        password: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadUsers();
        loadTenants();
    }, [roleFilter, statusFilter]);

    const loadTenants = async () => {
        try {
            const res = await tenantService.getAll({ limit: 100 });
            setTenants(Array.isArray(res) ? res : (res?.tenants || []));
        } catch (err) {
            console.error('Error al cargar empresas:', err);
        }
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            const params = {};
            if (search) params.search = search;
            if (roleFilter) params.role = roleFilter;
            if (statusFilter) params.status = statusFilter;
            const res = await superAdminService.getGlobalUsers(params);
            setUsers(res || []);
        } catch (err) {
            console.error('Error al cargar usuarios:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadUsers();
    };

    const handleOpenEditModal = (user) => {
        setEditModal(user);
        setEditForm({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            phone: user.phone || '',
            role: user.role || 'client',
            tenant_id: user.tenant_id ? String(user.tenant_id) : '',
            is_active: user.is_active ? 1 : 0,
            password: ''
        });
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!editModal) return;
        setSubmitting(true);
        try {
            const payload = {
                first_name: editForm.first_name,
                last_name: editForm.last_name,
                email: editForm.email,
                phone: editForm.phone,
                role: editForm.role,
                tenant_id: editForm.tenant_id ? parseInt(editForm.tenant_id) : null,
                is_active: editForm.is_active
            };
            if (editForm.password && editForm.password.trim().length >= 6) {
                payload.password = editForm.password.trim();
            }
            await superAdminService.updateGlobalUser(editModal.id, payload);
            showAlert({ title: 'Usuario Actualizado', text: 'Los datos del usuario han sido actualizados exitosamente.', icon: 'success' });
            setEditModal(null);
            loadUsers();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al actualizar usuario', icon: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (userId) => {
        try {
            await superAdminService.toggleUserStatus(userId);
            loadUsers();
            showAlert({ title: 'Estado Actualizado', text: 'El estado del usuario se ha cambiado correctamente.', icon: 'success' });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cambiar estado', icon: 'error' });
        }
    };

    const handleResetPassword = async () => {
        if (!resetModal || !newPassword) return;
        setSubmitting(true);
        try {
            const res = await superAdminService.resetUserPassword(resetModal.id, newPassword);
            showAlert({ title: 'Éxito', text: res.message || 'Contraseña restablecida', icon: 'success' });
            setResetModal(null);
            setNewPassword('');
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al resetear contraseña', icon: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const getRoleBadge = (role) => {
        const roleColors = {
            tenant_admin: { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6', label: 'Admin Empresa' },
            admin: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', label: 'Administrador' },
            branch_manager: { bg: 'var(--cool-slate-blue-bg)', color: 'var(--cool-slate-blue)', label: 'Gerente' },
            technician: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Tecnico' },
            cashier: { bg: 'rgba(236,72,153,0.1)', color: '#ec4899', label: 'Cajero' },
            client: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Cliente' }
        };
        const r = roleColors[role] || roleColors.client;
        return (
            <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: r.bg, color: r.color, border: `1px solid ${r.color}` }}>
                {r.label}
            </span>
        );
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Users size={28} className="text-primary" />
                        <span>Usuarios Globales</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Administra todos los usuarios registrados en la plataforma. Activa, desactiva o restablece credenciales.
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={loadUsers}><RefreshCw size={16} /> Actualizar</button>
            </div>

            {/* Filters */}
            <form onSubmit={handleSearchSubmit} className="card" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', padding: '12px var(--sp-4)', flexWrap: 'wrap' }}>
                <Search size={18} style={{ color: 'var(--color-text-secondary)' }} />
                <input
                    type="text" className="input"
                    placeholder="Buscar por nombre, email o empresa..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ border: 'none', padding: 0, background: 'transparent', flex: 1, minWidth: '200px' }}
                />
                <select className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ width: 'auto', minWidth: '150px' }}>
                    <option value="">Todos los roles</option>
                    <option value="tenant_admin">Admin Empresa</option>
                    <option value="admin">Administrador</option>
                    <option value="branch_manager">Gerente</option>
                    <option value="technician">Tecnico</option>
                    <option value="cashier">Cajero</option>
                    <option value="client">Cliente</option>
                </select>
                <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto', minWidth: '130px' }}>
                    <option value="">Todos</option>
                    <option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                </select>
                <button type="submit" className="btn btn-primary btn-sm"><Filter size={14} /> Filtrar</button>
            </form>

            {/* Users Table */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><div className="spinner"></div></div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table className="table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Email</th>
                                    <th>Empresa</th>
                                    <th>Rol</th>
                                    <th>Estado</th>
                                    <th>Registro</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '32px' }}>
                                            No se encontraron usuarios con los filtros actuales.
                                        </td>
                                    </tr>
                                ) : users.map(u => (
                                    <tr key={u.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 700, fontSize: '13px', color: 'var(--color-primary)', flexShrink: 0
                                                }}>
                                                    {u.first_name?.charAt(0).toUpperCase()}
                                                </div>
                                                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{u.first_name} {u.last_name}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '13px', color: 'var(--color-text)' }}>{u.email}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text)' }}>
                                                <Building2 size={14} style={{ color: 'var(--color-text-secondary)' }} />
                                                {u.company_name || 'Sin empresa'}
                                            </div>
                                        </td>
                                        <td>{getRoleBadge(u.role)}</td>
                                        <td>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                                                background: u.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                color: u.is_active ? '#10b981' : '#ef4444'
                                            }}>
                                                {u.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={() => handleOpenEditModal(u)}
                                                    title="Editar usuario"
                                                    style={{ color: 'var(--color-primary)' }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={() => handleToggleStatus(u.id)}
                                                    title={u.is_active ? 'Desactivar' : 'Activar'}
                                                    style={{ color: u.is_active ? 'var(--color-error)' : 'var(--color-success)' }}
                                                >
                                                    {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={() => { setResetModal(u); setNewPassword(''); }}
                                                    title="Resetear contraseña"
                                                    style={{ color: 'var(--color-warning)' }}
                                                >
                                                    <Key size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button onClick={() => setEditModal(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Edit2 size={18} className="text-primary" /> Editar Usuario
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '18px' }}>
                            Modifica los datos generales, rol, empresa y estado del usuario <strong>{editModal.email}</strong>.
                        </p>

                        <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Nombre *</label>
                                    <input
                                        type="text" className="input" required
                                        value={editForm.first_name}
                                        onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Apellido *</label>
                                    <input
                                        type="text" className="input" required
                                        value={editForm.last_name}
                                        onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Correo Electrónico *</label>
                                    <input
                                        type="email" className="input" required
                                        value={editForm.email}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Teléfono</label>
                                    <input
                                        type="text" className="input" placeholder="Ej. 5512345678"
                                        value={editForm.phone}
                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Rol en la Plataforma *</label>
                                    <select
                                        className="input"
                                        value={editForm.role}
                                        onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                    >
                                        <option value="client">Cliente</option>
                                        <option value="tenant_admin">Admin Empresa</option>
                                        <option value="admin">Administrador</option>
                                        <option value="branch_manager">Gerente</option>
                                        <option value="technician">Técnico</option>
                                        <option value="cashier">Cajero</option>
                                        <option value="salesperson">Vendedor</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Empresa Asignada</label>
                                    <select
                                        className="input"
                                        value={editForm.tenant_id}
                                        onChange={e => setEditForm({ ...editForm, tenant_id: e.target.value })}
                                    >
                                        <option value="">Sin empresa (Global)</option>
                                        {tenants.map(t => (
                                            <option key={t.id} value={t.id}>{t.company_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="label">Estado de la Cuenta</label>
                                <select
                                    className="input"
                                    value={editForm.is_active}
                                    onChange={e => setEditForm({ ...editForm, is_active: parseInt(e.target.value) })}
                                >
                                    <option value={1}>Activo</option>
                                    <option value={0}>Inactivo</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">Nueva Contraseña (Opcional)</label>
                                <input
                                    type="password" className="input"
                                    placeholder="Dejar vacío para conservar actual (mín. 6 caracteres)"
                                    value={editForm.password}
                                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                                    minLength={6}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '24px', position: 'relative' }}>
                        <button onClick={() => setResetModal(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>Resetear Contraseña</h3>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                            Asignar nueva contraseña para <strong>{resetModal.email}</strong>
                        </p>
                        <div style={{ marginBottom: '16px' }}>
                            <label className="label">Nueva Contraseña</label>
                            <input type="password" className="input" placeholder="Minimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setResetModal(null)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleResetPassword} disabled={submitting || newPassword.length < 6}>
                                {submitting ? 'Guardando...' : 'Resetear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
