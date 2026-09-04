import { useState, useEffect } from 'react';
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
    RefreshCw,
    Clock,
    Lock,
    Zap,
    ArrowRight
} from 'lucide-react';
import { showAlert, showConfirm } from '../../utils/swal';
import { formatCurrency } from '../../utils/constants';

export default function SubscriptionPage() {
    const { updateTenantInfo } = useTenant();
    const [tenant, setTenant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'

    useEffect(() => {
        loadTenantInfo();
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
            showAlert({ title: 'Error', text: err.message || 'Error al obtener datos de suscripción', icon: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const isTrialExpired = tenant?.subscription_status === 'trial' && tenant?.trial_ends_at && new Date(tenant.trial_ends_at) < new Date();
    const daysLeftInTrial = tenant?.subscription_status === 'trial' && tenant?.trial_ends_at 
        ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
        : null;

    const getStatusInfo = (status) => {
        if (status === 'trial' && isTrialExpired) {
            return {
                label: 'Prueba Expirada',
                icon: AlertCircle,
                color: '#ef4444'
            };
        }
        switch (status) {
            case 'active':
                return {
                    label: 'Suscripción Activa',
                    icon: CheckCircle2,
                    color: '#10b981'
                };
            case 'trial':
                return {
                    label: `Prueba (${daysLeftInTrial} días)`,
                    icon: Clock,
                    color: '#3b82f6'
                };
            case 'past_due':
                return {
                    label: 'Pago Pendiente',
                    icon: AlertCircle,
                    color: '#f59e0b'
                };
            case 'suspended':
                return {
                    label: 'Cuenta Suspendida',
                    icon: AlertCircle,
                    color: '#ef4444'
                };
            default:
                return {
                    label: 'Inactiva',
                    icon: AlertCircle,
                    color: '#64748b'
                };
        }
    };

    const handleUpgradePlan = async (plan) => {
        const isCurrentActive = plan.id === tenant?.plan_id && tenant?.subscription_status === 'active';
        if (isCurrentActive) return;

        const isTrialOrExpired = tenant?.subscription_status === 'trial' || isTrialExpired;
        const price = billingCycle === 'yearly' ? (plan.price_yearly || plan.price_monthly * 10) : plan.price_monthly;
        const cycleLabel = billingCycle === 'yearly' ? 'Anual (con 2 meses de descuento)' : 'Mensual';

        const confirmed = await showConfirm({
            title: isTrialOrExpired ? `Activar Suscripción: ${plan.name}` : `Cambiar a Plan ${plan.name}`,
            text: `¿Deseas contratar el ${plan.name} por ${formatCurrency(price)} MXN (${cycleLabel})? ${isTrialOrExpired ? 'Tu periodo de prueba se convertirá a suscripción activa y tendrás acceso total inmediato.' : 'Se actualizarán tus límites de sucursales y personal.'}`,
            icon: 'question',
            confirmText: 'Confirmar y Activar'
        });
        if (!confirmed) return;

        try {
            setActionLoading(true);
            const res = await billingService.subscribePlan({
                plan_id: plan.id,
                billing_cycle: billingCycle
            });

            showAlert({
                title: '¡Suscripción Activada!',
                text: res.message || `Tu cuenta ahora tiene activo el plan ${plan.name}.`,
                icon: 'success'
            });

            await loadTenantInfo();
            if (updateTenantInfo) {
                updateTenantInfo({
                    plan_id: plan.id,
                    subscription_status: 'active'
                });
            }
        } catch (err) {
            console.error('Error al contratar plan:', err);
            showAlert({
                title: 'Error',
                text: err.message || 'No se pudo procesar la suscripción.',
                icon: 'error'
            });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '14px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>Cargando estado de suscripción...</p>
            </div>
        );
    }

    const subStatus = getStatusInfo(tenant?.subscription_status);
    const plans = tenant?.available_plans || [];

    // Cálculo de cuotas y porcentajes
    const branchesUsed = tenant?.used_branches || 1;
    const branchesMax = tenant?.max_branches || 1;
    const branchesPct = branchesMax === 99 ? Math.min(100, (branchesUsed / 10) * 100) : Math.min(100, (branchesUsed / branchesMax) * 100);

    const usersUsed = tenant?.used_users || 1;
    const usersMax = tenant?.max_users || 3;
    const usersPct = usersMax === 999 ? Math.min(100, (usersUsed / 20) * 100) : Math.min(100, (usersUsed / usersMax) * 100);

    const repairsUsed = tenant?.used_repairs_month || 0;
    const repairsMax = tenant?.max_monthly_repairs;
    const repairsPct = repairsMax ? Math.min(100, (repairsUsed / repairsMax) * 100) : Math.min(100, (repairsUsed / 500) * 100);

    return (
        <div className="container animate-fadeIn" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-8)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px', fontWeight: 800 }}>
                        <Shield size={28} className="text-primary" />
                        <span>Mi Suscripción SaaS</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '4px', margin: 0 }}>
                        Estado de facturación, cuotas de recursos operativos y actualización de planes
                    </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={loadTenantInfo} title="Recargar">
                    <RefreshCw size={14} />
                    <span>Actualizar</span>
                </button>
            </div>

            {/* Banner Informativo de Estado de Prueba / Suscripción */}
            {isTrialExpired ? (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '18px 24px',
                    marginBottom: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#ef4444' }}>
                                Periodo de Prueba Concluido
                            </h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                Tu tiempo de prueba ha expirado. Selecciona un plan a continuación para activar tu suscripción y continuar gestionando tus talleres de forma inmediata.
                            </p>
                        </div>
                    </div>
                </div>
            ) : tenant?.subscription_status === 'trial' ? (
                <div style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 22px',
                    marginBottom: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#3b82f6' }}>
                                Periodo de Prueba Activo ({daysLeftInTrial} días restantes)
                            </h3>
                            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                Tienes acceso completo a todas las funcionalidades. Puedes activar tu plan definitivo cuando desees.
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Grid 3 Tarjetas de Estado */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                
                {/* 1. Estado Actual */}
                <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Plan Contratado</span>
                                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--color-text)' }}>
                                    {tenant?.plan_name}
                                </h2>
                            </div>
                            <span className="badge-neutral" style={{ fontWeight: 700, color: subStatus.color }}>
                                <subStatus.icon size={13} style={{ marginRight: '4px' }} />
                                {subStatus.label}
                            </span>
                        </div>

                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                                <span>Organización:</span>
                                <strong style={{ color: 'var(--color-text)' }}>{tenant?.company_name}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                                <span>Costo Mensual:</span>
                                <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(tenant?.price_monthly || 0)} MXN</strong>
                            </div>
                            {tenant?.subscription_status === 'trial' && tenant?.trial_ends_at && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={13} /> Fin de Prueba:
                                    </span>
                                    <strong style={{ color: isTrialExpired ? '#ef4444' : 'var(--color-primary)' }}>
                                        {new Date(tenant.trial_ends_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {isTrialExpired ? ' (Expirado)' : ''}
                                    </strong>
                                </div>
                            )}
                            {tenant?.subscription_expires_at && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={13} /> Próxima Renovación:
                                    </span>
                                    <strong style={{ color: 'var(--color-text)' }}>
                                        {new Date(tenant.subscription_expires_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </strong>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Lock size={13} style={{ color: 'var(--color-primary)' }} />
                        <span>Suscripción SaaS con aislamiento total de datos.</span>
                    </div>
                </div>

                {/* 2. Cuotas y Consumo en Vivo */}
                <div className="card" style={{ padding: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Consumo de Recursos</span>
                        <span className="badge-neutral" style={{ fontSize: '10px' }}>Mes en Curso</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Sucursales */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)', fontWeight: 600 }}>
                                    <Building2 size={15} style={{ color: '#3b82f6' }} /> Sucursales
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                    <strong>{branchesUsed}</strong> / {branchesMax === 99 ? 'Ilimitadas' : `${branchesMax}`}
                                </span>
                            </div>
                            <div className="progress-track" style={{ height: '8px' }}>
                                <div className="progress-fill" style={{ width: `${branchesPct}%`, background: '#3b82f6' }} />
                            </div>
                        </div>

                        {/* Usuarios Staff */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)', fontWeight: 600 }}>
                                    <Users size={15} style={{ color: '#6366f1' }} /> Personal / Staff
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                    <strong>{usersUsed}</strong> / {usersMax === 999 ? 'Ilimitados' : `${usersMax}`}
                                </span>
                            </div>
                            <div className="progress-track" style={{ height: '8px' }}>
                                <div className="progress-fill" style={{ width: `${usersPct}%`, background: '#6366f1' }} />
                            </div>
                        </div>

                        {/* Reparaciones Mensuales */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)', fontWeight: 600 }}>
                                    <Wrench size={15} style={{ color: '#0284c7' }} /> Órdenes Taller (Mes)
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                    <strong>{repairsUsed}</strong> / {repairsMax ? `${repairsMax}` : 'Ilimitadas'}
                                </span>
                            </div>
                            <div className="progress-track" style={{ height: '8px' }}>
                                <div className="progress-fill" style={{ width: `${repairsPct}%`, background: '#0284c7' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Facturación y Ciclo */}
                <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Resumen Operativo</span>
                        
                        <div style={{
                            background: 'var(--color-bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            padding: '16px',
                            marginTop: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Zap size={18} style={{ color: 'var(--color-primary)' }} />
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                                        Acceso Ininterrumpido
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                        Activación instantánea sin pérdida de datos históricos
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                            ¿Deseas soporte o un plan corporativo a medida?
                        </div>
                        <a 
                            href="mailto:soporte@sysaas.com" 
                            className="btn btn-secondary btn-sm w-full"
                            style={{ textAlign: 'center', justifyContent: 'center' }}
                        >
                            Contactar Soporte
                        </a>
                    </div>
                </div>
            </div>

            {/* Selector y Grid de Planes */}
            <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                            Planes de Suscripción Disponibles
                        </h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0 }}>
                            Escala los recursos y capacidades de tu negocio según tu volumen de operaciones
                        </p>
                    </div>

                    {/* Selector Ciclo de Facturación */}
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                cursor: 'pointer',
                                background: billingCycle === 'monthly' ? 'var(--color-primary)' : 'transparent',
                                color: billingCycle === 'monthly' ? '#ffffff' : 'var(--color-text-secondary)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Facturación Mensual
                        </button>
                        <button
                            onClick={() => setBillingCycle('yearly')}
                            style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                cursor: 'pointer',
                                background: billingCycle === 'yearly' ? 'var(--color-primary)' : 'transparent',
                                color: billingCycle === 'yearly' ? '#ffffff' : 'var(--color-text-secondary)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Anual (2 Meses Gratis)
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    {plans.map((p) => {
                        const isCurrentActive = p.id === tenant?.plan_id && tenant?.subscription_status === 'active';
                        const price = billingCycle === 'yearly' ? (p.price_yearly || p.price_monthly * 10) : p.price_monthly;

                        return (
                            <div
                                key={p.id}
                                className="card"
                                style={{
                                    padding: '24px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    border: isCurrentActive ? '2px solid var(--color-primary)' : (p.id === tenant?.plan_id ? '2px dashed var(--color-primary)' : '1px solid var(--color-border)'),
                                    position: 'relative'
                                }}
                            >
                                <div>
                                    {/* Header de Plan */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                                            {p.name}
                                        </h3>
                                        {isCurrentActive && (
                                            <span className="badge-neutral" style={{ fontWeight: 700, color: '#10b981' }}>
                                                ACTIVO
                                            </span>
                                        )}
                                        {!isCurrentActive && p.id === tenant?.plan_id && (
                                            <span className="badge-neutral" style={{ fontWeight: 700, color: '#3b82f6' }}>
                                                SELECCIONADO
                                            </span>
                                        )}
                                    </div>

                                    {/* Precio */}
                                    <div style={{ marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)' }}>
                                                {formatCurrency(price)}
                                            </span>
                                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                                /{billingCycle === 'yearly' ? 'año' : 'mes'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Características */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Check size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />
                                            <span><strong>{p.max_branches === 99 ? 'Sucursales Ilimitadas' : `${p.max_branches} Sucursal${p.max_branches > 1 ? 'es' : ''}`}</strong></span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Check size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />
                                            <span><strong>{p.max_users === 999 ? 'Usuarios Ilimitados' : `Hasta ${p.max_users} Usuarios`}</strong></span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Check size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />
                                            <span>{p.max_monthly_repairs ? `${p.max_monthly_repairs} tickets al mes` : 'Tickets y órdenes ilimitadas'}</span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Check size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />
                                            <span>Punto de Venta POS & Inventario</span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Check size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />
                                            <span>Reportes & Inteligencia ML</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Botón de Acción */}
                                <button
                                    className={`btn ${isCurrentActive ? 'btn-secondary' : 'btn-primary'} btn-sm w-full`}
                                    onClick={() => handleUpgradePlan(p)}
                                    disabled={isCurrentActive || actionLoading}
                                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    {isCurrentActive ? (
                                        'Plan Actual Activo'
                                    ) : (tenant?.subscription_status === 'trial' || isTrialExpired) ? (
                                        <>
                                            <Zap size={14} />
                                            <span>Activar {p.name}</span>
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
