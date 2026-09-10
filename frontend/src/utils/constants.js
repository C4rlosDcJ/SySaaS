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
    waiting_approval: '#818cf8',
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
    if (typeof date === 'string') {
        const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const [, y, m, d] = match;
            const localDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
            return localDate.toLocaleDateString('es-MX', options || {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
        }
    }
    return new Date(date).toLocaleDateString('es-MX', options || {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

export const formatDateTime = (date) => {
    if (!date) return 'Pendiente';
    if (typeof date === 'string') {
        const matchTime = date.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (matchTime && !date.endsWith('00:00:00.000Z') && !date.endsWith('00:00:00')) {
            return new Date(date).toLocaleDateString('es-MX', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        }
        return formatDate(date, {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
    }
    return new Date(date).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
