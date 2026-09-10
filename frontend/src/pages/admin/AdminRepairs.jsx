import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repairService } from '../../services/api';
import { STATUS_LABELS, formatCurrency, formatDate } from '../../utils/constants';
import {
    Search, Filter, RefreshCw, Wrench, Eye,
    ChevronLeft, ChevronRight, ShoppingCart, Trash2
} from 'lucide-react';
import './AdminRepairs.css';

const ALL_STATUSES = Object.keys(STATUS_LABELS);

export default function AdminRepairs() {
    const [repairs, setRepairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [warrantyFilter, setWarrantyFilter] = useState('all');

    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth > 900 ? 12 : 6);

    useEffect(() => {
        const handleResize = () => setItemsPerPage(window.innerWidth > 900 ? 12 : 6);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        fetchRepairs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, warrantyFilter, page, itemsPerPage]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => fetchRepairs(), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    const fetchRepairs = async () => {
        setLoading(true);
        try {
            const params = { limit: itemsPerPage, page };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (warrantyFilter === 'warranties') {
                params.is_warranty = 'true';
            } else if (warrantyFilter === 'pending_warranties') {
                params.is_warranty = 'true';
                params.warranty_approved = 'pending';
            }
            const data = await repairService.getAll(params);
            setRepairs(data.repairs || []);
            setTotal(data.pagination?.total || 0);
            setTotalPages(data.pagination?.totalPages || 1);
        } catch (err) {
            console.error('Error al cargar reparaciones:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusFilter = (s) => {
        setStatusFilter(s);
        setPage(1);
    };

    const handleDeleteRepair = async (repair) => {
        const clientName = `${repair.customer_first_name || repair.first_name || ''} ${repair.customer_last_name || repair.last_name || ''}`.trim();
        const msg = `¿Estás seguro de eliminar la orden #${repair.ticket_number}${clientName ? ` (${clientName})` : ''}? Esta acción no se puede deshacer.`;
        if (window.confirm(msg)) {
            try {
                await repairService.delete(repair.id);
                fetchRepairs();
            } catch (err) {
                alert('Error al eliminar la reparación: ' + err.message);
            }
        }
    };

    return (
        <div className="repairs-page">

            {/* ── Header ── */}
            <header className="page-header">
                <div>
                    <h1>Reparaciones</h1>
                    <p>{total > 0 ? `${total} órdenes en total` : 'Gestiona las órdenes de reparación'}</p>
                </div>
                <div className="header-actions">
                    <button onClick={fetchRepairs} className="btn btn-secondary btn-sm" title="Actualizar">
                        <RefreshCw size={14} />
                        <span className="hide-on-mobile">Actualizar</span>
                    </button>
                    <Link to="/admin/nueva-reparacion" className="btn btn-primary btn-sm">
                        <Wrench size={14} />
                        <span className="hide-on-mobile">Nueva Reparación</span>
                    </Link>
                </div>
            </header>

            {/* ── Status filter chips ── */}
            <div className="status-chips">
                <button
                    className={`chip ${statusFilter === 'all' ? 'chip--active' : ''}`}
                    onClick={() => handleStatusFilter('all')}
                >
                    Todas
                </button>
                {ALL_STATUSES.map(s => (
                    <button
                        key={s}
                        className={`chip chip--${s} ${statusFilter === s ? 'chip--active' : ''}`}
                        onClick={() => handleStatusFilter(s)}
                    >
                        {STATUS_LABELS[s]}
                    </button>
                ))}
            </div>

            {/* ── Search bar ── */}
            <div className="repairs-search" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ flex: 1, minWidth: '250px' }}>
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por ticket, cliente, modelo..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                        className="input"
                    />
                </div>
                <div className="filter-select-wrapper" style={{ minWidth: '220px' }}>
                    <select
                        className="select"
                        value={warrantyFilter}
                        onChange={e => { setWarrantyFilter(e.target.value); setPage(1); }}
                        style={{ height: '42px', padding: '0 12px', fontSize: '14px', borderRadius: 'var(--radius-md)' }}
                    >
                        <option value="all">Todas las órdenes</option>
                        <option value="warranties">Sólo Garantías</option>
                        <option value="pending_warranties">Garantías por Aprobar</option>
                    </select>
                </div>
            </div>

            {/* ── Table ── */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Cargando reparaciones...</p>
                </div>
            ) : repairs.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon"><Wrench size={40} /></div>
                    <h3>No se encontraron reparaciones</h3>
                    <p>Cambia los filtros o crea una nueva orden</p>
                    <Link to="/admin/nueva-reparacion" className="btn btn-primary btn-sm">
                        Nueva Reparación
                    </Link>
                </div>
            ) : (
                <>
                    <div className="table-container">
                        <table className="table repairs-table">
                            <thead>
                                <tr>
                                    <th>Ticket</th>
                                    <th>Cliente</th>
                                    <th>Dispositivo</th>
                                    <th>Estado</th>
                                    <th>Pago</th>
                                    <th>Total</th>
                                    <th>Fecha</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {repairs.map(repair => (
                                    <tr key={repair.id}>
                                        <td data-label="Ticket">
                                            <span className="repairs-ticket">{repair.ticket_number}</span>
                                            {repair.parent_repair_id && (
                                                <span style={{ marginLeft: '6px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>Garantía</span>
                                            )}
                                        </td>
                                        <td data-label="Cliente">
                                            <div className="repairs-client">
                                                <div className="repairs-client-avatar">
                                                    {((repair.customer_first_name || repair.first_name)?.[0] || 'C')}
                                                    {((repair.customer_last_name || repair.last_name)?.[0] || '')}
                                                </div>
                                                <div>
                                                    <div className="repairs-client-name">
                                                        {repair.customer_first_name || repair.first_name || 'Sin Cliente'}{' '}
                                                        {repair.customer_last_name || repair.last_name || ''}
                                                    </div>
                                                    <div className="repairs-client-email">
                                                        {repair.customer_email || repair.email || repair.customer_phone || '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Dispositivo">
                                            <div className="repairs-device">
                                                <span className="repairs-device-type">{repair.device_type_name}</span>
                                                <span className="repairs-device-model">{repair.brand_name || repair.brand_other} · {repair.model}</span>
                                            </div>
                                        </td>
                                        <td data-label="Estado">
                                            <span className={`status-badge status-${repair.status}`}>
                                                {STATUS_LABELS[repair.status]}
                                            </span>
                                        </td>
                                        <td data-label="Pago">
                                            {repair.payment_status === 'paid' ? (
                                                <span className="badge text-xs bg-success-muted text-success">✓ Pagado</span>
                                            ) : repair.payment_status === 'partial' ? (
                                                <span className="badge text-xs bg-warning-muted text-warning">◐ Parcial</span>
                                            ) : repair.total_cost > 0 ? (
                                                <span className="badge text-xs bg-error-muted text-error">○ Pendiente</span>
                                            ) : (
                                                <span className="text-muted text-xs">—</span>
                                            )}
                                        </td>
                                        <td data-label="Total" className="repairs-cost">
                                            {formatCurrency(repair.total_cost)}
                                        </td>
                                        <td data-label="Fecha" className="repairs-date">
                                            {formatDate(repair.created_at)}
                                        </td>
                                        <td data-label="Acciones">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Link
                                                    to={`/admin/reparaciones/${repair.id}`}
                                                    className="btn btn-ghost btn-icon"
                                                    title="Ver detalle"
                                                >
                                                    <Eye size={16} />
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-icon"
                                                    style={{ color: 'var(--color-error)' }}
                                                    title="Eliminar orden de reparación"
                                                    onClick={() => handleDeleteRepair(repair)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Pagination ── */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-4)' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                Anterior
                            </button>
                            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                Página {page} de {totalPages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
