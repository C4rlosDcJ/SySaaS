import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService, getImageUrl } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { Wrench, Mail, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import './AuthPages.css';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [devLink, setDevLink] = useState('');
    const [loading, setLoading] = useState(false);
    const { businessLogo, businessName } = useTheme();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        setDevLink('');

        try {
            const data = await authService.forgotPassword(email);
            setSuccess(data.message || 'Se ha enviado un enlace a tu correo.');
            
            // Si el backend devolvió un token de desarrollo (SMTP fallback)
            if (data.devToken) {
                const frontendUrl = window.location.origin;
                setDevLink(`${frontendUrl}/reset-password?token=${data.devToken}`);
            }
        } catch (err) {
            setError(err.message || 'Error al procesar la solicitud');
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
                        <h1>¿Olvidaste tu contraseña?</h1>
                        <p>No te preocupes. Introduce la dirección de correo electrónico asociada a tu cuenta y te enviaremos un enlace seguro para restablecerla de inmediato.</p>
                        
                        <div className="auth-features" style={{ marginTop: 'var(--sp-8)' }}>
                            <div className="feature">
                                <div className="feature-icon-wrapper">
                                    <KeyRound size={20} />
                                </div>
                                <span>Restablecimiento rápido y seguro</span>
                            </div>
                        </div>
                    </div>
                    <div className="auth-visual-ambient"></div>
                </div>

                <div className="auth-form-container">
                    <div className="auth-form-wrapper">
                        <h2>Recuperar Contraseña</h2>
                        <p className="auth-subtitle">
                            Ingresa tu correo para recibir las instrucciones de recuperación.
                        </p>

                        {success ? (
                            <div className="success-state animate-fadeIn" style={{ textAlign: 'center', padding: 'var(--sp-6) 0' }}>
                                <div className="success-icon-wrapper" style={{ display: 'inline-flex', padding: 'var(--sp-4)', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', marginBottom: 'var(--sp-4)' }}>
                                    <CheckCircle2 size={40} />
                                </div>
                                <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--sp-2)' }}>Correo Enviado</h3>
                                <p className="text-muted" style={{ fontSize: 'var(--font-sm)', lineHeight: 1.6 }}>
                                    {success}
                                </p>

                                {devLink && (
                                    <div className="dev-helper-box" style={{ marginTop: 'var(--sp-6)', padding: 'var(--sp-4)', background: 'rgba(59, 130, 246, 0.1)', border: '1px dashed #3b82f6', borderRadius: 'var(--radius-md)', textAlign: 'left' }}>
                                        <h4 style={{ color: '#3b82f6', fontSize: 'var(--font-xs)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Modo Desarrollo (Simulación SMTP)</h4>
                                        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--sp-2)' }}>No se pudo enviar por correo real (SMTP sin configurar). Usa este enlace simulado para continuar:</p>
                                        <a href={devLink} className="forgot-link" style={{ fontSize: 'var(--font-xs)', fontWeight: 600, wordBreak: 'break-all' }}>
                                            {devLink}
                                        </a>
                                    </div>
                                )}

                                <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 'var(--sp-6)', padding: 'var(--sp-2) var(--sp-6)' }}>
                                    Regresar al Login
                                </Link>
                            </div>
                        ) : (
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
                                            value={email}
                                            onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-full"
                                    disabled={loading}
                                    style={{ marginTop: 'var(--sp-4)' }}
                                >
                                    {loading ? (
                                        <span className="btn-loading">
                                            <span className="spinner-small"></span>
                                            Enviando correo...
                                        </span>
                                    ) : (
                                        'Enviar Enlace'
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
