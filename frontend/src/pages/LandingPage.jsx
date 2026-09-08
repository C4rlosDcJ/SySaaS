import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { publicService } from '../services/api';
import Navbar from '../components/Navbar';
import Nothing3DCanvas from '../components/Nothing3DCanvas';
import Tilt3DCard from '../components/Tilt3DCard';
import {
    Search,
    ArrowRight,
    Building2,
    GitBranch,
    Cpu,
    Check,
    CreditCard,
    MessageSquare,
    ShoppingBag
} from 'lucide-react';
import './LandingPage.css';

export default function LandingPage() {
    const { isAuthenticated, isAdmin } = useAuth();
    const { theme, businessName } = useTheme();
    const isDark = theme === 'dark';
    const currentBrand = businessName || 'SYS-SAAS';
    const navigate = useNavigate();

    const [quickTicket, setQuickTicket] = useState('');
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'

    const handleQuickTrack = (e) => {
        e.preventDefault();
        if (quickTicket.trim()) {
            navigate(`/rastrear?ticketId=${encodeURIComponent(quickTicket.trim().toUpperCase())}`);
        }
    };

    const saasFeatures = [
        {
            num: '01',
            icon: Building2,
            title: 'Arquitectura Multi-Tenant',
            description: 'Aislamiento total de base de datos para cada empresa. Subdominio dedicado, inventarios y clientes 100% privados.'
        },
        {
            num: '02',
            icon: GitBranch,
            title: 'Control Multi-Sucursal',
            description: 'Administra todas tus sedes desde un solo panel. Traspasos de stock atómicos, staff y métricas en vivo.'
        },
        {
            num: '03',
            icon: Cpu,
            title: 'Diagnósticos con IA & ML',
            description: 'Modelos de machine learning que analizan fallas recurrentes, tiempos de reparación y piezas sugeridas.'
        },
        {
            num: '04',
            icon: ShoppingBag,
            title: 'Punto de Venta POS & Facturación',
            description: 'Cobro ágil de tickets y accesorios. Compatible con lectores de código de barras e impresión térmica.'
        },
        {
            num: '05',
            icon: CreditCard,
            title: 'Suscripciones con Stripe',
            description: 'Pasarela integrada con procesamiento automático de cobros recurrentes y control de cuotas SaaS.'
        },
        {
            num: '06',
            icon: MessageSquare,
            title: 'Avisos Automáticos por WhatsApp',
            description: 'Notifica a tus clientes de manera instantánea cuando su orden cambie de estado con link de rastreo.'
        }
    ];

    const buildPlanFeaturesList = (p) => {
        const feats = [];
        const featObj = typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || {});

        // Quotas
        if (p.max_branches >= 99) {
            feats.push('Sucursales ilimitadas');
        } else if (p.max_branches > 1) {
            feats.push(`Hasta ${p.max_branches} Sucursales en red`);
        } else {
            feats.push('1 Sucursal matriz');
        }

        if (p.max_users >= 999) {
            feats.push('Usuarios y técnicos ilimitados');
        } else {
            feats.push(`Hasta ${p.max_users} usuarios de staff`);
        }

        if (!p.max_monthly_repairs) {
            feats.push('Tickets y reparaciones ilimitadas');
        } else {
            feats.push(`${p.max_monthly_repairs} tickets de reparación al mes`);
        }

        // Modulos del sistema reales
        if (featObj.pos_sales !== false) {
            feats.push(featObj.transfers ? 'Punto de Venta POS & Traspasos' : 'Punto de Venta POS y Facturación');
        }
        if (featObj.inventory !== false) {
            feats.push('Control de Inventario y Stock');
        }
        if (featObj.public_tracking !== false) {
            feats.push('Rastreo público para clientes');
        }
        if (featObj.transfers && !featObj.pos_sales) {
            feats.push('Traspasos entre Sucursales');
        }
        if (featObj.whatsapp_notifications) {
            feats.push('Notificaciones por WhatsApp');
        }
        if (featObj.ai_assistant) {
            feats.push(p.slug === 'enterprise' ? 'Inteligencia Artificial y ML avanzada' : 'Diagnósticos predictivos con IA');
        }
        if (featObj.ecommerce) {
            feats.push('Catálogo E-Commerce y Pedidos Web');
        }
        if (featObj.advanced_reports) {
            feats.push(p.slug === 'enterprise' ? 'Reportes ejecutivos de red y ML' : 'Reportes Financieros y Machine Learning');
        }

        // Nivel de soporte
        if (featObj.support_tier) {
            feats.push(featObj.support_tier);
        }

        // Caracteristicas personalizadas
        if (Array.isArray(featObj.custom_features)) {
            featObj.custom_features.forEach(cf => {
                if (!feats.includes(cf)) feats.push(cf);
            });
        }

        return feats;
    };

    const defaultPlans = [
        {
            name: 'Plan Básico',
            slug: 'basico',
            priceMonthly: 299,
            priceYearly: 2990,
            description: 'Para talleres individuales o negocios en crecimiento.',
            features: [
                '1 Sucursal matriz',
                'Hasta 3 usuarios de staff',
                '100 tickets de reparación al mes',
                'Punto de Venta POS y Facturación',
                'Control de Inventario y Stock',
                'Rastreo público para clientes',
                'Soporte técnico por correo'
            ],
            popular: false,
            cta: 'Comenzar Prueba'
        },
        {
            name: 'Plan Pro',
            slug: 'pro',
            priceMonthly: 599,
            priceYearly: 5990,
            description: 'La opción recomendada para cadenas en expansión.',
            features: [
                'Hasta 3 Sucursales en red',
                'Hasta 10 usuarios de staff',
                '500 tickets de reparación al mes',
                'Punto de Venta POS & Traspasos',
                'Control de Inventario y Stock',
                'Rastreo público para clientes',
                'Diagnósticos predictivos con IA',
                'Notificaciones por WhatsApp',
                'Catálogo E-Commerce y Pedidos Web',
                'Soporte prioritario'
            ],
            popular: true,
            cta: 'Adquirir Plan Pro'
        },
        {
            name: 'Plan Enterprise',
            slug: 'enterprise',
            priceMonthly: 999,
            priceYearly: 9990,
            description: 'Para cadenas corporativas y redes a gran escala.',
            features: [
                'Sucursales ilimitadas',
                'Usuarios y técnicos ilimitados',
                'Tickets y reparaciones ilimitadas',
                'Punto de Venta POS & Traspasos',
                'Control de Inventario y Stock',
                'Rastreo público para clientes',
                'Inteligencia Artificial y ML avanzada',
                'Notificaciones por WhatsApp',
                'Catálogo E-Commerce y Pedidos Web',
                'Reportes ejecutivos de red y ML',
                'Soporte 24/7 y Onboarding dedicado'
            ],
            popular: false,
            cta: 'Comenzar Prueba'
        }
    ];

    const [plans, setPlans] = useState(defaultPlans);

    useEffect(() => {
        publicService.getPlans()
            .then(data => {
                if (data?.plans && data.plans.length > 0) {
                    const mapped = data.plans.map(p => {
                        return {
                            id: p.id,
                            name: p.name,
                            slug: p.slug,
                            priceMonthly: p.price_monthly,
                            priceYearly: p.price_yearly,
                            description: p.description || p.features?.description || (
                                p.slug === 'basico' ? 'Para talleres individuales o negocios en crecimiento.' :
                                p.slug === 'pro' ? 'La opción recomendada para cadenas en expansión.' :
                                'Para cadenas corporativas y redes a gran escala.'
                            ),
                            features: buildPlanFeaturesList(p),
                            popular: p.popular || p.features?.popular || p.slug === 'pro',
                            cta: p.slug === 'basico' ? 'Comenzar Prueba' : p.slug === 'pro' ? 'Adquirir Plan Pro' : 'Comenzar Prueba'
                        };
                    });
                    setPlans(mapped);
                }
            })
            .catch(() => {});
    }, []);

    return (
        <div className={`landing-page ${isDark ? 'theme-dark' : 'theme-light'}`}>
            <Navbar />

            {/* ── HERO SECTION (3D CANVAS + MINIMALIST GLYPH) ── */}
            <section className="nothing-hero">
                <div className="container hero-container">
                    <div className="hero-content">

                        {/* Pixel Glyph Capsule Tag */}
                        <div className="nothing-badge pixel-font">
                            <span className="glyph-dot" />
                            <span>(01) PLATAFORMA SAAS MULTI-EMPRESA</span>
                        </div>

                        {/* Title */}
                        <h1 className="nothing-hero-title">
                            EL SISTEMA DEFINITIVO PARA <span className="nothing-highlight">TALLERES Y SOPORTE TÉCNICO</span>
                        </h1>

                        {/* Description */}
                        <p className="nothing-hero-description">
                            Controla múltiples sucursales, automatiza diagnósticos con Inteligencia Artificial, gestiona tu inventario descentralizado y procesa cobros con diseño minimalista de alto rendimiento.
                        </p>

                        {/* Action Buttons (Pill Capsules) */}
                        <div className="nothing-hero-actions">
                            <Link
                                to={isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/register'}
                                className="nothing-btn-primary"
                            >
                                <span>{isAuthenticated ? 'Panel de Control' : 'Registra tu Empresa'}</span>
                                <ArrowRight size={16} />
                            </Link>

                            <a href="#caracteristicas" className="nothing-btn-secondary">
                                <span>Ver Capacidades</span>
                            </a>
                        </div>

                        {/* Public Ticket Tracker Search (Capsule Shape) */}
                        <form onSubmit={handleQuickTrack} className="nothing-quick-track">
                            <Search size={16} className="track-icon" />
                            <input
                                type="text"
                                placeholder="Rastrear ticket público (ej. REP-1001)"
                                value={quickTicket}
                                onChange={(e) => setQuickTicket(e.target.value)}
                            />
                            <button type="submit" className="track-btn">
                                Rastrear
                            </button>
                        </form>
                    </div>

                    {/* Hero Visual 3D Interactive Canvas */}
                    <div className="nothing-hero-visual">
                        <Tilt3DCard className="visual-card-wrapper">
                            <div style={{ position: 'relative', width: '100%', minHeight: '340px' }}>
                                <Nothing3DCanvas isDark={isDark} />
                                <div style={{
                                    position: 'absolute',
                                    bottom: '16px',
                                    left: '16px',
                                    right: '16px',
                                    background: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                                    backdropFilter: 'blur(8px)',
                                    border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)',
                                    padding: '8px 14px',
                                    borderRadius: '9999px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    color: 'var(--nothing-text-primary)'
                                }}>
                                    <span>{currentBrand.toUpperCase()} 3D HARDWARE CORE</span>
                                    <span>OPERATIVO 100%</span>
                                </div>
                            </div>
                            <div className="glyph-corner top-left" />
                            <div className="glyph-corner top-right" />
                            <div className="glyph-corner bottom-left" />
                            <div className="glyph-corner bottom-right" />
                        </Tilt3DCard>
                    </div>
                </div>
            </section>

            {/* ── BENTO PLATFORM STATS ── */}
            <section className="nothing-stats-section">
                <div className="container">
                    <div className="nothing-stats-grid">
                        {[
                            { code: '01', value: '99.9%', label: 'Uptime Garantizado' },
                            { code: '02', value: 'MULTI', label: 'Sedes Descentralizadas' },
                            { code: '03', value: 'AI/ML', label: 'Diagnósticos Asistidos' },
                            { code: '04', value: 'STRIPE', label: 'Pasarela Integrada' }
                        ].map((stat, i) => (
                            <Tilt3DCard key={i} className="nothing-stat-card">
                                <span className="stat-code pixel-font">({stat.code})</span>
                                <div className="stat-value">{stat.value}</div>
                                <div className="stat-label">{stat.label}</div>
                            </Tilt3DCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CORE SAAS CAPABILITIES (BENTO GRID WITH 3D TILT) ── */}
            <section id="caracteristicas" className="nothing-section">
                <div className="container">
                    <div className="nothing-section-header">
                        <span className="nothing-badge pixel-font">
                            <span className="glyph-dot" />
                            <span>(02) CAPACIDADES DE PLATAFORMA</span>
                        </span>
                        <h2 className="nothing-section-title">
                            TECNOLOGÍA DE VANGUARDIA PARA ESCALAR TU NEGOCIO
                        </h2>
                    </div>

                    <div className="nothing-bento-grid">
                        {saasFeatures.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <Tilt3DCard key={i} className="nothing-bento-card">
                                    <div className="bento-card-top">
                                        <span className="bento-num pixel-font">({item.num})</span>
                                        <div className="bento-icon-wrapper">
                                            <Icon size={18} />
                                        </div>
                                    </div>
                                    <h3 className="bento-title">{item.title}</h3>
                                    <p className="bento-desc">{item.description}</p>
                                </Tilt3DCard>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── SAAS PRICING PLANS ── */}
            <section id="planes" className="nothing-section nothing-pricing-section">
                <div className="container">
                    <div className="nothing-section-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <span className="nothing-badge pixel-font">
                            <span className="glyph-dot" />
                            <span>(03) SUSCRIPCIONES Y PLANES</span>
                        </span>
                        <h2 className="nothing-section-title">
                            PLANES TRANSPARENTES SIN COSTOS OCULTOS
                        </h2>

                        {/* Selector Mensual / Anual */}
                        <div className="nothing-cycle-selector">
                            <button
                                type="button"
                                className={`cycle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
                                onClick={() => setBillingCycle('monthly')}
                            >
                                Facturación Mensual
                            </button>
                            <button
                                type="button"
                                className={`cycle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
                                onClick={() => setBillingCycle('yearly')}
                            >
                                Anual (2 Meses Gratis)
                            </button>
                        </div>
                    </div>

                    <div className="nothing-pricing-grid">
                        {plans.map((plan, i) => {
                            const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
                            return (
                                <Tilt3DCard
                                    key={i}
                                    className={`nothing-pricing-card ${plan.popular ? 'popular' : ''}`}
                                >
                                    {plan.popular && (
                                        <div className="popular-glyph-badge pixel-font">
                                            <span>RECOMENDADO</span>
                                        </div>
                                    )}

                                    <div className="pricing-card-header">
                                        <h3 className="plan-name">{plan.name}</h3>
                                        <p className="plan-desc">{plan.description}</p>
                                    </div>

                                    <div className="pricing-cost">
                                        <span className="price-val">${price}</span>
                                        <span className="price-unit">MXN /{billingCycle === 'yearly' ? 'año' : 'mes'}</span>
                                    </div>

                                    <ul className="plan-features-list">
                                        {plan.features.map((feat, idx) => (
                                            <li key={idx}>
                                                <Check size={14} className="feature-check" />
                                                <span>{feat}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Link
                                        to={`/register?plan=${plan.slug || 'pro'}`}
                                        className={plan.popular ? 'nothing-btn-primary w-full' : 'nothing-btn-secondary w-full'}
                                    >
                                        {plan.cta}
                                    </Link>
                                </Tilt3DCard>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="nothing-footer">
                <div className="container">
                    <div className="footer-top">
                        <div className="footer-brand">
                            <div className="footer-logo pixel-font">
                                <span className="glyph-dot" />
                                <strong>{currentBrand.toUpperCase()}</strong>
                            </div>
                            <p className="footer-tagline">
                                Infraestructura tecnológica para administración y escalamiento de cadenas de servicio técnico.
                            </p>
                        </div>

                        <div className="footer-nav">
                            <div className="footer-col">
                                <h4 className="pixel-font">(PLATAFORMA)</h4>
                                <ul>
                                    <li><a href="#caracteristicas">Capacidades</a></li>
                                    <li><a href="#planes">Precios y Planes</a></li>
                                    <li><Link to="/rastrear">Rastreo de Ticket</Link></li>
                                </ul>
                            </div>

                            <div className="footer-col">
                                <h4 className="pixel-font">(ACCESO)</h4>
                                <ul>
                                    <li><Link to="/login">Iniciar Sesión</Link></li>
                                    <li><Link to="/register">Registrar Empresa</Link></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="footer-bottom">
                        <p>© {new Date().getFullYear()} {currentBrand.toUpperCase()}. ARQUITECTURA MULTI-TENANT & MULTI-SUCURSAL.</p>
                        <p className="footer-mono-status">ESTADO DEL SISTEMA: OPERATIVO 100%</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
