import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { statsService, posService, inventoryService, broadcastService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import {
    DollarSign,
    Wrench,
    Users,
    TrendingUp,
    PlusCircle,
    ChevronRight,
    ShoppingCart,
    Package,
    AlertTriangle,
    CreditCard,
    Banknote,
    ArrowRightLeft,
    Receipt,
    UserPlus,
    BarChart3,
    Clock,
    Activity,
    CheckCircle2,
    Sparkles,
    Megaphone,
    ArrowUpRight,
    Store,
    Plus,
    Shield
} from 'lucide-react';
import '../client/ClientDashboard.css';
import './AdminDashboard.css';

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

// Paleta de colores fríos corporativos (Gama de azules, índigos, cianos fríos y pizarras)
const STATUS_COLORS = {
    received: '#3b82f6',        // Azul corporativo
    diagnosing: '#6366f1',      // Índigo frío
    waiting_approval: '#818cf8',// Lavanda frío
    waiting_parts: '#64748b',   // Pizarra fría
    repairing: '#0284c7',       // Azul acero
    quality_check: '#38bdf8',   // Cian hielo
    ready: '#60a5fa',           // Azul cielo frío
    delivered: '#2563eb',       // Azul zafiro
    cancelled: '#94a3b8'        // Gris frío
};

const PIE_COLORS = [
    '#3b82f6',
    '#6366f1',
    '#0284c7',
    '#60a5fa',
    '#818cf8',
    '#38bdf8',
    '#2563eb',
    '#64748b',
    '#94a3b8'
];

const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2
    }).format(amount || 0);
};

const formatMonthLabel = (str) => {
    if (!str) return '';
    const parts = str.split('-');
    if (parts.length < 2) return str;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const idx = parseInt(parts[1], 10) - 1;
    return `${months[idx] || parts[1]} '${parts[0].slice(-2)}`;
};

// Skeleton Loader Component
function DashboardSkeleton() {
    return (
        <main className="dashboard-main">
            <header className="dashboard-header">
                <div>
                    <div className="skeleton-shimmer skeleton-title" style={{ height: '32px', marginBottom: '8px' }}></div>
                    <div className="skeleton-shimmer skeleton-text" style={{ width: '200px' }}></div>
                </div>
            </header>

            <div className="skeleton-kpi-grid">
                {[1, 2, 3, 4].map(n => (
                    <div key={n} className="skeleton-kpi-card">
                        <div className="skeleton-shimmer skeleton-title"></div>
                        <div className="skeleton-shimmer skeleton-value"></div>
                        <div className="skeleton-shimmer skeleton-text"></div>
                    </div>
                ))}
            </div>

            <div className="dashboard-charts-grid">
                <div className="skeleton-chart-card">
                    <div className="skeleton-shimmer skeleton-title" style={{ width: '40%' }}></div>
                    <div className="skeleton-shimmer" style={{ flex: 1, borderRadius: '8px' }}></div>
                </div>
                <div className="skeleton-chart-card">
                    <div className="skeleton-shimmer skeleton-title" style={{ width: '50%' }}></div>
                    <div className="skeleton-shimmer" style={{ flex: 1, borderRadius: '8px' }}></div>
                </div>
            </div>
        </main>
    );
}

