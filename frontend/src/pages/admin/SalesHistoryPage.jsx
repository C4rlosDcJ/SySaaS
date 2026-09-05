import { useState, useEffect, useRef } from 'react';
import {
    Receipt, Search, Eye, XCircle, Printer, DollarSign,
    TrendingUp, ShoppingBag, CreditCard, Banknote, ArrowRightLeft,
    Calendar, Download, RefreshCw, Filter, Layers, User,
    FileText, CheckCircle2, AlertCircle, Clock, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { posService, settingsService } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { formatCurrency, formatDateTime } from '../../utils/constants';
import { showAlert, showConfirm } from '../../utils/swal';
import PrintReceipt from '../../components/common/PrintReceipt';
import './SalesHistoryPage.css';

const PAYMENT_LABELS = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    mixed: 'Mixto'
};

const PAYMENT_ICONS = {
    cash: Banknote,
    card: CreditCard,
    transfer: ArrowRightLeft,
    mixed: Layers
};

export default function SalesHistoryPage() {
    const { tenant } = useTenant();
    const [sales, setSales] = useState([]);
    const [stats, setStats] = useState({});
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

    // Filters & Search
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [datePreset, setDatePreset] = useState('all'); // 'today' | 'week' | 'month' | 'all' | 'custom'
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth > 900 ? 15 : 8);

    // Modals
    const [selectedSale, setSelectedSale] = useState(null);
    const [showDetail, setShowDetail] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Ticket Print Modal
    const [showPrintTicket, setShowPrintTicket] = useState(false);
    const [ticketSaleData, setTicketSaleData] = useState(null);

    const searchTimeout = useRef(null);

    useEffect(() => {
        const handleResize = () => setItemsPerPage(window.innerWidth > 900 ? 15 : 8);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        settingsService.getAll().then(setSettings).catch(() => {});
    }, []);

    useEffect(() => {
        loadSales();
        loadStats();
    }, [page, dateFrom, dateTo, paymentMethod, statusFilter, itemsPerPage]);

    // Handle Quick Date Presets
    const handlePresetChange = (preset) => {
        setDatePreset(preset);
        setPage(1);
        const now = new Date();
        if (preset === 'today') {
            const todayStr = now.toISOString().slice(0, 10);
            setDateFrom(todayStr);
            setDateTo(todayStr);
        } else if (preset === 'week') {
            const dayOfWeek = now.getDay() || 7;
            const monday = new Date(now);
            monday.setDate(now.getDate() - (dayOfWeek - 1));
            setDateFrom(monday.toISOString().slice(0, 10));
            setDateTo(now.toISOString().slice(0, 10));
        } else if (preset === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            setDateFrom(firstDay.toISOString().slice(0, 10));
            setDateTo(now.toISOString().slice(0, 10));
        } else if (preset === 'all') {
            setDateFrom('');
            setDateTo('');
        }
    };

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearch(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            setPage(1);
            loadSales(val);
        }, 350);
    };

    const loadSales = async (customSearch = search) => {
        setLoading(true);
        try {
            const params = { page, limit: itemsPerPage };
            if (customSearch && customSearch.trim()) params.search = customSearch.trim();
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            if (paymentMethod) params.payment_method = paymentMethod;
            if (statusFilter) params.status = statusFilter;

            const data = await posService.getSales(params);
            setSales(data.sales || []);
            setPagination(data.pagination || { page: 1, limit: itemsPerPage, total: 0, totalPages: 1 });
        } catch (err) {
            console.error('Error al cargar ventas:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const data = await posService.getSalesStats();
            setStats(data || {});
        } catch (err) {
            console.error('Error al cargar estadísticas de ventas:', err);
        }
    };

    const viewSaleDetail = async (saleId) => {
        setLoadingDetail(true);
        setShowDetail(true);
        try {
            const detail = await posService.getSaleById(saleId);
            setSelectedSale(detail);
        } catch (err) {
            showAlert({ title: 'Error', text: 'No se pudo cargar el detalle de la venta.', icon: 'error' });
            setShowDetail(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handlePrintSaleTicket = async (sale) => {
        try {
            let fullSale = sale;
            if (!sale.items || sale.items.length === 0) {
                fullSale = await posService.getSaleById(sale.id);
            }
            setTicketSaleData(fullSale);
            setShowPrintTicket(true);
        } catch (err) {
            showAlert({ title: 'Error', text: 'Error al preparar ticket de venta.', icon: 'error' });
        }
    };

    const handleCancelSale = async (id) => {
        const confirmed = await showConfirm({
            title: '¿Cancelar esta Venta?',
            text: 'Se revertirá la transacción y se repondrán las unidades vendidas en el inventario automáticamente.',
            icon: 'warning',
            confirmText: 'Sí, Cancelar Venta'
        });
        if (!confirmed) return;

        try {
            await posService.cancelSale(id);
            showAlert({ title: 'Venta Cancelada', text: 'La venta ha sido cancelada y el stock fue restaurado.', icon: 'success' });
            setShowDetail(false);
            loadSales();
            loadStats();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'No se pudo cancelar la venta.', icon: 'error' });
        }
    };

    const handleExportCSV = () => {
        if (!sales || sales.length === 0) {
            showAlert({ title: 'Sin Datos', text: 'No hay ventas disponibles en este filtro para exportar.', icon: 'info' });
            return;
        }

        const companyName = tenant?.company_name || settings.business_name || 'SySaaS';
        const headers = ['Folio Venta', 'Fecha y Hora', 'Cliente', 'Cajero', 'Sucursal', 'Metodo Pago', 'Subtotal ($)', 'Descuento ($)', 'Total ($)', 'Estado', 'Ticket Reparacion'];
        const rows = sales.map(s => [
            s.sale_number,
            `"${formatDateTime(s.created_at).replace(/"/g, '""')}"`,
            `"${((s.customer_first_name ? `${s.customer_first_name} ${s.customer_last_name || ''}` : 'Publico General')).replace(/"/g, '""')}"`,
            `"${((s.cashier_first_name ? `${s.cashier_first_name} ${s.cashier_last_name || ''}` : 'Cajero')).replace(/"/g, '""')}"`,
            `"${(s.branch_name || 'Matriz').replace(/"/g, '""')}"`,
            PAYMENT_LABELS[s.payment_method] || s.payment_method,
            parseFloat(s.subtotal || 0).toFixed(2),
            parseFloat(s.discount || 0).toFixed(2),
            parseFloat(s.total || 0).toFixed(2),
            s.status === 'completed' ? 'Completada' : (s.status === 'cancelled' ? 'Cancelada' : s.status),
            `"${(s.repair_ticket || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
            + `# Empresa: ${companyName} - Reporte de Ventas emitido el ${new Date().toLocaleDateString('es-MX')}\n`
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Ventas_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showAlert({ title: 'Exportación Exitosa', text: `Se exportaron ${sales.length} transacciones en formato CSV.`, icon: 'success' });
    };

    const resetFilters = () => {
        setSearch('');
        setDateFrom('');
        setDateTo('');
        setPaymentMethod('');
        setStatusFilter('');
        setDatePreset('all');
        setPage(1);
        loadSales('');
    };

    return (
        <div className="sales-history-page animate-fadeIn">
            
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px', fontWeight: 800 }}>
                        <Receipt size={28} className="text-primary" /> 
                        <span>Historial de Ventas</span>
                    </h1>
                    <p className="page-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                        Consulta transacciones, reimprime comprobantes térmicos y audita los ingresos de caja.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { loadSales(); loadStats(); }} title="Recargar">
                        <RefreshCw size={14} />
                        <span>Actualizar</span>
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={14} /> 
                        <span>Exportar CSV</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="sales-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="sales-stat-card">
                    <div className="sales-stat-icon" style={{ background: 'var(--cool-teal-bg)', color: 'var(--cool-teal)', border: '1px solid var(--cool-teal-border)' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div className="sales-stat-value">{formatCurrency(stats.today?.total || 0)}</div>
                        <div className="sales-stat-count"><strong>{stats.today?.count || 0}</strong> ventas hoy</div>
                        <div className="sales-stat-label">Ingresos de Hoy</div>
                    </div>
                </div>

                <div className="sales-stat-card">
                    <div className="sales-stat-icon" style={{ background: 'var(--cool-cyan-bg)', color: 'var(--cool-cyan)', border: '1px solid var(--cool-cyan-border)' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="sales-stat-value">{formatCurrency(stats.week?.total || 0)}</div>
                        <div className="sales-stat-count"><strong>{stats.week?.count || 0}</strong> ventas esta semana</div>
                        <div className="sales-stat-label">Semana en Curso</div>
                    </div>
                </div>

                <div className="sales-stat-card">
                    <div className="sales-stat-icon" style={{ background: 'var(--cool-slate-blue-bg)', color: 'var(--cool-slate-blue)', border: '1px solid var(--cool-slate-blue-border)' }}>
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <div className="sales-stat-value">{formatCurrency(stats.month?.total || 0)}</div>
                        <div className="sales-stat-count"><strong>{stats.month?.count || 0}</strong> ventas en el mes</div>
                        <div className="sales-stat-label">Mes Actual</div>
                    </div>
                </div>

                <div className="sales-stat-card">
                    <div className="sales-stat-icon" style={{ background: 'var(--cool-amber-bg)', color: 'var(--cool-amber)', border: '1px solid var(--cool-amber-border)' }}>
                        <Receipt size={24} />
                    </div>
                    <div>
                        <div className="sales-stat-value">{formatCurrency(stats.month?.averageTicket || (stats.allTime?.count ? stats.allTime.total / stats.allTime.count : 0))}</div>
                        <div className="sales-stat-count">Ticket Promedio</div>
                        <div className="sales-stat-label">Promedio por Venta</div>
                    </div>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="sales-filters-card">
                {/* Top Row: Search + Quick Date Presets */}
                <div className="sales-filters-top">
                    <div className="sales-search-box">
                        <Search size={15} className="search-icon" />
                        <input
                            type="text"
                            className="input input-sm sales-search-input"
                            placeholder="Buscar por folio, cliente, cajero o ticket de reparación..."
                            value={search}
                            onChange={handleSearchChange}
                        />
                    </div>

                    {/* Presets */}
                    <div className="sales-presets-group">
                        {[
                            { key: 'all', label: 'Todo' },
                            { key: 'today', label: 'Hoy' },
                            { key: 'week', label: 'Esta Semana' },
                            { key: 'month', label: 'Este Mes' }
                        ].map(p => (
                            <button
                                key={p.key}
                                type="button"
                                onClick={() => handlePresetChange(p.key)}
                                className={`preset-pill ${datePreset === p.key ? 'active' : ''}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bottom Row: Specific Date Range + Payment + Status + Reset */}
                <div className="sales-filters-bottom">
                    <div className="sales-date-group">
                        <Calendar size={14} style={{ color: 'var(--color-text-muted)' }} />
                        <input
                            type="date"
                            className="sales-date-input"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setDatePreset('custom'); setPage(1); }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>a</span>
                        <input
                            type="date"
                            className="sales-date-input"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setDatePreset('custom'); setPage(1); }}
                        />
                    </div>

                    <select
                        className="select select-sm sales-filter-select"
                        value={paymentMethod}
                        onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
                    >
                        <option value="">Todos los Métodos</option>
                        <option value="cash">Efectivo</option>
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transferencia</option>
                        <option value="mixed">Mixto</option>
                    </select>

                    <select
                        className="select select-sm sales-filter-select"
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    >
                        <option value="">Todos los Estados</option>
                        <option value="completed">Completadas</option>
                        <option value="cancelled">Canceladas</option>
                        <option value="pending">Pendientes</option>
                    </select>

                    {(search || dateFrom || dateTo || paymentMethod || statusFilter) && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={resetFilters}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}
                        >
                            <X size={13} /> Limpiar Filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Sales Table */}
            {loading ? (
                <div className="loading-state" style={{ minHeight: '300px' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Cargando historial de ventas...</p>
                </div>
            ) : (
                <>
                    <div className="table-container card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="table" style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    <th>No. Venta</th>
                                    <th>Fecha y Hora</th>
                                    <th>Cliente</th>
                                    <th>Cajero</th>
                                    <th>Método</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" style={{ padding: '48px 16px', textAlign: 'center' }}>
                                            <div className="empty-state" style={{ padding: 0 }}>
                                                <Receipt size={40} className="empty-icon" style={{ opacity: 0.4, marginBottom: '12px' }} />
                                                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>No se encontraron ventas</h3>
                                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                                    {search || dateFrom || paymentMethod || statusFilter
                                                        ? 'Intenta ajustar los filtros de búsqueda.'
                                                        : 'Las transacciones cobradas en el Punto de Venta aparecerán aquí.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map(sale => {
                                        const PayIcon = PAYMENT_ICONS[sale.payment_method] || Banknote;
                                        return (
                                            <tr key={sale.id}>
                                                <td>
                                                    <span className="sale-number" style={{ fontWeight: 700 }}>{sale.sale_number}</span>
                                                    {sale.repair_ticket && (
                                                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                            Ord: <strong>{sale.repair_ticket}</strong>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                                    {formatDateTime(sale.created_at)}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                                                        {sale.customer_first_name
                                                            ? `${sale.customer_first_name} ${sale.customer_last_name || ''}`
                                                            : <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>Público general</span>
                                                        }
                                                    </div>
                                                </td>
                                                <td style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                                    {sale.cashier_first_name ? `${sale.cashier_first_name} ${sale.cashier_last_name || ''}` : 'Cajero'}
                                                </td>
                                                <td>
                                                    <div className="sale-method-pill">
                                                        <PayIcon size={14} className="method-icon" />
                                                        <span>{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</span>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13.5px', color: 'var(--color-text)' }}>
                                                    {formatCurrency(sale.total)}
                                                </td>
                                                <td>
                                                    <div className={`sale-status-indicator status-${sale.status}`}>
                                                        <span className="status-dot"></span>
                                                        <span>
                                                            {sale.status === 'completed' ? 'Completada' :
                                                             sale.status === 'cancelled' ? 'Cancelada' : sale.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                        <button 
                                                            className="btn btn-secondary btn-sm" 
                                                            onClick={() => handlePrintSaleTicket(sale)} 
                                                            title="Imprimir Ticket Térmico"
                                                            style={{ padding: '5px 9px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                        >
                                                            <Printer size={13} />
                                                            <span style={{ fontSize: '11.5px' }}>Ticket</span>
                                                        </button>
                                                        <button 
                                                            className="btn btn-ghost btn-sm" 
                                                            onClick={() => viewSaleDetail(sale.id)} 
                                                            title="Ver Detalle"
                                                            style={{ padding: '6px' }}
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                Mostrando página <strong>{page}</strong> de <strong>{pagination.totalPages}</strong> ({pagination.total} ventas en total)
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <ChevronLeft size={14} /> Anterior
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={page >= pagination.totalPages}
                                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                    Siguiente <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ═══ Sale Detail Modal ═══ */}
            {showDetail && (
                <div className="modal-overlay" onClick={() => setShowDetail(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px', width: '95%' }}>
                        {loadingDetail ? (
                            <div className="loading-state" style={{ minHeight: 250 }}>
                                <div className="spinner"></div>
                            </div>
                        ) : selectedSale ? (
                            <>
                                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Receipt size={20} />
                                        </div>
                                        <div>
                                            <h3 className="modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                                                {selectedSale.sale_number}
                                            </h3>
                                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                                {formatDateTime(selectedSale.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handlePrintSaleTicket(selectedSale)}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Printer size={14} /> Imprimir Ticket
                                        </button>
                                        <button className="modal-close" onClick={() => setShowDetail(false)}>
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ padding: '20px 0' }}>
                                    
                                    {/* Informative Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', background: 'var(--color-bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                                        <div>
                                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Cliente</span>
                                            <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: 'var(--color-text)' }}>
                                                {selectedSale.customer_first_name
                                                    ? `${selectedSale.customer_first_name} ${selectedSale.customer_last_name || ''}`
                                                    : 'Público General'}
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Cajero / Staff</span>
                                            <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>
                                                {selectedSale.cashier_first_name} {selectedSale.cashier_last_name || ''}
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Método de Pago</span>
                                            <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>
                                                {PAYMENT_LABELS[selectedSale.payment_method] || selectedSale.payment_method}
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Estado</span>
                                            <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: selectedSale.status === 'completed' ? '#10b981' : '#ef4444' }}>
                                                {selectedSale.status === 'completed' ? 'Completada' : (selectedSale.status === 'cancelled' ? 'Cancelada' : selectedSale.status)}
                                            </div>
                                        </div>
                                    </div>

                                    {selectedSale.repair_ticket && (
                                        <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--color-text)' }}>
                                                Vinculado a Orden de Taller: <strong>{selectedSale.repair_ticket}</strong>
                                            </span>
                                            {selectedSale.repair_warranty_days && (
                                                <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>
                                                    Garantía: {selectedSale.repair_warranty_days} días
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    <div className="table-container" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '18px' }}>
                                        <table className="table" style={{ margin: 0 }}>
                                            <thead>
                                                <tr>
                                                    <th>Descripción</th>
                                                    <th style={{ textAlign: 'center' }}>Cant.</th>
                                                    <th style={{ textAlign: 'right' }}>P. Unit</th>
                                                    <th style={{ textAlign: 'right' }}>Importe</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedSale.items?.map((item, i) => (
                                                    <tr key={i}>
                                                        <td>
                                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.description}</div>
                                                            {item.sku && <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>SKU: {item.sku}</div>}
                                                        </td>
                                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price || item.price)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.total)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Total Breakdown */}
                                    <div style={{ background: 'var(--color-bg-tertiary)', padding: '16px 20px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                            <span>Subtotal</span>
                                            <span>{formatCurrency(selectedSale.subtotal)}</span>
                                        </div>
                                        {parseFloat(selectedSale.discount) > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ef4444' }}>
                                                <span>Descuento aplicado</span>
                                                <span>-{formatCurrency(selectedSale.discount)}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: 'var(--color-text)', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                                            <span>Total Pagado</span>
                                            <span>{formatCurrency(selectedSale.total)}</span>
                                        </div>
                                        {selectedSale.payment_method === 'cash' && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)', borderTop: '1px dashed var(--color-border)', paddingTop: '6px', marginTop: '2px' }}>
                                                <span>Efectivo Recibido: <strong>{formatCurrency(selectedSale.amount_received || selectedSale.total)}</strong></span>
                                                <span>Cambio: <strong>{formatCurrency(selectedSale.change_amount || 0)}</strong></span>
                                            </div>
                                        )}
                                    </div>

                                </div>

                                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '14px' }}>
                                    <div>
                                        {selectedSale.status === 'completed' && (
                                            <button 
                                                type="button"
                                                className="btn btn-danger btn-sm" 
                                                onClick={() => handleCancelSale(selectedSale.id)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <XCircle size={14} /> Cancelar Transacción
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            type="button"
                                            className="btn btn-primary btn-sm" 
                                            onClick={() => handlePrintSaleTicket(selectedSale)}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Printer size={14} /> Imprimir Ticket
                                        </button>
                                        <button 
                                            type="button"
                                            className="btn btn-secondary btn-sm" 
                                            onClick={() => setShowDetail(false)}
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Print Receipt Modal */}
            <PrintReceipt
                isOpen={showPrintTicket}
                onClose={() => setShowPrintTicket(false)}
                data={ticketSaleData}
                type="sale"
                settings={settings}
            />

        </div>
    );
}
