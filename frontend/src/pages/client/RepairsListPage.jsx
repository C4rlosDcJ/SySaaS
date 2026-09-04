import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repairService } from '../../services/api';
import {
    Search,
    Filter,
    ChevronRight,
    Smartphone,
    RefreshCw
} from 'lucide-react';
import './RepairsListPage.css';

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

const getProgressPercent = (status) => {
    const steps = ['received', 'diagnosing', 'waiting_approval', 'waiting_parts', 'repairing', 'quality_check', 'ready', 'delivered'];
    const index = steps.indexOf(status);
    if (index === -1) return 0;
    if (status === 'cancelled') return 0;
    return Math.round(((index + 1) / steps.length) * 100);
};

export default function RepairsListPage() {
    const [repairs, setRepairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchRepairs();
    }, []);

    const fetchRepairs = async () => {
        setLoading(true);
        try {
            const data = await repairService.getAll({ limit: 100 });
            setRepairs(data.repairs || []);
        } catch (error) {
            console.error('Error al cargar reparaciones:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredRepairs = repairs.filter(repair => {
        const matchesSearch =
            repair.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            repair.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            repair.brand_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || repair.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="repairs-page-container animate-fadeIn">
            <header className="page-header" style={{ marginBottom: 'var(--sp-6)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700 }}>Mis Reparaciones</h1>
                    <p className="text-muted">Consulta el historial completo y seguimiento de tus dispositivos</p>
                </div>
                <button onClick={fetchRepairs} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                    <RefreshCw size={16} />
                    Actualizar Lista
                </button>
            </header>

            {/* Filtros */}
            <div className="filters-bar-premium">
                <div className="search-box-premium">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por ticket, marca, modelo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input"
                    />
                </div>
                <div className="filter-group-premium">
                    <Filter size={16} />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="select"
                    >
                        <option value="all">Todos los estados</option>
                        {Object.entries(statusLabels).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Lista de reparaciones */}
            <div className="repairs-list-wrapper">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Cargando tus reparaciones...</p>
                    </div>
                ) : filteredRepairs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <Smartphone size={48} />
                        </div>
                        <h3>No se encontraron registros</h3>
                        <p>{searchTerm || statusFilter !== 'all' ? 'Intenta con otros términos o filtros' : 'Aún no posees reparaciones registradas en la plataforma'}</p>
                    </div>
                ) : (
                    <div className="repairs-cards-grid">
                        {filteredRepairs.map((repair) => {
                            const progress = getProgressPercent(repair.status);
                            return (
                                <div key={repair.id} className="repair-grid-card">
                                    <div className="card-top-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span className="ticket-tag">{repair.ticket_number}</span>
                                            {repair.parent_repair_id && (
                                                <span style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>Garantía</span>
                                            )}
                                            {repair.status === 'delivered' && repair.warranty_expires && new Date(repair.warranty_expires) > new Date() && (
                                                <span style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: '#10b981', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>Garantía Vigente</span>
                                            )}
                                        </div>
                                        <span className={`status-badge status-${repair.status}`}>
                                            {statusLabels[repair.status]}
                                        </span>
                                    </div>
                                    <div className="card-main-body">
                                        <h3>{repair.device_type_name} {repair.brand_name || repair.brand_other}</h3>
                                        <p className="model-info">{repair.model}</p>
                                        {repair.problem_description && (
                                            <p className="problem-text-excerpt">
                                                {repair.problem_description.substring(0, 85)}
                                                {repair.problem_description.length > 85 ? '...' : ''}
                                            </p>
                                        )}
                                        
                                        {/* Stepper Visual de Reparación */}
                                        <div className="repair-timeline-stepper">
                                            {[
                                                { key: 'received', label: 'Recibido' },
                                                { key: 'diagnosing', label: 'Diagnóstico' },
                                                { key: 'repairing', label: 'Reparación' },
                                                { key: 'quality_check', label: 'Calidad' },
                                                { key: 'ready', label: 'Listo' }
                                            ].map((step, idx) => {
                                                const stepOrder = {
                                                    received: 1,
                                                    diagnosing: 2,
                                                    waiting_approval: 2,
                                                    waiting_parts: 3,
                                                    repairing: 3,
                                                    quality_check: 4,
                                                    ready: 5,
                                                    delivered: 5,
                                                    cancelled: 0
                                                };
                                                const currentOrder = stepOrder[repair.status] || 0;
                                                const stepIndex = idx + 1;
                                                const isCompleted = currentOrder > stepIndex || repair.status === 'delivered';
                                                const isCurrent = currentOrder === stepIndex;

                                                return (
                                                    <div key={step.key} className={`timeline-step ${isCompleted ? 'step-completed' : ''} ${isCurrent ? 'step-current' : ''}`}>
                                                        <div className="timeline-dot">
                                                            {isCompleted ? '✓' : stepIndex}
                                                        </div>
                                                        <span className="timeline-label">{step.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="meta-footer-details">
                                            <span className="meta-date">
                                                Registrado: {new Date(repair.created_at).toLocaleDateString('es-MX', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                            {repair.total_cost > 0 && (
                                                <span className="meta-cost">
                                                    ${parseFloat(repair.total_cost).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Link to={`/dashboard/reparaciones/${repair.id}`} className="view-detail-card-action">
                                        Ver Seguimiento Completo <ChevronRight size={14} />
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
