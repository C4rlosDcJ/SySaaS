import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getImageUrl } from '../services/api';
import { Wrench, Mail, Lock, Eye, EyeOff, ArrowLeft, Bell, History, Smartphone, Sun, Moon } from 'lucide-react';
import './AuthPages.css';

export default function LoginPage() {
    const [searchParams] = useSearchParams();
    const redirectUrl = searchParams.get('redirect');

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const { businessLogo, businessName, theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await login(formData.email, formData.password);
            // Redirigir según el rol o parámetro redirect
            if (response.user.role === 'superadmin') {
                navigate(redirectUrl || '/superadmin');
            } else if (['admin', 'tenant_admin', 'branch_manager', 'technician', 'salesperson', 'cashier'].includes(response.user.role)) {
                navigate(redirectUrl || '/admin');
            } else {
                navigate(redirectUrl || '/dashboard');
            }
        } catch (err) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const renderBusinessName = () => {
        const name = businessName || 'Sys-Teck';
        if (name.includes('-')) {
            const parts = name.split('-');
            return <>{parts[0]}<span className="text-primary">-{parts.slice(1).join('-')}</span></>;
        }
        if (name.includes(' ')) {
            const parts = name.split(' ');
            return <>{parts[0]} <span className="text-primary">{parts.slice(1).join(' ')}</span></>;
        }
        const mid = Math.ceil(name.length / 2);
        return <>{name.substring(0, mid)}<span className="text-primary">{name.substring(mid)}</span></>;
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-visual">
                    <div className="auth-visual-content">
                        <div className="auth-logo">
                            {businessLogo ? (
                                <img 
                                    src={getImageUrl(businessLogo)} 
                                    alt="Logo" 
                                    className="logo-img-auth" 
                                    style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="logo-icon">
                                    <Wrench size={20} />
                                </div>
                            )}
                            <span className="logo-text">{renderBusinessName()}</span>
                        </div>
                        <h1>Acceso a la plataforma</h1>
                        <p>Inicia sesión en tu cuenta administrativa de taller o accede al panel de cliente para ver el progreso de tus órdenes de servicio técnico.</p>
                        <div className="auth-features">
                            <div className="feature">
                                <div className="feature-icon-wrapper">
                                    <Smartphone size={20} />
                                </div>
                                <span>Control multi-sucursal activo</span>
                            </div>
                            <div className="feature">
                                <div className="feature-icon-wrapper">
                                    <Bell size={20} />
                                </div>
                                <span>Notificaciones automatizadas</span>
                            </div>
                            <div className="feature">
                                <div className="feature-icon-wrapper">
                                    <History size={20} />
                                </div>
                                <span>Inventario y órdenes centralizados</span>
                            </div>
                        </div>
                    </div>
                    <div className="auth-visual-ambient"></div>
                </div>

                <div className="auth-form-container">
                    <div className="auth-form-wrapper" style={{ position: 'relative' }}>
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="btn btn-outline btn-sm"
                            title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
                            style={{ 
                                position: 'absolute', 
                                top: '-8px', 
                                right: '0', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                padding: '6px 12px', 
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-tertiary)',
                                color: 'var(--color-text)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 500
                            }}
                        >
                            {theme === 'dark' ? <Sun size={14} className="text-warning" /> : <Moon size={14} className="text-primary" />}
                            <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                        </button>

                        <h2>Iniciar Sesión</h2>
                        <p className="auth-subtitle">
                            ¿Tienes una empresa o taller? <Link to="/register">Regístrate aquí</Link>
                        </p>

                        <form onSubmit={handleSubmit} className="auth-form">
                            {error && <div className="error-alert">{error}</div>}

                            <div className="input-group">
                                <label htmlFor="email">Correo Electrónico</label>
                                <div className="input-with-icon">
                                    <Mail size={18} className="input-icon" />
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        className="input"
                                        placeholder="tu@email.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label htmlFor="password">Contraseña</label>
                                <div className="input-with-icon">
                                    <Lock size={18} className="input-icon" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        name="password"
                                        className="input"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="form-options">
                                <label className="checkbox-label">
                                    <input type="checkbox" />
                                    <span>Recordarme</span>
                                </label>
                                <Link to="/forgot-password" className="forgot-link">
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg w-full"
                                disabled={loading}
                                style={{ marginTop: 'var(--sp-2)' }}
                            >
                                {loading ? (
                                    <span className="btn-loading">
                                        <span className="spinner-small"></span>
                                        Iniciando sesión...
                                    </span>
                                ) : (
                                    'Iniciar Sesión'
                                )}
                            </button>
                        </form>

                        <Link to="/" className="back-link">
                            <ArrowLeft size={16} />
                            Volver al inicio
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
