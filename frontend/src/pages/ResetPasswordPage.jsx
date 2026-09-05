import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authService, getImageUrl } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { Wrench, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';
import './AuthPages.css';

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [error, setError] = useState(token ? '' : 'Falta el token de restablecimiento de contraseña en la URL.');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { businessLogo, businessName } = useTheme();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!token) {
            setError('Falta el token de recuperación en la URL.');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const data = await authService.resetPassword(token, password);
            setSuccess(data.message || 'Tu contraseña ha sido restablecida exitosamente.');
        } catch (err) {
            setError(err.message || 'El enlace es inválido o ha expirado.');
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
        return <>{name}</>;
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
                                    style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: 'var(--logo-radius, 8px)' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="logo-icon">
                                    <Wrench size={20} />
                                </div>
                            )}
                            <span className="logo-text">{renderBusinessName()}</span>
                        </div>
                        <h1>Crea una nueva contraseña</h1>
                        <p>Asegúrate de elegir una contraseña segura que combine letras, números y caracteres especiales para mantener tu cuenta protegida.</p>
                        
                        <div className="auth-features" style={{ marginTop: 'var(--sp-8)' }}>
                            <div className="feature">
                                <div className="feature-icon-wrapper">
                                    <Lock size={20} />
                                </div>
                                <span>Cifrado y seguridad de nivel bancario</span>
                            </div>
                        </div>
                    </div>
                    <div className="auth-visual-ambient"></div>
                </div>

                <div className="auth-form-container">
                    <div className="auth-form-wrapper">
                        <h2>Nueva Contraseña</h2>
                        <p className="auth-subtitle">
                            Ingresa y confirma tu nueva contraseña de acceso.
                        </p>

                        {success ? (
                            <div className="success-state animate-fadeIn" style={{ textAlign: 'center', padding: 'var(--sp-6) 0' }}>
                                <div className="success-icon-wrapper" style={{ display: 'inline-flex', padding: 'var(--sp-4)', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', marginBottom: 'var(--sp-4)' }}>
                                    <CheckCircle2 size={40} />
                                </div>
                                <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--sp-2)' }}>Contraseña Actualizada</h3>
                                <p className="text-muted" style={{ fontSize: 'var(--font-sm)', lineHeight: 1.6, marginBottom: 'var(--sp-6)' }}>
                                    {success}
                                </p>

                                <Link to="/login" className="btn btn-primary w-full" style={{ display: 'inline-flex', justifyContent: 'center' }}>
                                    Iniciar Sesión
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="auth-form">
                                {error && <div className="error-alert" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <span>{error}</span>
                                </div>}

                                <div className="input-group">
                                    <label htmlFor="password">Nueva Contraseña</label>
                                    <div className="input-with-icon">
                                        <Lock size={18} className="input-icon" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id="password"
                                            name="password"
                                            className="input"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                            disabled={!token}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={() => setShowPassword(!showPassword)}
                                            disabled={!token}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label htmlFor="confirmPassword">Confirmar Nueva Contraseña</label>
                                    <div className="input-with-icon">
                                        <Lock size={18} className="input-icon" />
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            className="input"
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                            disabled={!token}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            disabled={!token}
                                        >
                                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-full"
                                    disabled={loading || !token}
                                    style={{ marginTop: 'var(--sp-4)' }}
                                >
                                    {loading ? (
                                        <span className="btn-loading">
                                            <span className="spinner-small"></span>
                                            Restableciendo contraseña...
                                        </span>
                                    ) : (
                                        'Restablecer Contraseña'
                                    )}
                                </button>
                            </form>
                        )}

                        {!success && (
                            <Link to="/login" className="back-link" style={{ marginTop: 'var(--sp-6)' }}>
                                <ArrowLeft size={16} />
                                Volver al inicio de sesión
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
