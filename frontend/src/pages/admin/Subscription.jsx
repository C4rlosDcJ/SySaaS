import { useState, useEffect } from 'react';
import { tenantService } from '../../services/api';
import { Shield, CreditCard } from 'lucide-react';

export default function SubscriptionPage() {
    const [tenant, setTenant] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTenantInfo();
    }, []);

    const loadTenantInfo = async () => {
        try {
            setLoading(true);
            const data = await tenantService.getMyTenant();
            setTenant(data);
        } catch (err) {
            alert(err.message || 'Error al obtener datos de suscripción');
        } finally {
            setLoading(false);
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'active': return { label: 'Activa', color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.08)' };
            case 'trial': return { label: 'Periodo de Prueba', color: 'var(--color-info)', background: 'rgba(0, 112, 243, 0.08)' };
            case 'past_due': return { label: 'Pago Pendiente', color: 'var(--color-warning)', background: 'rgba(245, 166, 35, 0.08)' };
            case 'suspended': return { label: 'Suspendida', color: 'var(--color-error)', background: 'rgba(255, 0, 60, 0.08)' };
            default: return { label: 'Cancelada', color: 'var(--color-error)', background: 'rgba(255, 0, 60, 0.08)' };
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    const subStatus = getStatusLabel(tenant?.subscription_status);

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Shield size={20} className="logo-icon" />
                    <span>Mi Suscripción SaaS</span>
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                    Revisa el estado de facturación, límites de tu plan y pasarela de pagos.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                
                {/* Detalles de suscripcion */}
                <div className="card">
                    <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--font-md)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>Estado Actual</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
                        <div><strong style={{ color: 'var(--color-text)' }}>Empresa:</strong> {tenant?.company_name}</div>
                        <div><strong style={{ color: 'var(--color-text)' }}>Plan Contratado:</strong> <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{tenant?.plan_name}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ color: 'var(--color-text)' }}>Estado:</strong>
                            <span className="status-badge" style={{ color: subStatus.color, background: subStatus.background, borderColor: subStatus.color }}>
                                {subStatus.label.toUpperCase()}
                            </span>
                        </div>
                        {tenant?.subscription_status === 'trial' && tenant?.trial_ends_at && (
                            <div><strong style={{ color: 'var(--color-text)' }}>Tu prueba termina el:</strong> {new Date(tenant.trial_ends_at).toLocaleDateString()}</div>
                        )}
                        {tenant?.subscription_expires_at && (
                            <div><strong style={{ color: 'var(--color-text)' }}>Próxima renovación:</strong> {new Date(tenant.subscription_expires_at).toLocaleDateString()}</div>
                        )}
                    </div>
                </div>

                {/* Límites de uso */}
                <div className="card">
                    <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--font-md)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>Límites de tu Plan</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text)' }}><strong>Límite de Sucursales:</strong></span>
                            <span>{tenant?.max_branches === 99 ? 'Ilimitadas' : `${tenant?.max_branches || 1} sucursales`}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text)' }}><strong>Límite de Usuarios Staff:</strong></span>
                            <span>{tenant?.max_users === 999 ? 'Ilimitados' : `${tenant?.max_users || 3} empleados`}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text)' }}><strong>Reparaciones Mensuales:</strong></span>
                            <span>{tenant?.max_monthly_repairs === null ? 'Ilimitadas' : `${tenant?.max_monthly_repairs} tickets`}</span>
                        </div>
                    </div>
                </div>

                {/* Pasarela Stripe */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--font-md)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>Método de Pago</h3>
                        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
                            Administra tu suscripción mediante la pasarela segura de Stripe.
                        </p>
                    </div>
                    {tenant?.stripe_subscription_id ? (
                        <button className="btn btn-secondary w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <CreditCard size={18} />
                            <span>Portal de Clientes Stripe</span>
                        </button>
                    ) : (
                        <button className="btn btn-primary w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <CreditCard size={18} />
                            <span>Suscribirse con Tarjeta</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
