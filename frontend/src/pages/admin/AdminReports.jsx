import { useState, useEffect, useMemo } from 'react';
import { statsService, analyticsService, branchService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import {
    DollarSign, Wrench, Users, TrendingUp, Award,
    RefreshCw, ArrowUpRight, ArrowDownRight, Cpu, Sparkles, UserCheck,
    ShoppingBag, CreditCard, Download, Printer, Store, Filter, Calendar
} from 'lucide-react';
import { formatCurrency } from '../../utils/constants';
import { showAlert } from '../../utils/swal';
import './AdminReports.css';

// Etiquetas y estados del flujo
const STATUS_LABELS = {
    received: 'Recibido',
    diagnosing: 'En Diagnóstico',
    waiting_approval: 'Esp. Aprobación',
    waiting_parts: 'Esp. Refacciones',
    repairing: 'En Reparación',
    quality_check: 'C. de Calidad',
    ready: 'Listo para Entrega',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
};

const PAYMENT_METHOD_LABELS = {
    cash: 'Efectivo',
    card: 'Tarjeta de Débito/Crédito',
    transfer: 'Transferencia Bancaria',
    other: 'Otro Medio'
};

// Paleta de colores fríos corporativos (Gama de azules, índigos, cianos fríos y pizarras)
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

const STATUS_COLORS = {
    received: '#3b82f6',
    diagnosing: '#6366f1',
    waiting_approval: '#818cf8',
    waiting_parts: '#64748b',
    repairing: '#0284c7',
    quality_check: '#38bdf8',
    ready: '#60a5fa',
    delivered: '#2563eb',
    cancelled: '#94a3b8'
};

const defaultAnalytics = {
    kpis: {
        total_revenue: 0,
        pos_revenue: 0,
        repairs_revenue: 0,
        sales_count: 0,
        repairs_count: 0,
        avg_ticket: 0,
        revenue_growth: null,
        discounts_total: 0,
        delivered_repairs: 0
    },
    topProducts: [],
    paymentMethods: [],
    temporalRevenue: [],
    topServices: [],
    branchBreakdown: [],
    topSellers: [],
    topTechnicians: [],
    repairsByStatus: []
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="chart-tooltip">
                {label && <p className="tooltip-label">{label}</p>}
                {payload.map((p, i) => (
                    <p key={i} className="tooltip-value" style={{ color: p.color || 'var(--color-primary)' }}>
                        {p.name}: {typeof p.value === 'number' && (p.name.includes('Monto') || p.name.includes('Ingreso') || p.name === 'Total' || p.name === 'Pronóstico' || p.name === 'Ventas Mostrador' || p.name === 'Taller / Reparaciones') ? formatCurrency(p.value) : p.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function AdminReports() {
    const { user, isTenantAdmin, isSuperAdmin, isImpersonating } = useAuth();
    const { activeBranchId, branches: tenantBranches, tenant } = useTenant();
    const isBranchScoped = !isTenantAdmin && !isSuperAdmin && !isImpersonating;

    // Plan check: Reportes exclusivo para Enterprise
    const planSlug = (tenant?.plan_slug || tenant?.plan_name || '').toLowerCase();
    const isReportsPlanAllowed = 
        planSlug.includes('enterprise') || 
        (tenant?.plan_id && Number(tenant.plan_id) >= 3) || 
        Boolean(tenant?.plan_features?.advanced_reports) ||
        Boolean(tenant?.features?.advanced_reports);

    const [analytics, setAnalytics] = useState(defaultAnalytics);
    const [branches, setBranches] = useState([]);
    const [forecastData, setForecastData] = useState(null);
    const [segmentationData, setSegmentationData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isReportsPlanAllowed && tenant) {
            showAlert({
                title: 'Función Enterprise',
                text: 'El módulo de Análisis y Reportes está reservado para el plan Enterprise.',
                icon: 'warning',
                confirmButtonText: 'Aceptar'
            });
        }
    }, [isReportsPlanAllowed, tenant]);

    // Filtros
    const [period, setPeriod] = useState('this_month'); // 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'year'
    const [selectedBranch, setSelectedBranch] = useState(() => {
        if (!isTenantAdmin && !isSuperAdmin && !isImpersonating) {
            return String(user?.branch_id || activeBranchId || '');
        }
        return '';
    });
    const [activeTab, setActiveTab] = useState('executive'); // 'executive' | 'sales_products' | 'workshop' | 'branches_team' | 'ai_ml'
    const [kmeansFilter, setKmeansFilter] = useState('');
    const [kmeansPage, setKmeansPage] = useState(1);
    const KMEANS_PAGE_SIZE = 8;

    useEffect(() => {
        if (!isReportsPlanAllowed) return;
        loadBranches();
    }, [isReportsPlanAllowed]);

    useEffect(() => {
        if (isBranchScoped) {
            const userBranch = String(user?.branch_id || activeBranchId || (branches[0]?.id || ''));
            if (userBranch && selectedBranch !== userBranch) {
                setSelectedBranch(userBranch);
            }
        }
    }, [isBranchScoped, user?.branch_id, activeBranchId, branches]);

    useEffect(() => {
        if (!isReportsPlanAllowed) return;
        fetchAnalytics();
    }, [period, selectedBranch, isReportsPlanAllowed]);

    const loadBranches = async () => {
        try {
            const res = await branchService.getAll();
            setBranches(Array.isArray(res) ? res : (res?.branches || []));
        } catch (e) {
            console.error('Error al cargar sucursales:', e);
        }
    };

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const params = { period };
            if (selectedBranch) params.branch_id = selectedBranch;

            const [analyticsRes, fcRes, segRes] = await Promise.allSettled([
                statsService.getEnterpriseAnalytics(params),
                analyticsService.getForecast(),
                analyticsService.getCustomerSegmentation()
            ]);

            if (analyticsRes.status === 'fulfilled' && analyticsRes.value && analyticsRes.value.kpis) {
                setAnalytics(analyticsRes.value);
            } else {
                setAnalytics(defaultAnalytics);
            }

            if (fcRes.status === 'fulfilled') setForecastData(fcRes.value);
            if (segRes.status === 'fulfilled') setSegmentationData(segRes.value);
        } catch (e) {
            console.error('Error al cargar analítica empresarial:', e);
            setAnalytics(defaultAnalytics);
        } finally {
            setLoading(false);
        }
    };

    // Exportar a CSV enriquecido con BOM para compatibilidad con Excel
    const exportCSV = () => {
        if (!analytics) return;

        const branchName = selectedBranch
            ? (branches.find(b => String(b.id) === String(selectedBranch))?.name || user?.branch_name || 'Sucursal')
            : 'Todas las Sucursales';

        const periodLabels = {
            today: 'Hoy',
            '7d': 'Últimos 7 Días',
            '30d': 'Últimos 30 Días',
            this_month: 'Este Mes',
            last_month: 'Mes Anterior',
            year: 'Este Año'
        };

        const currentPeriodLabel = periodLabels[period] || period;
        const now = new Date();
        const formattedDate = now.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        let csv = '\uFEFF'; // UTF-8 BOM para apertura perfecta en Excel
        const companyName = tenant?.company_name || tenant?.name || user?.tenant_name || 'Mi Empresa';

        // Encabezado
        csv += `${companyName.toUpperCase()} - REPORTE COMERCIAL Y OPERATIVO\r\n`;
        csv += `Empresa:,"${companyName}"\r\n`;
        csv += `Sucursal:,"${branchName}"\r\n`;
        csv += `Período:,"${currentPeriodLabel}"\r\n`;
        csv += `Fecha de Generación:,"${formattedDate}"\r\n\r\n`;

        // 1. Resumen Ejecutivo (KPIs)
        csv += '=== 1. RESUMEN FINANCIERO Y OPERATIVO ===\r\n';
        csv += 'Métrica,Valor\r\n';
        csv += `Ingresos Consolidados,$${(analytics.kpis?.total_revenue || 0).toFixed(2)}\r\n`;
        csv += `Ventas de Mostrador (POS),$${(analytics.kpis?.pos_revenue || 0).toFixed(2)}\r\n`;
        csv += `Facturación de Taller,$${(analytics.kpis?.repairs_revenue || 0).toFixed(2)}\r\n`;
        csv += `Ticket Promedio (POS),$${(analytics.kpis?.avg_ticket || 0).toFixed(2)}\r\n`;
        csv += `Descuentos Totales Concedidos,$${(analytics.kpis?.discounts_total || 0).toFixed(2)}\r\n`;
        csv += `Órdenes de Reparación Entregadas,${analytics.kpis?.delivered_repairs || 0}\r\n\r\n`;

        // 2. Métodos de Pago
        csv += '=== 2. VENTAS POR MÉTODO DE PAGO ===\r\n';
        csv += 'Método de Pago,Transacciones,Total Recaudado\r\n';
        (analytics.paymentMethods || []).forEach(pm => {
            csv += `"${PAYMENT_METHOD_LABELS[pm.method] || pm.method}",${pm.count || 0},$${(pm.total || 0).toFixed(2)}\r\n`;
        });
        csv += '\r\n';

        // 3. Top Productos
        csv += '=== 3. TOP PRODUCTOS MÁS VENDIDOS ===\r\n';
        csv += 'Producto,SKU,Categoría,Unidades Vendidas,Ingresos Generados,Stock Restante\r\n';
        (analytics.topProducts || []).forEach(p => {
            csv += `"${(p.name || '').replace(/"/g, '""')}","${p.sku || 'N/A'}","${p.category || 'General'}",${p.units_sold || 0},$${(p.total_revenue || 0).toFixed(2)},${p.stock || 0}\r\n`;
        });
        csv += '\r\n';

        // 4. Top Servicios
        csv += '=== 4. SERVICIOS MÁS SOLICITADOS EN TALLER ===\r\n';
        csv += 'Servicio,Órdenes Atendidas,Ingresos Generados\r\n';
        (analytics.topServices || []).forEach(s => {
            csv += `"${(s.name || '').replace(/"/g, '""')}",${s.count || 0},$${(s.revenue || 0).toFixed(2)}\r\n`;
        });
        csv += '\r\n';

        // 5. Equipo de Trabajo
        csv += '=== 5. TOP VENDEDORES Y TÉCNICOS ===\r\n';
        csv += 'Personal,Rol / Tipo,Operaciones Realizadas,Total Generado\r\n';
        (analytics.topSellers || []).forEach(s => {
            csv += `"${(s.name || '').replace(/"/g, '""')}",Vendedor / Mostrador,${s.sales_count || 0} ventas,$${(s.total_sold || 0).toFixed(2)}\r\n`;
        });
        (analytics.topTechnicians || []).forEach(t => {
            csv += `"${(t.name || '').replace(/"/g, '""')}",Técnico de Taller,${t.repairs_count || 0} reparaciones,$${(t.total_revenue || 0).toFixed(2)}\r\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const filename = `Reporte_${branchName.replace(/\s+/g, '_')}_${period}_${now.toISOString().slice(0, 10)}.csv`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Imprimir Reporte
    const handlePrint = () => {
        window.print();
    };

    // Métodos de pago estructurados para PieChart
    const paymentPieData = useMemo(() => {
        if (!analytics?.paymentMethods || !Array.isArray(analytics.paymentMethods)) return [];
        return analytics.paymentMethods.map((pm, idx) => ({
            name: PAYMENT_METHOD_LABELS[pm.method] || pm.method,
            value: pm.total || 0,
            count: pm.count || 0,
            color: COOL_PALETTE[idx % COOL_PALETTE.length]
        }));
    }, [analytics]);

    // Estados de reparación para PieChart
    const repairStatusPieData = useMemo(() => {
        if (!analytics?.repairsByStatus || !Array.isArray(analytics.repairsByStatus)) return [];
        return analytics.repairsByStatus.map((rbs, idx) => ({
            name: STATUS_LABELS[rbs.status] || rbs.status,
            value: rbs.count || 0,
            totalAmount: rbs.total || 0,
            color: STATUS_COLORS[rbs.status] || COOL_PALETTE[idx % COOL_PALETTE.length]
        }));
    }, [analytics]);

    const kpis = analytics?.kpis || defaultAnalytics.kpis;
    const temporalRevenueData = analytics?.temporalRevenue || [];

    const periodLabels = {
        today: 'Hoy',
        '7d': 'Últimos 7 Días',
        '30d': 'Últimos 30 Días',
        this_month: 'Este Mes',
        last_month: 'Mes Anterior',
        year: 'Este Año'
    };

    if (!isReportsPlanAllowed) {
        return (
            <div className="reports-page animate-fadeIn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '65vh' }}>
                <div style={{
                    maxWidth: '480px',
                    width: '100%',
                    textAlign: 'center',
                    background: 'var(--color-bg-card)',
                    padding: '36px 28px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-md)'
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto'
                    }}>
                        <TrendingUp size={28} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: 'var(--color-text)' }}>Función Enterprise</h2>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
                        El módulo de Análisis y Reportes está reservado para el plan Enterprise.
                    </p>
                    <button 
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => window.history.back()}
                    >
                        Volver
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="reports-page animate-fadeIn">
            
            {/* ── Print Header (Visible solo en impresión física o PDF) ── */}
            <div className="reports-print-header">
                <div className="print-title-row">
                    <h2>{(tenant?.company_name || tenant?.name || user?.tenant_name || 'Mi Empresa').toUpperCase()} - Reporte Comercial y Operativo</h2>
                    <span className="print-badge">{branches.find(b => String(b.id) === String(selectedBranch))?.name || user?.branch_name || 'Todas las Sucursales'}</span>
                </div>
                <div className="print-meta-grid">
                    <div><strong>Empresa:</strong> {tenant?.company_name || tenant?.name || user?.tenant_name || 'Mi Empresa'}</div>
                    <div><strong>Período:</strong> {periodLabels[period] || period}</div>
                    <div><strong>Emitido por:</strong> {user?.first_name} {user?.last_name} ({user?.role === 'tenant_admin' || user?.role === 'admin' ? 'Administrador' : user?.role === 'branch_manager' ? 'Gerente' : user?.role})</div>
                    <div><strong>Fecha de Impresión:</strong> {new Date().toLocaleString('es-MX')}</div>
                </div>
                <hr className="print-divider" />
            </div>

            {/* ── Header & Action Controls ── */}
            <header className="reports-header-box">
                <div className="reports-header-title">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TrendingUp size={28} className="text-primary" />
                        <div>
                            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Análisis & Reportes Comerciales</h1>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                Métricas financieras de ventas POS, artículos más comercializados y servicios de taller
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

                    {/* Selector de Sucursal */}
                    {isBranchScoped ? (
                        <div className="control-group" style={{ 
                            background: 'var(--color-bg-elevated)', 
                            padding: '6px 12px', 
                            borderRadius: 'var(--radius-md)', 
                            border: '1px solid var(--color-border)', 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: 'var(--color-text)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px' 
                        }}>
                            <Store size={15} className="text-primary" />
                            <span>{branches.find(b => String(b.id) === String(selectedBranch))?.name || user?.branch_name || 'Mi Sucursal'}</span>
                        </div>
                    ) : (
                        branches.length > 0 && (
                            <div className="control-group">
                                <Store size={15} className="control-icon" />
                                <select
                                    className="select select-sm control-select"
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                >
                                    <option value="">Todas las Sucursales</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )
                    )}

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
                    onClick={() => setActiveTab('executive')}
                    className={`report-tab-btn ${activeTab === 'executive' ? 'active' : ''}`}
                >
                    <DollarSign size={16} /> <span>Resumen Ejecutivo</span>
                </button>
                <button
                    onClick={() => setActiveTab('sales_products')}
                    className={`report-tab-btn ${activeTab === 'sales_products' ? 'active' : ''}`}
                >
                    <ShoppingBag size={16} /> <span>Ventas & Productos</span>
                </button>
                <button
                    onClick={() => setActiveTab('workshop')}
                    className={`report-tab-btn ${activeTab === 'workshop' ? 'active' : ''}`}
                >
                    <Wrench size={16} /> <span>Taller & Servicios</span>
                </button>
                <button
                    onClick={() => setActiveTab('branches_team')}
                    className={`report-tab-btn ${activeTab === 'branches_team' ? 'active' : ''}`}
                >
                    <Users size={16} /> <span>{isBranchScoped ? 'Equipo de Sede' : 'Sucursales & Equipo'}</span>
                </button>
                <button
                    onClick={() => setActiveTab('ai_ml')}
                    className={`report-tab-btn ${activeTab === 'ai_ml' ? 'active' : ''}`}
                >
                    <Cpu size={16} /> <span>Inteligencia ML</span>
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        Calculando métricas comerciales del período...
                    </p>
                </div>
            ) : (
                <>
                    {/* ══════════════════════════════════════════════════════════
                        TAB 1: RESUMEN EJECUTIVO & FINANZAS
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'executive' && (
                        <div className="tab-content animate-fadeIn">
                            {/* Macro KPIs */}
                            <div className="kpi-grid">
                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Ingresos Consolidados</span>
                                        <div className="kpi-icon" style={{ background: 'var(--cool-cyan-bg)', color: 'var(--cool-cyan)', border: '1px solid var(--cool-cyan-border)' }}>
                                            <DollarSign size={18} />
                                        </div>
                                    </div>
                                    <div className="kpi-value">{formatCurrency(kpis.total_revenue || 0)}</div>
                                    {kpis.revenue_growth !== null && (
                                        <div className={`kpi-change ${kpis.revenue_growth >= 0 ? 'pos' : 'neg'}`}>
                                            {kpis.revenue_growth >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                            <span>{Math.abs(kpis.revenue_growth)}% vs período anterior</span>
                                        </div>
                                    )}
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Ventas Mostrador (POS)</span>
                                        <div className="kpi-icon" style={{ background: 'var(--cool-slate-blue-bg)', color: 'var(--cool-slate-blue)', border: '1px solid var(--cool-slate-blue-border)' }}>
                                            <ShoppingBag size={18} />
                                        </div>
                                    </div>
                                    <div className="kpi-value">{formatCurrency(kpis.pos_revenue || 0)}</div>
                                    <span className="kpi-subtext">{kpis.sales_count || 0} tickets de venta</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Facturación Taller</span>
                                        <div className="kpi-icon" style={{ background: 'var(--cool-teal-bg)', color: 'var(--cool-teal)', border: '1px solid var(--cool-teal-border)' }}>
                                            <Wrench size={18} />
                                        </div>
                                    </div>
                                    <div className="kpi-value">{formatCurrency(kpis.repairs_revenue || 0)}</div>
                                    <span className="kpi-subtext">{kpis.repairs_count || 0} órdenes en período</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Ticket Promedio (POS)</span>
                                        <div className="kpi-icon" style={{ background: 'var(--cool-amber-bg)', color: 'var(--cool-amber)', border: '1px solid var(--cool-amber-border)' }}>
                                            <CreditCard size={18} />
                                        </div>
                                    </div>
                                    <div className="kpi-value">{formatCurrency(kpis.avg_ticket || 0)}</div>
                                    <span className="kpi-subtext">por transacción de mostrador</span>
                                </div>
                            </div>

                            {/* Gráfica de Evolución Temporal y Split de Ingresos */}
                            <div className="charts-split-grid">
                                {/* Evolución Temporal */}
                                <div className="report-card report-card-main">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Evolución de Ingresos en el Tiempo</h2>
                                            <p>Comportamiento de ventas de productos y órdenes de reparación</p>
                                        </div>
                                    </div>
                                    <div className="chart-area" style={{ height: 300 }}>
                                        {temporalRevenueData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={temporalRevenueData}>
                                                    <defs>
                                                        <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="var(--cool-slate-blue)" stopOpacity={0.35} />
                                                            <stop offset="95%" stopColor="var(--cool-slate-blue)" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="repGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="var(--cool-cyan)" stopOpacity={0.35} />
                                                            <stop offset="95%" stopColor="var(--cool-cyan)" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                                                    <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                                                    <YAxis stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} tickFormatter={v => `$${v}`} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                                    <Area type="monotone" dataKey="pos_revenue" name="Ventas Mostrador" stroke="var(--cool-slate-blue)" strokeWidth={2} fill="url(#posGrad)" />
                                                    <Area type="monotone" dataKey="repairs_revenue" name="Taller / Reparaciones" stroke="var(--cool-cyan)" strokeWidth={2} fill="url(#repGrad)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="empty-chart">Sin movimientos registrados en este período</div>
                                        )}
                                    </div>
                                </div>

                                {/* Split de Ingresos: Taller vs POS */}
                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Origen de los Ingresos</h2>
                                            <p>Distribución entre mostrador y taller</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
                                        {(() => {
                                            const total = (kpis.pos_revenue || 0) + (kpis.repairs_revenue || 0) || 1;
                                            const posPct = Math.round(((kpis.pos_revenue || 0) / total) * 100);
                                            const repPct = Math.round(((kpis.repairs_revenue || 0) / total) * 100);

                                            return (
                                                <>
                                                    <div className="split-item">
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--cool-slate-blue)' }} />
                                                                Ventas de Mostrador (POS)
                                                            </span>
                                                            <span style={{ fontWeight: 700 }}>{formatCurrency(kpis.pos_revenue || 0)} ({posPct}%)</span>
                                                        </div>
                                                        <div className="progress-track">
                                                            <div className="progress-fill" style={{ width: `${posPct}%`, background: 'var(--cool-slate-blue)' }} />
                                                        </div>
                                                    </div>

                                                    <div className="split-item">
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--cool-cyan)' }} />
                                                                Servicios de Reparación
                                                            </span>
                                                            <span style={{ fontWeight: 700 }}>{formatCurrency(kpis.repairs_revenue || 0)} ({repPct}%)</span>
                                                        </div>
                                                        <div className="progress-track">
                                                            <div className="progress-fill" style={{ width: `${repPct}%`, background: 'var(--cool-cyan)' }} />
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}

                                        <div style={{ marginTop: '12px', padding: '12px', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Descuentos Totales Concedidos:</div>
                                            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                                                {formatCurrency(kpis.discounts_total || 0)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 2: VENTAS & PRODUCTOS MÁS VENDIDOS
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'sales_products' && (
                        <div className="tab-content animate-fadeIn">
                            <div className="charts-split-grid">
                                {/* Top 10 Productos Más Vendidos */}
                                <div className="report-card report-card-main">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Top 10 Productos Más Vendidos</h2>
                                            <p>Artículos con mayor volumen de venta y facturación</p>
                                        </div>
                                    </div>

                                    {analytics?.topProducts?.length > 0 ? (
                                        <div className="table-responsive" style={{ maxHeight: 380, overflowY: 'auto' }}>
                                            <table className="tech-table">
                                                <thead>
                                                    <tr>
                                                        <th>Producto</th>
                                                        <th>Categoría</th>
                                                        <th style={{ textAlign: 'center' }}>Unidades</th>
                                                        <th style={{ textAlign: 'right' }}>Total Ventas</th>
                                                        <th style={{ textAlign: 'center' }}>Stock</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.topProducts.map((p, idx) => (
                                                        <tr key={idx}>
                                                            <td>
                                                                <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</div>
                                                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>SKU: {p.sku}</div>
                                                            </td>
                                                            <td>
                                                                <span className="badge-neutral">{p.category}</span>
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                                                {p.units_sold} uds
                                                            </td>
                                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>
                                                                {formatCurrency(p.total_revenue)}
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <span style={{ fontSize: '12px', fontWeight: 600, color: p.stock <= 3 ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
                                                                    {p.stock}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="empty-chart">No hay ventas de productos registradas en este período.</div>
                                    )}
                                </div>

                                {/* Ventas por Método de Pago */}
                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Métodos de Pago</h2>
                                            <p>Distribución de cobros en mostrador</p>
                                        </div>
                                    </div>

                                    {paymentPieData.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ width: '100%', height: 190 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={paymentPieData}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%" cy="50%"
                                                            innerRadius={48} outerRadius={72}
                                                            paddingAngle={3}
                                                        >
                                                            {paymentPieData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--color-bg-card)" strokeWidth={2} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip formatter={(val) => [formatCurrency(val), 'Monto Total']} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Leyenda en Gama Fría */}
                                            <div className="pie-legend" style={{ width: '100%' }}>
                                                {paymentPieData.map((item, idx) => (
                                                    <div key={idx} className="pie-legend-item">
                                                        <span className="pie-legend-dot" style={{ background: item.color }} />
                                                        <span className="pie-legend-name">{item.name}</span>
                                                        <span className="pie-legend-val">{formatCurrency(item.value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="empty-chart">Sin cobros en este período</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 3: TALLER & REPARACIONES
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'workshop' && (
                        <div className="tab-content animate-fadeIn">
                            <div className="charts-split-grid">
                                {/* Servicios Más Solicitados */}
                                <div className="report-card report-card-main">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Servicios Más Solicitados</h2>
                                            <p>Fallas frecuentes e intervenciones técnicas</p>
                                        </div>
                                    </div>

                                    {analytics?.topServices?.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
                                            {analytics.topServices.map((svc, idx) => {
                                                const maxCount = Math.max(...analytics.topServices.map(s => s.count)) || 1;
                                                const pct = Math.round((svc.count / maxCount) * 100);

                                                return (
                                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{svc.name}</span>
                                                            <span style={{ fontWeight: 700 }}>{svc.count} órdenes ({formatCurrency(svc.revenue)})</span>
                                                        </div>
                                                        <div className="progress-track">
                                                            <div className="progress-fill" style={{ width: `${pct}%`, background: COOL_PALETTE[idx % COOL_PALETTE.length] }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="empty-chart">Sin servicios registrados en el período</div>
                                    )}
                                </div>

                                {/* Estados de Reparación (PieChart en tonos fríos) */}
                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Estado de Órdenes en Taller</h2>
                                            <p>Distribución de reparaciones en curso</p>
                                        </div>
                                    </div>

                                    {repairStatusPieData.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ width: '100%', height: 190 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={repairStatusPieData}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%" cy="50%"
                                                            innerRadius={48} outerRadius={72}
                                                            paddingAngle={3}
                                                        >
                                                            {repairStatusPieData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--color-bg-card)" strokeWidth={2} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip formatter={(val) => [`${val} equipos`, 'Cantidad']} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Leyenda en Gama Fría */}
                                            <div className="pie-legend" style={{ width: '100%' }}>
                                                {repairStatusPieData.map((item, idx) => (
                                                    <div key={idx} className="pie-legend-item">
                                                        <span className="pie-legend-dot" style={{ background: item.color }} />
                                                        <span className="pie-legend-name">{item.name}</span>
                                                        <span className="pie-legend-val">{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="empty-chart">Sin órdenes activas</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 4: SUCURSALES & EQUIPO DE TRABAJO
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'branches_team' && (
                        <div className="tab-content animate-fadeIn">
                            {/* Comparativa Multi-Sucursal */}
                            {analytics?.branchBreakdown?.length > 0 && (
                                <div className="report-card" style={{ marginBottom: '24px' }}>
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Rendimiento por Sucursal</h2>
                                            <p>Comparativo de facturación global y transacciones por sede</p>
                                        </div>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="tech-table">
                                            <thead>
                                                <tr>
                                                    <th>Sucursal</th>
                                                    <th style={{ textAlign: 'right' }}>Ventas POS</th>
                                                    <th style={{ textAlign: 'right' }}>Taller</th>
                                                    <th style={{ textAlign: 'right' }}>Total Facturado</th>
                                                    <th style={{ textAlign: 'center' }}>Tickets / Órdenes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.branchBreakdown.map((b) => (
                                                    <tr key={b.id}>
                                                        <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                                            <Store size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--color-primary)' }} />
                                                            {b.name} <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>({b.code})</span>
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(b.pos_revenue)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(b.repairs_revenue)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>{formatCurrency(b.total_revenue)}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span className="badge-neutral">{b.sales_count} ventas | {b.repairs_count} rep.</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Ranking de Personal (Vendedores & Técnicos) */}
                            <div className="charts-split-grid">
                                {/* Vendedores */}
                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Top Vendedores de Mostrador</h2>
                                            <p>Personal con mayor facturación en ventas</p>
                                        </div>
                                    </div>
                                    {analytics?.topSellers?.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {analytics.topSellers.map((s, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '13px' }}>{s.name}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{s.sales_count} ventas cerradas</div>
                                                    </div>
                                                    <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>{formatCurrency(s.total_sold)}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-chart">Sin ventas asociadas a usuarios en este período</div>
                                    )}
                                </div>

                                {/* Técnicos */}
                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Productividad de Técnicos</h2>
                                            <p>Especialistas con más órdenes de taller resueltas</p>
                                        </div>
                                    </div>
                                    {analytics?.topTechnicians?.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {analytics.topTechnicians.map((t, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '13px' }}>{t.name}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.repairs_count} reparaciones asignadas</div>
                                                    </div>
                                                    <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>{formatCurrency(t.revenue)}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-chart">Sin órdenes asignadas a técnicos en este período</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 5: INTELIGENCIA PREDICTIVA ML (Scikit-Learn)
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'ai_ml' && (
                        <div className="tab-content animate-fadeIn">
                            <div className="kpi-grid" style={{ marginBottom: '24px' }}>
                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Ventas Proyectadas (Próximos 30 Días)</span>
                                        <Sparkles size={18} className="text-primary" />
                                    </div>
                                    <div className="kpi-value">{formatCurrency(forecastData?.total_predicted_30d || 0)}</div>
                                    <span className="kpi-subtext">Modelo de regresión lineal (Scikit-Learn)</span>
                                </div>

                                <div className="kpi-card">
                                    <div className="kpi-card-header">
                                        <span className="kpi-label">Promedio Diario Estimado</span>
                                        <Cpu size={18} style={{ color: '#0284c7' }} />
                                    </div>
                                    <div className="kpi-value">{formatCurrency(forecastData?.daily_avg_predicted || 0)}</div>
                                    <span className="kpi-subtext">Basado en volumen histórico del taller</span>
                                </div>
                            </div>

                            {/* Curva predictiva */}
                            {forecastData?.forecast?.length > 0 && (
                                <div className="report-card" style={{ marginBottom: '24px' }}>
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Curva Predictiva de Ingresos Diarios</h2>
                                            <p>Proyección estadística entrenada sobre el comportamiento comercial de tu negocio</p>
                                        </div>
                                    </div>
                                    <div className="chart-area" style={{ height: 280 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={forecastData.forecast}>
                                                <defs>
                                                    <linearGradient id="mlForecastGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                                                <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                                                <YAxis stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} tickFormatter={v => `$${v}`} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area type="monotone" dataKey="predicted_amount" name="Pronóstico Diario" stroke="#6366f1" strokeWidth={2} fill="url(#mlForecastGrad)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Segmentación K-Means RFM Enlistada */}
                            {segmentationData?.customers?.length > 0 ? (
                                <div className="report-card">
                                    <div className="report-card-header">
                                        <div>
                                            <h2>Segmentación K-Means de Clientes (RFM)</h2>
                                            <p>Agrupación inteligente por volumen de compra, recurrencia e inactividad</p>
                                        </div>
                                        <span className="badge-neutral" style={{ fontWeight: 700 }}>
                                            {segmentationData.customers.length} Clientes Analizados
                                        </span>
                                    </div>

                                    {/* Resumen de Clusters en lista */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '4px' }}>
                                        {['VIP', 'Frecuente', 'En Riesgo', 'Ocasional/Nuevo'].map(segName => {
                                            const segCustomers = segmentationData.customers.filter(c => c.segment === segName || (segName.includes('Ocasional') && (c.segment === 'Ocasional' || c.segment === 'Nuevo' || c.segment === 'Ocasional/Nuevo')));
                                            const count = segCustomers.length;
                                            const totalSpent = segCustomers.reduce((acc, c) => acc + (c.total_spent || 0), 0);
                                            const avgSpent = count > 0 ? totalSpent / count : 0;

                                            return (
                                                <div
                                                    key={segName}
                                                    onClick={() => setKmeansFilter(kmeansFilter === segName ? '' : segName)}
                                                    style={{
                                                        padding: '12px 14px',
                                                        borderRadius: 'var(--radius-md)',
                                                        background: kmeansFilter === segName ? 'var(--color-bg-elevated)' : 'var(--color-bg-tertiary)',
                                                        border: kmeansFilter === segName ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>{segName}</span>
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>{count}</span>
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                                        Promedio: <strong>{formatCurrency(avgSpent)}</strong>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Lista Enlistada de Clientes con Paginación */}
                                    {(() => {
                                        const filteredList = segmentationData.customers.filter(c =>
                                            !kmeansFilter ||
                                            c.segment === kmeansFilter ||
                                            (kmeansFilter.includes('Ocasional') && (c.segment === 'Ocasional' || c.segment === 'Nuevo' || c.segment === 'Ocasional/Nuevo'))
                                        );
                                        const totalPages = Math.ceil(filteredList.length / KMEANS_PAGE_SIZE) || 1;
                                        const currentPage = Math.min(kmeansPage, totalPages);
                                        const startIndex = (currentPage - 1) * KMEANS_PAGE_SIZE;
                                        const paginatedItems = filteredList.slice(startIndex, startIndex + KMEANS_PAGE_SIZE);

                                        return (
                                            <>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                                                    {paginatedItems.map((c, idx) => (
                                                        <div
                                                            key={c.customer_id || idx}
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                padding: '12px 16px',
                                                                background: 'var(--color-bg-tertiary)',
                                                                borderRadius: 'var(--radius-md)',
                                                                border: '1px solid var(--color-border)',
                                                                gap: '12px'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <div style={{
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    borderRadius: '50%',
                                                                    background: 'var(--color-bg-card)',
                                                                    border: '1px solid var(--color-border)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontWeight: 700,
                                                                    fontSize: '13px',
                                                                    color: 'var(--color-text)'
                                                                }}>
                                                                    {c.customer_name?.charAt(0)?.toUpperCase() || 'C'}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                                                                        {c.customer_name}
                                                                    </div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                                        {c.total_orders} {c.total_orders === 1 ? 'ticket / compra' : 'tickets / compras'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>
                                                                        {formatCurrency(c.total_spent)}
                                                                    </div>
                                                                    <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                                                                        Total Invertido
                                                                    </div>
                                                                </div>
                                                                <span className="badge-neutral" style={{ fontWeight: 700, minWidth: '85px', textAlign: 'center' }}>
                                                                    {c.segment}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Controles de Paginación */}
                                                {filteredList.length > KMEANS_PAGE_SIZE && (
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
                                                            Mostrando {startIndex + 1} - {Math.min(startIndex + KMEANS_PAGE_SIZE, filteredList.length)} de {filteredList.length} clientes
                                                        </span>

                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                            <button
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => setKmeansPage(prev => Math.max(1, prev - 1))}
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
                                                                onClick={() => setKmeansPage(prev => Math.min(totalPages, prev + 1))}
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
                            ) : (
                                <div className="report-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                                    Se requieren al menos 4 clientes con compras o reparaciones para generar el agrupamiento K-Means.
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
