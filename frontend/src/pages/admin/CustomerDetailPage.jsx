import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { customerService, servicesCatalog } from '../../services/api';
import {
    ArrowLeft,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Wrench,
    CheckCircle2,
    Clock,
    DollarSign,
    ExternalLink,
    AlertCircle,
    User,
    Building2,
    Trash2
} from 'lucide-react';
import './CustomerDetailPage.css';

export default function CustomerDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState(null);
    const [repairs, setRepairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchCustomerData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchCustomerData = async () => {
        setLoading(true);
        setError('');
        try {
            const customerData = await customerService.getById(id);
            setCustomer(customerData);

            const repairsData = await customerService.getRepairs(id, { limit: 100 });
            setRepairs(repairsData || []);
        } catch (err) {
            console.error('Error al cargar detalle de cliente:', err);
            setError(err.message || 'No se pudieron cargar los datos del cliente.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`¿Estás seguro de eliminar o dar de baja a ${customer.first_name} ${customer.last_name}?`)) return;
        try {
            await customerService.delete(id);
            navigate('/admin/clientes');
        } catch (err) {
            alert(err.message || 'Error al eliminar cliente');
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'received': return 'badge badge-info';
            case 'diagnosing': return 'badge badge-warning';
            case 'waiting_parts': return 'badge badge-waiting';
            case 'repairing': return 'badge badge-primary';
            case 'ready': return 'badge badge-success';
            case 'delivered': return 'badge badge-delivered';
            case 'cancelled': return 'badge badge-danger';
            default: return 'badge';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'received': return 'Recibido';
            case 'diagnosing': return 'Diagnosticando';
            case 'waiting_parts': return 'Esperando Repuestos';
            case 'repairing': return 'En Reparación';
            case 'ready': return 'Listo para Entrega';
            case 'delivered': return 'Entregado';
            case 'cancelled': return 'Cancelado';
            default: return status;
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="customer-detail-loading">
                <div className="spinner"></div>
                <p>Cargando información del cliente...</p>
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="customer-detail-error">
                <AlertCircle size={48} className="text-danger" />
                <h2>Error</h2>
                <p>{error || 'No se encontró el cliente.'}</p>
                <button onClick={() => navigate('/admin/clientes')} className="btn btn-primary">
                    <ArrowLeft size={16} /> Volver a Clientes
                </button>
            </div>
        );
    }

    const filteredRepairs = repairs.filter(repair => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'active') {
            return !['delivered', 'cancelled'].includes(repair.status);
        }
        return repair.status === filterStatus;
    });

    return (
        <div className="customer-detail-container">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <div className="header-nav">
                        <Link to="/admin/clientes" className="back-link-btn">
                            <ArrowLeft size={18} />
                            Volver a Clientes
                        </Link>
                    </div>
                    <div className="header-main-info" style={{ marginTop: '8px' }}>
                        <h1>Detalle del Cliente</h1>
                        <p className="text-muted">Visualiza el historial completo del cliente</p>
                    </div>
                </div>
                <div>
                    <button onClick={handleDelete} className="btn btn-outline btn-sm" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                        <Trash2 size={16} />
                        Eliminar Cliente
                    </button>
                </div>
            </header>

            <div className="customer-detail-grid">
                {/* Panel Izquierdo: Info Cliente */}
                <div className="customer-info-card">
                    <div className="customer-avatar-lg">
                        <User size={36} />
                    </div>
                    <h2>{customer.first_name} {customer.last_name}</h2>
                    <span className="customer-role-badge">Cliente Registrado</span>

                    <div className="customer-meta-list">
                        <div className="meta-item">
                            <Mail size={16} />
                            <div className="meta-text">
                                <span className="label">Correo Electrónico</span>
                                <span className="value">{customer.email}</span>
                            </div>
                        </div>
                        <div className="meta-item">
                            <Phone size={16} />
                            <div className="meta-text">
                                <span className="label">Teléfono</span>
                                <span className="value">{customer.phone || 'Sin teléfono registrado'}</span>
                            </div>
                        </div>
                        <div className="meta-item">
                            <MapPin size={16} />
                            <div className="meta-text">
                                <span className="label">Dirección</span>
                                <span className="value">{customer.address || 'Sin dirección registrada'}</span>
                            </div>
                        </div>
                        {customer.branch_name && (
                            <div className="meta-item">
                                <Building2 size={16} />
                                <div className="meta-text">
                                    <span className="label">Sucursal</span>
                                    <span className="value">{customer.branch_name} ({customer.branch_code || 'SUC'})</span>
                                </div>
                            </div>
                        )}
                        <div className="meta-item">
                            <Calendar size={16} />
                            <div className="meta-text">
                                <span className="label">Miembro Desde</span>
                                <span className="value">{formatDate(customer.created_at)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Panel Derecho: Stats e Historial */}
                <div className="customer-history-section">
                    {/* Tarjetas de Estadísticas */}
                    <div className="stats-row">
                        <div className="stat-card spent">
                            <div className="stat-icon-wrapper">
                                <DollarSign size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="label">Total Facturado</span>
                                <h3>{servicesCatalog.formatCurrency(customer.stats?.total_spent || 0)}</h3>
                            </div>
                        </div>
                        <div className="stat-card total">
                            <div className="stat-icon-wrapper">
                                <Wrench size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="label">Total Reparaciones</span>
                                <h3>{customer.stats?.total_repairs || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card active">
                            <div className="stat-icon-wrapper">
                                <Clock size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="label">Activas</span>
                                <h3>{customer.stats?.active || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card completed">
                            <div className="stat-icon-wrapper">
                                <CheckCircle2 size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="label">Entregadas</span>
                                <h3>{customer.stats?.completed || 0}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Historial de Reparaciones */}
                    <div className="repairs-history-card">
                        <div className="card-header-actions">
                            <h3>Historial de Reparaciones</h3>
                            <div className="filters">
                                <select 
                                    value={filterStatus} 
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="select select-sm"
                                >
                                    <option value="all">Todas</option>
                                    <option value="active">Activas</option>
                                    <option value="received">Recibido</option>
                                    <option value="diagnosing">Diagnosticando</option>
                                    <option value="waiting_parts">Esperando Repuestos</option>
                                    <option value="repairing">En Reparación</option>
                                    <option value="ready">Listo para Entrega</option>
                                    <option value="delivered">Entregado</option>
                                    <option value="cancelled">Cancelado</option>
                                </select>
                            </div>
                        </div>

                        {filteredRepairs.length === 0 ? (
                            <div className="empty-repairs-state">
                                <Wrench size={32} />
                                <p>No se encontraron reparaciones para este cliente con el filtro seleccionado.</p>
                            </div>
                        ) : (
                            <div className="repairs-table-wrapper">
                                <table className="repairs-history-table">
                                    <thead>
                                        <tr>
                                            <th>Ticket / Folio</th>
                                            <th>Dispositivo</th>
                                            <th>Fecha Ingreso</th>
                                            <th>Costo</th>
                                            <th>Estado</th>
                                            <th>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRepairs.map((repair) => (
                                            <tr key={repair.id}>
                                                <td className="ticket-cell">
                                                    <strong>{repair.ticket_number || `#${repair.id}`}</strong>
                                                </td>
                                                <td>
                                                    <span className="device-desc">
                                                        {repair.brand_name || repair.brand} {repair.device_model || repair.model}
                                                    </span>
                                                    <span className="device-type-sub">
                                                        {repair.device_type_name || repair.device_type}
                                                    </span>
                                                </td>
                                                <td>{formatDate(repair.created_at)}</td>
                                                <td>{servicesCatalog.formatCurrency(repair.total_cost || 0)}</td>
                                                <td>
                                                    <span className={getStatusBadgeClass(repair.status)}>
                                                        {getStatusLabel(repair.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <Link 
                                                        to={`/admin/reparaciones/${repair.id}`}
                                                        className="btn btn-ghost btn-sm icon-btn"
                                                        title="Ver detalles de reparación"
                                                    >
                                                        <ExternalLink size={14} />
                                                        <span>Ver</span>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
