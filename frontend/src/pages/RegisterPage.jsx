import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { publicService, billingService, getImageUrl } from '../services/api';
import {
    Wrench,
    Mail,
    Lock,
    User,
    Phone,
    Eye,
    EyeOff,
    ArrowLeft,
    ArrowRight,
    Check,
    X,
    Shield,
    Building2,
    Globe,
    Sun,
    Moon,
    Zap,
    Layers,
    Cpu,
    CheckCircle2
} from 'lucide-react';
import './RegisterPage.css';

export default function RegisterPage() {
    const [searchParams] = useSearchParams();
    const [step, setStep] = useState(1);
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

    const [selectedPlanSlug, setSelectedPlanSlug] = useState(searchParams.get('plan') || '');
    const [isTrial, setIsTrial] = useState(searchParams.get('trial') !== 'false');
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [platformName, setPlatformName] = useState('SySaaS');
    const [platformLogo, setPlatformLogo] = useState('');

    const { registerCompany } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    useEffect(() => {
        publicService.getPlatformInfo()
            .then(d => {
                if (d?.platform_name) setPlatformName(d.platform_name);
                if (d?.platform_logo) setPlatformLogo(d.platform_logo);
            })
            .catch(() => {});

        publicService.getPlans()
            .then(data => {
                const planList = data?.plans || [];
                setPlans(planList);
                if (planList.length > 0 && !selectedPlanSlug) {
                    const defaultPlan = planList.find(p => p.slug === 'pro') || planList[0];
                    setSelectedPlanSlug(defaultPlan.slug);
                }
            })
            .catch(() => {})
            .finally(() => setLoadingPlans(false));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            if (name === 'company_name' && !prev.slug) {
                updated.slug = value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            }
            return updated;
        });
        setError('');
    };

    const validateStep1 = () => {
        if (!formData.company_name.trim()) return 'El nombre de la empresa es obligatorio.';
        if (!formData.first_name.trim()) return 'El nombre del administrador es obligatorio.';
        if (!formData.email.trim()) return 'El correo electronico es obligatorio.';
        if (!formData.password || formData.password.length < 6) return 'La contrasena debe tener al menos 6 caracteres.';
        if (formData.password !== formData.confirmPassword) return 'Las contrasenas no coinciden.';
        return null;
    };

    const handleNextStep = () => {
        const err = validateStep1();
        if (err) {
            setError(err);
            return;
        }
        setError('');
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (step === 1) {
            handleNextStep();
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { confirmPassword: _ignored, ...payload } = formData;
            await registerCompany({
                ...payload,
                plan_slug: selectedPlanSlug || undefined,
                is_trial: isTrial,
                billing_cycle: billingCycle
            });

            // Si es suscripcion de pago, iniciar checkout directo en Stripe
            if (!isTrial && selectedPlanSlug) {
                try {
                    const session = await billingService.createCheckoutSession(selectedPlanSlug, billingCycle);
                    if (session?.url) {
                        window.location.href = session.url;
                        return;
                    }
                } catch (stripeErr) {
                    console.warn('[REGISTER] Error al crear sesion Stripe:', stripeErr.message);
                    navigate('/admin/suscripcion?stripe_error=' + encodeURIComponent(stripeErr.message || 'not_configured'));
                    return;
                }
            }

            navigate('/admin');
        } catch (err) {
            setError(err.message || 'Error al registrar la empresa');
        } finally {
            setLoading(false);
        }
    };

    // Para prueba gratis: solo basico y pro. Enterprise solo con suscripcion
    const visiblePlans = isTrial
        ? plans.filter(p => p.slug !== 'enterprise')
        : plans;

    const selectedPlan = plans.find(p => p.slug === selectedPlanSlug);

    const formatPrice = (amount) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const getPlanPrice = (plan) => {
        return billingCycle === 'yearly'
            ? (plan.price_yearly || plan.price_monthly * 10)
            : plan.price_monthly;
    };

    return (
        <div className="register-page">
            <div className="register-layout">
                {/* ── Panel Izquierdo: Branding ── */}
                <div className="register-visual">
                    <div className="register-visual-content">
                        <div className="register-logo-badge">
                            {platformLogo ? (
                                <img
                                    src={getImageUrl(platformLogo)}
                                    alt="Logo"
                                    style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }}
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="register-logo-icon">
                                    <Wrench size={18} />
                                </div>
                            )}
                            <span className="register-logo-text">{platformName}</span>
                        </div>

                        <h1 className="register-headline">
                            Control total para tu taller y sucursales
                        </h1>

                        <p className="register-desc">
                            Potencia la administracion de reparaciones, inventario, punto de venta y analitica con tecnologia de vanguardia.
                        </p>

                        <div className="register-features">
                            <div className="register-feature">
                                <div className="register-feature-icon-wrapper">
                                    <Layers size={20} />
                                </div>
                                <div className="register-feature-text">
                                    <span className="register-feature-title">Multi-Sucursal Centralizado</span>
                                    <span className="register-feature-sub">Controla inventario y ordenes en todas tus sedes</span>
                                </div>
                            </div>

                            <div className="register-feature">
                                <div className="register-feature-icon-wrapper">
                                    <Cpu size={20} />
                                </div>
                                <div className="register-feature-text">
                                    <span className="register-feature-title">Inteligencia Artificial</span>
                                    <span className="register-feature-sub">Asistente tecnico y analisis predictivo de fallas</span>
                                </div>
                            </div>

                            <div className="register-feature">
                                <div className="register-feature-icon-wrapper">
                                    <Shield size={20} />
                                </div>
                                <div className="register-feature-text">
                                    <span className="register-feature-title">Datos Aislados y Seguros</span>
                                    <span className="register-feature-sub">Arquitectura multi-inquilino con cifrado completo</span>
                                </div>
                            </div>

                            <div className="register-feature">
                                <div className="register-feature-icon-wrapper">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div className="register-feature-text">
                                    <span className="register-feature-title">30 Dias de Prueba Gratis</span>
                                    <span className="register-feature-sub">Comienza de inmediato sin tarjeta de credito</span>
                                </div>
                            </div>
                        </div>

                        <div className="register-visual-footer">
                            <span>SYSAAS PLATFORM</span>
                            <span>ENTERPRISE READY</span>
                        </div>
                    </div>
                </div>

                {/* ── Panel Derecho: Formulario y Planes ── */}
                <div className="register-content">
                    <div className={`register-container-box ${step === 2 ? 'step-2-wide' : ''}`}>
                        
                        {/* Barra Superior con Stepper y Selector de Tema */}
                        <div className="register-topbar">
                            <div className="register-stepper">
                                <div className={`stepper-step ${step === 1 ? 'active' : 'completed'}`}>
                                    <span className="stepper-number">01</span>
                                    <span className="stepper-label">Empresa</span>
                                </div>
                                <div className={`stepper-divider ${step >= 2 ? 'completed' : ''}`} />
                                <div className={`stepper-step ${step === 2 ? 'active' : ''}`}>
                                    <span className="stepper-number">02</span>
                                    <span className="stepper-label">Plan</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={toggleTheme}
                                className="theme-toggle-btn"
                                title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
                            >
                                {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                                <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                            </button>
                        </div>

                        {/* Titulo */}
                        <div className="register-header">
                            <h2 className="register-title">
                                {step === 1 ? 'Registra tu Empresa' : 'Elige tu Plan de Operacion'}
                            </h2>
                            <p className="register-subtitle">
                                {step === 1 ? (
                                    <>Ya tienes una cuenta registrada? <Link to="/login">Inicia sesion</Link></>
                                ) : (
                                    <>Selecciona la modalidad que mejor se adapte a tu etapa de crecimiento</>
                                )}
                            </p>
                        </div>

                        {error && (
                            <div className="register-alert-error">
                                <span>{error}</span>
                            </div>
                        )}

                        {/* PASO 1: DATOS GENERALES */}
                        {step === 1 && (
                            <form onSubmit={e => { e.preventDefault(); handleNextStep(); }} className="register-form-grid">
                                <div className="register-input-group">
                                    <label className="register-label">Nombre de la Empresa o Taller *</label>
                                    <div className="register-input-wrapper">
                                        <Building2 size={16} className="register-input-icon" />
                                        <input
                                            type="text"
                                            name="company_name"
                                            className="register-input"
                                            placeholder="Ej. TecnoFix Central"
                                            value={formData.company_name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="register-input-group">
                                    <label className="register-label">Identificador Web (Slug)</label>
                                    <div className="register-input-wrapper">
                                        <Globe size={16} className="register-input-icon" />
                                        <input
                                            type="text"
                                            name="slug"
                                            className="register-input"
                                            placeholder="tecnofix-central"
                                            value={formData.slug}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <span className="register-help-text">
                                        URL de tu portal: {platformName.toLowerCase()}.com/{formData.slug || 'tu-empresa'}
                                    </span>
                                </div>

                                <div className="register-form-row">
                                    <div className="register-input-group">
                                        <label className="register-label">Nombre Admin *</label>
                                        <div className="register-input-wrapper">
                                            <User size={16} className="register-input-icon" />
                                            <input
                                                type="text"
                                                name="first_name"
                                                className="register-input"
                                                placeholder="Juan"
                                                value={formData.first_name}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="register-input-group">
                                        <label className="register-label">Apellido</label>
                                        <div className="register-input-wrapper">
                                            <User size={16} className="register-input-icon" />
                                            <input
                                                type="text"
                                                name="last_name"
                                                className="register-input"
                                                placeholder="Perez"
                                                value={formData.last_name}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="register-form-row">
                                    <div className="register-input-group">
                                        <label className="register-label">Correo Electronico *</label>
                                        <div className="register-input-wrapper">
                                            <Mail size={16} className="register-input-icon" />
                                            <input
                                                type="email"
                                                name="email"
                                                className="register-input"
                                                placeholder="admin@empresa.com"
                                                value={formData.email}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="register-input-group">
                                        <label className="register-label">Telefono</label>
                                        <div className="register-input-wrapper">
                                            <Phone size={16} className="register-input-icon" />
                                            <input
                                                type="tel"
                                                name="phone"
                                                className="register-input"
                                                placeholder="(55) 1234-5678"
                                                value={formData.phone}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="register-form-row">
                                    <div className="register-input-group">
                                        <label className="register-label">Contrasena *</label>
                                        <div className="register-input-wrapper">
                                            <Lock size={16} className="register-input-icon" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                className="register-input"
                                                placeholder="Minimo 6 caracteres"
                                                value={formData.password}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="register-input-group">
                                        <label className="register-label">Confirmar Contrasena *</label>
                                        <div className="register-input-wrapper has-toggle">
                                            <Lock size={16} className="register-input-icon" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="confirmPassword"
                                                className="register-input"
                                                placeholder="Repite tu contrasena"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                required
                                            />
                                            <button
                                                type="button"
                                                className="register-password-toggle"
                                                onClick={() => setShowPassword(!showPassword)}
                                                tabIndex="-1"
                                            >
                                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <label className="register-checkbox-label">
                                    <input type="checkbox" required />
                                    <span>
                                        He leido y acepto los terminos de servicio y la politica de privacidad de la plataforma.
                                    </span>
                                </label>

                                <button type="submit" className="register-btn-submit">
                                    <span>Continuar a Seleccion de Plan</span>
                                    <ArrowRight size={16} />
                                </button>
                            </form>
                        )}

                        {/* PASO 2: SELECCION DE PLAN */}
                        {step === 2 && (
                            <form onSubmit={handleSubmit}>
                                {/* Segmented Control: Prueba 30 dias vs Suscripcion */}
                                <div className="plan-mode-segment">
                                    <button
                                        type="button"
                                        className={`mode-segment-btn ${isTrial ? 'active' : ''}`}
                                        onClick={() => {
                                            setIsTrial(true);
                                            if (selectedPlanSlug === 'enterprise') {
                                                setSelectedPlanSlug('pro');
                                            }
                                        }}
                                    >
                                        <Zap size={16} />
                                        <span>Prueba Gratuita</span>
                                        <span className="mode-segment-badge">30 DIAS</span>
                                    </button>

                                    <button
                                        type="button"
                                        className={`mode-segment-btn ${!isTrial ? 'active' : ''}`}
                                        onClick={() => setIsTrial(false)}
                                    >
                                        <Shield size={16} />
                                        <span>Suscripcion de Pago</span>
                                        <span className="mode-segment-badge">STRIPE</span>
                                    </button>
                                </div>

                                {/* Nota Informativa en Modo Prueba */}
                                {isTrial ? (
                                    <div className="trial-info-banner">
                                        <Zap size={15} style={{ flexShrink: 0 }} />
                                        <span>
                                            Disfruta de 30 dias de acceso completo sin requerir tarjeta de credito. En modalidad de prueba puedes seleccionar los planes Basico y Pro.
                                        </span>
                                    </div>
                                ) : (
                                    /* Selector de Ciclo de Facturacion (solo en suscripcion de pago) */
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <div className="billing-cycle-segment">
                                            <button
                                                type="button"
                                                className={`cycle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
                                                onClick={() => setBillingCycle('monthly')}
                                            >
                                                Facturacion Mensual
                                            </button>
                                            <button
                                                type="button"
                                                className={`cycle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
                                                onClick={() => setBillingCycle('yearly')}
                                            >
                                                <span>Anual</span>
                                                <span className="cycle-discount-pill">2 MESES GRATIS</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Grid de Planes */}
                                {loadingPlans ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
                                        <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 12px' }} />
                                        <span style={{ fontSize: '13px' }}>Cargando planes disponibles...</span>
                                    </div>
                                ) : (
                                    <div className={`pricing-grid ${visiblePlans.length === 2 ? 'grid-2-cols' : 'grid-3-cols'}`}>
                                        {visiblePlans.map(plan => {
                                            const isSelected = selectedPlanSlug === plan.slug;
                                            const price = getPlanPrice(plan);
                                            const isPro = plan.slug === 'pro';

                                            return (
                                                <div
                                                    key={plan.id}
                                                    className={`pricing-card ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => setSelectedPlanSlug(plan.slug)}
                                                >
                                                    {isPro && (
                                                        <div className="pricing-card-badge-top">
                                                            RECOMENDADO
                                                        </div>
                                                    )}

                                                    <div>
                                                        <div className="pricing-card-header">
                                                            <div className="pricing-plan-name">{plan.name}</div>
                                                            <div className="pricing-radio-check">
                                                                {isSelected && <Check size={12} strokeWidth={3} />}
                                                            </div>
                                                        </div>

                                                        <div className="pricing-price-box">
                                                            <div className="pricing-price-row">
                                                                <span className="pricing-price-amount">{formatPrice(price)}</span>
                                                                <span className="pricing-price-period">
                                                                    MXN / {billingCycle === 'yearly' ? 'año' : 'mes'}
                                                                </span>
                                                            </div>
                                                            {isTrial && (
                                                                <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                                                                    30 dias sin costo inicial
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="pricing-quota-tags">
                                                            <span className="quota-tag">
                                                                {plan.max_branches === 99 ? 'Sucursales ilimitadas' : `${plan.max_branches} sucursal${plan.max_branches > 1 ? 'es' : ''}`}
                                                            </span>
                                                            <span className="quota-tag">
                                                                {plan.max_users === 999 ? 'Usuarios ilimitados' : `${plan.max_users} usuarios staff`}
                                                            </span>
                                                            <span className="quota-tag">
                                                                {plan.max_monthly_repairs ? `${plan.max_monthly_repairs} ordenes/mes` : 'Ordenes ilimitadas'}
                                                            </span>
                                                        </div>

                                                        <div className="pricing-features-list">
                                                            <div className="pricing-feature-row included">
                                                                <div className="pricing-feature-icon check">
                                                                    <Check size={10} strokeWidth={3} />
                                                                </div>
                                                                <span>Punto de Venta y Facturacion</span>
                                                            </div>

                                                            <div className="pricing-feature-row included">
                                                                <div className="pricing-feature-icon check">
                                                                    <Check size={10} strokeWidth={3} />
                                                                </div>
                                                                <span>Control de Inventario y Stock</span>
                                                            </div>

                                                            <div className={`pricing-feature-row ${plan.features?.ai_assistant ? 'included' : ''}`}>
                                                                <div className={`pricing-feature-icon ${plan.features?.ai_assistant ? 'check' : 'cross'}`}>
                                                                    {plan.features?.ai_assistant ? <Check size={10} strokeWidth={3} /> : <X size={10} />}
                                                                </div>
                                                                <span>Asistente de Inteligencia Artificial</span>
                                                            </div>

                                                            <div className={`pricing-feature-row ${plan.features?.ecommerce ? 'included' : ''}`}>
                                                                <div className={`pricing-feature-icon ${plan.features?.ecommerce ? 'check' : 'cross'}`}>
                                                                    {plan.features?.ecommerce ? <Check size={10} strokeWidth={3} /> : <X size={10} />}
                                                                </div>
                                                                <span>Catalogo y Pedidos Web</span>
                                                            </div>

                                                            <div className={`pricing-feature-row ${plan.features?.advanced_reports ? 'included' : ''}`}>
                                                                <div className={`pricing-feature-icon ${plan.features?.advanced_reports ? 'check' : 'cross'}`}>
                                                                    {plan.features?.advanced_reports ? <Check size={10} strokeWidth={3} /> : <X size={10} />}
                                                                </div>
                                                                <span>Reportes con Machine Learning</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Resumen del Plan */}
                                {selectedPlan && (
                                    <div className="selected-plan-summary">
                                        <div className="summary-details">
                                            <span style={{ color: 'var(--color-text-secondary)' }}>Seleccionado:</span>
                                            <span className="summary-plan-pill">{selectedPlan.name}</span>
                                        </div>
                                        <div className="summary-cost">
                                            {isTrial ? (
                                                <span style={{ color: '#10b981' }}>30 dias gratis</span>
                                            ) : (
                                                <span>{formatPrice(getPlanPrice(selectedPlan))} MXN / {billingCycle === 'yearly' ? 'año' : 'mes'}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Botones de Accion */}
                                <div className="step-actions-row">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="btn-step-back"
                                        title="Regresar al paso anterior"
                                    >
                                        <ArrowLeft size={16} />
                                    </button>

                                    <button
                                        type="submit"
                                        className="register-btn-submit"
                                        style={{ marginTop: 0 }}
                                        disabled={loading || !selectedPlanSlug}
                                    >
                                        {loading ? (
                                            <span>Procesando registro...</span>
                                        ) : isTrial ? (
                                            <>
                                                <Zap size={16} />
                                                <span>Iniciar 30 Dias de Prueba Gratis</span>
                                            </>
                                        ) : (
                                            <>
                                                <Shield size={16} />
                                                <span>Continuar con Activacion en Stripe</span>
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}

                        <Link to="/" className="back-to-home">
                            <ArrowLeft size={14} />
                            <span>Volver a la pagina de inicio</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
