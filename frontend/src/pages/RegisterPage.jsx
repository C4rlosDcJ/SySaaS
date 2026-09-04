import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { publicService, getImageUrl } from '../services/api';
import {
    Wrench,
    Mail,
    Lock,
    User,
    Phone,
    Eye,
    EyeOff,
    ArrowLeft,
    CheckCircle,
    LayoutDashboard,
    Bell,
    Shield,
    Building2,
    Globe,
    Sun,
    Moon
} from 'lucide-react';
import './AuthPages.css';

export default function RegisterPage() {
    const [accountType, setAccountType] = useState('company'); // 'company' | 'client'
    const [formData, setFormData] = useState({
        company_name: '',
        slug: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [platformName, setPlatformName] = useState('SySaaS');
    const [platformLogo, setPlatformLogo] = useState('');
    const { registerCompany, register } = useAuth();

    useEffect(() => {
        publicService.getPlatformInfo()
            .then(data => {
                if (data?.platform_name) setPlatformName(data.platform_name);
                if (data?.platform_logo) setPlatformLogo(data.platform_logo);
            })
            .catch(() => {});
    }, []);
    const { businessLogo, businessName, theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            if (name === 'company_name' && !prev.slug) {
                updated.slug = value.toLowerCase().replace(/[^a-z0-9]/g, '-');
            }
            return updated;
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (accountType === 'company' && !formData.company_name.trim()) {
            setError('El nombre de la empresa es obligatorio.');
            setLoading(false);
            return;
        }

        // Validar contraseñas
        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            setLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            setLoading(false);
            return;
        }

        try {
            const { confirmPassword: _confirmPassword, ...payload } = formData;
            if (accountType === 'company') {
                await registerCompany(payload);
                navigate('/admin');
            } else {
                await register(payload);
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message || 'Error al registrar la cuenta');
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
                            {platformLogo ? (
                                <img src={getImageUrl(platformLogo)} alt="Logo" className="logo-img-auth" style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                                <Wrench size={28} className="logo-icon" />
                            )}
                            <span className="logo-text">{platformName}</span>
                        </div>
                        <h1>Únete a {platformName} SaaS</h1>
                        <p>Crea tu cuenta de organización y comienza a administrar tus sucursales y personal técnico con el mejor flujo operativo.</p>
                        <div className="auth-features">
                            <div className="feature">
                                <div className="feature-icon-wrapper">
                                    <CheckCircle size={20} />
                                </div>
                                <span>Administración Multi-Tenant</span>
                            </div>
                            <div className="feature">
                                <div className="feature-icon-wrapper">
                                    <LayoutDashboard size={20} />
                                </div>
                                <span>Control de Stock por Sucursal</span>
                            </div>
                            <div className="feature">
                                <div className="feature-icon-wrapper">
                                    <Bell size={20} />
                                </div>
                                <span>Diagnósticos Asistidos por IA</span>
                            </div>
                            <div className="feature">
                                <div className="feature-icon-wrapper">
                                    <Shield size={20} />
                                </div>
                                <span>Pasarela de Stripe integrada</span>
                            </div>
                        </div>
                    </div>
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

                        <h2>Crear Cuenta</h2>
                        <p className="auth-subtitle">
                            ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
                        </p>

                        <form onSubmit={handleSubmit} className="auth-form">
                            {error && <div className="error-alert">{error}</div>}

                            {/* Selector de Tipo de Registro */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '24px', background: 'var(--color-bg-tertiary, var(--color-bg-elevated))', padding: '6px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                                <button
                                    type="button"
                                    onClick={() => setAccountType('company')}
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        border: accountType === 'company' ? '1px solid var(--color-primary)' : '1px solid transparent',
                                        background: accountType === 'company' ? 'var(--color-primary)' : 'transparent',
                                        color: accountType === 'company' ? 'var(--color-primary-contrast)' : 'var(--color-text-secondary)',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <Building2 size={16} style={{ color: accountType === 'company' ? 'var(--color-primary-contrast)' : 'var(--color-text-secondary)' }} />
                                    <span>Taller / Empresa</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAccountType('client')}
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        border: accountType === 'client' ? '1px solid var(--color-primary)' : '1px solid transparent',
                                        background: accountType === 'client' ? 'var(--color-primary)' : 'transparent',
                                        color: accountType === 'client' ? 'var(--color-primary-contrast)' : 'var(--color-text-secondary)',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <User size={16} style={{ color: accountType === 'client' ? 'var(--color-primary-contrast)' : 'var(--color-text-secondary)' }} />
                                    <span>Soy Cliente</span>
                                </button>
                            </div>

                            {accountType === 'company' && (
                                <>
                                    <div className="input-group">
                                        <label htmlFor="company_name">Nombre de la Empresa / Taller *</label>
                                        <div className="input-with-icon">
                                            <Building2 size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                id="company_name"
                                                name="company_name"
                                                className="input"
                                                placeholder="Ej. TecnoFix Central"
                                                value={formData.company_name}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label htmlFor="slug">Identificador Web (Slug de Empresa)</label>
                                        <div className="input-with-icon">
                                            <Globe size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                id="slug"
                                                name="slug"
                                                className="input"
                                                placeholder="tecnofix-central"
                                                value={formData.slug}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px', display: 'block' }}>
                                            URL de tu empresa: {platformName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/app/{formData.slug || 'tu-empresa'}
                                        </span>
                                    </div>
                                </>
                            )}

                            <div className="form-row">
                                <div className="input-group">
                                    <label htmlFor="first_name">{accountType === 'company' ? 'Nombre Administrador *' : 'Nombre *'}</label>
                                    <div className="input-with-icon">
                                        <User size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            id="first_name"
                                            name="first_name"
                                            className="input"
                                            placeholder="Juan"
                                            value={formData.first_name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label htmlFor="last_name">Apellido</label>
                                    <div className="input-with-icon">
                                        <User size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            id="last_name"
                                            name="last_name"
                                            className="input"
                                            placeholder="Pérez"
                                            value={formData.last_name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

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
                                <label htmlFor="phone">Teléfono</label>
                                <div className="input-with-icon">
                                    <Phone size={18} className="input-icon" />
                                    <input
                                        type="tel"
                                        id="phone"
                                        name="phone"
                                        className="input"
                                        placeholder="(123) 456-7890"
                                        value={formData.phone}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
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
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label htmlFor="confirmPassword">Confirmar</label>
                                    <div className="input-with-icon">
                                        <Lock size={18} className="input-icon" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            className="input"
                                            placeholder="••••••••"
                                            value={formData.confirmPassword}
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
                            </div>

                            <label className="checkbox-label">
                                <input type="checkbox" required />
                                <span>Acepto los <a href="#">términos y condiciones</a></span>
                            </label>

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg w-full"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="btn-loading">
                                        <span className="spinner-small"></span>
                                        Creando cuenta...
                                    </span>
                                ) : (
                                    'Crear Cuenta'
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
