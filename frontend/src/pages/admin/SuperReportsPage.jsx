import { useState, useEffect, useMemo } from 'react';
import { superAdminService } from '../../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import {
    DollarSign, Building2, Users, TrendingUp, Shield,
    RefreshCw, ArrowUpRight, ArrowDownRight, Layers,
    Download, Printer, Calendar, Clock, AlertTriangle, CheckCircle2,
    Search, UserCheck, Sparkles, Cpu, Target, HelpCircle
} from 'lucide-react';
import { formatCurrency } from '../../utils/constants';
import './AdminReports.css';

// Paleta de colores fríos corporativos
const COOL_PALETTE = [
    '#3b82f6', // Azul corporativo
    '#6366f1', // Índigo frío
    '#0284c7', // Azul acero
    '#60a5fa', // Azul cielo frío
    '#818cf8', // Lavanda frío
    '#38bdf8', // Cian hielo
    '#2563eb', // Azul zafiro
    '#64748b', // Pizarra fría
    '#94a3b8'  // Gris frío
];

const ROLE_LABELS = {
    superadmin: 'Super Administradores',
    tenant_admin: 'Administradores de Empresa',
    technician: 'Técnicos de Taller',
    salesperson: 'Vendedores / Mostrador',
    client: 'Clientes Finales'
};

