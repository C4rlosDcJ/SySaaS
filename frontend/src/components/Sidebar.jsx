import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTenant } from '../context/TenantContext';
import {
    Wrench,
    Home,
    FileText,
    ClipboardList,
    User,
    LogOut,
    LogIn,
    LayoutDashboard,
    Users,
    Settings,
    PlusCircle,
    FileSpreadsheet,
    BarChart4,
    ShoppingCart,
    Receipt,
    Package,
    Search,
    Moon,
    Sun,
    ShoppingBag,
    GitBranch,
    ArrowLeftRight,
    Building2,
    Shield,
    DollarSign,
    Layers,
    Terminal,
    ArrowLeft,
    Truck,
    Tag,
    Megaphone,
    Bell,
    Clock,
    AlertTriangle,
    Zap
} from 'lucide-react';
import { broadcastService, publicService, getImageUrl } from '../services/api';
import GlobalSearch from './common/GlobalSearch';
import './Sidebar.css';

export default function Sidebar({ isOpen, toggleMenu }) {
    const { user, logout, isAdmin, isTenantAdmin, isSuperAdmin, isTechnician, isSalesperson, isImpersonating, exitImpersonation } = useAuth();
    const { theme, toggleTheme, businessName, businessLogo } = useTheme();
    const { tenant, branches, activeBranchId, updateActiveBranch } = useTenant();
    const navigate = useNavigate();
    const [searchOpen, setSearchOpen] = useState(false);
    const [systemBroadcasts, setSystemBroadcasts] = useState([]);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [platformName, setPlatformName] = useState(() => localStorage.getItem('platform_name') || 'SySaaS');
    const [platformLogo, setPlatformLogo] = useState(() => localStorage.getItem('platform_logo') || '');

    useEffect(() => {
        if (isSuperAdmin) {
            publicService.getPlatformInfo()
                .then(info => {
                    if (info?.platform_name) {
                        setPlatformName(info.platform_name);
                        localStorage.setItem('platform_name', info.platform_name);
                    }
                    if (info?.platform_logo !== undefined) {
                        setPlatformLogo(info.platform_logo);
                        localStorage.setItem('platform_logo', info.platform_logo);
                    }
                })
                .catch(() => {});
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        if (user && !isSuperAdmin) {
            broadcastService.getActive()
                .then(data => setSystemBroadcasts(data || []))
                .catch(() => setSystemBroadcasts([]));
        }
    }, [user, isSuperAdmin]);

    // Cmd+K / Ctrl+K keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (isAdmin) {
                    setSearchOpen(prev => !prev);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAdmin]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const clientLinks = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio', exact: true },
        { to: '/dashboard/reparaciones', icon: Wrench, label: 'Mis Reparaciones' },
        { to: '/dashboard/nueva-cotizacion', icon: FileText, label: 'Nueva Cotización' },
        { to: '/dashboard/pedidos', icon: Package, label: 'Mis Pedidos' },
        { to: '/dashboard/pagos', icon: DollarSign, label: 'Mis Pagos' },
        { to: '/dashboard/tienda', icon: ShoppingBag, label: 'Tienda' },
        { to: '/dashboard/perfil', icon: User, label: 'Mi Perfil' },
    ];

    const superAdminLinks = [
        { type: 'separator', label: 'Plataforma SaaS' },
        { to: '/superadmin', icon: Shield, label: 'Super Dashboard', exact: true },
        { to: '/superadmin/reportes', icon: BarChart4, label: 'Reportes SaaS' },
        { to: '/superadmin/empresas', icon: Building2, label: 'Empresas SaaS' },
        { to: '/superadmin/usuarios', icon: Users, label: 'Usuarios Globales' },
        { to: '/superadmin/planes', icon: Layers, label: 'Planes Suscripcion' },
        { to: '/superadmin/anuncios', icon: Megaphone, label: 'Anuncios Globales' },
        { to: '/superadmin/auditoria', icon: Terminal, label: 'Auditoria Global' },
        { to: '/superadmin/configuracion', icon: Settings, label: 'Configuracion' }
    ];

    const getNavLinks = () => {
        if (isSuperAdmin && !isImpersonating) {
            return superAdminLinks;
        }

        if (user?.role === 'client') {
            return clientLinks;
        }

        if (isTenantAdmin || isImpersonating) {
            // Administrador de Empresa: Acceso Total
            return [
                { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
                { to: '/admin/reparaciones', icon: Wrench, label: 'Reparaciones' },
                { to: '/admin/nueva-reparacion', icon: PlusCircle, label: 'Nueva Reparación' },
                { to: '/admin/clientes', icon: Users, label: 'Clientes' },
                { to: '/admin/servicios', icon: FileSpreadsheet, label: 'Servicios' },

                { type: 'separator', label: 'Ventas & Compras' },
                { to: '/admin/pos', icon: ShoppingCart, label: 'Punto de Venta' },
                { to: '/admin/ventas', icon: Receipt, label: 'Historial Ventas' },
                { to: '/admin/pedidos', icon: ShoppingBag, label: 'Pedidos Web' },
                { to: '/admin/inventario', icon: Package, label: 'Inventario' },
                { to: '/admin/proveedores', icon: Truck, label: 'Proveedores & OC' },
                { to: '/admin/cupones', icon: Tag, label: 'Cupones Descuento' },

                { type: 'separator', label: 'Administración' },
                { to: '/admin/reportes', icon: BarChart4, label: 'Reportes' },
                { to: '/admin/usuarios', icon: Users, label: 'Personal / Usuarios' },
                { to: '/admin/sucursales', icon: GitBranch, label: 'Sucursales' },
                { to: '/admin/traslados', icon: ArrowLeftRight, label: 'Traspasos Stock' },
                { to: '/admin/suscripcion', icon: Shield, label: 'Suscripción' },
                { to: '/admin/configuracion', icon: Settings, label: 'Configuración' }
            ];
        }

        if (user?.role === 'branch_manager') {
            // Gerente de Sucursal: Gestión Operativa, Inventario y Personal de Sede
            return [
                { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
                { to: '/admin/reparaciones', icon: Wrench, label: 'Reparaciones' },
                { to: '/admin/nueva-reparacion', icon: PlusCircle, label: 'Nueva Reparación' },
                { to: '/admin/clientes', icon: Users, label: 'Clientes' },
                { to: '/admin/servicios', icon: FileSpreadsheet, label: 'Servicios' },

                { type: 'separator', label: 'Ventas & Stock' },
                { to: '/admin/pos', icon: ShoppingCart, label: 'Punto de Venta' },
                { to: '/admin/ventas', icon: Receipt, label: 'Historial Ventas' },
                { to: '/admin/pedidos', icon: ShoppingBag, label: 'Pedidos Web' },
                { to: '/admin/inventario', icon: Package, label: 'Inventario' },
                { to: '/admin/traslados', icon: ArrowLeftRight, label: 'Traspasos Stock' },

                { type: 'separator', label: 'Gestión de Sede' },
                { to: '/admin/reportes', icon: BarChart4, label: 'Reportes' },
                { to: '/admin/usuarios', icon: Users, label: 'Personal de Sede' }
            ];
        }

        if (user?.role === 'technician') {
            return [
                { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
                { to: '/admin/reparaciones', icon: Wrench, label: 'Reparaciones' },
                { to: '/admin/nueva-reparacion', icon: PlusCircle, label: 'Nueva Reparación' },
                { to: '/admin/clientes', icon: Users, label: 'Clientes' },
                { to: '/admin/servicios', icon: FileSpreadsheet, label: 'Servicios' },
                { type: 'separator', label: 'Stock' },
                { to: '/admin/inventario', icon: Package, label: 'Inventario' },
                { to: '/admin/traslados', icon: ArrowLeftRight, label: 'Traspasos Stock' }
            ];
        }

        if (user?.role === 'cashier') {
            return [
                { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
                { to: '/admin/pos', icon: ShoppingCart, label: 'Punto de Venta' },
                { to: '/admin/ventas', icon: Receipt, label: 'Historial Ventas' },
                { to: '/admin/reparaciones', icon: Wrench, label: 'Reparaciones' },
                { to: '/admin/clientes', icon: Users, label: 'Clientes' },
                { to: '/admin/inventario', icon: Package, label: 'Inventario' }
            ];
        }

        if (user?.role === 'salesperson') {
            return [
                { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
                { to: '/admin/pos', icon: ShoppingCart, label: 'Punto de Venta' },
                { to: '/admin/ventas', icon: Receipt, label: 'Historial Ventas' },
                { to: '/admin/clientes', icon: Users, label: 'Clientes' },
                { to: '/admin/inventario', icon: Package, label: 'Inventario' }
            ];
        }

        return clientLinks;
    };

    const links = getNavLinks();

    // Si es SuperAdmin (y no está en modo soporte), mostrar marca global de la plataforma configurada.
    // Si es una empresa/cliente, mostrar el nombre y logo exclusivo de su tenant.
    const currentName = (isSuperAdmin && !isImpersonating) 
        ? platformName 
        : (tenant?.company_name || 'Mi Empresa');

    const currentLogo = (isSuperAdmin && !isImpersonating)
        ? platformLogo
        : (tenant?.logo_url || '');

    const renderBusinessName = () => {
        const name = currentName;
        if (name.includes('-')) {
            const parts = name.split('-');
            return <>{parts[0]}<span className="text-primary">-{parts.slice(1).join('-')}</span></>;
        }
        if (name.includes(' ')) {
            const parts = name.split(' ');
            return <>{parts[0]} <span className="text-primary">{parts.slice(1).join(' ')}</span></>;
        }
        return <>{name}</>;
    };

    const getUserRoleLabel = () => {
        if (isSuperAdmin) return 'SuperAdmin Plataforma';
        if (isTenantAdmin) return 'Administrador Empresa';
        if (user?.role === 'branch_manager') return 'Gerente Sucursal';
        if (user?.role === 'technician') return 'Técnico';
        if (user?.role === 'salesperson') return 'Vendedor';
        if (user?.role === 'cashier') return 'Cajero';
        return 'Cliente';
    };

    return (
        <>
            {/* Overlay para móvil */}
            {isOpen && <div className="sidebar-overlay" onClick={toggleMenu}></div>}

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        {currentLogo ? (
                            <img 
                                src={getImageUrl(currentLogo)} 
                                alt="Logo" 
                                className="logo-img-sidebar" 
                                style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: 'var(--logo-radius, 8px)' }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        ) : (isSuperAdmin && !isImpersonating) ? (
                            <Shield size={24} className="logo-icon text-primary" />
                        ) : (
                            <Wrench size={24} className="logo-icon" />
                        )}
                        <span className="logo-text">{renderBusinessName()}</span>
                    </div>
                </div>

                {/* Selector de Sucursal Multi-Sucursal para personal (staff) o soporte */}
                {branches.length > 0 && user?.role !== 'client' && (!isSuperAdmin || isImpersonating) && (
                    <div className="branch-selector-container" style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <GitBranch size={13} className="text-primary" />
                            <span>SUCURSAL ACTIVA</span>
                        </div>
                        <select 
                            value={activeBranchId || ''} 
                            onChange={(e) => updateActiveBranch(parseInt(e.target.value, 10))}
                            style={{ 
                                width: '100%', 
                                padding: '7px 10px', 
                                borderRadius: 'var(--radius-md)', 
                                border: '1px solid var(--color-border)', 
                                backgroundColor: 'var(--color-bg-elevated)', 
                                color: 'var(--color-text)', 
                                fontSize: '12px',
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {isAdmin && (
                    <div style={{ display: 'flex', gap: '8px', padding: '12px 16px 6px' }}>
                        <div className="sidebar-search-trigger" style={{ flex: 1, margin: 0 }} onClick={() => setSearchOpen(true)}>
                            <Search size={16} />
                            <span>Buscar...</span>
                            <kbd className="search-kbd">⌘K</kbd>
                        </div>
                        {systemBroadcasts.length > 0 && (
                            <button
                                onClick={() => setShowBroadcastModal(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '8px 12px', background: 'rgba(99, 102, 241, 0.15)',
                                    border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-sm)',
                                    color: 'var(--color-primary)', cursor: 'pointer', position: 'relative'
                                }}
                                title="Comunicados del Sistema"
                            >
                                <Bell size={18} />
                                <span style={{
                                    position: 'absolute', top: '-4px', right: '-4px',
                                    background: '#ef4444', color: '#fff', borderRadius: '50%',
                                    width: '16px', height: '16px', fontSize: '10px', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {systemBroadcasts.length}
                                </span>
                            </button>
                        )}
                    </div>
                )}

                {/* Indicador de Estado de Periodo de Prueba o Facturación */}
                {user?.role !== 'client' && (!isSuperAdmin || isImpersonating) && tenant?.subscription_status === 'trial' && (
                    <div style={{ padding: '6px 16px 8px' }}>
                        {tenant?.trial_ends_at && new Date(tenant.trial_ends_at) < new Date() ? (
                            <NavLink
                                to="/admin/suscripcion"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                                    borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', textDecoration: 'none',
                                    fontSize: '11px', fontWeight: 700
                                }}
                            >
                                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                <span style={{ flex: 1 }}>Prueba Vencida • Activar</span>
                                <Zap size={12} />
                            </NavLink>
                        ) : (
                            <NavLink
                                to="/admin/suscripcion"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                                    borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.12)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', textDecoration: 'none',
                                    fontSize: '11px', fontWeight: 600
                                }}
                            >
                                <Clock size={14} style={{ flexShrink: 0 }} />
                                <span style={{ flex: 1 }}>
                                    Prueba: {tenant?.trial_ends_at ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))) : 0} días
                                </span>
                                <Zap size={12} />
                            </NavLink>
                        )}
                    </div>
                )}

                <nav className="sidebar-nav">
                    <ul className="nav-list">
                        {links.map((link, idx) => (
                            link.type === 'separator' ? (
                                <li key={`sep-${idx}`} className="nav-separator">
                                    <span>{link.label}</span>
                                </li>
                            ) : (
                                <li key={link.to}>
                                    <NavLink
                                        to={link.to}
                                        end={link.exact}
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                        onClick={() => {
                                            if (window.innerWidth <= 900) toggleMenu();
                                        }}
                                    >
                                        <link.icon size={20} className="nav-icon" />
                                        <span className="nav-label">{link.label}</span>
                                    </NavLink>
                                </li>
                            )
                        ))}
                    </ul>
                </nav>

                <div className="sidebar-footer">
                    {isImpersonating && (
                        <button
                            onClick={async () => {
                                try {
                                    await exitImpersonation();
                                    navigate('/superadmin');
                                } catch (err) {
                                    console.error('Error al salir de impersonacion:', err);
                                }
                            }}
                            className="btn btn-secondary w-full"
                            style={{
                                justifyContent: 'center',
                                marginBottom: '12px',
                                fontSize: '13px',
                                fontWeight: 600
                            }}
                        >
                            <ArrowLeft size={16} /> <span>Volver a SuperAdmin</span>
                        </button>
                    )}
                    <div className="theme-toggle-container" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button onClick={toggleTheme} className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
                            {theme === 'light' ? (
                                <><Moon size={18} /> <span>Modo Oscuro</span></>
                            ) : (
                                <><Sun size={18} /> <span>Modo Claro</span></>
                            )}
                        </button>
                    </div>
                    <div className="user-info">
                        <div className="sidebar-user-avatar">
                            {user?.first_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-details">
                            <span className="user-name">{user?.first_name} {user?.last_name}</span>
                            <span className="user-role" style={{ fontSize: '11px', opacity: 0.8 }}>
                                {getUserRoleLabel()}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="logout-btn">
                        <LogOut size={18} />
                        <span>Salir</span>
                    </button>
                </div>
            </aside>

            <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* Modal de Comunicados del Sistema */}
            {showBroadcastModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Megaphone size={20} className="text-primary" />
                                <span>Comunicados del Sistema</span>
                            </h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowBroadcastModal(false)} style={{ color: 'var(--color-text-secondary)' }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {systemBroadcasts.map(b => (
                                <div key={b.id} style={{
                                    padding: '14px', borderRadius: 'var(--radius-md)',
                                    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{b.title}</span>
                                        <span className={`status-badge status-${b.type === 'urgent' ? 'repairing' : b.type === 'warning' ? 'info' : 'delivered'}`}>
                                            {b.type === 'urgent' ? 'Urgente' : b.type === 'warning' ? 'Advertencia' : 'Informativo'}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                        {b.message}
                                    </p>
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                                        {new Date(b.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

