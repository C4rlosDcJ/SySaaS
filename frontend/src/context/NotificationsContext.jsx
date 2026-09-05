import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { notificationsService } from '../services/api';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
    const { user, isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const esRef = useRef(null);         // EventSource activo
    const retryTimerRef = useRef(null); // Timer de reconexion

    // Solo para staff/admin del tenant — no clientes, no superadmin
    const shouldConnect = isAuthenticated &&
        user?.tenant_id &&
        user?.role !== 'client' &&
        user?.role !== 'superadmin';

    // Carga inicial de notificaciones historicas desde REST
    const fetchAll = useCallback(async () => {
        if (!shouldConnect) return;
        try {
            const data = await notificationsService.getAll();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unread_count || 0);
        } catch {
            // silencioso
        }
    }, [shouldConnect]);

    // Conectar SSE
    const connectSSE = useCallback(() => {
        if (!shouldConnect) return;
        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }

        const url = notificationsService.getStreamUrl();
        const es = new EventSource(url);
        esRef.current = es;

        es.addEventListener('notification', (e) => {
            try {
                const notification = JSON.parse(e.data);
                setNotifications(prev => {
                    // Evitar duplicados
                    if (prev.some(n => n.id === notification.id)) return prev;
                    return [notification, ...prev];
                });
                setUnreadCount(prev => prev + 1);
            } catch {
                // payload malformado — ignorar
            }
        });

        es.onerror = () => {
            es.close();
            esRef.current = null;
            // Reintentar en 5 segundos
            retryTimerRef.current = setTimeout(() => connectSSE(), 5_000);
        };
    }, [shouldConnect]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!shouldConnect) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        setLoading(true);
        fetchAll().finally(() => setLoading(false));

        connectSSE();

        return () => {
            if (esRef.current) { esRef.current.close(); esRef.current = null; }
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        };
    }, [shouldConnect]); // eslint-disable-line react-hooks/exhaustive-deps

    const markAsRead = useCallback(async (id) => {
        try {
            await notificationsService.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* silencioso */ }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await notificationsService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
        } catch { /* silencioso */ }
    }, []);

    const removeNotification = useCallback(async (id) => {
        try {
            const target = notifications.find(n => n.id === id);
            await notificationsService.remove(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (target && !target.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch { /* silencioso */ }
    }, [notifications]);

    const refresh = useCallback(() => fetchAll(), [fetchAll]);

    return (
        <NotificationsContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            markAsRead,
            markAllAsRead,
            removeNotification,
            refresh
        }}>
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
    return ctx;
}