const defaultAnalytics = {
    kpis: {
        total_tenants: 0,
        active_tenants: 0,
        trial_tenants: 0,
        paid_tenants: 0,
        expired_tenants: 0,
        total_users: 0,
        mrr: 0,
        arr: 0,
        arpu: 0,
        conversion_rate: 0,
        churn_rate: 0,
        retention_rate: 100,
        estimated_ltv: 0
    },
    funnel: [],
    predictions: {
        forecast_3m: [],
        forecast_6m: [],
        forecast_12m: [],
        forecast_3y: [],
        confidence_score: 90,
        insights: []
    },
    tenants: [],
    planDistribution: [],
    expiringSoon: [],
    usersByRole: [],
    tenantsGrowth: []
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="chart-tooltip">
                {label && <p className="tooltip-label">{label}</p>}
                {payload.map((p, i) => (
                    <p key={i} className="tooltip-value" style={{ color: p.color || 'var(--color-primary)' }}>
                        {p.name}: {typeof p.value === 'number' && (p.name.includes('MRR') || p.name.includes('ARR') || p.name.includes('Ingreso') || p.name.includes('Precio') || p.name.includes('Aporte') || p.name.includes('Valor')) ? formatCurrency(p.value) : p.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function SuperReportsPage() {
    const [analytics, setAnalytics] = useState(defaultAnalytics);
    const [loading, setLoading] = useState(true);

    // Filtros de navegación
    const [period, setPeriod] = useState('this_month');
    const [activeTab, setActiveTab] = useState('financial'); // 'financial' | 'ai_forecast' | 'funnel' | 'tenants' | 'plans' | 'users'

    // Horizonte predictivo IA
    const [forecastHorizon, setForecastHorizon] = useState('12m'); // '3m' | '6m' | '12m' | '3y'

    // Paginación y búsqueda de empresas
    const [tenantSearch, setTenantSearch] = useState('');
    const [tenantStatusFilter, setTenantStatusFilter] = useState('');
    const [tenantPage, setTenantPage] = useState(1);
    const TENANT_PAGE_SIZE = 8;

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await superAdminService.getAnalytics({ period });
            if (res && res.kpis) {
                setAnalytics(res);
            } else {
                setAnalytics(defaultAnalytics);
            }
        } catch (e) {
            console.error('Error al cargar analítica SaaS:', e);
            setAnalytics(defaultAnalytics);
        } finally {
            setLoading(false);
        }
    };

    // Exportar a CSV
    const exportCSV = () => {
        if (!analytics) return;
        let csvContent = 'data:text/csv;charset=utf-8,';

        // Sección 1: Métricas de Negocio SaaS
        csvContent += 'REPORTE FINANCIERO Y DE SUSCRIPCIONES SAAS SYSAAS\r\n';
        csvContent += `Periodo:,${period}\r\n`;
        csvContent += `MRR (Ingresos Mensuales Recurrentes):,$${analytics.kpis?.mrr || 0}\r\n`;
        csvContent += `ARR Proyectado:,$${analytics.kpis?.arr || 0}\r\n`;
        csvContent += `ARPU (Ingreso Promedio por Tenant):,$${analytics.kpis?.arpu || 0}\r\n`;
        csvContent += `LTV Estimado:,$${analytics.kpis?.estimated_ltv || 0}\r\n`;
        csvContent += `Tasa de Conversion:,${analytics.kpis?.conversion_rate || 0}%\r\n`;
        csvContent += `Tasa de Retencion:,${analytics.kpis?.retention_rate || 0}%\r\n`;
        csvContent += `Total Empresas Registradas:,${analytics.kpis?.total_tenants || 0}\r\n\r\n`;

        // Sección 2: Desglose de Empresas SaaS
        csvContent += 'LISTADO DE EMPRESAS SAAS\r\n';
        csvContent += 'Empresa,Subdominio,RFC/TaxID,Plan,Precio Plan,Estado Suscripcion,Vencimiento,Sedes,Usuarios\r\n';
        (analytics.tenants || []).forEach(t => {
            csvContent += `"${t.name}","${t.slug}","${t.tax_id || ''}","${t.plan_name}",$${t.plan_price},"${t.subscription_status}","${t.subscription_end_date ? t.subscription_end_date.slice(0, 10) : 'N/A'}",${t.branches_count},${t.users_count}\r\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Reporte_SaaS_Avanzado_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    // Planes SaaS para PieChart
    const planPieData = useMemo(() => {
        if (!analytics?.planDistribution || !Array.isArray(analytics.planDistribution)) return [];
        return analytics.planDistribution.map((pd, idx) => ({
            name: pd.name,
            value: pd.count,
            mrr: pd.mrr,
            color: COOL_PALETTE[idx % COOL_PALETTE.length]
        }));
    }, [analytics]);

    // Roles de usuarios globales para PieChart
    const usersRolePieData = useMemo(() => {
        if (!analytics?.usersByRole || !Array.isArray(analytics.usersByRole)) return [];
        return analytics.usersByRole.map((ur, idx) => ({
            name: ROLE_LABELS[ur.role] || ur.role,
            value: ur.count,
            color: COOL_PALETTE[idx % COOL_PALETTE.length]
        }));
    }, [analytics]);

    // Datos del horizonte predictivo seleccionado
    const selectedForecastData = useMemo(() => {
        if (!analytics?.predictions) return [];
        if (forecastHorizon === '3m') return analytics.predictions.forecast_3m || [];
        if (forecastHorizon === '6m') return analytics.predictions.forecast_6m || [];
        if (forecastHorizon === '12m') return analytics.predictions.forecast_12m || [];
        if (forecastHorizon === '3y') return analytics.predictions.forecast_3y || [];
        return [];
    }, [analytics, forecastHorizon]);

    const kpis = analytics?.kpis || defaultAnalytics.kpis;
    const tenantsGrowthData = analytics?.tenantsGrowth || [];

    return (
        <div className="reports-page animate-fadeIn">

            {/* ── Header & Action Controls ── */}
            <header className="reports-header-box">
                <div className="reports-header-title">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Shield size={28} className="text-primary" />
                        <div>
                            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Analítica de Plataforma & Suscripciones SaaS</h1>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                Pronósticos predictivos con IA, MRR, ARR, embudo de conversión y ciclo de vida de organizaciones
                            </p>
                        </div>
                    </div>
                </div>

                <div className="reports-controls-bar">
                    {/* Selector de Período */}
                    <div className="control-group">
                        <Calendar size={15} className="control-icon" />
                        <select
                            className="select select-sm control-select"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                        >
                            <option value="today">Hoy</option>
                            <option value="7d">Últimos 7 Días</option>
                            <option value="30d">Últimos 30 Días</option>
                            <option value="this_month">Este Mes</option>
                            <option value="last_month">Mes Anterior</option>
                            <option value="year">Este Año</option>
                        </select>
                    </div>

                    <div className="button-group">
                        <button onClick={fetchAnalytics} className="btn btn-secondary btn-sm" title="Recargar">
                            <RefreshCw size={14} />
                        </button>
                        <button onClick={exportCSV} className="btn btn-secondary btn-sm" title="Exportar CSV">
                            <Download size={14} /> <span>Exportar CSV</span>
                        </button>
                        <button onClick={handlePrint} className="btn btn-primary btn-sm" title="Imprimir">
                            <Printer size={14} /> <span>Imprimir</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Navigation Tabs ── */}
            <div className="reports-tabs-bar">
                <button
                    onClick={() => setActiveTab('financial')}
                    className={`report-tab-btn ${activeTab === 'financial' ? 'active' : ''}`}
                >
                    <DollarSign size={16} /> <span>Finanzas SaaS & MRR</span>
                </button>
                <button
                    onClick={() => setActiveTab('ai_forecast')}
                    className={`report-tab-btn ${activeTab === 'ai_forecast' ? 'active' : ''}`}
                >
                    <Sparkles size={16} /> <span>Pronósticos Predictivos IA</span>
                </button>
                <button
                    onClick={() => setActiveTab('funnel')}
                    className={`report-tab-btn ${activeTab === 'funnel' ? 'active' : ''}`}
                >
                    <Target size={16} /> <span>Embudo & Retención</span>
                </button>
                <button
                    onClick={() => setActiveTab('tenants')}
                    className={`report-tab-btn ${activeTab === 'tenants' ? 'active' : ''}`}
                >
                    <Building2 size={16} /> <span>Empresas & Suscripciones</span>
                </button>
                <button
                    onClick={() => setActiveTab('plans')}
                    className={`report-tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
                >
                    <Layers size={16} /> <span>Planes & Monetización</span>
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`report-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                >
                    <Users size={16} /> <span>Usuarios Globales</span>
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        Calculando métricas y ejecutando modelos predictivos IA...
                    </p>
                </div>
            ) : (
                <>
                    {/* ══════════════════════════════════════════════════════════
                        TAB 1: FINANZAS SAAS & MRR
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'financial' && (
                        <div className="tab-content animate-fadeIn">
                            <div className="kpi-grid">
                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">MRR (Ingreso Mensual Recurrente)</span>
                                        <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                            <DollarSign size={18} />
                                        </div>
                                    </div>
                                    <div className="kpi-value">{formatCurrency(kpis.mrr || 0)}</div>
                                    <span className="kpi-subtext">{kpis.paid_tenants || 0} empresas de pago activas</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">ARR Proyectado (Anual)</span>
                                        <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                                            <TrendingUp size={18} />
                                        </div>
                                    </div>
                                    <div className="kpi-value">{formatCurrency(kpis.arr || 0)}</div>
                                    <span className="kpi-subtext">Facturación anual recurrente estimada</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">ARPU (Ingreso / Tenant)</span>
                                        <div className="kpi-icon" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
                                            <Building2 size={18} />
                                        </div>
                                    </div>
                                    <div className="kpi-value">{formatCurrency(kpis.arpu || 0)}</div>
                                    <span className="kpi-subtext">Promedio mensual por cliente de pago</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Valor de Vida (LTV Estimado)</span>
                                        <div className="kpi-icon" style={{ background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa' }}>
                                            <Shield size={18} />
                                        </div>
                                    </div>
                                    <div className="kpi-value">{formatCurrency(kpis.estimated_ltv || 0)}</div>
                                    <span className="kpi-subtext">Ingreso acumulado proyectado por cliente</span>
                                </div>
                            </div>

                            {/* Crecimiento de Registros y Distribución de Planes */}
                            <div className="charts-split-grid">
                                <div className="report-card report-card-main">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Nuevas Empresas Registradas</h2>
                                            <p>Crecimiento y adopción de la plataforma en el tiempo</p>
                                        </div>
                                    </div>
                                    <div className="chart-area" style={{ height: 300 }}>
                                        {tenantsGrowthData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={tenantsGrowthData}>
                                                    <defs>
                                                        <linearGradient id="tenantsGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                                                    <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                                                    <YAxis stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} allowDecimals={false} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Area type="monotone" dataKey="new_tenants" name="Nuevos Registros" stroke="#3b82f6" strokeWidth={2} fill="url(#tenantsGrad)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="empty-chart">Sin nuevos registros en este período</div>
                                        )}
                                    </div>
                                </div>

                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Suscripciones por Plan</h2>
                                            <p>Distribución de clientes</p>
                                        </div>
                                    </div>
                                    {planPieData.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ width: '100%', height: 180 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={planPieData}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%" cy="50%"
                                                            innerRadius={48} outerRadius={72}
                                                            paddingAngle={3}
                                                        >
                                                            {planPieData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--color-bg-card)" strokeWidth={2} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip formatter={(val) => [`${val} empresas`, 'Total']} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>

                                            <div className="pie-legend" style={{ width: '100%' }}>
                                                {planPieData.map((item, idx) => (
                                                    <div key={idx} className="pie-legend-item">
                                                        <span className="pie-legend-dot" style={{ background: item.color }} />
                                                        <span className="pie-legend-name">{item.name}</span>
                                                        <span className="pie-legend-val">{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="empty-chart">Sin planes activos</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 2: PRONÓSTICOS PREDICTIVOS CON IA MULTI-HORIZONTE
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'ai_forecast' && (
                        <div className="tab-content animate-fadeIn">
                            {/* Selector de Horizonte */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Modelo de Proyección Financiera SaaS</h2>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                        Regresión estadística entrenada sobre el comportamiento histórico de suscripciones (Confianza: {analytics?.predictions?.confidence_score || 90}%)
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                    {[
                                        { id: '3m', label: '3 Meses' },
                                        { id: '6m', label: '6 Meses' },
                                        { id: '12m', label: '12 Meses' },
                                        { id: '3y', label: '3 Años' }
                                    ].map(h => (
                                        <button
                                            key={h.id}
                                            onClick={() => setForecastHorizon(h.id)}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                borderRadius: 'var(--radius-sm)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                background: forecastHorizon === h.id ? 'var(--color-primary)' : 'transparent',
                                                color: forecastHorizon === h.id ? '#ffffff' : 'var(--color-text-secondary)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {h.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Macro KPIs del Pronóstico */}
                            <div className="kpi-grid" style={{ marginBottom: '24px' }}>
                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">MRR Estimado al Cierre</span>
                                        <Sparkles size={18} className="text-primary" />
                                    </div>
                                    <div className="kpi-value">
                                        {formatCurrency(
                                            forecastHorizon === '3y'
                                                ? (selectedForecastData[selectedForecastData.length - 1]?.projected_mrr || 0)
                                                : (selectedForecastData[selectedForecastData.length - 1]?.predicted_mrr || 0)
                                        )}
                                    </div>
                                    <span className="kpi-subtext">Proyección de ingresos mensuales</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">ARR Proyectado al Cierre</span>
                                        <TrendingUp size={18} style={{ color: '#6366f1' }} />
                                    </div>
                                    <div className="kpi-value">
                                        {formatCurrency(
                                            forecastHorizon === '3y'
                                                ? (selectedForecastData[selectedForecastData.length - 1]?.projected_arr || 0)
                                                : (selectedForecastData[selectedForecastData.length - 1]?.predicted_arr || 0)
                                        )}
                                    </div>
                                    <span className="kpi-subtext">Facturación anual recurrente</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Empresas Clientes Estimadas</span>
                                        <Building2 size={18} style={{ color: '#0284c7' }} />
                                    </div>
                                    <div className="kpi-value">
                                        {forecastHorizon === '3y'
                                            ? (selectedForecastData[selectedForecastData.length - 1]?.projected_tenants || 0)
                                            : (selectedForecastData[selectedForecastData.length - 1]?.predicted_tenants || 0)}
                                    </div>
                                    <span className="kpi-subtext">Organizaciones suscritas activas</span>
                                </div>
                            </div>

                            {/* Curva de Pronóstico */}
                            <div className="report-card" style={{ marginBottom: '24px' }}>
                                <div className="report-card-header">
                                    <div>
                                        <h2>Curva Predictiva de MRR</h2>
                                        <p>Evolución estimada de ingresos recurrentes ({forecastHorizon === '3y' ? 'Por Año' : 'Mes a Mes'})</p>
                                    </div>
                                </div>
                                <div className="chart-area" style={{ height: 300 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={selectedForecastData}>
                                            <defs>
                                                <linearGradient id="aiForecastGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                                            <XAxis dataKey={forecastHorizon === '3y' ? 'year' : 'month'} stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                                            <YAxis stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} tickFormatter={v => `$${v}`} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area
                                                type="monotone"
                                                dataKey={forecastHorizon === '3y' ? 'projected_mrr' : 'predicted_mrr'}
                                                name="MRR Proyectado"
                                                stroke="#6366f1"
                                                strokeWidth={2}
                                                fill="url(#aiForecastGrad)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Insights & Recomendaciones IA */}
                            {analytics?.predictions?.insights?.length > 0 && (
                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Diagnóstico Estratégico Generado por IA</h2>
                                            <p>Recomendaciones algorítmicas de retención y optimización de ingresos</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {analytics.predictions.insights.map((ins, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '12px 16px',
                                                    background: 'var(--color-bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--color-border)',
                                                    display: 'flex',
                                                    gap: '12px',
                                                    alignItems: 'flex-start'
                                                }}
                                            >
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: ins.type === 'positive' ? '#10b981' : (ins.type === 'warning' ? '#f59e0b' : '#ef4444'),
                                                    marginTop: '6px',
                                                    flexShrink: 0
                                                }} />
                                                <div>
                                                    <strong style={{ fontSize: '13px', color: 'var(--color-text)' }}>{ins.title}</strong>
                                                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                                        {ins.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 3: EMBUDO DE CONVERSIÓN & CHURN
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'funnel' && (
                        <div className="tab-content animate-fadeIn">
                            <div className="kpi-grid" style={{ marginBottom: '24px' }}>
                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Tasa de Conversión (Trial - Pago)</span>
                                        <Target size={18} className="text-primary" />
                                    </div>
                                    <div className="kpi-value">{kpis.conversion_rate || 0}%</div>
                                    <span className="kpi-subtext">Porcentaje de clientes que pasan a plan de pago</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Tasa de Retención</span>
                                        <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                                    </div>
                                    <div className="kpi-value">{kpis.retention_rate || 100}%</div>
                                    <span className="kpi-subtext">Organizaciones con suscripción al día</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Tasa de Pérdida (Churn Rate)</span>
                                        <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                                    </div>
                                    <div className="kpi-value">{kpis.churn_rate || 0}%</div>
                                    <span className="kpi-subtext">Cuentas suspendidas o canceladas</span>
                                </div>
                            </div>

                            {/* Visualización Escalonada del Embudo SaaS */}
                            <div className="report-card">
                                <div className="report-card-header">
                                    <div>
                                        <h2>Embudo de Conversión de Clientes</h2>
                                        <p>Flujo de usuarios desde el registro inicial hasta la retención de pago</p>
                                    </div>
                                    <span className="badge-neutral" style={{ fontWeight: 700 }}>
                                        {kpis.total_tenants || 0} Organizaciones
                                    </span>
                                </div>

                                {/* Pasos de Embudo Escalonados */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px 0' }}>
                                    {(analytics?.funnel || []).map((step, idx) => {
                                        const stepColors = ['#3b82f6', '#6366f1', '#0284c7', '#60a5fa'];
                                        const color = stepColors[idx % stepColors.length];
                                        return (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                                                        {step.step}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                        <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                                                            {step.count} {step.count === 1 ? 'empresa' : 'empresas'}
                                                        </strong>
                                                        <span className="badge-neutral" style={{ fontSize: '11px', fontWeight: 700 }}>
                                                            {step.rate}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="progress-track" style={{ height: '10px' }}>
                                                    <div
                                                        className="progress-fill"
                                                        style={{
                                                            width: `${Math.max(5, Math.min(100, step.rate))}%`,
                                                            background: color
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 4: EMPRESAS & SUSCRIPCIONES (LISTADO & PRUEBAS)
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'tenants' && (
                        <div className="tab-content animate-fadeIn">
                            {/* Alerta de Empresas por Vencer */}
                            {analytics?.expiringSoon?.length > 0 && (
                                <div className="report-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--color-primary)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                        <Clock size={20} className="text-primary" />
                                        <div>
                                            <h2 style={{ fontSize: '14px', margin: 0, fontWeight: 700 }}>Pruebas / Suscripciones Próximas a Vencer (Próximos 7 Días)</h2>
                                            <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-secondary)' }}>
                                                Empresas que requieren seguimiento comercial para conversión o renovación
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                                        {analytics.expiringSoon.map(es => (
                                            <div key={es.id} style={{ padding: '10px 12px', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <strong style={{ fontSize: '13px' }}>{es.name}</strong>
                                                    <span className="badge-neutral" style={{ fontSize: '10px' }}>{es.plan_name}</span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                                    /{es.slug}
                                                </div>
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
                                                    Vence en {es.days_left} {es.days_left === 1 ? 'día' : 'días'} ({es.end_date ? es.end_date.slice(0, 10) : 'Pronto'})
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Listado Paginado de Empresas */}
                            <div className="report-card">
                                <div className="report-card-header">
                                    <div>
                                        <h2>Listado de Empresas Registradas</h2>
                                        <p>Control de suscripciones, fechas de corte y límites de plataforma</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <select
                                            className="select select-sm"
                                            value={tenantStatusFilter}
                                            onChange={(e) => { setTenantStatusFilter(e.target.value); setTenantPage(1); }}
                                            style={{ width: '130px' }}
                                        >
                                            <option value="">Todos los Estados</option>
                                            <option value="active">Activas (Pago)</option>
                                            <option value="trial">En Prueba</option>
                                            <option value="expired">Vencidas</option>
                                        </select>
                                        <input
                                            type="text"
                                            className="input input-sm"
                                            placeholder="Buscar empresa..."
                                            value={tenantSearch}
                                            onChange={(e) => { setTenantSearch(e.target.value); setTenantPage(1); }}
                                            style={{ width: '170px' }}
                                        />
                                    </div>
                                </div>

                                {(() => {
                                    const filtered = (analytics?.tenants || []).filter(t => {
                                        const matchesSearch = t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
                                            t.slug.toLowerCase().includes(tenantSearch.toLowerCase());
                                        const matchesStatus = !tenantStatusFilter || t.subscription_status === tenantStatusFilter;
                                        return matchesSearch && matchesStatus;
                                    });

                                    const totalPages = Math.ceil(filtered.length / TENANT_PAGE_SIZE) || 1;
                                    const currentPage = Math.min(tenantPage, totalPages);
                                    const startIndex = (currentPage - 1) * TENANT_PAGE_SIZE;
                                    const paginated = filtered.slice(startIndex, startIndex + TENANT_PAGE_SIZE);

                                    return (
                                        <>
                                            <div className="table-responsive">
                                                <table className="tech-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Empresa</th>
                                                            <th>Plan</th>
                                                            <th>Estado Suscripción</th>
                                                            <th>Vencimiento</th>
                                                            <th style={{ textAlign: 'center' }}>Sedes / Usuarios</th>
                                                            <th style={{ textAlign: 'right' }}>MRR Aporte</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginated.map((t) => (
                                                            <tr key={t.id}>
                                                                <td>
                                                                    <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{t.name}</div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                                                                        /{t.slug}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className="badge-neutral">{t.plan_name}</span>
                                                                </td>
                                                                <td>
                                                                    <span className="badge-neutral" style={{ fontWeight: 700 }}>
                                                                        {t.subscription_status === 'active' ? 'PAGO ACTIVO' : (t.subscription_status === 'trial' ? 'EN PRUEBA' : 'VENCIDO')}
                                                                    </span>
                                                                </td>
                                                                <td style={{ fontSize: '12px' }}>
                                                                    {t.subscription_end_date ? t.subscription_end_date.slice(0, 10) : 'Sin límite'}
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <span className="badge-neutral">{t.branches_count} sedes | {t.users_count} usu.</span>
                                                                </td>
                                                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>
                                                                    {t.subscription_status === 'active' ? formatCurrency(t.plan_price) : '$0.00'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Controles de Paginación */}
                                            {filtered.length > TENANT_PAGE_SIZE && (
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginTop: '16px',
                                                    paddingTop: '12px',
                                                    borderTop: '1px solid var(--color-border)',
                                                    fontSize: '12px',
                                                    color: 'var(--color-text-secondary)'
                                                }}>
                                                    <span>
                                                        Mostrando {startIndex + 1} - {Math.min(startIndex + TENANT_PAGE_SIZE, filtered.length)} de {filtered.length} empresas
                                                    </span>

                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => setTenantPage(prev => Math.max(1, prev - 1))}
                                                            disabled={currentPage <= 1}
                                                            style={{ padding: '4px 10px', fontSize: '12px' }}
                                                        >
                                                            Anterior
                                                        </button>

                                                        <span style={{ padding: '0 8px', fontWeight: 600, color: 'var(--color-text)' }}>
                                                            Página {currentPage} de {totalPages}
                                                        </span>

                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => setTenantPage(prev => Math.min(totalPages, prev + 1))}
                                                            disabled={currentPage >= totalPages}
                                                            style={{ padding: '4px 10px', fontSize: '12px' }}
                                                        >
                                                            Siguiente
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 5: PLANES & MONETIZACIÓN
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'plans' && (
                        <div className="tab-content animate-fadeIn">
                            <div className="report-card">
                                <div className="report-card-header">
                                    <div>
                                        <h2>Rendimiento de Planes de Suscripción</h2>
                                        <p>Monetización recurrente y volumen de suscripciones por plan</p>
                                    </div>
                                </div>
                                <div className="table-responsive">
                                    <table className="tech-table">
                                        <thead>
                                            <tr>
                                                <th>Plan</th>
                                                <th style={{ textAlign: 'right' }}>Precio Mensual</th>
                                                <th style={{ textAlign: 'center' }}>Empresas Suscritas</th>
                                                <th style={{ textAlign: 'right' }}>Aporte Total al MRR</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(analytics?.planDistribution || []).map((p, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.price)}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                                        <span className="badge-neutral">{p.count} empresas</span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-text)' }}>
                                                        {formatCurrency(p.mrr)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 6: USUARIOS GLOBALES DE LA PLATAFORMA
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'users' && (
                        <div className="tab-content animate-fadeIn">
                            <div className="charts-split-grid">
                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Distribución de Usuarios por Rol</h2>
                                            <p>Cuentas activas en la plataforma</p>
                                        </div>
                                    </div>
                                    {usersRolePieData.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ width: '100%', height: 200 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={usersRolePieData}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%" cy="50%"
                                                            innerRadius={50} outerRadius={75}
                                                            paddingAngle={3}
                                                        >
                                                            {usersRolePieData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--color-bg-card)" strokeWidth={2} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip formatter={(val) => [`${val} usuarios`, 'Total']} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>

                                            <div className="pie-legend" style={{ width: '100%' }}>
                                                {usersRolePieData.map((item, idx) => (
                                                    <div key={idx} className="pie-legend-item">
                                                        <span className="pie-legend-dot" style={{ background: item.color }} />
                                                        <span className="pie-legend-name">{item.name}</span>
                                                        <span className="pie-legend-val">{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="empty-chart">Sin datos de usuarios</div>
                                    )}
                                </div>

                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Resumen de Cuentas Globales</h2>
                                            <p>Volumen de usuarios gestionados por el SaaS</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                            <div>
                                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Total de Usuarios</div>
                                                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>{kpis.total_users || 0}</div>
                                            </div>
                                            <UserCheck size={24} className="text-primary" />
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                            <div>
                                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Empresas Activas</div>
                                                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>{kpis.active_tenants || 0}</div>
                                            </div>
                                            <Building2 size={24} style={{ color: '#0284c7' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
