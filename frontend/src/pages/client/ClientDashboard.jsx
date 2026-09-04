import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { repairService } from '../../services/api';
import {
    Smartphone,
    CheckCircle,
    ClipboardList,
    FileText,
    User,
    ChevronRight,
    Clock,
    Activity,
    Shield,
    PieChart as PieIcon,
    DollarSign,
    TrendingUp,
    Package,
    ShoppingBag
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    AreaChart, Area
} from 'recharts';
import './ClientDashboard.css';

// Mapeo de estados
const statusLabels = {
    received: 'Recibido',
    diagnosing: 'En Diagnóstico',
    waiting_approval: 'Esperando Aprobación',
    waiting_parts: 'Esperando Refacciones',
    repairing: 'En Reparación',
    quality_check: 'Control de Calidad',
    ready: 'Listo para Entrega',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
};

const getProgressPercent = (status) => {
    const steps = ['received', 'diagnosing', 'waiting_approval', 'waiting_parts', 'repairing', 'quality_check', 'ready', 'delivered'];
    const index = steps.indexOf(status);
    if (index === -1) return 0;
    if (status === 'cancelled') return 0;
    return Math.round(((index + 1) / steps.length) * 100);
};

export default function ClientDashboard() {
    const { user } = useAuth();
    const [repairs, setRepairs] = useState([]);
    const [allRepairsList, setAllRepairsList] = useState([]);
    const [stats, setStats] = useState({
        active: 0,
        completed: 0,
        total: 0
    });
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        fetchRepairs();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchRepairs = async () => {
        try {
            const allData = await repairService.getAll({ limit: 500 });
            const all = allData.repairs || [];

            const active = all.filter(r => !['delivered', 'cancelled'].includes(r.status)).length;
            const completed = all.filter(r => r.status === 'delivered').length;

            setAllRepairsList(all);
            setRepairs(all.slice(0, 5));
            setStats({ active, completed, total: all.length });
        } catch (error) {
            console.error('Error al cargar reparaciones:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calcular total gastado y historial mensual de gastos sobre TODAS las reparaciones
    const totalSpent = useMemo(() => {
        return allRepairsList.reduce((sum, r) => sum + parseFloat(r.total_cost || 0), 0);
    }, [allRepairsList]);

    const monthlySpending = useMemo(() => {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const grouped = {};
        allRepairsList.forEach(r => {
            if (!r.created_at) return;
            const d = new Date(r.created_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!grouped[key]) grouped[key] = 0;
            grouped[key] += parseFloat(r.total_cost || 0);
        });
        return Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6)
            .map(([key, amount]) => {
                const [y, m] = key.split('-');
                return { label: `${months[parseInt(m) - 1]} '${y.slice(-2)}`, amount };
            });
    }, [allRepairsList]);

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Buenos dias';
        if (hour < 19) return 'Buenas tardes';
        return 'Buenas noches';
    };

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Cargando tu panel...</p>
            </div>
        );
    }

    return (
        <main className="dashboard-main animate-fadeIn">
            {/* Welcome Banner */}
            <div className="welcome-banner">
                <div className="welcome-content">
                    <span className="welcome-time">
                        <Clock size={14} />
                        {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <h1>¡{getGreeting()}, {user?.first_name}!</h1>
                    <p>Sigue de cerca el estado de tus dispositivos y solicita nuevas cotizaciones al instante.</p>
                </div>
                <div className="welcome-actions">
                    <Link to="/dashboard/nueva-cotizacion" className="btn btn-primary">
                        <FileText size={18} />
                        Nueva Cotización
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <div className="stat-card">
                    <div className="stat-icon active">
                        <Smartphone size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.active}</span>
                        <span className="stat-label">Reparaciones Activas</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon completed">
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.completed}</span>
                        <span className="stat-label">Dispositivos Entregados</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon total">
                        <ClipboardList size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Historial Total</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                        <DollarSign size={24} style={{ color: '#10b981' }} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: '18px' }}>
                            ${totalSpent.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                        </span>
                        <span className="stat-label">Total Invertido</span>
                    </div>
                </div>
            </div>

            {/* Graficas del Cliente */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                {/* Historial de Gastos Mensual */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={18} style={{ color: '#10b981' }} />
                        Historial de Gastos (Ultimos 6 Meses)
                    </h3>
                    {monthlySpending.length === 0 ? (
                        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '30px', fontSize: '13px' }}>Sin historial de gastos aun.</p>
                    ) : (
                        <div style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlySpending} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="clientSpendGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                                    <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v/1000).toFixed(0) + 'K' : v}`} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                                    <Tooltip formatter={(v) => [`$${parseFloat(v).toLocaleString('es-MX')}`, 'Gasto']} />
                                    <Area type="monotone" dataKey="amount" name="Gasto" stroke="#10b981" strokeWidth={2} fill="url(#clientSpendGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Resumen de Dispositivos */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PieIcon size={18} className="text-primary" /> Estado de Mis Equipos
                    </h3>
                    {repairs.length === 0 ? (
                        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '30px', fontSize: '13px' }}>No tienes equipos registrados.</p>
                    ) : (
                        <div style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { name: 'Activas', total: stats.active },
                                    { name: 'Completadas', total: stats.completed },
                                    { name: 'Total', total: stats.total }
                                ]}>
                                    <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} />
                                    <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} allowDecimals={false} />
                                    <Tooltip formatter={(val) => [`${val} equipos`, 'Cantidad']} />
                                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                        <Cell key="0" fill="#3b82f6" />
                                        <Cell key="1" fill="#10b981" />
                                        <Cell key="2" fill="#6366f1" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Split */}
            <div className="dashboard-split-layout">
                {/* Recent Repairs */}
                <section className="dashboard-section main-col">
                    <div className="section-header">
                        <h2>Dispositivos en Proceso</h2>
                        <Link to="/dashboard/reparaciones" className="btn btn-ghost btn-sm">
                            Ver todo <ChevronRight size={16} />
                        </Link>
                    </div>

                    {repairs.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <Smartphone size={48} />
                            </div>
                            <h3>No tienes reparaciones activas</h3>
                            <p>Solicita una cotización gratuita para comenzar a reparar tu dispositivo.</p>
                            <Link to="/dashboard/nueva-cotizacion" className="btn btn-primary" style={{ marginTop: 'var(--sp-4)' }}>
                                Solicitar Cotización
                            </Link>
                        </div>
                    ) : (
                        <div className="repairs-list">
                            {repairs.map((repair) => {
                                const progress = getProgressPercent(repair.status);
                                return (
                                    <div key={repair.id} className="repair-card-premium">
                                        <div className="card-top">
                                            <div className="device-brand-info">
                                                <Smartphone className="device-type-icon text-primary" size={20} />
                                                <div>
                                                    <h3>{repair.device_type_name} {repair.brand_name || repair.brand_other}</h3>
                                                    <span className="model-name">{repair.model}</span>
                                                </div>
                                            </div>
                                            <span className={`status-badge status-${repair.status}`}>
                                                {statusLabels[repair.status]}
                                            </span>
                                        </div>
                                        
                                        <div className="card-progress-section">
                                            <div className="progress-bar-container">
                                                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                                            </div>
                                            <div className="progress-labels">
                                                <span>Recibido</span>
                                                <span>Progreso: {progress}%</span>
                                                <span>Listo</span>
                                            </div>
                                        </div>

                                        <div className="card-footer-info">
                                            <span className="ticket-code">Ticket: <strong>{repair.ticket_number}</strong></span>
                                            <Link to={`/dashboard/reparaciones/${repair.id}`} className="btn btn-secondary btn-sm">
                                                Ver Detalle
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Quick Actions Column */}
                <section className="dashboard-section sidebar-col">
                    <h2>Acciones Rápidas</h2>
                    <div className="quick-actions-list">
                        <Link to="/dashboard/nueva-cotizacion" className="quick-action-item">
                            <div className="action-item-icon">
                                <FileText size={20} />
                            </div>
                            <div className="action-item-text">
                                <h4>Solicitar Reparación</h4>
                                <p>Ingresa los detalles de tu dispositivo</p>
                            </div>
                            <ChevronRight size={16} className="chevron" />
                        </Link>

                        <Link to="/dashboard/reparaciones" className="quick-action-item">
                            <div className="action-item-icon">
                                <Activity size={20} />
                            </div>
                            <div className="action-item-text">
                                <h4>Ver Mis Dispositivos</h4>
                                <p>Rastrea el progreso en tiempo real</p>
                            </div>
                            <ChevronRight size={16} className="chevron" />
                        </Link>

                        <Link to="/dashboard/pedidos" className="quick-action-item">
                            <div className="action-item-icon">
                                <Package size={20} />
                            </div>
                            <div className="action-item-text">
                                <h4>Mis Pedidos</h4>
                                <p>Revisa tus compras de refacciones y tienda</p>
                            </div>
                            <ChevronRight size={16} className="chevron" />
                        </Link>

                        <Link to="/dashboard/tienda" className="quick-action-item">
                            <div className="action-item-icon">
                                <ShoppingBag size={20} />
                            </div>
                            <div className="action-item-text">
                                <h4>Catálogo de Tienda</h4>
                                <p>Productos, accesorios y servicios en línea</p>
                            </div>
                            <ChevronRight size={16} className="chevron" />
                        </Link>

                        <Link to="/dashboard/perfil" className="quick-action-item">
                            <div className="action-item-icon">
                                <User size={20} />
                            </div>
                            <div className="action-item-text">
                                <h4>Editar Mi Perfil</h4>
                                <p>Actualiza tu dirección y contraseña</p>
                            </div>
                            <ChevronRight size={16} className="chevron" />
                        </Link>
                    </div>

                    <div className="security-info-box" style={{ marginTop: 'var(--sp-6)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-5)', display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
                        <Shield size={24} className="text-primary" style={{ flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>Servicio Garantizado</h4>
                            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                                Todas nuestras reparaciones cuentan con garantía extendida registrada automáticamente en tu perfil.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
