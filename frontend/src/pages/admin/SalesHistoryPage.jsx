import { useState, useEffect, useRef } from 'react';
import {
    Receipt, Search, Eye, XCircle, Printer, DollarSign,
    TrendingUp, ShoppingBag, CreditCard, Banknote, ArrowRightLeft,
    Calendar, Download, RefreshCw, Filter, Layers, User,
    FileText, CheckCircle2, AlertCircle, Clock, X, ChevronLeft, ChevronRight, RotateCcw
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

    // Helper para formatear fecha local en YYYY-MM-DD
    const formatLocalDate = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Handle Quick Date Presets
    const handlePresetChange = (preset) => {
        setDatePreset(preset);
        setPage(1);
        const now = new Date();
        if (preset === 'today') {
            const todayStr = formatLocalDate(now);
            setDateFrom(todayStr);
            setDateTo(todayStr);
        } else if (preset === 'week') {
            const dayOfWeek = now.getDay() || 7;
            const monday = new Date(now);
            monday.setDate(now.getDate() - (dayOfWeek - 1));
            setDateFrom(formatLocalDate(monday));
            setDateTo(formatLocalDate(now));
        } else if (preset === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            setDateFrom(formatLocalDate(firstDay));
            setDateTo(formatLocalDate(now));
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
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const clientDate = `${year}-${month}-${day}`;
            const data = await posService.getSalesStats({ client_date: clientDate });
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

    const handleReturnItem = async (item) => {
        const isRepair = !!(item.repair_id || selectedSale.repair_ticket);
        const itemTypeDesc = item.product_id 
            ? 'un producto y sus existencias volverán al inventario' 
            : (isRepair ? 'una reparación y se revertirá a estado lista para entrega' : 'un servicio');

        const confirmed = await showConfirm({
            title: '¿Devolver este ítem?',
            text: `Se retirará "${item.description}" de la venta. Corresponde a ${itemTypeDesc}. ¿Deseas continuar?`,
            icon: 'warning',
            confirmText: 'Sí, Devolver Ítem'
        });
        if (!confirmed) return;

        try {
            await posService.returnSaleItem(selectedSale.id, item.id, {
                reason: 'Devolución de cliente'
            });
            showAlert({
                title: 'Ítem Devuelto',
                text: `Se ha procesado la devolución de "${item.description}" y se actualizaron los totales.`,
                icon: 'success'
            });

            // Recargar detalle actual de la venta
            const updated = await posService.getSaleById(selectedSale.id);
            setSelectedSale(updated);

            // Recargar lista y estadísticas
            loadSales();
            loadStats();
        } catch (err) {
            showAlert({
                title: 'Error',
                text: err.message || 'No se pudo procesar la devolución del ítem.',
                icon: 'error'
            });
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
            s.status === 'completed' ? 'Completada' : (s.status === 'refunded' ? 'Devuelta' : (s.status === 'cancelled' ? 'Cancelada' : s.status)),
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
            <div className="page-header sales-page-header">
                <div className="sales-page-header-left">
                    <h1 className="page-title">
                        <Receipt size={26} className="text-primary" />
                        <span>Historial de Ventas</span>
                    </h1>
                    <p>Consulta transacciones, reimprime comprobantes térmicos y audita los ingresos de caja.</p>
                </div>
                <div className="sales-page-header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => { loadSales(); loadStats(); }} title="Recargar">
                        <RefreshCw size={14} />
                        <span>Actualizar</span>
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
                        <Download size={14} />
                        <span>Exportar CSV</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="sales-stats">
                <div className="sales-stat-card">
                    <div className="sales-stat-icon" style={{ color: 'var(--cool-teal)' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div className="sales-stat-value">{formatCurrency(stats.today?.total || 0)}</div>
                        <div className="sales-stat-count"><strong>{stats.today?.count || 0}</strong> ventas hoy</div>
                        <div className="sales-stat-label">Ingresos de Hoy</div>
                    </div>
                </div>

                <div className="sales-stat-card">
                    <div className="sales-stat-icon" style={{ color: 'var(--cool-cyan)' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="sales-stat-value">{formatCurrency(stats.week?.total || 0)}</div>
                        <div className="sales-stat-count"><strong>{stats.week?.count || 0}</strong> ventas esta semana</div>
                        <div className="sales-stat-label">Semana en Curso</div>
                    </div>
                </div>

                <div className="sales-stat-card">
                    <div className="sales-stat-icon" style={{ color: 'var(--cool-slate-blue)' }}>
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <div className="sales-stat-value">{formatCurrency(stats.month?.total || 0)}</div>
                        <div className="sales-stat-count"><strong>{stats.month?.count || 0}</strong> ventas en el mes</div>
                        <div className="sales-stat-label">Mes Actual</div>
                    </div>
                </div>

                <div className="sales-stat-card">
                    <div className="sales-stat-icon" style={{ color: 'var(--cool-amber)' }}>
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
                        <option value="refunded">Devueltas / Reembolsadas</option>
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
                                                    <div className={`sale-status-indicator sale-status-${sale.status}`}>
                                                        <span className="status-dot"></span>
                                                        <span>
                                                            {sale.status === 'completed' ? 'Completada' :
                                                             sale.status === 'refunded' ? 'Devuelta' :
                                                             sale.status === 'cancelled' ? 'Cancelada' :
                                                             sale.status === 'pending' ? 'Pendiente' : sale.status}
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
                                                        {sale.status === 'completed' && (
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                onClick={() => handleCancelSale(sale.id)}
                                                                title="Cancelar Venta"
                                                                style={{ padding: '6px', color: 'var(--color-danger, #ef4444)' }}
                                                            >
                                                                <XCircle size={15} />
                                                            </button>
                                                        )}
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
                <div className="modal-overlay sale-detail-overlay" onClick={() => setShowDetail(false)}>
                    <div className="modal sale-detail-modal" onClick={(e) => e.stopPropagation()}>
                        {loadingDetail ? (
                            <div className="loading-state" style={{ minHeight: 250 }}>
                                <div className="spinner"></div>
                            </div>
                        ) : selectedSale ? (
                            <>
                                <div className="sale-detail-header">
                                    <div className="sale-detail-header-info">
                                        <div className="sale-detail-icon-wrap">
                                            <Receipt size={18} />
                                        </div>
                                        <div className="sale-detail-title-col">
                                            <h3 className="sale-detail-folio font-mono">
                                                {selectedSale.sale_number}
                                            </h3>
                                            <span className="sale-detail-date">
                                                {formatDateTime(selectedSale.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="sale-detail-header-actions">
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm sale-detail-ticket-btn"
                                            onClick={() => handlePrintSaleTicket(selectedSale)}
                                            title="Imprimir Ticket"
                                        >
                                            <Printer size={14} />
                                            <span>Imprimir Ticket</span>
                                        </button>
                                        <button 
                                            type="button"
                                            className="modal-close sale-detail-close-btn" 
                                            onClick={() => setShowDetail(false)}
                                            aria-label="Cerrar"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="sale-detail-body">
                                    
                                    {/* Informative Grid */}
                                    <div className="sale-detail-meta-grid">
                                        <div className="sale-detail-meta-item">
                                            <span className="sale-detail-meta-label">Cliente</span>
                                            <div className="sale-detail-meta-value">
                                                {selectedSale.customer_first_name
                                                    ? `${selectedSale.customer_first_name} ${selectedSale.customer_last_name || ''}`
                                                    : 'Público General'}
                                            </div>
                                        </div>
                                        <div className="sale-detail-meta-item">
                                            <span className="sale-detail-meta-label">Cajero / Staff</span>
                                            <div className="sale-detail-meta-value">
                                                {selectedSale.cashier_first_name} {selectedSale.cashier_last_name || ''}
                                            </div>
                                        </div>
                                        <div className="sale-detail-meta-item">
                                            <span className="sale-detail-meta-label">Método de Pago</span>
                                            <div className="sale-detail-meta-value">
                                                {PAYMENT_LABELS[selectedSale.payment_method] || selectedSale.payment_method}
                                            </div>
                                        </div>
                                        <div className="sale-detail-meta-item">
                                            <span className="sale-detail-meta-label">Estado</span>
                                            <div className={`sale-detail-meta-value status-${selectedSale.status}`}>
                                                {selectedSale.status === 'completed' ? 'Completada' : (selectedSale.status === 'refunded' ? 'Devuelta' : (selectedSale.status === 'cancelled' ? 'Cancelada' : (selectedSale.status === 'pending' ? 'Pendiente' : selectedSale.status)))}
                                            </div>
                                        </div>
                                    </div>

                                    {selectedSale.repair_ticket && (
                                        <div className="sale-detail-repair-banner">
                                            <span className="sale-detail-repair-text">
                                                Vinculado a Orden de Taller: <strong>{selectedSale.repair_ticket}</strong>
                                            </span>
                                            {selectedSale.repair_warranty_days && (
                                                <span className="sale-detail-warranty-tag">
                                                    Garantía: {selectedSale.repair_warranty_days} días
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Items List */}
                                    <div className="sale-detail-items-container">
                                        <div className="sale-detail-items-header">Artículos de la Venta</div>
                                        <div className="sale-detail-items-list">
                                            {selectedSale.items?.map((item, i) => {
                                                const isReturned = Boolean(item.is_returned);
                                                return (
                                                    <div key={i} className={`sale-detail-item-row ${isReturned ? 'is-returned' : ''}`}>
                                                        <div className="sale-detail-item-main">
                                                            <div className="sale-detail-item-desc">
                                                                {item.description}
                                                            </div>
                                                            <div className="sale-detail-item-sub">
                                                                {item.sku && <span className="sale-detail-item-sku">SKU: {item.sku}</span>}
                                                                <span className="sale-detail-item-calc">
                                                                    {item.quantity} x {formatCurrency(item.unit_price || item.price)}
                                                                </span>
                                                            </div>
                                                            {isReturned && (
                                                                <div className="sale-detail-item-return-reason">
                                                                    Devuelto: {item.return_reason || 'Devolución de cliente'}
                                                                    {item.returned_at ? ` (${formatDateTime(item.returned_at)})` : ''}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="sale-detail-item-side">
                                                            <div className="sale-detail-item-total font-mono">
                                                                {formatCurrency(item.total)}
                                                            </div>
                                                            <div className="sale-detail-item-actions">
                                                                {isReturned ? (
                                                                    <span className="sale-detail-returned-badge">
                                                                        Devuelto
                                                                    </span>
                                                                ) : selectedSale.status === 'completed' ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-secondary btn-sm sale-detail-return-btn"
                                                                        onClick={() => handleReturnItem(item)}
                                                                        title="Quitar o devolver este ítem individual"
                                                                    >
                                                                        <RotateCcw size={12} />
                                                                        <span>Devolver</span>
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Total Breakdown */}
                                    <div className="sale-detail-breakdown">
                                        <div className="sale-detail-breakdown-row">
                                            <span>Subtotal</span>
                                            <span className="font-mono">{formatCurrency(selectedSale.subtotal)}</span>
                                        </div>
                                        {parseFloat(selectedSale.discount) > 0 && (
                                            <div className="sale-detail-breakdown-row is-discount">
                                                <span>Descuento aplicado</span>
                                                <span className="font-mono">-{formatCurrency(selectedSale.discount)}</span>
                                            </div>
                                        )}
                                        <div className="sale-detail-breakdown-row is-total">
                                            <span>Total Pagado</span>
                                            <span className="font-mono">{formatCurrency(selectedSale.total)}</span>
                                        </div>
                                        {selectedSale.payment_method === 'cash' && (
                                            <div className="sale-detail-breakdown-cash">
                                                <span>Efectivo Recibido: <strong className="font-mono">{formatCurrency(selectedSale.amount_received || selectedSale.total)}</strong></span>
                                                <span>Cambio: <strong className="font-mono">{formatCurrency(selectedSale.change_amount || 0)}</strong></span>
                                            </div>
                                        )}
                                    </div>

                                </div>

                                <div className="sale-detail-footer">
                                    <div className="sale-detail-footer-left">
                                        {selectedSale.status === 'completed' && (
                                            <button 
                                                type="button"
                                                className="btn btn-danger btn-sm sale-detail-cancel-btn" 
                                                onClick={() => handleCancelSale(selectedSale.id)}
                                            >
                                                <XCircle size={14} />
                                                <span>Cancelar Transacción</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="sale-detail-footer-right">
                                        <button 
                                            type="button"
                                            className="btn btn-primary btn-sm sale-detail-print-bottom-btn" 
                                            onClick={() => handlePrintSaleTicket(selectedSale)}
                                        >
                                            <Printer size={14} />
                                            <span>Imprimir Ticket</span>
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
