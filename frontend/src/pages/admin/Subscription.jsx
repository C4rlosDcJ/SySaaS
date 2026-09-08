import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { tenantService, billingService } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import {
    Shield,
    CreditCard,
    Building2,
    Users,
    Wrench,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Check,
    X,
    RefreshCw,
    Clock,
    Zap,
    ArrowRight,
    HelpCircle
} from 'lucide-react';
import { showAlert, showConfirm } from '../../utils/swal';
import { formatCurrency } from '../../utils/constants';
import './Subscription.css';

export default function SubscriptionPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { updateTenantInfo } = useTenant();
    const [tenant, setTenant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [billingCycle, setBillingCycle] = useState('monthly');

    useEffect(() => {
        loadTenantInfo();

        const sessionId = searchParams.get('session_id');
        const success = searchParams.get('success');
        if (sessionId && success === 'true') {
            verifyStripeSession(sessionId);
            setSearchParams({});
        } else if (searchParams.get('canceled') === 'true') {
            showAlert({
                title: 'Pago Cancelado',
                text: 'El proceso de pago fue cancelado. Puedes reactivar tu suscripcion en cualquier momento.',
                icon: 'info'
            });
            setSearchParams({});
        } else if (searchParams.get('stripe_error')) {
            showAlert({
                title: 'Stripe Requiere Configuracion',
                text: 'Tu empresa ha sido registrada, pero para procesar el cobro con Stripe es necesario configurar tus credenciales en el archivo backend/.env.',
                icon: 'warning'
            });
            setSearchParams({});
        }
    }, []);

    const loadTenantInfo = async () => {
        try {
            setLoading(true);
            const data = await tenantService.getMyTenant();
            setTenant(data);
            if (data && updateTenantInfo) {
                updateTenantInfo({
                    plan_id: data.plan_id,
                    subscription_status: data.subscription_status,
                    trial_ends_at: data.trial_ends_at,
                    subscription_expires_at: data.subscription_expires_at
                });
            }
        } catch (err) {
            showAlert({
                title: 'Error',
                text: err.message || 'Error al obtener datos de suscripcion',
                icon: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const verifyStripeSession = async (sessionId) => {
        try {
            setActionLoading(true);
            const result = await billingService.verifySession(sessionId);
            showAlert({
                title: 'Suscripcion Activada',
                text: result.message || 'Tu suscripcion ha sido confirmada y activada exitosamente.',
                icon: 'success'
            });
            await loadTenantInfo();
        } catch (err) {
            console.warn('[SUBSCRIPTION] Error al verificar sesion Stripe:', err.message);
            await loadTenantInfo();
        } finally {
            setActionLoading(false);
        }
    };

    const openStripePortal = async () => {
        try {
            setActionLoading(true);
            const res = await billingService.createPortalSession();
            if (res.url) {
                window.location.href = res.url;
            }
        } catch (err) {
            showAlert({
                title: 'Error',
                text: err.message || 'No se pudo acceder al portal de clientes de Stripe.',
                icon: 'error'
            });
        } finally {
            setActionLoading(false);
        }
    };

    const targetExpirationDate = tenant?.subscription_status === 'trial'
        ? tenant?.trial_ends_at
        : tenant?.subscription_expires_at;

    const getTimeRemaining = () => {
        if (tenant?.time_remaining) return tenant.time_remaining;
        if (!targetExpirationDate) return null;
        const target = new Date(targetExpirationDate);
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();

        if (diffMs <= 0) {
            return { expired: true, total_days: 0, months: 0, days: 0, text: 'Vencida', is_urgent: true };
        }
        const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (totalDays > 30) {
            const months = Math.floor(totalDays / 30);
            const remainderDays = totalDays % 30;
            const text = remainderDays > 0
                ? `${months} ${months === 1 ? 'mes' : 'meses'} y ${remainderDays} ${remainderDays === 1 ? 'día' : 'días'} restantes`
                : `${months} ${months === 1 ? 'mes' : 'meses'} restantes`;
            return { expired: false, total_days: totalDays, months, days: remainderDays, text, is_urgent: false };
        }
        return {
            expired: false,
            total_days: totalDays,
            months: 0,
            days: totalDays,
            text: totalDays === 1 ? '1 día restante' : `${totalDays} días restantes`,
            is_urgent: totalDays <= 7
        };
    };

    const timeRemaining = getTimeRemaining();
    const isTrialExpired = tenant?.subscription_status === 'trial' && timeRemaining?.expired;
    const isExpiringSoon = timeRemaining && !timeRemaining.expired && timeRemaining.is_urgent;

    const getStatusInfo = (status) => {
        if (status === 'trial' && isTrialExpired) {
            return {
                label: 'Prueba Expirada',
                className: 'expired',
                icon: AlertCircle
            };
        }
        switch (status) {
            case 'active':
                if (isExpiringSoon) {
                    return {
                        label: `Por Vencer (${timeRemaining.days || timeRemaining.total_days} días)`,
                        className: 'trial',
                        icon: AlertCircle
                    };
                }
                return {
                    label: 'Suscripcion Activa',
                    className: 'active',
                    icon: CheckCircle2
                };
            case 'trial':
                return {
                    label: `Prueba (${timeRemaining ? timeRemaining.text : 'Activa'})`,
                    className: 'trial',
                    icon: Clock
                };
            case 'past_due':
                return {
                    label: 'Pago Pendiente',
                    className: 'expired',
                    icon: AlertCircle
                };
            case 'suspended':
                return {
                    label: 'Suspendida',
                    className: 'expired',
                    icon: AlertCircle
                };
            default:
                return {
                    label: 'Inactiva',
                    className: 'trial',
                    icon: AlertCircle
                };
        }
    };

    const handleUpgradePlan = async (plan) => {
        const isCurrentActive = plan.id === tenant?.plan_id && tenant?.subscription_status === 'active';
        if (isCurrentActive) return;

        const price = billingCycle === 'yearly'
            ? (plan.price_yearly || plan.price_monthly * 10)
            : plan.price_monthly;
        const cycleLabel = billingCycle === 'yearly' ? 'Anual (2 meses de descuento)' : 'Mensual';

        const isTrialTransition = tenant?.subscription_status === 'trial' || isTrialExpired || tenant?.has_used_trial;
        const confirmed = await showConfirm({
            title: isTrialTransition ? `Contratar Plan ${plan.name}` : `Cambiar a Plan ${plan.name}`,
            text: isTrialTransition
                ? `El periodo de prueba es valido por unica vez. Seras redirigido a la pasarela segura de Stripe para formalizar la contratacion del Plan ${plan.name} por ${formatCurrency(price)} MXN (${cycleLabel}).`
                : `Seras redirigido a la pasarela segura de Stripe para procesar el pago de ${formatCurrency(price)} MXN (${cycleLabel}).`,
            icon: 'question',
            confirmText: 'Continuar a Stripe'
        });
        if (!confirmed) return;

        try {
            setActionLoading(true);
            const res = await billingService.createCheckoutSession(plan.slug, billingCycle);
            if (res.url) {
                window.location.href = res.url;
                return;
            }

            const fallback = await billingService.subscribePlan({ plan_id: plan.id, billing_cycle: billingCycle });
            showAlert({
                title: 'Suscripcion Actualizada',
                text: fallback.message || `Plan ${plan.name} activado con exito.`,
                icon: 'success'
            });
            await loadTenantInfo();
            if (updateTenantInfo) {
                updateTenantInfo({ plan_id: plan.id, subscription_status: 'active' });
            }
        } catch (err) {
            if (err.message && err.message.includes('Stripe')) {
                try {
                    const fallback = await billingService.subscribePlan({ plan_id: plan.id, billing_cycle: billingCycle });
                    showAlert({
                        title: 'Suscripcion Actualizada',
                        text: fallback.message || `Plan ${plan.name} activado.`,
                        icon: 'success'
                    });
                    await loadTenantInfo();
                    if (updateTenantInfo) {
                        updateTenantInfo({ plan_id: plan.id, subscription_status: 'active' });
                    }
                } catch (err2) {
                    showAlert({
                        title: 'Error',
                        text: err2.message || 'No se pudo procesar la solicitud.',
                        icon: 'error'
                    });
                }
            } else {
                showAlert({
                    title: 'Error',
                    text: err.message || 'Error al procesar la suscripcion.',
                    icon: 'error'
                });
            }
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="sub-page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '420px' }}>
                <div className="spinner" style={{ width: '28px', height: '28px', marginBottom: '14px' }} />
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    Cargando informacion de suscripcion...
                </span>
            </div>
        );
    }

    const subStatus = getStatusInfo(tenant?.subscription_status);
    const plans = tenant?.available_plans || [];

    const branchesUsed = tenant?.used_branches || 1;
    const branchesMax = tenant?.max_branches || 1;
    const branchesPct = branchesMax === 99
        ? Math.min(100, (branchesUsed / 10) * 100)
        : Math.min(100, (branchesUsed / branchesMax) * 100);

    const usersUsed = tenant?.used_users || 1;
    const usersMax = tenant?.max_users || 3;
    const usersPct = usersMax === 999
        ? Math.min(100, (usersUsed / 20) * 100)
        : Math.min(100, (usersUsed / usersMax) * 100);

    const repairsUsed = tenant?.used_repairs_month || 0;
    const repairsMax = tenant?.max_monthly_repairs;
    const repairsPct = repairsMax
        ? Math.min(100, (repairsUsed / repairsMax) * 100)
        : Math.min(100, (repairsUsed / 500) * 100);

    return (
        <div className="sub-page-container animate-fadeIn">
            {/* Encabezado */}
            <div className="sub-header-row">
                <div>
                    <h1 className="sub-title">
                        <Shield size={24} />
                        <span>Gestion de Suscripcion</span>
                    </h1>
                    <p className="sub-subtitle">
                        Estado operativo de tu cuenta, consumo de recursos y seleccion de planes
                    </p>
                </div>

                <button
                    type="button"
                    onClick={loadTenantInfo}
                    className="sub-refresh-btn"
                    disabled={actionLoading}
                >
                    <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
                    <span>Actualizar Estado</span>
                </button>
            </div>

            {/* Banners Informativos de Estado */}
            {isTrialExpired ? (
                <div className="sub-banner sub-banner-expired">
                    <div className="sub-banner-left">
                        <div className="sub-banner-icon">
                            <AlertCircle size={22} />
                        </div>
                        <div>
                            <div className="sub-banner-title">Periodo de Prueba Concluido (Uso Unico Agotado)</div>
                            <p className="sub-banner-text">
                                Tus 30 dias de prueba gratuita han finalizado. Como regla de la plataforma, el periodo de prueba solo puede utilizarse una vez. Para reactivar tu operacion de forma inmediata sin perder tus datos, selecciona y contrata una suscripcion de pago en el plan de tu preferencia.
                            </p>
                        </div>
                    </div>
                </div>
            ) : tenant?.subscription_status === 'trial' ? (
                <div className="sub-banner sub-banner-trial">
                    <div className="sub-banner-left">
                        <div className="sub-banner-icon">
                            <Clock size={22} />
                        </div>
                        <div>
                            <div className="sub-banner-title">
                                Periodo de Prueba Activo: {timeRemaining ? timeRemaining.text : 'Activo'} (Prueba Unica)
                            </div>
                            <p className="sub-banner-text">
                                Cuentas con acceso a todas las caracteristicas de tu plan. Recuerda que la prueba gratuita es valida por unica vez por empresa; al finalizar, deberas formalizar tu suscripcion mediante pago para continuar usando el sistema.
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Banner de Suscripción por Vencer */}
            {isExpiringSoon && tenant?.subscription_status === 'active' && (
                <div className="sub-banner sub-banner-warning">
                    <div className="sub-banner-left">
                        <div className="sub-banner-icon">
                            <AlertCircle size={22} />
                        </div>
                        <div>
                            <div className="sub-banner-title">
                                Aviso: Tu suscripción vence pronto ({timeRemaining.text})
                            </div>
                            <p className="sub-banner-text">
                                Tu plan actual concluye el {targetExpirationDate ? new Date(targetExpirationDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : 'próximamente'}. Para evitar la interrupción de tus servicios y módulos activos, actualiza o renueva tu suscripción.
                            </p>
                        </div>
                    </div>
                    {tenant?.stripe_customer_id ? (
                        <button
                            type="button"
                            onClick={openStripePortal}
                            className="sub-refresh-btn"
                            disabled={actionLoading}
                            style={{ background: '#eab308', color: '#000', fontWeight: 700 }}
                        >
                            <CreditCard size={14} />
                            <span>Portal de Facturación</span>
                        </button>
                    ) : null}
                </div>
            )}

            {/* Metricas y Estado Actual */}
            <div className="sub-metrics-grid">
                {/* Tarjeta 1: Plan Contratado */}
                <div className="sub-metric-card">
                    <div>
                        <div className="sub-metric-header">
                            <div>
                                <div className="sub-metric-label">Plan Contratado</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                                    {tenant?.plan_name || 'Sin Plan'}
                                </div>
                            </div>
                            <span className={`sub-plan-badge ${subStatus.className}`}>
                                <subStatus.icon size={12} />
                                <span>{subStatus.label}</span>
                            </span>
                        </div>

                        <div className="sub-detail-rows">
                            <div className="sub-detail-row">
                                <span>Empresa:</span>
                                <strong>{tenant?.company_name}</strong>
                            </div>
                            <div className="sub-detail-row">
                                <span>Costo Base:</span>
                                <strong>
                                    {formatCurrency(
                                        tenant?.billing_cycle === 'yearly'
                                            ? (tenant?.price_yearly || (tenant?.price_monthly ? tenant.price_monthly * 10 : 0))
                                            : (tenant?.price_monthly || 0)
                                    )} MXN / {tenant?.billing_cycle === 'yearly' ? 'año' : 'mes'}
                                </strong>
                            </div>
                            <div className="sub-detail-row">
                                <span>Modalidad:</span>
                                <strong style={{ color: tenant?.billing_cycle === 'yearly' ? 'var(--color-primary)' : 'inherit' }}>
                                    {tenant?.billing_cycle === 'yearly' ? 'Facturación Anual (12 meses)' : 'Facturación Mensual'}
                                </strong>
                            </div>

                            {/* Tiempo restante en días o meses */}
                            {timeRemaining && (
                                <div className="sub-detail-row" style={{
                                    background: timeRemaining.is_urgent ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-tertiary)',
                                    border: `1px solid ${timeRemaining.is_urgent ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border)'}`,
                                    padding: '8px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    marginTop: '4px',
                                    marginBottom: '4px'
                                }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                        <Clock size={14} style={{ color: timeRemaining.is_urgent ? 'var(--color-error)' : 'var(--color-primary)' }} />
                                        <span>Tiempo Restante:</span>
                                    </span>
                                    <strong style={{
                                        color: timeRemaining.is_urgent ? 'var(--color-error)' : 'var(--color-text)',
                                        fontFamily: 'var(--font-mono)',
                                        fontWeight: 700
                                    }}>
                                        {timeRemaining.text}
                                    </strong>
                                </div>
                            )}

                            {targetExpirationDate && (
                                <div className="sub-detail-row">
                                    <span>{tenant?.subscription_status === 'trial' ? 'Fin de Prueba:' : 'Próxima Renovación:'}</span>
                                    <strong style={{ color: timeRemaining?.expired ? 'var(--color-error)' : 'inherit' }}>
                                        {new Date(targetExpirationDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </strong>
                                </div>
                            )}
                        </div>
                    </div>

                    {tenant?.subscription_status === 'active' && (
                        <button
                            type="button"
                            onClick={openStripePortal}
                            className="sub-btn-portal"
                            disabled={actionLoading}
                        >
                            <CreditCard size={14} />
                            <span>Portal de Facturacion Stripe</span>
                        </button>
                    )}
                </div>

                {/* Tarjeta 2: Consumo de Recursos */}
                <div className="sub-metric-card">
                    <div>
                        <div className="sub-metric-header">
                            <div>
                                <div className="sub-metric-label">Consumo de Recursos</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                                    Cuotas Activas
                                </div>
                            </div>
                            <span className="sub-plan-badge trial">MES EN CURSO</span>
                        </div>

                        <div style={{ marginTop: 'var(--sp-2)' }}>
                            <div className="sub-quota-item">
                                <div className="sub-quota-header">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Building2 size={13} /> Sucursales
                                    </span>
                                    <span>
                                        <strong>{branchesUsed}</strong> / {branchesMax === 99 ? 'Ilimitadas' : branchesMax}
                                    </span>
                                </div>
                                <div className="sub-progress-track">
                                    <div className="sub-progress-fill" style={{ width: `${branchesPct}%` }} />
                                </div>
                            </div>

                            <div className="sub-quota-item">
                                <div className="sub-quota-header">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Users size={13} /> Personal Staff
                                    </span>
                                    <span>
                                        <strong>{usersUsed}</strong> / {usersMax === 999 ? 'Ilimitados' : usersMax}
                                    </span>
                                </div>
                                <div className="sub-progress-track">
                                    <div className="sub-progress-fill" style={{ width: `${usersPct}%` }} />
                                </div>
                            </div>

                            <div className="sub-quota-item">
                                <div className="sub-quota-header">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Wrench size={13} /> Reparaciones del Mes
                                    </span>
                                    <span>
                                        <strong>{repairsUsed}</strong> / {repairsMax ? repairsMax : 'Ilimitadas'}
                                    </span>
                                </div>
                                <div className="sub-progress-track">
                                    <div className="sub-progress-fill" style={{ width: `${repairsPct}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tarjeta 3: Asistencia y Soporte */}
                <div className="sub-metric-card">
                    <div>
                        <div className="sub-metric-header">
                            <div>
                                <div className="sub-metric-label">Seguridad y Respaldo</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                                    Aislamiento Total
                                </div>
                            </div>
                            <span className="sub-plan-badge active">SLA 99.9%</span>
                        </div>

                        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 var(--sp-4) 0' }}>
                            Tu base de datos y esquemas operativos se encuentran aislados logicamente. Todos los pagos son procesados de forma segura mediante Stripe con cifrado bancario.
                        </p>
                    </div>

                    <a
                        href="mailto:soporte@sysaas.com"
                        className="sub-btn-portal"
                        style={{ textDecoration: 'none' }}
                    >
                        <HelpCircle size={14} />
                        <span>Contactar a Soporte Tecnico</span>
                    </a>
                </div>
            </div>

            {/* Seccion de Planes Disponibles */}
            <div className="sub-plans-section">
                <div className="sub-plans-header">
                    <div>
                        <h2 className="sub-plans-title">Planes de Suscripcion Disponibles</h2>
                        <p className="sub-plans-subtitle">
                            Aumenta tus capacidades operativas y desbloquea funciones avanzadas de inteligencia artificial
                        </p>
                        {(tenant?.has_used_trial || isTrialExpired) && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginTop: '8px',
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'rgba(234, 179, 8, 0.08)',
                                border: '1px solid rgba(234, 179, 8, 0.25)',
                                color: '#ca8a04',
                                fontSize: '12px',
                                fontWeight: 600
                            }}>
                                <AlertCircle size={13} />
                                <span>Periodo de prueba unico utilizado. La activacion de planes se realiza mediante suscripcion de pago.</span>
                            </div>
                        )}
                    </div>

                    {/* Segmented Switch para ciclo de facturación */}
                    <div className="sub-cycle-switch">
                        <button
                            type="button"
                            className={`sub-cycle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
                            onClick={() => setBillingCycle('monthly')}
                        >
                            Facturacion Mensual
                        </button>
                        <button
                            type="button"
                            className={`sub-cycle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
                            onClick={() => setBillingCycle('yearly')}
                        >
                            <span>Anual</span>
                            <span className="sub-cycle-badge">2 MESES GRATIS</span>
                        </button>
                    </div>
                </div>

                <div className="sub-plans-grid">
                    {plans.map((p) => {
                        const isCurrentActive = p.id === tenant?.plan_id && tenant?.subscription_status === 'active';
                        const isCurrentPlan = p.id === tenant?.plan_id;
                        const isRecommended = p.popular || p.features?.popular || p.slug === 'pro';
                        const price = billingCycle === 'yearly'
                            ? (p.price_yearly || p.price_monthly * 10)
                            : p.price_monthly;

                        const planFeatures = [
                            { label: p.max_branches >= 99 ? 'Sucursales ilimitadas' : `${p.max_branches} sucursal${p.max_branches > 1 ? 'es' : ''}`, included: true },
                            { label: p.max_users >= 999 ? 'Usuarios staff ilimitados' : `Hasta ${p.max_users} usuarios staff`, included: true },
                            { label: p.max_monthly_repairs ? `${p.max_monthly_repairs} ordenes de servicio/mes` : 'Ordenes de servicio ilimitadas', included: true },
                            { label: 'Punto de Venta POS & Facturacion', included: p.features?.pos_sales !== false },
                            { label: 'Control de Inventario y Stock', included: p.features?.inventory !== false },
                            { label: 'Rastreo Publico para Clientes', included: p.features?.public_tracking !== false },
                            { label: 'Traspasos entre Sucursales', included: !!p.features?.transfers },
                            { label: 'Notificaciones por WhatsApp', included: !!p.features?.whatsapp_notifications },
                            { label: 'Asistente de Inteligencia Artificial', included: !!p.features?.ai_assistant },
                            { label: 'Catalogo E-Commerce y Pedidos Web', included: !!p.features?.ecommerce },
                            { label: 'Reportes y Machine Learning', included: !!p.features?.advanced_reports }
                        ];

                        if (p.features?.support_tier) {
                            planFeatures.push({ label: p.features.support_tier, included: true });
                        }

                        if (Array.isArray(p.features?.custom_features)) {
                            p.features.custom_features.forEach(cf => {
                                planFeatures.push({ label: cf, included: true });
                            });
                        }

                        return (
                            <div
                                key={p.id}
                                className={`sub-plan-card ${isCurrentActive ? 'current' : ''} ${isRecommended ? 'featured' : ''}`}
                            >
                                {isRecommended && !isCurrentActive && (
                                    <div className="sub-card-tag">
                                        RECOMENDADO
                                    </div>
                                )}

                                <div>
                                    <div className="sub-card-header">
                                        <h3 className="sub-card-plan-name">{p.name}</h3>
                                        {isCurrentActive && (
                                            <span className="sub-plan-badge active">ACTIVO</span>
                                        )}
                                        {!isCurrentActive && isCurrentPlan && (
                                            <span className={`sub-plan-badge ${isTrialExpired ? 'expired' : 'trial'}`}>
                                                {isTrialExpired ? 'PRUEBA EXPIRADA' : 'EN PRUEBA'}
                                            </span>
                                        )}
                                    </div>

                                    {(p.description || p.features?.description) && (
                                        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: '4px 0 10px 0', lineHeight: 1.3 }}>
                                            {p.description || p.features?.description}
                                        </p>
                                    )}

                                    <div className="sub-price-block">
                                        <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                            <span className="sub-price-number">{formatCurrency(price)}</span>
                                            <span className="sub-price-frequency">
                                                MXN / {billingCycle === 'yearly' ? 'año' : 'mes'}
                                            </span>
                                        </div>
                                        {billingCycle === 'yearly' && (
                                            <div className="sub-price-savings">
                                                Ahorro de 2 meses aplicado
                                            </div>
                                        )}
                                    </div>

                                    <div className="sub-card-quotas">
                                        <span className="sub-quota-badge">
                                            {p.max_branches === 99 ? 'Multi-Sucursal' : `${p.max_branches} Sede`}
                                        </span>
                                        <span className="sub-quota-badge">
                                            {p.max_users === 999 ? 'Staff Libre' : `${p.max_users} Usuarios`}
                                        </span>
                                        <span className="sub-quota-badge">
                                            {p.max_monthly_repairs ? `${p.max_monthly_repairs} Tickets` : 'Tickets Libres'}
                                        </span>
                                    </div>

                                    <div className="sub-features-checklist">
                                        {planFeatures.map((f, idx) => (
                                            <div
                                                key={idx}
                                                className={`sub-feature-item ${f.included ? 'included' : 'excluded'}`}
                                            >
                                                <div className={`sub-feature-dot ${f.included ? 'check' : 'cross'}`}>
                                                    {f.included ? <Check size={10} strokeWidth={3} /> : <X size={10} />}
                                                </div>
                                                <span>{f.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleUpgradePlan(p)}
                                    disabled={isCurrentActive || actionLoading}
                                    className={`sub-action-btn ${isCurrentActive ? 'btn-current' : 'btn-active-primary'}`}
                                >
                                    {isCurrentActive ? (
                                        <>
                                            <CheckCircle2 size={14} />
                                            <span>Plan Actual</span>
                                        </>
                                    ) : (tenant?.subscription_status === 'trial' || isTrialExpired) ? (
                                        <>
                                            <Zap size={14} />
                                            <span>Activar con Stripe</span>
                                        </>
                                    ) : (
                                        <>
                                            <ArrowRight size={14} />
                                            <span>Cambiar a {p.name}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
