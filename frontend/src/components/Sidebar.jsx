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
    Shield
} from 'lucide-react';
import GlobalSearch from './common/GlobalSearch';
import './Sidebar.css';

export default function Sidebar({ isOpen, toggleMenu }) {
    const { user, logout, isAdmin, isTenantAdmin, isSuperAdmin } = useAuth();
    const { theme, toggleTheme, businessName, businessLogo } = useTheme();
    const { branches, activeBranchId, updateActiveBranch } = useTenant();
    const navigate = useNavigate();
    const [searchOpen, setSearchOpen] = useState(false);

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
        { to: '/dashboard', icon: Home, label: 'Dashboard', exact: true },
        { to: '/dashboard/tienda', icon: ShoppingBag, label: 'Tienda' },
        { to: '/dashboard/pedidos', icon: Package, label: 'Mis Pedidos' },
        { to: '/dashboard/nueva-cotizacion', icon: FileText, label: 'Nueva Cotización' },
        { to: '/dashboard/reparaciones', icon: ClipboardList, label: 'Mis Reparaciones' },
        { to: '/dashboard/perfil', icon: User, label: 'Mi Perfil' },
    ];

    const adminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
        { type: 'separator', label: 'Operaciones' },
        { to: '/admin/reparaciones', icon: Wrench, label: 'Reparaciones' },
        { to: '/admin/nueva-reparacion', icon: PlusCircle, label: 'Nueva Reparación' },
        { to: '/admin/clientes', icon: Users, label: 'Clientes' },
        { to: '/admin/servicios', icon: FileSpreadsheet, label: 'Servicios' },
        { type: 'separator', label: 'Ventas' },
        { to: '/admin/pos', icon: ShoppingCart, label: 'Punto de Venta' },
        { to: '/admin/ventas', icon: Receipt, label: 'Historial Ventas' },
        { to: '/admin/inventario', icon: Package, label: 'Inventario' },
        
        // Opciones SaaS Multi-sucursal
        ...(branches.length > 1 ? [{ to: '/admin/traslados', icon: ArrowLeftRight, label: 'Traslados' }] : []),
        
        { type: 'separator', label: 'Administración' },
        { to: '/admin/reportes', icon: BarChart4, label: 'Reportes' },
        
        ...(isTenantAdmin ? [
            { to: '/admin/sucursales', icon: Building2, label: 'Sucursales' },
            { to: '/admin/suscripcion', icon: Shield, label: 'Suscripción' }
        ] : []),
        
        { to: '/admin/configuracion', icon: Settings, label: 'Configuración' },
    ];

    // Rutas exclusivas de plataforma
    const superAdminLinks = [
        { to: '/superadmin', icon: Shield, label: 'Super Dashboard', exact: true },
        { to: '/superadmin/empresas', icon: Building2, label: 'Empresas SaaS' },
        { to: '/superadmin/planes', icon: FileSpreadsheet, label: 'Planes Suscripción' }
    ];

    const links = isSuperAdmin ? superAdminLinks : (isAdmin ? adminLinks : clientLinks);

    const renderBusinessName = () => {
        if (!businessName) return 'Sys-Teck';
        if (businessName.includes('-')) {
            const parts = businessName.split('-');
            return <>{parts[0]}<span className="text-primary">-{parts.slice(1).join('-')}</span></>;
        }
        if (businessName.includes(' ')) {
            const parts = businessName.split(' ');
            return <>{parts[0]} <span className="text-primary">{parts.slice(1).join(' ')}</span></>;
        }
        const mid = Math.ceil(businessName.length / 2);
        return <>{businessName.substring(0, mid)}<span className="text-primary">{businessName.substring(mid)}</span></>;
    };

    const getUserRoleLabel = () => {
        if (isSuperAdmin) return 'SuperAdmin Plataforma';
        if (isTenantAdmin) return 'Administrador Empresa';
        if (user?.role === 'branch_manager') return 'Gerente Sucursal';
        if (user?.role === 'technician') return 'Técnico';
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
                        {businessLogo ? (
                            <img src={businessLogo} alt="Logo" className="logo-img-sidebar" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} />
                        ) : (
                            <Wrench size={24} className="logo-icon" />
                        )}
                        <span className="logo-text">{renderBusinessName()}</span>
                    </div>
                </div>

                {/* Selector de Sucursal Multi-Sucursal para personal (staff) */}
                {branches.length > 0 && user?.role !== 'client' && !isSuperAdmin && (
                    <div className="branch-selector-container" style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            <GitBranch size={12} />
                            <span>SUCURSAL ACTIVA</span>
                        </div>
                        <select 
                            value={activeBranchId || ''} 
                            onChange={(e) => updateActiveBranch(parseInt(e.target.value, 10))}
                            style={{ 
                                width: '100%', 
                                padding: '8px', 
                                borderRadius: 'var(--radius-sm)', 
                                border: '1px solid var(--border-color)', 
                                backgroundColor: 'var(--bg-card)', 
                                color: 'var(--text-main)', 
                                fontSize: '13px',
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
                    <div className="sidebar-search-trigger" onClick={() => setSearchOpen(true)}>
                        <Search size={18} />
                        <span>Buscar...</span>
                        <kbd className="search-kbd">⌘K</kbd>
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
        </>
    );
}

