/**
 * Middleware de Guardia de Suscripcion
 * 
 * Verifica que el tenant tenga una suscripcion activa antes de permitir
 * operaciones. Se ejecuta DESPUES de tenantContext.
 * 
 * Comportamiento por estado:
 *   - trial: Permite todo si trial_ends_at > ahora. Si expiro, bloquea.
 *   - active: Permite todo.
 *   - past_due: Permite solo GET (lectura). Bloquea POST/PUT/DELETE.
 *   - canceled/suspended: Bloquea todo.
 */
const subscriptionGuard = (req, res, next) => {
    try {
        // SuperAdmin no tiene restricciones de suscripcion
        if (req.tenantCtx && req.tenantCtx.isSuperAdmin) {
            return next();
        }

        // Si no hay contexto de tenant, algo fallo antes
        if (!req.tenantCtx || !req.tenantCtx.tenant) {
            return res.status(403).json({ 
                message: 'Contexto de empresa no disponible.' 
            });
        }

        const { tenant } = req.tenantCtx;
        const status = tenant.subscription_status;
        const method = req.method.toUpperCase();

        switch (status) {
            case 'active':
                // Todo permitido
                return next();

            case 'trial': {
                // Verificar si el trial no ha expirado
                if (tenant.trial_ends_at) {
                    const trialEnd = new Date(tenant.trial_ends_at);
                    if (trialEnd < new Date()) {
                        return res.status(403).json({
                            message: 'Tu periodo de prueba ha expirado. Actualiza tu suscripcion para continuar.',
                            code: 'TRIAL_EXPIRED'
                        });
                    }
                }
                return next();
            }

            case 'past_due':
                // Solo lectura permitida
                if (method === 'GET') {
                    return next();
                }
                return res.status(403).json({
                    message: 'Tu suscripcion tiene un pago pendiente. Solo puedes consultar informacion hasta que se resuelva.',
                    code: 'PAYMENT_PAST_DUE'
                });

            case 'canceled':
                return res.status(403).json({
                    message: 'Tu suscripcion ha sido cancelada. Contacta al soporte para reactivarla.',
                    code: 'SUBSCRIPTION_CANCELED'
                });

            case 'suspended':
                return res.status(403).json({
                    message: 'Tu cuenta ha sido suspendida. Contacta al administrador de la plataforma.',
                    code: 'ACCOUNT_SUSPENDED'
                });

            default:
                return res.status(403).json({
                    message: 'Estado de suscripcion no reconocido.',
                    code: 'UNKNOWN_STATUS'
                });
        }
    } catch (error) {
        console.error('[SUB-GUARD] Error en guardia de suscripcion:', error.message);
        res.status(500).json({ message: 'Error al verificar suscripcion.' });
    }
};

/**
 * Middleware para verificar limites del plan
 * Uso: planLimit('branches') o planLimit('users')
 */
const planLimit = (resource) => {
    return async (req, res, next) => {
        try {
            if (req.tenantCtx && req.tenantCtx.isSuperAdmin) {
                return next();
            }

            const { tenantId, planLimits } = req.tenantCtx;
            const db = require('../config/database');

            let currentCount = 0;
            let maxAllowed = null;

            switch (resource) {
                case 'branches': {
                    maxAllowed = planLimits.maxBranches;
                    const [result] = await db.query(
                        'SELECT COUNT(*) as count FROM branches WHERE tenant_id = ? AND is_active = TRUE',
                        [tenantId]
                    );
                    currentCount = result[0].count;
                    break;
                }
                case 'users': {
                    maxAllowed = planLimits.maxUsers;
                    const [result] = await db.query(
                        `SELECT COUNT(*) as count FROM users 
                         WHERE tenant_id = ? AND is_active = TRUE AND role != 'client'`,
                        [tenantId]
                    );
                    currentCount = result[0].count;
                    break;
                }
                case 'monthly_repairs': {
                    maxAllowed = planLimits.maxMonthlyRepairs;
                    if (maxAllowed === null) {
                        // null = ilimitado
                        return next();
                    }
                    const [result] = await db.query(
                        `SELECT COUNT(*) as count FROM repairs 
                         WHERE tenant_id = ? 
                         AND MONTH(created_at) = MONTH(CURRENT_DATE()) 
                         AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
                        [tenantId]
                    );
                    currentCount = result[0].count;
                    break;
                }
                default:
                    return next();
            }

            if (maxAllowed !== null && currentCount >= maxAllowed) {
                return res.status(403).json({
                    message: `Has alcanzado el limite de tu plan: ${currentCount}/${maxAllowed} ${resource}. Actualiza tu plan para agregar mas.`,
                    code: 'PLAN_LIMIT_REACHED',
                    resource,
                    current: currentCount,
                    limit: maxAllowed
                });
            }

            next();
        } catch (error) {
            console.error('[PLAN-LIMIT] Error al verificar limite:', error.message);
            res.status(500).json({ message: 'Error al verificar limites del plan.' });
        }
    };
};

/**
 * Middleware para verificar si una funcionalidad esta habilitada en el plan
 * Uso: featureGuard('ai_assistant') o featureGuard('ecommerce')
 */
const featureGuard = (featureName) => {
    return (req, res, next) => {
        try {
            if (req.tenantCtx && req.tenantCtx.isSuperAdmin) {
                return next();
            }

            if (!req.tenantCtx || !req.tenantCtx.planFeatures) {
                return res.status(403).json({
                    message: 'Contexto de plan no disponible.',
                    code: 'PLAN_CONTEXT_MISSING'
                });
            }

            const { planFeatures, tenant } = req.tenantCtx;
            const enabled = planFeatures[featureName];

            if (!enabled) {
                const planName = tenant ? tenant.plan_name : 'actual';
                return res.status(403).json({
                    message: `Esta funcionalidad no esta incluida en tu plan ${planName}. Actualiza tu suscripcion para acceder.`,
                    code: 'FEATURE_LOCKED',
                    feature: featureName,
                    upgrade_url: '/admin/suscripcion'
                });
            }

            next();
        } catch (error) {
            console.error('[FEATURE-GUARD] Error al verificar funcionalidad:', error.message);
            res.status(500).json({ message: 'Error al verificar acceso a funcionalidad.' });
        }
    };
};

module.exports = { subscriptionGuard, planLimit, featureGuard };
