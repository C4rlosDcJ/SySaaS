// =====================================================
//   SySaaS — Centralized constants & formatters
// =====================================================

export const STATUS_LABELS = {
    received: 'Recibido',
    diagnosing: 'En Diagnóstico',
    waiting_approval: 'Esperando Aprobación',
    waiting_parts: 'Esperando Refacciones',
    repairing: 'En Reparación',
    quality_check: 'Control de Calidad',
    ready: 'Listo para Entrega',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
};

export const STATUS_COLORS = {
    received: '#3b82f6',
    diagnosing: '#8b5cf6',
    waiting_approval: '#f59e0b',
    waiting_parts: '#78716c',
    repairing: '#ef4444',
    quality_check: '#06b6d4',
    ready: '#22c55e',
    delivered: '#84cc16',
    cancelled: '#6b7280',
};

export const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

export const formatDate = (date, options) => {
    if (!date) return 'Pendiente';
    return new Date(date).toLocaleDateString('es-MX', options || {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

export const formatDateTime = (date) => {
    if (!date) return 'Pendiente';
    return new Date(date).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
