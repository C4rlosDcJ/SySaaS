import { useState, useEffect } from 'react';
import { orderService } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { showAlert } from '../../utils/swal';
import {
    ClipboardCheck, Clock, Package, Truck, DollarSign,
    Eye, X, ChevronRight, AlertCircle, CheckCircle, ShoppingBag
} from 'lucide-react';
import './AdminOrdersPage.css';

const statusLabels = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    processing: 'En Proceso',
    ready: 'Listo para Entrega',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
};

const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

export default function AdminOrdersPage() {
    const { tenant } = useTenant();
    const planSlug = (tenant?.plan_slug || tenant?.plan_name || '').toLowerCase();
    const isOrdersPlanAllowed = 
        ['pro', 'enterprise'].some(p => planSlug.includes(p)) || 
        (tenant?.plan_id && Number(tenant.plan_id) >= 2);

    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [detailModal, setDetailModal] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (!isOrdersPlanAllowed && tenant) {
            showAlert({
                title: 'Función Pro y Enterprise',
                text: 'El módulo de Pedidos Web está reservado para los planes Pro y Enterprise.',
                icon: 'warning',
                confirmButtonText: 'Aceptar'
            });
        }
    }, [isOrdersPlanAllowed, tenant]);

    useEffect(() => {
        if (!isOrdersPlanAllowed) {
            setLoading(false);
            return;
        }
        fetchOrders();
        fetchStats();
    }, [statusFilter, isOrdersPlanAllowed]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const params = { limit: 100 };
            if (statusFilter) params.status = statusFilter;
            const data = await orderService.getAll(params);
            setOrders(data.orders || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const data = await orderService.getStats();
            setStats(data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const openDetail = async (orderId) => {
        try {
            const data = await orderService.getById(orderId);
            setDetailData(data);
            setAdminNotes(data.admin_notes || '');
            setDetailModal(orderId);
        } catch (err) {
            console.error('Error fetching order detail:', err);
        }
    };

    const handleStatusChange = async (orderId, newStatus) => {
        setUpdating(true);
        try {
            await orderService.updateStatus(orderId, newStatus);
            fetchOrders();
            fetchStats();
            if (detailModal === orderId) {
                const data = await orderService.getById(orderId);
                setDetailData(data);
            }
        } catch (err) {
            alert(err.message || 'Error al actualizar estado');
        } finally {
            setUpdating(false);
        }
    };

    const handleSaveNotes = async () => {
        if (!detailModal) return;
        setUpdating(true);
        try {
            await orderService.updateStatus(detailModal, detailData.status, adminNotes);
            const data = await orderService.getById(detailModal);
            setDetailData(data);
        } catch (err) {
            alert(err.message || 'Error al guardar notas');
        } finally {
            setUpdating(false);
        }
    };

    if (!isOrdersPlanAllowed) {
        return (
            <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '65vh' }}>
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
                        background: 'var(--cool-slate-blue-bg)',
                        color: 'var(--cool-slate-blue)',
                        border: '1px solid var(--cool-slate-blue-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto'
                    }}>
                        <ShoppingBag size={28} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: 'var(--color-text)' }}>Función Pro y Enterprise</h2>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
                        El módulo de Gestión de Pedidos Web está reservado para los planes Pro y Enterprise.
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

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Cargando pedidos...</p>
            </div>
        );
    }

    return (
        <main className="admin-orders">
            <div className="admin-orders-header">
                <h1>
                    <ClipboardCheck size={28} className="text-primary" />
                    Gestión de Pedidos
                </h1>
            </div>

            {/* Stats */}
            {stats && (
                <div className="orders-stats-row">
                    <div className="orders-stat-card">
                        <div className="stat-icon-wrap pending"><Clock size={22} /></div>
                        <div className="stat-info">
                            <span className="stat-value">{stats.pendingCount}</span>
                            <span className="stat-label">Pendientes</span>
                        </div>
                    </div>
                    <div className="orders-stat-card">
                        <div className="stat-icon-wrap progress"><Package size={22} /></div>
                        <div className="stat-info">
                            <span className="stat-value">{stats.inProgressCount}</span>
                            <span className="stat-label">En Proceso</span>
                        </div>
                    </div>
                    <div className="orders-stat-card">
                        <div className="stat-icon-wrap ready"><CheckCircle size={22} /></div>
                        <div className="stat-info">
                            <span className="stat-value">{stats.readyCount}</span>
                            <span className="stat-label">Listos</span>
                        </div>
                    </div>
                    <div className="orders-stat-card">
                        <div className="stat-icon-wrap revenue"><DollarSign size={22} /></div>
                        <div className="stat-info">
                            <span className="stat-value">{formatCurrency(stats.totalRevenue)}</span>
                            <span className="stat-label">Ingresos Pedidos</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="orders-controls">
                <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="">Todos los estados</option>
                    <option value="pending">Pendientes</option>
                    <option value="confirmed">Confirmados</option>
                    <option value="processing">En Proceso</option>
                    <option value="ready">Listos</option>
                    <option value="delivered">Entregados</option>
                    <option value="cancelled">Cancelados</option>
                </select>
            </div>

            {/* Table */}
            {orders.length === 0 ? (
                <div className="orders-empty-admin">
                    <ClipboardCheck size={48} />
                    <h3>No hay pedidos{statusFilter ? ' con este estado' : ''}</h3>
                    <p>Los pedidos de clientes aparecerán aquí.</p>
                </div>
            ) : (
                <div className="orders-table-wrap">
                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Cliente</th>
                                <th>Ítems</th>
                                <th>Fecha</th>
                                <th>Total</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id}>
                                    <td><strong>{order.order_number}</strong></td>
                                    <td>
                                        <div className="order-customer-cell">
                                            <span className="customer-name">
                                                {order.customer_first_name} {order.customer_last_name}
                                            </span>
                                            <span className="customer-contact">
                                                {order.customer_email}
                                            </span>
                                        </div>
                                    </td>
                                    <td>{order.item_count}</td>
                                    <td>{formatDate(order.created_at)}</td>
                                    <td><strong>{formatCurrency(order.total)}</strong></td>
                                    <td>
                                        <select
                                            className="status-select"
                                            value={order.status}
                                            onChange={e => handleStatusChange(order.id, e.target.value)}
                                            disabled={updating || order.status === 'cancelled' || order.status === 'delivered'}
                                        >
                                            <option value="pending">Pendiente</option>
                                            <option value="confirmed">Confirmado</option>
                                            <option value="processing">En Proceso</option>
                                            <option value="ready">Listo</option>
                                            <option value="delivered">Entregado</option>
                                            <option value="cancelled">Cancelado</option>
                                        </select>
                                    </td>
                                    <td>
                                        <div className="order-actions">
                                            <button onClick={() => openDetail(order.id)}>
                                                <Eye size={14} /> Ver
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            {detailModal && detailData && (
                <div className="order-detail-overlay" onClick={() => setDetailModal(null)}>
                    <div className="order-detail-modal" onClick={e => e.stopPropagation()}>
                        <h2>
                            <Package size={24} className="text-primary" />
                            {detailData.order_number}
                            <span className={`order-status-badge status-${detailData.status}`} style={{ marginLeft: 'auto', fontSize: '12px' }}>
                                {statusLabels[detailData.status]}
                            </span>
                        </h2>

                        <div className="detail-section">
                            <h4>Cliente</h4>
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <span>Nombre</span>
                                    <strong>{detailData.customer_first_name} {detailData.customer_last_name}</strong>
                                </div>
                                <div className="detail-item">
                                    <span>Email</span>
                                    <strong>{detailData.customer_email}</strong>
                                </div>
                                <div className="detail-item">
                                    <span>Teléfono</span>
                                    <strong>{detailData.customer_phone || '—'}</strong>
                                </div>
                                <div className="detail-item">
                                    <span>Fecha</span>
                                    <strong>{formatDate(detailData.created_at)}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="detail-section">
                            <h4>Ítems del Pedido</h4>
                            <table className="detail-items-list">
                                <thead>
                                    <tr>
                                        <th>Descripción</th>
                                        <th>Tipo</th>
                                        <th>Cant.</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(detailData.items || []).map(item => (
                                        <tr key={item.id}>
                                            <td><strong>{item.description}</strong></td>
                                            <td>
                                                <span className={`order-item-type-badge type-${item.item_type}`}>
                                                    {item.item_type === 'product' ? 'Producto' : 'Servicio'}
                                                </span>
                                            </td>
                                            <td>{item.quantity}</td>
                                            <td><strong>{formatCurrency(item.total)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ textAlign: 'right', marginTop: 'var(--sp-3)', fontSize: 'var(--font-lg)', fontWeight: 800 }}>
                                Total: {formatCurrency(detailData.total)}
                            </div>
                        </div>

                        {detailData.notes && (
                            <div className="detail-section">
                                <h4>Notas del Cliente</h4>
                                <p style={{ fontSize: 'var(--font-sm)', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                                    {detailData.notes}
                                </p>
                            </div>
                        )}

                        <div className="detail-section">
                            <h4>Notas del Administrador</h4>
                            <textarea
                                className="detail-notes-input"
                                rows={3}
                                placeholder="Agregar notas para el cliente..."
                                value={adminNotes}
                                onChange={e => setAdminNotes(e.target.value)}
                            />
                        </div>

                        <div className="detail-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setDetailModal(null)}
                            >
                                Cerrar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveNotes}
                                disabled={updating}
                            >
                                {updating ? 'Guardando...' : 'Guardar Notas'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
