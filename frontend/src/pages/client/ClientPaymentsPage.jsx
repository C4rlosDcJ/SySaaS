import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { repairService } from '../../services/api';
import {
    DollarSign,
    Receipt,
    CheckCircle2,
    Clock,
    AlertCircle,
    Download,
    Search,
    Filter,
    Calendar,
    Smartphone,
    CreditCard,
    ArrowUpRight,
    RefreshCw
} from 'lucide-react';
import './ClientPaymentsPage.css';

export default function ClientPaymentsPage() {
    const [repairs, setRepairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'paid' | 'partial' | 'pending'

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const data = await repairService.getAll({ limit: 500 });
            setRepairs(data.repairs || []);
        } catch (error) {
            console.error('Error al cargar historial de pagos:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calcular métricas
    const stats = useMemo(() => {
        let totalBilled = 0;
        let totalPaid = 0;
        let totalPending = 0;
        let paidCount = 0;
        let pendingCount = 0;

        repairs.forEach(r => {
            const total = parseFloat(r.total_cost || 0);
            const deposit = parseFloat(r.deposit_amount || 0);
            totalBilled += total;

            if (r.payment_status === 'paid' || r.status === 'delivered') {
                totalPaid += total;
                paidCount++;
            } else if (r.payment_status === 'partial') {
                totalPaid += deposit;
                totalPending += Math.max(0, total - deposit);
                pendingCount++;
            } else {
                totalPending += total;
                pendingCount++;
            }
        });

        return { totalBilled, totalPaid, totalPending, paidCount, pendingCount };
    }, [repairs]);

    // Filtrar reparaciones con costo
    const filteredPayments = useMemo(() => {
        return repairs
            .filter(r => parseFloat(r.total_cost || 0) > 0)
            .filter(r => {
                const matchesSearch =
                    r.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    r.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    r.brand_name?.toLowerCase().includes(searchTerm.toLowerCase());

                const isPaid = r.payment_status === 'paid' || r.status === 'delivered';
                const isPartial = r.payment_status === 'partial';
                const isPending = !isPaid && !isPartial;

                let matchesStatus = true;
                if (statusFilter === 'paid') matchesStatus = isPaid;
                if (statusFilter === 'partial') matchesStatus = isPartial;
                if (statusFilter === 'pending') matchesStatus = isPending;

                return matchesSearch && matchesStatus;
            });
    }, [repairs, searchTerm, statusFilter]);

    const getPaymentBadge = (repair) => {
        if (repair.payment_status === 'paid' || repair.status === 'delivered') {
            return (
                <span className="payment-badge payment-paid">
                    <CheckCircle2 size={12} /> Pagado
                </span>
            );
        }
        if (repair.payment_status === 'partial') {
            return (
                <span className="payment-badge payment-partial">
                    <Clock size={12} /> Abono / Parcial
                </span>
            );
        }
        return (
            <span className="payment-badge payment-pending">
                <AlertCircle size={12} /> Saldo Pendiente
            </span>
        );
    };

    return (
        <div className="client-payments-page animate-fadeIn">
            {/* Header */}
            <header className="page-header" style={{ marginBottom: 'var(--sp-6)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Receipt className="text-primary" size={28} />
                        Historial de Pagos y Facturación
                    </h1>
                    <p className="text-muted">Consulta los comprobantes, anticipos y saldos de todas tus reparaciones</p>
                </div>
                <button onClick={fetchPayments} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                    <RefreshCw size={16} /> Actualizar
                </button>
            </header>

            {/* KPI Summary Cards */}
            <div className="payments-stats-grid">
                <div className="card payment-stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                        <Receipt size={22} style={{ color: '#3b82f6' }} />
                    </div>
                    <div>
                        <div className="stat-label">Total Facturado</div>
                        <div className="stat-value">${stats.totalBilled.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                        <div className="stat-sub">{repairs.length} servicios registrados</div>
                    </div>
                </div>

                <div className="card payment-stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                        <CheckCircle2 size={22} style={{ color: '#10b981' }} />
                    </div>
                    <div>
                        <div className="stat-label">Total Pagado</div>
                        <div className="stat-value" style={{ color: '#10b981' }}>
                            ${stats.totalPaid.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="stat-sub">{stats.paidCount} liquidaciones completas</div>
                    </div>
                </div>

                <div className="card payment-stat-card">
                    <div className="stat-icon" style={{ background: stats.totalPending > 0 ? 'var(--cool-amber-bg)' : 'var(--color-bg-tertiary)' }}>
                        <Clock size={22} style={{ color: stats.totalPending > 0 ? 'var(--cool-amber)' : 'var(--color-text-secondary)' }} />
                    </div>
                    <div>
                        <div className="stat-label">Saldo por Liquidar</div>
                        <div className="stat-value" style={{ color: stats.totalPending > 0 ? 'var(--cool-amber)' : 'var(--color-text)' }}>
                            ${stats.totalPending.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="stat-sub">Al momento de la entrega</div>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por ticket o modelo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input"
                        style={{ paddingLeft: '36px', width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={16} style={{ color: 'var(--color-text-secondary)' }} />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="select"
                        style={{ minWidth: '160px' }}
                    >
                        <option value="all">Todos los pagos</option>
                        <option value="paid">Liquidado / Pagado</option>
                        <option value="partial">Con Anticipo</option>
                        <option value="pending">Saldo Pendiente</option>
                    </select>
                </div>
            </div>

            {/* Tabla de Pagos */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div className="spinner"></div>
                        <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)' }}>Cargando registros contables...</p>
                    </div>
                ) : filteredPayments.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <Receipt size={48} style={{ color: 'var(--color-text-secondary)', margin: '0 auto 12px' }} />
                        <h3 style={{ fontSize: '16px', margin: '0 0 6px' }}>No hay registros de pago</h3>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0 }}>
                            {searchTerm ? 'No se encontraron recibos con los filtros actuales.' : 'Aún no se han generado cargos en tus órdenes.'}
                        </p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table" style={{ width: '100%', margin: 0 }}>
                            <thead>
                                <tr>
                                    <th>Ticket / Dispositivo</th>
                                    <th>Fecha de Ingreso</th>
                                    <th>Costo Total</th>
                                    <th>Anticipo</th>
                                    <th>Saldo Restante</th>
                                    <th>Estado de Pago</th>
                                    <th style={{ textAlign: 'right' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPayments.map((repair) => {
                                    const total = parseFloat(repair.total_cost || 0);
                                    const deposit = parseFloat(repair.deposit_amount || 0);
                                    const isPaid = repair.payment_status === 'paid' || repair.status === 'delivered';
                                    const remaining = isPaid ? 0 : Math.max(0, total - deposit);

                                    return (
                                        <tr key={repair.id}>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                                                        {repair.ticket_number}
                                                    </span>
                                                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                                        {repair.brand_name || repair.brand_other} {repair.model}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                                    <Calendar size={13} />
                                                    {new Date(repair.created_at).toLocaleDateString('es-MX', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 700, fontSize: '14px' }}>
                                                ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ fontSize: '13px', color: deposit > 0 ? '#10b981' : 'var(--color-text-secondary)' }}>
                                                ${deposit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ fontSize: '14px', fontWeight: 700, color: remaining > 0 ? 'var(--cool-amber)' : 'var(--cool-teal)' }}>
                                            ${Math.max(0, remaining).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                        </td>
                                            <td>{getPaymentBadge(repair)}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <Link
                                                    to={`/dashboard/reparaciones/${repair.id}`}
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    Ver Detalle <ArrowUpRight size={13} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
