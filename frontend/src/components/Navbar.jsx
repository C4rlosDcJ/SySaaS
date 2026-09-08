import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Menu,
    X,
    LogOut,
    Sun,
    Moon,
    Home,
    Search,
    Layers,
    CreditCard,
    LayoutDashboard,
    LogIn,
    UserPlus,
    ChevronRight
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getImageUrl } from '../services/api';
import './Navbar.css';

export default function Navbar() {
    const { user, isAuthenticated, logout, isAdmin } = useAuth();
    const { businessLogo, businessName, theme, toggleTheme } = useTheme();
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    // Bloquear scroll de fondo cuando el menú está abierto
    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [menuOpen]);

    // Cerrar menú al cambiar de ruta
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        setMenuOpen(false);
        logout();
        navigate('/');
    };

    const isActive = (path) => location.pathname === path;

    const handleSectionClick = (e, targetId) => {
        setMenuOpen(false);
        if (location.pathname === '/') {
            e.preventDefault();
            const element = document.getElementById(targetId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    const getUserRoleLabel = () => {
        if (user?.role === 'superadmin') return 'Super Administrador';
        if (user?.role === 'admin' || isAdmin) return 'Administrador';
        if (user?.role === 'technician') return 'Técnico';
        if (user?.role === 'sales') return 'Ventas';
        return 'Cliente';
    };

    return (
        <nav className={`navbar ${menuOpen ? 'menu-open' : ''}`}>
            <div className="navbar-container">
                {/* Logo Nothing OS */}
                <Link to="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>
                    {businessLogo ? (
                        <img
                            src={getImageUrl(businessLogo)}
                            alt="Logo"
                            style={{ width: '26px', height: '26px', objectFit: 'contain', borderRadius: 'var(--logo-radius, 6px)' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    ) : (
                        <span className="logo-glyph-dot" />
                    )}
                    <span>{businessName || 'SYS-SAAS'}</span>
                </Link>

                {/* Mobile menu toggle button */}
                <button
                    className="menu-toggle"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
                >
                    {menuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>

                {/* Desktop Navigation (Pill Capsule) */}
                <div className="navbar-menu desktop-nav-menu">
                    <div className="navbar-links">
                        <Link
                            to="/"
                            className={`nav-link ${isActive('/') ? 'active' : ''}`}
                        >
                            Inicio
                        </Link>

                        <Link
                            to="/rastrear"
                            className={`nav-link ${isActive('/rastrear') ? 'active' : ''}`}
                        >
                            Rastrear
                        </Link>

                        <Link
                            to="/#caracteristicas"
                            className="nav-link"
                            onClick={(e) => handleSectionClick(e, 'caracteristicas')}
                        >
                            Características
                        </Link>

                        <Link
                            to="/#planes"
                            className="nav-link"
                            onClick={(e) => handleSectionClick(e, 'planes')}
                        >
                            Planes
                        </Link>
                    </div>

                    {/* Auth & Theme Controls Desktop */}
                    <div className="navbar-auth">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="theme-toggle-pill"
                            title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        </button>

                        {isAuthenticated ? (
                            <>
                                <Link
                                    to={isAdmin ? '/admin' : '/dashboard'}
                                    className="nav-link user-link"
                                >
                                    <span className="user-avatar">
                                        {user?.first_name?.charAt(0).toUpperCase()}
                                    </span>
                                    <span>{user?.first_name}</span>
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="nav-auth-login"
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <LogOut size={14} />
                                    <span>Salir</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="nav-auth-login"
                                >
                                    Iniciar Sesión
                                </Link>
                                <Link
                                    to="/register"
                                    className="nav-auth-register"
                                >
                                    Registrarse
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Mobile Navigation Drawer (Estilo Sistema) */}
                <div className={`mobile-nav-drawer ${menuOpen ? 'active' : ''}`}>
                    <div className="mobile-drawer-content">
                        {/* Grupo de Navegación Principal */}
                        <div className="mobile-drawer-section">
                            <div className="mobile-section-header">
                                <span>Navegación</span>
                            </div>
                            <div className="mobile-nav-card">
                                <Link
                                    to="/"
                                    className={`mobile-drawer-item ${isActive('/') ? 'active' : ''}`}
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <div className="mobile-item-left">
                                        <span className="mobile-item-icon"><Home size={18} /></span>
                                        <span className="mobile-item-text">Inicio</span>
                                    </div>
                                    <ChevronRight size={16} className="mobile-item-arrow" />
                                </Link>

                                <Link
                                    to="/rastrear"
                                    className={`mobile-drawer-item ${isActive('/rastrear') ? 'active' : ''}`}
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <div className="mobile-item-left">
                                        <span className="mobile-item-icon"><Search size={18} /></span>
                                        <span className="mobile-item-text">Rastrear Ticket</span>
                                    </div>
                                    <ChevronRight size={16} className="mobile-item-arrow" />
                                </Link>

                                <Link
                                    to="/#caracteristicas"
                                    className="mobile-drawer-item"
                                    onClick={(e) => handleSectionClick(e, 'caracteristicas')}
                                >
                                    <div className="mobile-item-left">
                                        <span className="mobile-item-icon"><Layers size={18} /></span>
                                        <span className="mobile-item-text">Características</span>
                                    </div>
                                    <ChevronRight size={16} className="mobile-item-arrow" />
                                </Link>

                                <Link
                                    to="/#planes"
                                    className="mobile-drawer-item"
                                    onClick={(e) => handleSectionClick(e, 'planes')}
                                >
                                    <div className="mobile-item-left">
                                        <span className="mobile-item-icon"><CreditCard size={18} /></span>
                                        <span className="mobile-item-text">Planes y Precios</span>
                                    </div>
                                    <ChevronRight size={16} className="mobile-item-arrow" />
                                </Link>
                            </div>
                        </div>

                        {/* Controles de Configuración y Tema */}
                        <div className="mobile-drawer-section">
                            <div className="mobile-section-header">
                                <span>Apariencia</span>
                            </div>
                            <button
                                type="button"
                                onClick={toggleTheme}
                                className="mobile-theme-card"
                            >
                                <div className="mobile-item-left">
                                    <span className="mobile-item-icon">
                                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                    </span>
                                    <span className="mobile-item-text">
                                        Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}
                                    </span>
                                </div>
                                <span className="mobile-theme-pill">
                                    {theme === 'dark' ? 'Activar' : 'Activar'}
                                </span>
                            </button>
                        </div>

                        {/* Sección de Usuario / Autenticación */}
                        <div className="mobile-drawer-section">
                            <div className="mobile-section-header">
                                <span>Cuenta</span>
                            </div>

                            {isAuthenticated ? (
                                <div className="mobile-user-card">
                                    <div className="mobile-user-top">
                                        <div className="mobile-user-avatar">
                                            {user?.first_name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="mobile-user-info">
                                            <span className="mobile-user-name">
                                                {user?.first_name} {user?.last_name || ''}
                                            </span>
                                            <span className="mobile-user-role">
                                                {getUserRoleLabel()}
                                            </span>
                                        </div>
                                    </div>

                                    <Link
                                        to={isAdmin ? '/admin' : '/dashboard'}
                                        className="mobile-btn-panel"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <LayoutDashboard size={17} />
                                        <span>Ir al Panel de Control</span>
                                    </Link>

                                    <button
                                        onClick={handleLogout}
                                        className="mobile-btn-logout"
                                    >
                                        <LogOut size={16} />
                                        <span>Cerrar Sesión</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="mobile-guest-card">
                                    <Link
                                        to="/login"
                                        className="mobile-btn-guest-login"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <LogIn size={18} />
                                        <span>Iniciar Sesión</span>
                                    </Link>
                                    <Link
                                        to="/register"
                                        className="mobile-btn-guest-register"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <UserPlus size={18} />
                                        <span>Registrar Empresa</span>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Footer sutil Nothing OS */}
                        <div className="mobile-drawer-footer">
                            <span className="footer-glyph" />
                            <span>SYS-SAAS v1.0 • PLATAFORMA CLOUD</span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
