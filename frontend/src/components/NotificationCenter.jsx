import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Wrench, ShoppingBag, RefreshCw, DollarSign, Info, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import './NotificationCenter.css';

// Icono segun tipo de notificacion
function NotifIcon({ type }) {
    const iconMap = {
        new_repair: <Wrench size={15} />,
        new_order: <ShoppingBag size={15} />,
        status_change: <RefreshCw size={15} />,
        payment: <DollarSign size={15} />,
        general: <Info size={15} />
    };
    return (
        <div className={`notif-icon type-${type}`}>
            {iconMap[type] || <Info size={15} />}
        </div>
    );
}

// Tiempo relativo
function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days === 1) return 'Ayer';
    return `Hace ${days} dias`;
}

export default function NotificationCenter() {
    const [open, setOpen] = useState(false);
    const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
    const navigate = useNavigate();

    const handleToggle = useCallback(() => setOpen(prev => !prev), []);
    const handleClose = useCallback(() => setOpen(false), []);

    const handleItemClick = useCallback(async (notification) => {
        handleClose();
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }
        if (notification.link) {
            navigate(notification.link);
        }
    }, [handleClose, markAsRead, navigate]);

    const handleDelete = useCallback(async (e, id) => {
        e.stopPropagation();
        await removeNotification(id);
    }, [removeNotification]);

    const handleMarkAll = useCallback(async () => {
        await markAllAsRead();
    }, [markAllAsRead]);

    return (
        <div className="notif-wrapper">
            {/* Overlay para cerrar */}
            {open && <div className="notif-overlay" onClick={handleClose} />}

            {/* Boton trigger */}
            <button
                className={`notif-trigger ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={handleToggle}
                title="Notificaciones"
                aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`}
            >
                <Bell size={17} />
                {unreadCount > 0 && (
                    <span className="notif-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Panel */}
            {open && (
                <div className="notif-panel">
                    {/* Header */}
                    <div className="notif-header">
                        <div className="notif-header-left">
                            <span className="notif-header-title">Notificaciones</span>
                            {unreadCount > 0 && (
                                <span className="notif-header-count">{unreadCount} nuevas</span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button className="notif-mark-all-btn" onClick={handleMarkAll}>
                                Marcar todas
                            </button>
                        )}
                    </div>

                    {/* Lista o estado vacio */}
                    <div className="notif-list">
                        {notifications.length === 0 ? (
                            <div className="notif-empty">
                                <div className="notif-empty-icon">
                                    <Bell size={20} />
                                </div>
                                <span className="notif-empty-title">Sin notificaciones</span>
                                <span className="notif-empty-sub">
                                    Apareceran aqui las alertas de reparaciones, pedidos y mas.
                                </span>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                                    onClick={() => handleItemClick(n)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => e.key === 'Enter' && handleItemClick(n)}
                                >
                                    <NotifIcon type={n.type} />
                                    <div className="notif-content">
                                        <div className="notif-title">{n.title}</div>
                                        <div className="notif-message">{n.message}</div>
                                        <div className="notif-time">{timeAgo(n.created_at)}</div>
                                    </div>
                                    {!n.is_read && <div className="notif-unread-dot" />}
                                    <button
                                        className="notif-delete-btn"
                                        onClick={e => handleDelete(e, n.id)}
                                        title="Eliminar"
                                        aria-label="Eliminar notificacion"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
