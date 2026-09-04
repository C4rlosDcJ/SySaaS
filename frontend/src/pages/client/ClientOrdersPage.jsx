import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { orderService } from '../../services/api';
import {
    Package, Calendar, Hash, ChevronDown, ShoppingBag,
    Clock, CheckCircle, Truck, XCircle, AlertCircle, Loader, Edit3
} from 'lucide-react';
import './ClientOrdersPage.css';

const statusLabels = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    processing: 'En Proceso',
    ready: 'Listo',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
};

const statusIcons = {
    pending: Clock,
    confirmed: CheckCircle,
    processing: Loader,
    ready: Package,
    delivered: Truck,
    cancelled: XCircle
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

export default function ClientOrdersPage() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [expandedData, setExpandedData] = useState({});
    const [statusFilter, setStatusFilter] = useState('');
    const [cancelling, setCancelling] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, [statusFilter]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const params = { limit: 50 };
            if (statusFilter) params.status = statusFilter;
            const data = await orderService.getAll(params);
            setOrders(data.orders || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEditOrder = (order, detail) => {
        if (!detail) return;
        if (!confirm(`¿Deseas editar el pedido ${order.order_number}? Se cargará en tu carrito para que puedas modificarlo en la tienda.`)) return;

        const cartItems = (detail.items || []).map(item => {
            const isProduct = item.product_id !== null && item.product_id !== undefined;
            const itemType = isProduct ? 'product' : 'service';
            const key = isProduct ? `p-${item.product_id}` : `s-${item.service_id}`;
            return {
                key,
                item_type: itemType,
                product_id: item.product_id,
                service_id: item.service_id,
                name: item.description,
                price: parseFloat(item.unit_price) || 0,
                quantity: item.quantity,
                maxStock: isProduct ? 999 : null,
                categoryColor: null
            };
        });

        localStorage.setItem('sysaas_cart', JSON.stringify(cartItems));
        localStorage.setItem('sysaas_editing_order_id', order.id);
        localStorage.setItem('sysaas_editing_order_number', order.order_number);

        navigate('/dashboard/tienda');
    };

    const toggleExpand = async (orderId) => {
        if (expandedId === orderId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(orderId);
        if (!expandedData[orderId]) {
            try {
                const data = await orderService.getById(orderId);
                setExpandedData(prev => ({ ...prev, [orderId]: data }));
            } catch (err) {
                console.error('Error fetching order detail:', err);
            }
        }
    };

    const handleCancel = async (orderId) => {
        if (!confirm('¿Estás seguro de cancelar este pedido?')) return;
        setCancelling(orderId);
        try {
            await orderService.cancel(orderId);
            fetchOrders();
        } catch (err) {
            alert(err.message || 'Error al cancelar pedido');
        } finally {
            setCancelling(null);
        }
    };

    const filterOptions = [
        { value: '', label: 'Todos' },
        { value: 'pending', label: 'Pendientes' },
        { value: 'confirmed', label: 'Confirmados' },
        { value: 'processing', label: 'En Proceso' },
        { value: 'ready', label: 'Listos' },
        { value: 'delivered', label: 'Entregados' },
        { value: 'cancelled', label: 'Cancelados' }
    ];

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Cargando pedidos...</p>
            </div>
        );
    }

    return (
        <main className="orders-page">
            <div className="orders-page-header">
                <h1>
                    <Package size={28} className="text-primary" />
                    Mis Pedidos
                </h1>
                <div className="orders-filter-tabs">
                    {filterOptions.map(opt => (
                        <button
                            key={opt.value}
                            className={`orders-filter-tab ${statusFilter === opt.value ? 'active' : ''}`}
                            onClick={() => setStatusFilter(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="orders-empty">
                    <div className="orders-empty-icon">
                        <ShoppingBag size={32} />
                    </div>
                    <h3>No tienes pedidos{statusFilter ? ' con este estado' : ''}</h3>
                    <p>Visita nuestra tienda para explorar servicios y productos disponibles.</p>
                    <Link to="/dashboard/tienda" className="btn btn-primary">
                        Ir a la Tienda
                    </Link>
                </div>
            ) : (
                <div className="orders-list">
                    {orders.map(order => {
                        const isExpanded = expandedId === order.id;
                        const detail = expandedData[order.id];
                        const StatusIcon = statusIcons[order.status] || AlertCircle;

                        return (
                            <div key={order.id} className="order-card">
                                <div
                                    className="order-card-header"
                                    onClick={() => toggleExpand(order.id)}
                                >
                                    <div className="order-card-left">
                                        <div className="order-card-icon">
                                            <StatusIcon size={22} />
                                        </div>
                                        <div className="order-card-info">
                                            <h3>{order.order_number}</h3>
                                            <div className="order-meta">
                                                <span>
                                                    <Calendar size={13} />
                                                    {formatDate(order.created_at)}
                                                </span>
                                                <span>
                                                    <Hash size={13} />
                                                    {order.item_count} {order.item_count === 1 ? 'ítem' : 'ítems'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="order-card-right">
                                        <span className={`order-status-badge status-${order.status}`}>
                                            {statusLabels[order.status]}
                                        </span>
                                        <span className="order-total">{formatCurrency(order.total)}</span>
                                        <ChevronDown
                                            size={18}
                                            className={`order-expand-icon ${isExpanded ? 'expanded' : ''}`}
                                        />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="order-card-details">
                                        {detail ? (
                                            <>
                                                <table className="order-items-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Ítem</th>
                                                            <th>Tipo</th>
                                                            <th>Precio Unit.</th>
                                                            <th>Cant.</th>
                                                            <th>Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(detail.items || []).map(item => (
                                                            <tr key={item.id}>
                                                                <td><strong>{item.description}</strong></td>
                                                                <td>
                                                                    <span className={`order-item-type-badge type-${item.product_id ? 'product' : 'service'}`}>
                                                                        {item.product_id ? 'Producto' : 'Servicio'}
                                                                    </span>
                                                                </td>
                                                                <td>{formatCurrency(item.unit_price)}</td>
                                                                <td>{item.quantity}</td>
                                                                <td><strong>{formatCurrency(item.total)}</strong></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                <div className="order-detail-footer">
                                                    {detail.notes && (
                                                        <p className="order-notes">
                                                            Nota: {detail.notes}
                                                        </p>
                                                    )}
                                                    {detail.admin_notes && (
                                                        <p className="order-notes">
                                                            Respuesta: {detail.admin_notes}
                                                        </p>
                                                    )}
                                                    {order.status === 'pending' && (
                                                         <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                                             <button
                                                                 className="order-edit-btn"
                                                                 onClick={() => handleEditOrder(order, detail)}
                                                                 style={{
                                                                     padding: '8px 16px',
                                                                     background: 'rgba(255, 255, 255, 0.03)',
                                                                     color: 'var(--color-text)',
                                                                     border: '1px solid var(--color-border)',
                                                                     borderRadius: 'var(--radius-md)',
                                                                     fontSize: '0.75rem',
                                                                     fontWeight: '700',
                                                                     cursor: 'pointer',
                                                                     display: 'inline-flex',
                                                                     alignItems: 'center',
                                                                     gap: '6px',
                                                                     transition: 'all 0.2s ease'
                                                                 }}
                                                                 onMouseEnter={(e) => {
                                                                     e.currentTarget.style.background = '#fff';
                                                                     e.currentTarget.style.color = '#000';
                                                                     e.currentTarget.style.borderColor = '#fff';
                                                                 }}
                                                                 onMouseLeave={(e) => {
                                                                     e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                                                     e.currentTarget.style.color = 'var(--color-text)';
                                                                     e.currentTarget.style.borderColor = 'var(--color-border)';
                                                                 }}
                                                             >
                                                                 <Edit3 size={14} /> Editar Pedido
                                                             </button>
                                                             <button
                                                                 className="order-cancel-btn"
                                                                 onClick={() => handleCancel(order.id)}
                                                                 disabled={cancelling === order.id}
                                                                 style={{ marginTop: 0 }}
                                                             >
                                                                 {cancelling === order.id ? 'Cancelando...' : 'Cancelar Pedido'}
                                                             </button>
                                                         </div>
                                                     )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="catalog-loading" style={{ padding: 'var(--sp-6)' }}>
                                                <div className="spinner"></div>
                                                <p>Cargando detalle...</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
