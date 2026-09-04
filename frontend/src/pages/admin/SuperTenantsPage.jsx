import { useState, useEffect, useMemo } from 'react';
import { tenantService, superAdminService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    Search,
    Plus,
    RefreshCw,
    X,
    LogIn,
    ChevronDown,
    ChevronUp,
    Users,
    GitBranch,
    Wrench,
    DollarSign,
    Shield,
    Download,
    Clock,
    ShoppingBag,
    TrendingUp,
    Activity,
    CheckCircle2,
    AlertCircle,
    SlidersHorizontal,
    ArrowUpRight,
    Edit3,
    Key,
    Store,
    LayoutGrid,
    List,
    ArrowUpDown,
    Check,
    Lock
} from 'lucide-react';
import { showAlert, showConfirm } from '../../utils/swal';

export default function SuperTenantsPage() {
    const [tenants, setTenants] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'name' | 'plan'
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

    const [expandedTenant, setExpandedTenant] = useState(null);
    const [tenantDetail, setTenantDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Modales
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTenant, setEditingTenant] = useState(null);
    const [resettingPasswordTenant, setResettingPasswordTenant] = useState(null);
    const [newPasswordValue, setNewPasswordValue] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const { impersonateTenant } = useAuth();
    const navigate = useNavigate();

    const [newTenant, setNewTenant] = useState({
        company_name: '',
        slug: '',
        tax_id: '',
        plan_id: '1',
        admin_email: '',
        admin_password: '',
        admin_first_name: '',
        admin_last_name: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [tenantsRes, plansRes] = await Promise.all([
                tenantService.getAll().catch(() => ({ tenants: [] })),
                tenantService.getPlans().catch(() => [])
            ]);
            setTenants(tenantsRes.tenants || []);
            setPlans(plansRes || []);
        } catch (err) {
            console.error('Error al cargar datos:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExpandTenant = async (tenantId) => {
        if (expandedTenant === tenantId) {
            setExpandedTenant(null);
            setTenantDetail(null);
            return;
        }
        setExpandedTenant(tenantId);
        setDetailLoading(true);
        try {
            const detail = await superAdminService.getTenantDetail(tenantId);
            setTenantDetail(detail);
        } catch (err) {
            console.error('Error al obtener detalle:', err);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleStatus = async (id, currentStatus) => {
        try {
            if (currentStatus === 'suspended') {
                await tenantService.activate(id);
                showAlert({ title: 'Empresa Reactivada', text: 'El acceso a la plataforma ha sido restaurado.', icon: 'success' });
            } else {
                const confirmed = await showConfirm({
                    title: '¿Suspender Empresa?',
                    text: 'Se bloqueará el acceso temporalmente a todos los usuarios de esta organización.',
                    icon: 'warning',
                    confirmText: 'Sí, suspender'
                });
                if (!confirmed) return;
                await tenantService.suspend(id);
                showAlert({ title: 'Empresa Suspendida', text: 'La cuenta ha sido suspendida.', icon: 'info' });
            }
            loadData();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al modificar estado', icon: 'error' });
        }
    };

    const handleChangePlan = async (tenantId, planId) => {
        try {
            await superAdminService.changeTenantPlan(tenantId, planId);
            loadData();
            showAlert({ title: 'Plan Actualizado', text: 'El plan de la empresa se ha actualizado con éxito.', icon: 'success' });
            if (expandedTenant === tenantId) {
                const detail = await superAdminService.getTenantDetail(tenantId);
                setTenantDetail(detail);
            }
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cambiar plan', icon: 'error' });
        }
    };

    const handleImpersonate = async (tenantId, companyName) => {
        const confirmed = await showConfirm({
            title: 'Soporte Técnico Asistido',
            text: `¿Deseas ingresar al panel de "${companyName}" en modo Soporte Técnico?`,
            icon: 'question',
            confirmText: 'Ingresar como Soporte'
        });
        if (!confirmed) return;
        try {
            await impersonateTenant(tenantId);
            navigate('/admin');
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al iniciar soporte', icon: 'error' });
        }
    };

    const handleExtendTrial = async (tenantId, companyName, days = 15) => {
        const confirmed = await showConfirm({
            title: 'Extender Periodo de Prueba',
            text: `¿Deseas otorgar +${days} días de prueba adicionales a "${companyName}"?`,
            icon: 'question',
            confirmText: `Otorgar +${days} Días`
        });
        if (!confirmed) return;

        try {
            await tenantService.extendTrial(tenantId, days);
            showAlert({ title: 'Prueba Extendida', text: `Se otorgaron ${days} días adicionales exitosamente.`, icon: 'success' });
            loadData();
            if (expandedTenant === tenantId) {
                const detail = await superAdminService.getTenantDetail(tenantId);
                setTenantDetail(detail);
            }
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al extender periodo de prueba', icon: 'error' });
        }
    };

    const handleUpdateTenantSubmit = async (e) => {
        e.preventDefault();
        if (!editingTenant) return;
        try {
            await tenantService.update(editingTenant.id, {
                company_name: editingTenant.company_name,
                slug: editingTenant.slug,
                tax_id: editingTenant.tax_id
            });
            setEditingTenant(null);
            loadData();
            showAlert({ title: 'Empresa Actualizada', text: 'Los datos corporativos han sido guardados.', icon: 'success' });
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al actualizar empresa', icon: 'error' });
        }
    };

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        if (!resettingPasswordTenant || !newPasswordValue) return;
        try {
            const tenantUsers = await superAdminService.getGlobalUsers({ tenant_id: resettingPasswordTenant.id, role: 'admin' });
            const adminUser = (tenantUsers.users || []).find(u => u.role === 'admin' || u.role === 'tenant_admin') || tenantUsers.users?.[0];

            if (adminUser) {
                await superAdminService.resetUserPassword(adminUser.id, newPasswordValue);
                setResettingPasswordTenant(null);
                setNewPasswordValue('');
                showAlert({ title: 'Contraseña Actualizada', text: `Se actualizó la contraseña para ${adminUser.email}.`, icon: 'success' });
            } else {
                showAlert({ title: 'Atención', text: 'No se encontró un usuario administrador registrado en esta empresa.', icon: 'info' });
            }
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al restablecer contraseña', icon: 'error' });
        }
    };

    const handleExportCSV = () => {
        if (!tenants || tenants.length === 0) {
            showAlert({ title: 'Atención', text: 'No hay empresas registradas para exportar.', icon: 'info' });
            return;
        }

        const headers = ['ID', 'Empresa', 'Slug', 'Plan', 'Estado', 'Fin Prueba', 'Fecha Registro'];
        const rows = tenants.map(t => [
            t.id,
            `"${(t.company_name || '').replace(/"/g, '""')}"`,
            t.slug,
            t.plan_name || 'Desconocido',
            t.subscription_status,
            t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString() : 'N/A',
            new Date(t.created_at).toLocaleDateString()
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `empresas_sysaas_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg('');
        try {
            await tenantService.create(newTenant);
            setShowCreateModal(false);
            setNewTenant({
                company_name: '', slug: '', tax_id: '', plan_id: '1',
                admin_email: '', admin_password: '', admin_first_name: '', admin_last_name: ''
            });
            loadData();
            showAlert({ title: 'Empresa Creada', text: 'La organización ha sido aprovisionada con éxito.', icon: 'success' });
        } catch (err) {
            setErrorMsg(err.message || 'Error al registrar empresa');
        } finally {
            setSubmitting(false);
        }
    };

    // Estadísticas globales
    const stats = useMemo(() => {
        const total = tenants.length;
        const active = tenants.filter(t => t.subscription_status === 'active').length;
        const trial = tenants.filter(t => t.subscription_status === 'trial').length;
        const suspended = tenants.filter(t => t.subscription_status === 'suspended').length;
        return { total, active, trial, suspended };
    }, [tenants]);

    const filteredTenants = useMemo(() => {
        let list = tenants.filter(t => {
            const matchSearch = !search ||
                t.company_name?.toLowerCase().includes(search.toLowerCase()) ||
                t.slug?.toLowerCase().includes(search.toLowerCase()) ||
                t.tax_id?.toLowerCase().includes(search.toLowerCase());
            const matchStatus = !statusFilter || t.subscription_status === statusFilter;
            const matchPlan = !planFilter || String(t.plan_id) === String(planFilter);
            return matchSearch && matchStatus && matchPlan;
        });

        if (sortBy === 'name') {
            list.sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));
        } else if (sortBy === 'plan') {
            list.sort((a, b) => (a.plan_name || '').localeCompare(b.plan_name || ''));
        } else {
            list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return list;
    }, [tenants, search, statusFilter, planFilter, sortBy]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)',
                        letterSpacing: '0.04em'
                    }}>
                        ACTIVA
                    </span>
                );
            case 'trial':
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)',
                        letterSpacing: '0.04em'
                    }}>
                        EN PRUEBA
                    </span>
                );
            case 'suspended':
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)',
                        letterSpacing: '0.04em'
                    }}>
                        SUSPENDIDA
                    </span>
                );
            case 'past_due':
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)',
                        letterSpacing: '0.04em'
                    }}>
                        PAGO PENDIENTE
                    </span>
                );
            default:
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: 'rgba(107, 114, 128, 0.12)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.25)',
                        letterSpacing: '0.04em'
                    }}>
                        CANCELADA
                    </span>
                );
        }
    };

    return (
        <div className="container animate-fadeIn" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-8)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Building2 size={28} className="text-primary" />
                        <span>Empresas SaaS</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Gestiona organizaciones cliente, control de planes, límites y soporte técnico asistido.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={handleExportCSV} title="Exportar a CSV">
                        <Download size={15} />
                        <span>Exportar CSV</span>
                    </button>
                    <button className="btn btn-secondary" onClick={loadData} title="Recargar">
                        <RefreshCw size={15} />
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={16} />
                        <span>Nueva Empresa</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                        <Building2 size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Empresas</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>{stats.total}</div>
                    </div>
                </div>

                <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Suscripciones Activas</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>{stats.active}</div>
                    </div>
                </div>

                <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                        <Clock size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>En Periodo de Prueba</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#3b82f6' }}>{stats.trial}</div>
                    </div>
                </div>

                <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: stats.suspended > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: stats.suspended > 0 ? '#ef4444' : 'var(--color-text-secondary)', flexShrink: 0 }}>
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Suspendidas</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: stats.suspended > 0 ? '#ef4444' : 'var(--color-text)' }}>{stats.suspended}</div>
                    </div>
                </div>
            </div>

            {/* Filter & View Controls Bar */}
            <div className="card" style={{ padding: '14px 18px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                    
                    {/* Buscador */}
                    <div style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '0 12px', height: '38px', border: '1px solid var(--color-border)' }}>
                        <Search size={16} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, slug o RFC..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                width: '100%',
                                fontSize: '13px',
                                color: 'var(--color-text)',
                                outline: 'none'
                            }}
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 0 }}
                                title="Limpiar búsqueda"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Controles de Filtros & Ordenación */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <select
                            className="select select-sm"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            style={{ width: 'auto', minWidth: '140px', height: '38px', fontSize: '13px' }}
                        >
                            <option value="">Todos los estados</option>
                            <option value="active">Activas</option>
                            <option value="trial">En Prueba</option>
                            <option value="suspended">Suspendidas</option>
                            <option value="past_due">Pago Pendiente</option>
                        </select>

                        <select
                            className="select select-sm"
                            value={planFilter}
                            onChange={e => setPlanFilter(e.target.value)}
                            style={{ width: 'auto', minWidth: '130px', height: '38px', fontSize: '13px' }}
                        >
                            <option value="">Todos los planes</option>
                            {plans.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>

                        <select
                            className="select select-sm"
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            style={{ width: 'auto', minWidth: '135px', height: '38px', fontSize: '13px' }}
                        >
                            <option value="newest">Más Recientes</option>
                            <option value="name">Alfabético</option>
                            <option value="plan">Por Plan</option>
                        </select>

                        {/* View Switcher */}
                        <div style={{ display: 'flex', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '2px', border: '1px solid var(--color-border)', height: '38px', alignItems: 'center' }}>
                            <button
                                onClick={() => setViewMode('cards')}
                                style={{
                                    border: 'none',
                                    background: viewMode === 'cards' ? 'var(--color-bg-card)' : 'transparent',
                                    color: viewMode === 'cards' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                    padding: '0 10px',
                                    height: '32px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px',
                                    fontWeight: viewMode === 'cards' ? 700 : 500,
                                    boxShadow: viewMode === 'cards' ? 'var(--shadow-sm)' : 'none'
                                }}
                                title="Vista Detallada"
                            >
                                <List size={15} />
                                <span>Lista</span>
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                style={{
                                    border: 'none',
                                    background: viewMode === 'table' ? 'var(--color-bg-card)' : 'transparent',
                                    color: viewMode === 'table' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                    padding: '0 10px',
                                    height: '32px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px',
                                    fontWeight: viewMode === 'table' ? 700 : 500,
                                    boxShadow: viewMode === 'table' ? 'var(--shadow-sm)' : 'none'
                                }}
                                title="Vista Tabla"
                            >
                                <LayoutGrid size={15} />
                                <span>Tabla</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-barra informativa de conteo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    <span>Mostrando <strong>{filteredTenants.length}</strong> de <strong>{tenants.length}</strong> organizaciones</span>
                    {(search || statusFilter || planFilter) && (
                        <button
                            onClick={() => { setSearch(''); setStatusFilter(''); setPlanFilter(''); setSortBy('newest'); }}
                            style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0 }}
                        >
                            Limpiar todos los filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Content Display */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)' }}>Cargando empresas...</p>
                </div>
            ) : filteredTenants.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '50px', color: 'var(--color-text-secondary)' }}>
                    <Building2 size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>No se encontraron organizaciones</div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>Intenta ajustar los filtros de búsqueda.</div>
                </div>
            ) : viewMode === 'table' ? (
                /* Table View */
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-responsive">
                        <table className="table" style={{ width: '100%', margin: 0 }}>
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Slug</th>
                                    <th>Plan</th>
                                    <th>Estado</th>
                                    <th>Alta</th>
                                    <th>Fin de Prueba</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTenants.map(t => (
                                    <tr key={t.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>
                                                    {t.company_name?.charAt(0).toUpperCase()}
                                                </div>
                                                <span style={{ fontWeight: 700 }}>{t.company_name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t.slug}</span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{t.plan_name}</span>
                                        </td>
                                        <td>{getStatusBadge(t.subscription_status)}</td>
                                        <td style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                            {new Date(t.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td style={{ fontSize: '12px', color: t.trial_ends_at ? '#3b82f6' : 'var(--color-text-secondary)' }}>
                                            {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleImpersonate(t.id, t.company_name)}
                                                    title="Soporte"
                                                >
                                                    <LogIn size={13} />
                                                </button>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setEditingTenant({ ...t })}
                                                    title="Editar Datos"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                <button
                                                    className={`btn btn-sm ${t.subscription_status === 'suspended' ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => handleStatus(t.id, t.subscription_status)}
                                                >
                                                    {t.subscription_status === 'suspended' ? 'Reactivar' : 'Suspender'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Cards / Accordion View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredTenants.map(t => {
                        const isExpanded = expandedTenant === t.id;
                        return (
                            <div
                                key={t.id}
                                className="card"
                                style={{
                                    padding: 0,
                                    overflow: 'hidden',
                                    border: isExpanded ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                                }}
                            >
                                {/* Tenant Main Row */}
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        flexWrap: 'wrap',
                                        background: isExpanded ? 'var(--color-bg-secondary)' : 'transparent'
                                    }}
                                    onClick={() => handleExpandTenant(t.id)}
                                >
                                    {/* Avatar inicial */}
                                    <div style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--color-bg-tertiary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        fontWeight: 800,
                                        color: 'var(--color-text)',
                                        fontSize: '16px',
                                        border: '1px solid var(--color-border)'
                                    }}>
                                        {t.company_name?.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Nombre y Slug */}
                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>
                                            {t.company_name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                                            {t.slug}
                                        </div>
                                    </div>

                                    {/* Plan */}
                                    <div style={{ minWidth: '110px' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Plan</div>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
                                            {t.plan_name || 'Básico'}
                                        </div>
                                    </div>

                                    {/* Estado */}
                                    <div style={{ minWidth: '110px' }}>
                                        {getStatusBadge(t.subscription_status)}
                                    </div>

                                    {/* Fecha Registro */}
                                    <div style={{ minWidth: '100px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Alta</div>
                                        <div style={{ marginTop: '2px', color: 'var(--color-text)' }}>
                                            {new Date(t.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>

                                    {/* Acciones Rápidas */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleImpersonate(t.id, t.company_name)}
                                            title="Ingresar como Soporte Técnico"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}
                                        >
                                            <LogIn size={13} />
                                            <span>Soporte</span>
                                        </button>

                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setEditingTenant({ ...t })}
                                            title="Editar información de la empresa"
                                        >
                                            <Edit3 size={13} />
                                        </button>

                                        <button
                                            className={`btn btn-sm ${t.subscription_status === 'suspended' ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => handleStatus(t.id, t.subscription_status)}
                                            style={{ fontSize: '12px' }}
                                        >
                                            {t.subscription_status === 'suspended' ? 'Reactivar' : 'Suspender'}
                                        </button>
                                    </div>

                                    {/* Chevron Toggle */}
                                    <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </div>

                                {/* Expanded Detail Panel */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--color-border)', padding: '24px', background: 'var(--color-bg-secondary)' }}>
                                        {detailLoading ? (
                                            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                                                <div className="spinner"></div>
                                            </div>
                                        ) : tenantDetail ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                
                                                {/* Operational Metric Cards */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                                                    {[
                                                        { label: 'Usuarios', value: tenantDetail.operations?.total_users || 0, icon: Users, color: '#3b82f6' },
                                                        { label: 'Sucursales', value: tenantDetail.branches?.length || 0, icon: GitBranch, color: '#8b5cf6' },
                                                        { label: 'Reparaciones', value: tenantDetail.operations?.total_repairs || 0, icon: Wrench, color: '#f59e0b' },
                                                        { label: 'Ventas POS', value: tenantDetail.operations?.total_sales || 0, icon: ShoppingBag, color: '#10b981' },
                                                        { label: 'Facturación', value: `$${parseFloat(tenantDetail.operations?.total_revenue || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`, icon: DollarSign, color: '#10b981' },
                                                    ].map((kpi, i) => (
                                                        <div
                                                            key={i}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '10px',
                                                                padding: '12px 14px',
                                                                background: 'var(--color-bg-card)',
                                                                borderRadius: 'var(--radius-md)',
                                                                border: '1px solid var(--color-border)'
                                                            }}
                                                        >
                                                            <kpi.icon size={18} style={{ color: kpi.color, flexShrink: 0 }} />
                                                            <div>
                                                                <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                                                                    {kpi.label}
                                                                </div>
                                                                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text)', marginTop: '2px' }}>
                                                                    {kpi.value}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Plan Control & SuperAdmin Actions */}
                                                <div style={{
                                                    background: 'var(--color-bg-card)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    padding: '16px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                    gap: '12px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                                                            Plan de la Empresa:
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            {plans.map(p => {
                                                                const isSelected = (tenantDetail.tenant?.plan_id || t.plan_id) === p.id;
                                                                return (
                                                                    <button
                                                                        key={p.id}
                                                                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                                                                        onClick={() => handleChangePlan(t.id, p.id)}
                                                                        disabled={isSelected}
                                                                        style={{ fontSize: '12px' }}
                                                                    >
                                                                        {p.name} (${parseFloat(p.price_monthly).toFixed(0)}/mes)
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => setResettingPasswordTenant(t)}
                                                            title="Restablecer contraseña del admin"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                                                        >
                                                            <Key size={13} />
                                                            <span>Reset Clave Admin</span>
                                                        </button>

                                                        {t.subscription_status === 'trial' && (
                                                            <button
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => handleExtendTrial(t.id, t.company_name, 15)}
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                                                            >
                                                                <Clock size={13} style={{ color: '#3b82f6' }} />
                                                                <span>Extender Prueba (+15 Días)</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Sucursales Registradas */}
                                                {tenantDetail.branches?.length > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                                                            Sucursales Registradas ({tenantDetail.branches.length})
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                                                            {tenantDetail.branches.map(b => (
                                                                <div
                                                                    key={b.id}
                                                                    style={{
                                                                        background: 'var(--color-bg-card)',
                                                                        border: '1px solid var(--color-border)',
                                                                        borderRadius: 'var(--radius-sm)',
                                                                        padding: '10px 12px',
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        gap: '2px',
                                                                        fontSize: '12px'
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{b.name}</span>
                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-secondary)' }}>{b.code}</span>
                                                                    </div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {b.address || 'Sin dirección registrada'}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Users Breakdown */}
                                                {tenantDetail.users_by_role?.length > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                                                            Desglose de Usuarios
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            {tenantDetail.users_by_role.map((ur, i) => (
                                                                <div
                                                                    key={i}
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        borderRadius: 'var(--radius-sm)',
                                                                        fontSize: '12px',
                                                                        background: 'var(--color-bg-card)',
                                                                        color: 'var(--color-text)',
                                                                        border: '1px solid var(--color-border)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px'
                                                                    }}
                                                                >
                                                                    <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{ur.role}:</span>
                                                                    <span style={{ color: 'var(--color-text-secondary)' }}>{ur.count} ({ur.active_count} activos)</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Recent Activity Log */}
                                                {tenantDetail.recent_activity?.length > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                                                            Actividad Reciente en la Organización
                                                        </div>
                                                        <div style={{
                                                            background: 'var(--color-bg-card)',
                                                            border: '1px solid var(--color-border)',
                                                            borderRadius: 'var(--radius-md)',
                                                            padding: '8px 14px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '6px',
                                                            maxHeight: '140px',
                                                            overflowY: 'auto'
                                                        }}>
                                                            {tenantDetail.recent_activity.map((a, i) => (
                                                                <div
                                                                    key={i}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '10px',
                                                                        fontSize: '12px',
                                                                        padding: '4px 0',
                                                                        borderBottom: i < tenantDetail.recent_activity.length - 1 ? '1px solid var(--color-border)' : 'none'
                                                                    }}
                                                                >
                                                                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{a.user_email}</span>
                                                                    <span style={{
                                                                        fontFamily: 'var(--font-mono)',
                                                                        fontSize: '11px',
                                                                        background: 'var(--color-bg-tertiary)',
                                                                        padding: '1px 6px',
                                                                        borderRadius: '3px',
                                                                        color: 'var(--color-text-secondary)'
                                                                    }}>
                                                                        {a.action}
                                                                    </span>
                                                                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                                                                        {new Date(a.created_at).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '13px' }}>
                                                No se pudo cargar el detalle operativo.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Tenant Modal */}
            {showCreateModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '520px', position: 'relative', padding: '28px' }}>
                        <button
                            onClick={() => setShowCreateModal(false)}
                            style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>
                        
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Building2 size={20} className="text-primary" />
                            <span>Aprovisionar Nueva Empresa</span>
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px 0' }}>
                            Registra una organización cliente y su usuario administrador inicial.
                        </p>

                        {errorMsg && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '16px' }}>
                                {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="label">Nombre Comercial de la Empresa *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Ej. Reparaciones Express"
                                    value={newTenant.company_name}
                                    onChange={e => {
                                        const name = e.target.value;
                                        setNewTenant(prev => ({
                                            ...prev,
                                            company_name: name,
                                            slug: prev.slug ? prev.slug : name.toLowerCase().replace(/[^a-z0-9]/g, '-')
                                        }));
                                    }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Slug Identificador *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="reparaciones-express"
                                        value={newTenant.slug}
                                        onChange={e => setNewTenant({ ...newTenant, slug: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Plan Inicial *</label>
                                    <select
                                        className="select"
                                        value={newTenant.plan_id}
                                        onChange={e => setNewTenant({ ...newTenant, plan_id: e.target.value })}
                                    >
                                        {plans.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} (${parseFloat(p.price_monthly).toFixed(0)}/mes)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--color-border)', margin: '6px 0', paddingTop: '10px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Datos del Administrador Inicial
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Nombre *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Carlos"
                                        value={newTenant.admin_first_name}
                                        onChange={e => setNewTenant({ ...newTenant, admin_first_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Apellido *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Pérez"
                                        value={newTenant.admin_last_name}
                                        onChange={e => setNewTenant({ ...newTenant, admin_last_name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Correo Electrónico de Acceso *</label>
                                <input
                                    type="email"
                                    className="input"
                                    placeholder="admin@empresa.com"
                                    value={newTenant.admin_email}
                                    onChange={e => setNewTenant({ ...newTenant, admin_email: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Contraseña Inicial *</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Mínimo 6 caracteres"
                                    value={newTenant.admin_password}
                                    onChange={e => setNewTenant({ ...newTenant, admin_password: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '14px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Aprovisionando...' : 'Crear Organización'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Tenant Modal */}
            {editingTenant && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', position: 'relative', padding: '28px' }}>
                        <button
                            onClick={() => setEditingTenant(null)}
                            style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>

                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Edit3 size={20} className="text-primary" />
                            <span>Editar Datos de Organización</span>
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px 0' }}>
                            Modifica los datos comerciales e identificadores de la empresa.
                        </p>

                        <form onSubmit={handleUpdateTenantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="label">Nombre Comercial *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={editingTenant.company_name}
                                    onChange={e => setEditingTenant({ ...editingTenant, company_name: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Slug Identificador (URL) *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={editingTenant.slug}
                                    onChange={e => setEditingTenant({ ...editingTenant, slug: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">RFC / Tax ID</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="XAXX010101000"
                                    value={editingTenant.tax_id || ''}
                                    onChange={e => setEditingTenant({ ...editingTenant, tax_id: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '14px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingTenant(null)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resettingPasswordTenant && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '440px', position: 'relative', padding: '28px' }}>
                        <button
                            onClick={() => setResettingPasswordTenant(null)}
                            style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>

                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Key size={20} className="text-primary" />
                            <span>Restablecer Clave de Admin</span>
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px 0' }}>
                            Asigna una nueva contraseña de emergencia para el administrador de <strong>{resettingPasswordTenant.company_name}</strong>.
                        </p>

                        <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="label">Nueva Contraseña Temporal *</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Mínimo 6 caracteres"
                                    value={newPasswordValue}
                                    onChange={e => setNewPasswordValue(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '14px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setResettingPasswordTenant(null)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Actualizar Contraseña
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
