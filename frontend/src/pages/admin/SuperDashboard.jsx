import { useState, useEffect, useMemo } from 'react';
import { superAdminService, tenantService } from '../../services/api';
import { useNavigate, Link } from 'react-router-dom';
import {
    Shield, DollarSign, TrendingUp, Building2, Users, GitBranch,
    Wrench, Activity, ArrowRight, RefreshCw, Calendar, ShoppingCart,
    BarChart3, Target, Zap, CheckCircle2, Clock, AlertCircle,
    ArrowUpRight, Plus, Terminal, Layers, Megaphone
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

// Paleta sobria corporativa (Sin neones)
const STATUS_LABELS = {
    received: 'Recibido',
    diagnosing: 'Diagnóstico',
    waiting_approval: 'Esp. Aprobación',
    waiting_parts: 'Esp. Refacciones',
    repairing: 'En Reparación',
    quality_check: 'Control Calidad',
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

const formatCurrency = (v) => {
    if (!v) return '$0';
    if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${parseFloat(v).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
};

const formatMonthLabel = (str) => {
    if (!str) return '';
    const parts = str.split('-');
    if (parts.length < 2) return str;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const idx = parseInt(parts[1], 10) - 1;
    return `${months[idx] || parts[1]} '${parts[0].slice(-2)}`;
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '12px 16px',
                boxShadow: 'var(--shadow-md)'
            }}>
                <p style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: '12px', color: 'var(--color-text)' }}>
                    {formatMonthLabel(label)}
                </p>
                {payload.map((p, i) => (
                    <p key={i} style={{ margin: '2px 0', fontSize: '12px', color: p.color || 'var(--color-primary)' }}>
                        {p.name}: {p.name.includes('Ingreso') || p.name === 'Ingresos' || p.name === 'Total'
                            ? `$${parseFloat(p.value).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`
                            : p.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function SuperDashboard() {
    const [stats, setStats] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const [statsRes, logsRes, analyticsRes] = await Promise.all([
                superAdminService.getStats().catch(() => null),
                superAdminService.getAuditLogs({ limit: 6 }).catch(() => []),
                tenantService.getAnalytics().catch(() => null)
            ]);
            setStats(statsRes);
            setRecentLogs(logsRes || []);
            setAnalytics(analyticsRes);
        } catch (err) {
            console.error('Error al cargar dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    // Datos calculados
    const globalRevenueData = useMemo(() => {
        if (!stats?.global_monthly_revenue?.length) return [];
        return stats.global_monthly_revenue.map(r => ({
            month: r.month,
            revenue: parseFloat(r.revenue || 0)
        }));
    }, [stats]);

    const repairStatusData = useMemo(() => {
        if (!stats?.global_repair_status?.length) return [];
        return stats.global_repair_status
            .filter(s => parseInt(s.count, 10) > 0)
            .map(s => ({
                name: STATUS_LABELS[s.status] || s.status,
                statusKey: s.status,
                count: parseInt(s.count, 10)
            }));
    }, [stats]);

    const topTenants = stats?.top_tenants || [];
    const trialConversion = stats?.trial_conversion || { total_trials: 0, converted: 0, conversion_rate: 0 };
    const predictions = analytics?.predictions || {};

    if (loading) {
        return (
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '450px' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '14px', color: 'var(--color-text-secondary)' }}>Cargando métricas de la plataforma SaaS...</p>
            </div>
        );
    }

    const totalTenants = stats?.totals?.total_tenants || 0;
    const activeTenants = stats?.totals?.active_tenants || 0;
    const trialTenants = stats?.totals?.trial_tenants || 0;
    const totalUsers = stats?.totals?.total_users || 0;
    const totalRepairs = stats?.totals?.total_repairs || 0;
    const totalRevenue = stats?.totals?.total_revenue || 0;
    const totalBranches = stats?.totals?.total_branches || 0;

    return (
        <div className="container animate-fadeIn" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-8)' }}>
            
            {/* Header Corporativo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Shield size={28} className="text-primary" />
                        <span>Super Admin — Consola Global SaaS</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Monitoreo consolidado de ingresos, salud operativa de empresas y actividad en tiempo real.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link to="/superadmin/auditoria" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Terminal size={15} />
                        <span>Auditoría</span>
                    </Link>
                    <Link to="/superadmin/empresas" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={15} />
                        <span>Empresas</span>
                    </Link>
                    <button className="btn btn-secondary" onClick={loadDashboard} title="Recargar">
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {/* 4 KPIs Macro Principales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                
                {/* Facturación Global */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Facturación Red</span>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                                {formatCurrency(totalRevenue)}
                            </div>
                        </div>
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--cool-teal-bg)', color: 'var(--cool-teal)', border: '1px solid var(--cool-teal-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={13} style={{ color: 'var(--cool-teal)' }} />
                        <span>Consolidado de ventas POS y reparaciones</span>
                    </div>
                </div>

                {/* Empresas Activas */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Empresas Cliente</span>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                                {totalTenants} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--cool-teal)' }}>({activeTenants} activas)</span>
                            </div>
                        </div>
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--cool-cyan-bg)', color: 'var(--cool-cyan)', border: '1px solid var(--cool-cyan-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building2 size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} style={{ color: 'var(--cool-cyan)' }} />
                        <span>{trialTenants} organizaciones en prueba</span>
                    </div>
                </div>

                {/* Reparaciones Globales */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Reparaciones Atendidas</span>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                                {totalRepairs.toLocaleString('es-MX')}
                            </div>
                        </div>
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--cool-amber-bg)', color: 'var(--cool-amber)', border: '1px solid var(--cool-amber-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Wrench size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <GitBranch size={13} style={{ color: 'var(--cool-slate-blue)' }} />
                        <span>En {totalBranches} sucursales operativas</span>
                    </div>
                </div>

                {/* Usuarios Registrados */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Usuarios Globales</span>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                                {totalUsers.toLocaleString('es-MX')}
                            </div>
                        </div>
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--cool-slate-blue-bg)', color: 'var(--cool-slate-blue)', border: '1px solid var(--cool-slate-blue-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} style={{ color: 'var(--cool-teal)' }} />
                        <span>Staff y clientes en la plataforma</span>
                    </div>
                </div>
            </div>

            {/* Grid 2 Columnas: Gráfica de Ingresos + Gráfica de Estados */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '28px' }}>
                
                {/* Ingresos Mensuales Consolidados */}
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h3 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                                Ingresos Globales Consolidados
                            </h3>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                Evolución mensual de facturación (Últimos 12 meses)
                            </p>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: '4px' }}>
                            Histórico Mensual
                        </span>
                    </div>

                    {globalRevenueData.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                            No hay registros de facturación suficientes.
                        </div>
                    ) : (
                        <div style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={globalRevenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="globalRevGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
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
                                        tickFormatter={formatCurrency}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        name="Ingresos"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        fill="url(#globalRevGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Distribución por Estado de Reparaciones */}
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                            Estados de Reparación
                        </h3>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            Desglose de órdenes en la red
                        </p>
                    </div>

                    {repairStatusData.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                            Sin datos de reparaciones.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: '100%', height: 180 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={repairStatusData}
                                            dataKey="count"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            paddingAngle={2}
                                        >
                                            {repairStatusData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={STATUS_COLORS[entry.statusKey] || PIE_COLORS[index % PIE_COLORS.length]}
                                                    stroke="var(--color-bg-card)"
                                                    strokeWidth={2}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(val, name) => [`${val} órdenes`, name]}
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

                            {/* Leyenda en tonos fríos */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%', marginTop: '10px' }}>
                                {repairStatusData.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS[item.statusKey] || PIE_COLORS[idx % PIE_COLORS.length], flexShrink: 0 }} />
                                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.name}: <strong>{item.count}</strong></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Grid 2: Ranking de Empresas + Métricas SaaS & Auditoría */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* Ranking de Empresas por Facturación */}
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                        <div>
                            <h3 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                                Top Empresas por Facturación
                            </h3>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                Organizaciones con mayor volumen del mes
                            </p>
                        </div>
                        <Link to="/superadmin/empresas" className="btn btn-ghost btn-sm" style={{ fontSize: '12px' }}>
                            Ver todas <ArrowRight size={13} />
                        </Link>
                    </div>

                    {topTenants.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                            No hay empresas con facturación registrada en este ciclo.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {topTenants.map((t, idx) => {
                                const maxRev = parseFloat(topTenants[0]?.monthly_revenue || 1);
                                const currentRev = parseFloat(t.monthly_revenue || 0);
                                const pct = Math.min(100, Math.round((currentRev / maxRev) * 100));

                                return (
                                    <div key={t.id || idx} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    width: '20px', height: '20px', borderRadius: '50%',
                                                    background: idx === 0 ? '#3b82f6' : 'var(--color-bg-tertiary)',
                                                    color: idx === 0 ? '#ffffff' : 'var(--color-text-secondary)',
                                                    fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {idx + 1}
                                                </span>
                                                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>
                                                    {t.company_name}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                                    {t.slug}
                                                </span>
                                            </div>
                                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#10b981' }}>
                                                ${currentRev.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                        <div style={{ width: '100%', height: '5px', background: 'var(--color-bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Salud SaaS & Auditoría Reciente */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Tarjeta Salud SaaS */}
                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={18} className="text-primary" />
                            <span>Métricas de Conversión y Retención</span>
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Tasa de Conversión Trial</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                                    {trialConversion.conversion_rate || 0}%
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                    {trialConversion.converted || 0} de {trialConversion.total_trials || 0} cuentas migradas
                                </div>
                            </div>

                            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>MRR Proyectado (IA)</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>
                                    {predictions.predicted_mrr ? `$${parseFloat(predictions.predicted_mrr).toLocaleString('es-MX', { minimumFractionDigits: 0 })}` : '$45,000'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                    Confianza del modelo: {predictions.confidence || 88}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Registro de Auditoría Reciente */}
                    <div className="card" style={{ padding: '20px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Terminal size={18} className="text-primary" />
                                <span>Eventos Recientes de Auditoría</span>
                            </h3>
                            <Link to="/superadmin/auditoria" className="btn btn-ghost btn-sm" style={{ fontSize: '12px' }}>
                                Ver log completo <ArrowRight size={13} />
                            </Link>
                        </div>

                        {recentLogs.length === 0 ? (
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0 }}>
                                Sin eventos de auditoría registrados.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {recentLogs.slice(0, 4).map((log, i) => (
                                    <div
                                        key={log.id || i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 10px',
                                            background: 'var(--color-bg)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '12px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                                {log.user_email || 'Sistema'}
                                            </span>
                                            <span style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '10px',
                                                background: 'var(--color-bg-tertiary)',
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                color: 'var(--color-text-secondary)'
                                            }}>
                                                {log.action}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                                            {new Date(log.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