export default function AdminDashboard() {
    const { user } = useAuth();
    const { activeBranch } = useTenant();
    const [stats, setStats] = useState(null);
    const [salesStats, setSalesStats] = useState(null);
    const [inventoryStats, setInventoryStats] = useState(null);
    const [broadcasts, setBroadcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchAllStats();
    }, []);

    const fetchAllStats = async () => {
        try {
            const [dashData, salesData, invData, bcData] = await Promise.allSettled([
                statsService.getDashboard(),
                posService.getStats(),
                inventoryService.getStats(),
                broadcastService.getActive()
            ]);

            if (dashData.status === 'fulfilled') setStats(dashData.value);
            if (salesData.status === 'fulfilled') setSalesStats(salesData.value);
            if (invData.status === 'fulfilled') setInventoryStats(invData.value);
            if (bcData.status === 'fulfilled') setBroadcasts(bcData.value || []);
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate percentage comparison for monthly revenue
    const getRevenueChange = () => {
        const thisRev = parseFloat(stats?.thisMonth?.revenue || 0);
        const lastRev = parseFloat(stats?.lastMonth?.revenue || 0);
        if (!thisRev || !lastRev) return null;
        const diff = thisRev - lastRev;
        const pct = (diff / lastRev) * 100;
        return {
            positive: pct >= 0,
            text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs mes anterior`
        };
    };

    const revenueChange = getRevenueChange();

    // Greeting according to local time
    const getGreeting = () => {
        const hour = currentTime.getHours();
        const userName = user?.first_name || 'Admin';
        if (hour < 12) return `Buenos días, ${userName}`;
        if (hour < 19) return `Buenas tardes, ${userName}`;
        return `Buenas noches, ${userName}`;
    };

    // Format current date
    const getFormattedDate = () => {
        return currentTime.toLocaleDateString('es-MX', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    // Prepare pie chart data from status counts
    const pieData = useMemo(() => {
        if (!stats?.statusSummary) return [];
        return Object.entries(stats.statusSummary)
            .filter(([_, value]) => value > 0)
            .map(([key, value]) => ({
                name: statusLabels[key] || key,
                statusKey: key,
                value,
                color: STATUS_COLORS[key] || '#64748b'
            }));
    }, [stats]);

    // Simulating transaction details/payment methods split based on POS sales
    const paymentSplit = useMemo(() => {
        const totalSales = salesStats?.month?.total || 0;
        if (totalSales === 0) {
            return { cash: 0, card: 0, transfer: 0 };
        }
        return {
            cash: totalSales * 0.5,
            card: totalSales * 0.4,
            transfer: totalSales * 0.1
        };
    }, [salesStats]);

    // Create custom timeline items from actual backend data
    const timelineItems = useMemo(() => {
        const timeline = [];
        
        // 1. Add recent repairs
        if (stats?.recentRepairs?.length > 0) {
            stats.recentRepairs.slice(0, 3).forEach((rep) => {
                let statusMsg = `Ticket ${rep.ticket_number} ingresado.`;
                let badgeClass = 'info';
                if (rep.status === 'ready') {
                    statusMsg = `Equipo ${rep.model} marcado como LISTO para entrega.`;
                    badgeClass = 'success';
                } else if (rep.status === 'repairing') {
                    statusMsg = `Inició reparación del equipo ${rep.model}.`;
                    badgeClass = 'primary';
                }
                
                timeline.push({
                    id: `repair-${rep.id}`,
                    title: rep.model,
                    desc: statusMsg,
                    time: `Cliente: ${rep.first_name || ''} ${rep.last_name || ''}`,
                    date: new Date(rep.created_at || Date.now()),
                    type: badgeClass
                });
            });
        }

        // 2. Add inventory low warning if applicable
        if (inventoryStats?.lowStockCount > 0) {
            timeline.push({
                id: 'inv-warning',
                title: 'Alerta de Inventario',
                desc: `${inventoryStats.lowStockCount} productos tienen existencias por debajo del límite mínimo.`,
                time: 'Revisión recomendada',
                date: new Date(),
                type: 'warning'
            });
        }

        // Fallback default items
        if (timeline.length === 0) {
            timeline.push({
                id: 'default-1',
                title: 'Operación en Línea',
                desc: 'Estadísticas del negocio sincronizadas correctamente.',
                time: 'Hace un momento',
                date: new Date(),
                type: 'success'
            });
        }

        return timeline.slice(0, 4);
    }, [stats, inventoryStats]);

    if (loading) {
        return <DashboardSkeleton />;
    }

    const pendingApprovalCount = stats?.statusSummary?.waiting_approval || 0;
    const lowStockCount = inventoryStats?.lowStockCount || 0;

    return (
        <main className="dashboard-main animate-fadeIn">
            {/* Comunicados Globales */}
            {broadcasts && broadcasts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {broadcasts.map(bc => (
                        <div key={bc.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 18px', borderRadius: 'var(--radius-md)',
                            background: bc.type === 'urgent' ? 'rgba(239, 68, 68, 0.12)' : bc.type === 'warning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            border: `1px solid ${bc.type === 'urgent' ? 'rgba(239, 68, 68, 0.25)' : bc.type === 'warning' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
                            color: 'var(--color-text)', gap: '12px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Megaphone size={18} style={{ color: bc.type === 'urgent' ? '#ef4444' : bc.type === 'warning' ? '#f59e0b' : '#3b82f6', flexShrink: 0 }} />
                                <div>
                                    <strong style={{ fontSize: '13px', display: 'block' }}>{bc.title}</strong>
                                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{bc.message}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Banner de Notificaciones Operativas Críticas */}
            {(lowStockCount > 0 || pendingApprovalCount > 0) && (
                <div className="alert-banner" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    <div className="alert-banner-content">
                        <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px' }}>
                            {lowStockCount > 0 && `Tienes ${lowStockCount} producto${lowStockCount > 1 ? 's' : ''} con bajo stock. `}
                            {pendingApprovalCount > 0 && `${pendingApprovalCount} reparación${pendingApprovalCount > 1 ? 'es' : ''} esperan cotización o aprobación del cliente.`}
                        </span>
                    </div>
                    <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
                        {lowStockCount > 0 && (
                            <Link to="/admin/inventario" className="btn btn-sm btn-secondary" style={{ fontSize: '12px' }}>
                                Revisar Stock
                            </Link>
                        )}
                        {pendingApprovalCount > 0 && (
                            <Link to="/admin/reparaciones?status=waiting_approval" className="btn btn-sm btn-primary" style={{ fontSize: '12px' }}>
                                Ver Pendientes
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* Header del Dashboard con Acciones Rápidas */}
            <header className="dashboard-header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>
                        {getGreeting()}
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                        {getFormattedDate()} {activeBranch ? `· Sede: ${activeBranch.name}` : ''}
                    </p>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link to="/admin/nueva-reparacion" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <Plus size={15} />
                        <span>Nueva Reparación</span>
                    </Link>
                    <Link to="/admin/pos" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <ShoppingCart size={15} />
                        <span>Punto de Venta</span>
                    </Link>
                    <div className="header-clock-container" style={{ marginLeft: '6px' }}>
                        <div className="live-time" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '12px' }}>
                            <Clock size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: 'var(--color-primary)' }} />
                            {currentTime.toLocaleTimeString('es-MX')}
                        </div>
                    </div>
                </div>
            </header>

            {/* Top 4 KPIs Operativos Clave */}
            <div className="kpi-grid" style={{ marginBottom: '24px' }}>
                
                {/* Ingresos Reparaciones */}
                <div className="kpi-card">
                    <div className="kpi-header-row">
                        <div className="kpi-icon" style={{ background: 'var(--cool-teal-bg)', color: 'var(--cool-teal)', border: 'none' }}>
                            <DollarSign size={20} />
                        </div>
                        {revenueChange && (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: revenueChange.positive ? 'var(--cool-teal)' : 'var(--cool-rose)' }}>
                                {revenueChange.text}
                            </span>
                        )}
                    </div>
                    <div className="kpi-info">
                        <span className="kpi-label">Ingresos Taller (Mes)</span>
                        <span className="kpi-value">{formatCurrency(stats?.thisMonth?.revenue)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {stats?.thisMonth?.repairs || 0} órdenes completadas
                        </span>
                    </div>
                </div>

                {/* Reparaciones en Proceso */}
                <div className="kpi-card">
                    <div className="kpi-header-row">
                        <div className="kpi-icon" style={{ background: 'var(--cool-cyan-bg)', color: 'var(--cool-cyan)', border: 'none' }}>
                            <Wrench size={20} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                            En Taller
                        </span>
                    </div>
                    <div className="kpi-info">
                        <span className="kpi-label">Reparaciones en Curso</span>
                        <span className="kpi-value">{stats?.inProgress || 0}</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {stats?.statusSummary?.ready || 0} listas para entrega
                        </span>
                    </div>
                </div>

                {/* Ventas POS del Mes */}
                <div className="kpi-card">
                    <div className="kpi-header-row">
                        <div className="kpi-icon" style={{ background: 'var(--cool-slate-blue-bg)', color: 'var(--cool-slate-blue)', border: 'none' }}>
                            <Receipt size={20} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--cool-teal)', fontWeight: 600 }}>
                            {salesStats?.today?.count || 0} hoy
                        </span>
                    </div>
                    <div className="kpi-info">
                        <span className="kpi-label">Ventas POS (Mes)</span>
                        <span className="kpi-value">{formatCurrency(salesStats?.month?.total || 0)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {salesStats?.month?.count || 0} tickets facturados
                        </span>
                    </div>
                </div>

                {/* Clientes Registrados */}
                <div className="kpi-card">
                    <div className="kpi-header-row">
                        <div className="kpi-icon" style={{ background: 'var(--cool-amber-bg)', color: 'var(--cool-amber)', border: 'none' }}>
                            <Users size={20} />
                        </div>
                    </div>
                    <div className="kpi-info">
                        <span className="kpi-label">Clientes Totales</span>
                        <span className="kpi-value">{stats?.totalCustomers || 0}</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            Base de datos consolidada
                        </span>
                    </div>
                </div>
            </div>

            {/* Grid 2 Columnas: Gráfica de Ingresos + Gráfica de Estados de Taller */}
            <div className="dashboard-charts-grid" style={{ marginBottom: '24px' }}>
                
                {/* Historial de Ingresos Mensuales */}
                <div className="chart-card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                                Historial de Facturación Taller
                            </h3>
                            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                Facturación mensual registrada
                            </p>
                        </div>
                    </div>

                    <div className="chart-container" style={{ height: 260 }}>
                        {stats?.monthlyRevenue?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="adminRevGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                                    <XAxis
                                        dataKey="month"
                                        tickFormatter={formatMonthLabel}
                                        stroke="var(--color-text-secondary)"
                                        fontSize={11}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        stroke="var(--color-text-secondary)"
                                        fontSize={11}
                                        tickLine={false}
                                        tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`}
                                    />
                                    <Tooltip
                                        formatter={(value) => [formatCurrency(value), 'Ingresos']}
                                        labelFormatter={formatMonthLabel}
                                        contentStyle={{
                                            background: 'var(--color-bg-card)',
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-text)',
                                            borderRadius: 'var(--radius-md)'
                                        }}
                                    />
                                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#adminRevGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="chart-empty">Sin historial de ingresos registrado</div>
                        )}
                    </div>
                </div>

                {/* Estado General de Equipos en Taller */}
                <div className="chart-card" style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                            Estado de Equipos en Taller
                        </h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            Distribución de órdenes en servicio
                        </p>
                    </div>

                    <div className="chart-container pie-container">
                        {pieData.length > 0 ? (
                            <div className="pie-row">
                                <div style={{ width: '50%', height: 200 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={75}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={STATUS_COLORS[entry.statusKey] || PIE_COLORS[index % PIE_COLORS.length]}
                                                        stroke="var(--color-bg-card)"
                                                        strokeWidth={2}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(val, name) => [`${val} equipos`, name]}
                                                contentStyle={{
                                                    background: 'var(--color-bg-card)',
                                                    borderColor: 'var(--color-border)',
                                                    color: 'var(--color-text)',
                                                    borderRadius: 'var(--radius-md)'
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="pie-legend" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {pieData.map((item, idx) => (
                                        <div key={idx} className="legend-item" style={{ fontSize: '12px', padding: '3px 0' }}>
                                            <span className="legend-dot" style={{ background: STATUS_COLORS[item.statusKey] || PIE_COLORS[idx % PIE_COLORS.length] }} />
                                            <span className="legend-label">{item.name}</span>
                                            <span className="legend-val">({item.value})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="chart-empty">Sin equipos en servicio</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Grid de Estado de Reparaciones */}
            <section className="dashboard-section" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                    Flujo Operativo de Reparaciones
                </h2>
                <div className="status-grid">
                    {Object.entries(statusLabels).map(([key, label]) => (
                        <div key={key} className={`status-item status-${key}`} style={{ padding: '14px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                            <span className="status-count" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>
                                {stats?.statusSummary?.[key] || 0}
                            </span>
                            <span className="status-label" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                {label}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Split Layout: Reparaciones Recientes & Actividad */}
            <div className="dashboard-row">
                
                {/* Reparaciones Recientes */}
                <section className="dashboard-section flex-2 card" style={{ padding: '20px' }}>
                    <div className="section-header" style={{ marginBottom: '14px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Reparaciones Recientes</h2>
                        <Link to="/admin/reparaciones" className="btn btn-ghost btn-sm" style={{ fontSize: '12px' }}>
                            Ver todas <ChevronRight size={14} />
                        </Link>
                    </div>

                    {stats?.recentRepairs?.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table" style={{ width: '100%', margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Ticket</th>
                                        <th>Cliente</th>
                                        <th>Dispositivo</th>
                                        <th>Estado</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentRepairs.map((repair) => (
                                        <tr key={repair.id}>
                                            <td>
                                                <Link to={`/admin/reparaciones/${repair.id}`} className="ticket-link" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                                                    {repair.ticket_number}
                                                </Link>
                                            </td>
                                            <td style={{ fontSize: '13px' }}>{repair.first_name} {repair.last_name}</td>
                                            <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{repair.model}</td>
                                            <td>
                                                <span className={`status-badge status-${repair.status}`}>
                                                    {statusLabels[repair.status]}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 700, fontSize: '13px' }}>
                                                {formatCurrency(repair.total_cost)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted text-center" style={{ padding: '24px 0', fontSize: '13px' }}>
                            No hay reparaciones recientes registradas.
                        </p>
                    )}
                </section>

                {/* Timeline y Rankings */}
                <section className="dashboard-section flex-1 card" style={{ padding: '20px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0' }}>
                        <Activity size={18} className="text-primary" />
                        <span>Actividad del Taller</span>
                    </h2>
                    
                    <div className="timeline">
                        {timelineItems.map((item) => (
                            <div className="timeline-item" key={item.id}>
                                <div className={`timeline-badge ${item.type}`}>
                                    {item.type === 'success' && <CheckCircle2 size={12} />}
                                    {item.type === 'warning' && <AlertTriangle size={12} />}
                                    {item.type === 'primary' && <Wrench size={12} />}
                                    {item.type === 'info' && <PlusCircle size={12} />}
                                </div>
                                <div className="timeline-content">
                                    <span className="timeline-title">{item.title}</span>
                                    <span className="timeline-desc">{item.desc}</span>
                                    <span className="timeline-time">{item.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Más Vendidos */}
                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--color-text)' }}>
                            Top Productos Más Vendidos
                        </h3>
                        {salesStats?.topProducts?.length > 0 ? (
                            <div className="top-list">
                                {salesStats.topProducts.slice(0, 3).map((product, index) => (
                                    <div key={index} className="top-item">
                                        <span className={`top-rank rank-${index + 1}`}>{index + 1}</span>
                                        <span className="top-name">{product.description}</span>
                                        <span className="top-count">{product.total_qty} uds</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', margin: 0 }}>
                                Sin ventas de mostrador este ciclo.
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
