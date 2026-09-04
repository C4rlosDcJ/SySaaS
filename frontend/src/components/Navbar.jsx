import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getImageUrl } from '../services/api';
import './Navbar.css';

export default function Navbar() {
    const { user, isAuthenticated, logout, isAdmin } = useAuth();
    const { businessLogo, businessName, theme, toggleTheme } = useTheme();
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
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

    return (
        <nav className="navbar">
            <div className="navbar-container">
                {/* Logo Nothing OS */}
                <Link to="/" className="navbar-logo">
                    {businessLogo ? (
                        <img
                            src={getImageUrl(businessLogo)}
                            alt="Logo"
                            style={{ width: '26px', height: '26px', objectFit: 'contain', borderRadius: '4px' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    ) : (
                        <span className="logo-glyph-dot" />
                    )}
                    <span>{businessName || 'SYS-SAAS'}</span>
                </Link>

                {/* Mobile menu toggle */}
                <button
                    className="menu-toggle"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Toggle menu"
                >
                    {menuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>

                {/* Navigation Links in Pill Capsule */}
                <div className={`navbar-menu ${menuOpen ? 'active' : ''}`}>
                    <div className="navbar-links">
                        <Link
                            to="/"
                            className={`nav-link ${isActive('/') ? 'active' : ''}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            Inicio
                        </Link>

                        <Link
                            to="/rastrear"
                            className={`nav-link ${isActive('/rastrear') ? 'active' : ''}`}
                            onClick={() => setMenuOpen(false)}
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

                    {/* Auth & Theme Controls */}
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
                                    onClick={() => setMenuOpen(false)}
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
                                    onClick={() => setMenuOpen(false)}
                                >
                                    Iniciar Sesión
                                </Link>
                                <Link
                                    to="/register"
                                    className="nav-auth-register"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    Registrarse
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
