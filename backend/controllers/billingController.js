const db = require('../config/database');

const getStripe = () => {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

// Crear Checkout Session (Stripe Hosted Checkout)
exports.createCheckoutSession = async (req, res) => {
    try {
        const stripe = getStripe();
        if (!stripe) {
            return res.status(503).json({ message: 'La integracion con Stripe no esta configurada. Contacta al administrador.' });
        }

        const tenantId = req.tenantCtx.tenantId;
        const { plan_slug, billing_cycle = 'monthly' } = req.body;

        if (!plan_slug) {
            return res.status(400).json({ message: 'El plan_slug es obligatorio.' });
        }

        const [plans] = await db.query('SELECT * FROM saas_plans WHERE slug = ? AND is_active = 1', [plan_slug]);
        if (plans.length === 0) {
            return res.status(400).json({ message: 'Plan de suscripcion no valido.' });
        }
        const plan = plans[0];

        const [tenants] = await db.query('SELECT company_name, stripe_customer_id FROM tenants WHERE id = ?', [tenantId]);
        if (tenants.length === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }

        let stripeCustomerId = tenants[0].stripe_customer_id;

        // Crear customer en Stripe si no existe
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: tenants[0].company_name,
                metadata: { tenant_id: String(tenantId) }
            });
            stripeCustomerId = customer.id;
            await db.query('UPDATE tenants SET stripe_customer_id = ? WHERE id = ?', [stripeCustomerId, tenantId]);
        }

        const isYearly = billing_cycle === 'yearly';
        const amount = isYearly
            ? parseFloat(plan.price_yearly || plan.price_monthly * 10)
            : parseFloat(plan.price_monthly);

        // Usar stripe_price_id si esta configurado, sino generar price_data dinamico
        const stripePresetPriceId = isYearly ? plan.stripe_price_id_yearly : plan.stripe_price_id;

        let lineItem;
        if (stripePresetPriceId) {
            lineItem = { price: stripePresetPriceId, quantity: 1 };
        } else {
            // price_data dinamico — funciona sin necesidad de configurar prices en el dashboard de Stripe
            lineItem = {
                price_data: {
                    currency: 'mxn',
                    product_data: {
                        name: `${plan.name} - SySaaS`,
                        description: `Plan ${plan.name} (${isYearly ? 'Anual' : 'Mensual'}) - Hasta ${plan.max_branches === 99 ? 'ilimitadas' : plan.max_branches} sucursales, ${plan.max_users === 999 ? 'ilimitados' : plan.max_users} usuarios`
                    },
                    unit_amount: Math.round(amount * 100), // Stripe requiere centavos
                    recurring: {
                        interval: isYearly ? 'year' : 'month',
                        interval_count: 1
                    }
                },
                quantity: 1
            };
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [lineItem],
            mode: 'subscription',
            success_url: `${frontendUrl}/admin/suscripcion?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/admin/suscripcion?canceled=true`,
            subscription_data: {
                metadata: {
                    tenant_id: String(tenantId),
                    plan_id: String(plan.id),
                    plan_slug: plan.slug,
                    billing_cycle
                }
            },
            metadata: {
                tenant_id: String(tenantId),
                plan_id: String(plan.id),
                plan_slug: plan.slug,
                billing_cycle
            }
        });

        res.json({ id: session.id, url: session.url });
    } catch (error) {
        console.error('[STRIPE] Error al crear checkout session:', error);
        res.status(500).json({ message: 'Error al contactar con la pasarela de pagos.' });
    }
};

// Verificar sesion de Stripe al regresar del checkout (success_url)
exports.verifyCheckoutSession = async (req, res) => {
    try {
        const stripe = getStripe();
        if (!stripe) {
            return res.status(503).json({ message: 'Stripe no esta configurado.' });
        }

        const { session_id } = req.body;
        if (!session_id) {
            return res.status(400).json({ message: 'session_id es obligatorio.' });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ['subscription']
        });

        if (session.payment_status !== 'paid' && session.status !== 'complete') {
            return res.status(400).json({ message: 'El pago aun no esta confirmado.', status: session.status });
        }

        const tenantId = session.metadata.tenant_id;
        const planId = session.metadata.plan_id;
        const billingCycle = session.metadata.billing_cycle || 'monthly';

        if (!tenantId || !planId) {
            return res.status(400).json({ message: 'Metadatos de sesion incompletos.' });
        }

        const subscription = session.subscription;
        const stripeSubscriptionId = typeof subscription === 'string' ? subscription : subscription?.id;
        const currentPeriodEnd = typeof subscription === 'object' && subscription?.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : (() => {
                const d = new Date();
                d.setMonth(d.getMonth() + (billingCycle === 'yearly' ? 12 : 1));
                return d;
            })();

        await db.query(
            `UPDATE tenants
             SET plan_id = ?,
                 subscription_status = 'active',
                 stripe_subscription_id = ?,
                 subscription_expires_at = ?,
                 trial_ends_at = NULL
             WHERE id = ?`,
            [planId, stripeSubscriptionId || null, currentPeriodEnd, tenantId]
        );

        // Registrar pago en historial
        if (session.amount_total) {
            await db.query(
                `INSERT INTO subscription_payments (tenant_id, stripe_payment_id, stripe_invoice_id, amount, currency, status, description, period_start, period_end)
                 VALUES (?, ?, ?, ?, 'mxn', 'succeeded', ?, CURDATE(), ?)`,
                [
                    tenantId,
                    session.payment_intent || null,
                    session.invoice || null,
                    session.amount_total / 100,
                    `Plan activado via Checkout (${billingCycle})`,
                    currentPeriodEnd
                ]
            );
        }

        // Retornar datos actualizados del tenant
        const [updatedTenant] = await db.query(
            `SELECT t.*, sp.name as plan_name, sp.slug as plan_slug, sp.features as plan_features,
                    sp.max_branches, sp.max_users, sp.max_monthly_repairs
             FROM tenants t JOIN saas_plans sp ON t.plan_id = sp.id WHERE t.id = ?`,
            [tenantId]
        );

        res.json({
            message: 'Suscripcion activada exitosamente.',
            tenant: updatedTenant[0] || null,
            subscription_id: stripeSubscriptionId
        });
    } catch (error) {
        console.error('[STRIPE] Error al verificar sesion:', error);
        res.status(500).json({ message: 'Error al verificar el pago con Stripe.' });
    }
};

// Crear Customer Portal Session (Autoservicio de suscripcion en Stripe)
exports.createPortalSession = async (req, res) => {
    try {
        const stripe = getStripe();
        if (!stripe) {
            return res.status(503).json({ message: 'La integracion con Stripe no esta configurada.' });
        }

        const tenantId = req.tenantCtx.tenantId;
        const [tenants] = await db.query('SELECT stripe_customer_id FROM tenants WHERE id = ?', [tenantId]);

        if (tenants.length === 0 || !tenants[0].stripe_customer_id) {
            return res.status(400).json({ message: 'No tienes una cuenta de facturacion activa en Stripe.' });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const session = await stripe.billingPortal.sessions.create({
            customer: tenants[0].stripe_customer_id,
            return_url: `${frontendUrl}/admin/suscripcion`
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('[STRIPE] Error al crear portal session:', error);
        res.status(500).json({ message: 'Error al redirigir al portal de Stripe.' });
    }
};

// Webhook seguro de Stripe (firma verificada)
exports.handleWebhook = async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
        return res.status(503).send('Stripe no esta configurado.');
    }

    const sig = req.headers['stripe-signature'];
    const rawBody = req.rawBody || req.body;

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.warn('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET no esta configurado. Omitiendo verificacion de firma.');
        return res.json({ received: true, warning: 'sin_verificacion_firma' });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`[STRIPE WEBHOOK ERROR]: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        const obj = event.data.object;

        // Pago del checkout completado
        if (event.type === 'checkout.session.completed') {
            const tenantId = obj.metadata?.tenant_id;
            const planId = obj.metadata?.plan_id;
            const billingCycle = obj.metadata?.billing_cycle || 'monthly';
            const stripeSubscriptionId = obj.subscription;

            if (tenantId && planId) {
                let expiresAt = null;
                if (stripeSubscriptionId) {
                    try {
                        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
                        expiresAt = new Date(sub.current_period_end * 1000);
                    } catch (e) {
                        expiresAt = new Date();
                        expiresAt.setMonth(expiresAt.getMonth() + (billingCycle === 'yearly' ? 12 : 1));
                    }
                }

                await db.query(
                    `UPDATE tenants
                     SET plan_id = ?, subscription_status = 'active',
                         stripe_subscription_id = ?, subscription_expires_at = ?,
                         trial_ends_at = NULL
                     WHERE id = ?`,
                    [planId, stripeSubscriptionId || null, expiresAt, tenantId]
                );

                if (obj.amount_total) {
                    await db.query(
                        `INSERT INTO subscription_payments (tenant_id, stripe_payment_id, stripe_invoice_id, amount, currency, status, description)
                         VALUES (?, ?, ?, ?, 'mxn', 'succeeded', ?)`,
                        [tenantId, obj.payment_intent || null, obj.invoice || null, obj.amount_total / 100, `Checkout completado - Plan ID ${planId}`]
                    );
                }

                console.log(`[STRIPE] Suscripcion activada para tenant ID: ${tenantId}`);
            }
        }

        // Renovacion mensual/anual exitosa
        if (event.type === 'invoice.payment_succeeded') {
            const stripeSubscriptionId = obj.subscription;
            if (stripeSubscriptionId) {
                let expiresAt = null;
                try {
                    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
                    expiresAt = new Date(sub.current_period_end * 1000);
                } catch (e) {
                    expiresAt = new Date();
                    expiresAt.setMonth(expiresAt.getMonth() + 1);
                }

                await db.query(
                    `UPDATE tenants SET subscription_status = 'active', subscription_expires_at = ?
                     WHERE stripe_subscription_id = ?`,
                    [expiresAt, stripeSubscriptionId]
                );

                // Buscar tenant para registrar el pago
                const [ts] = await db.query('SELECT id FROM tenants WHERE stripe_subscription_id = ?', [stripeSubscriptionId]);
                if (ts.length > 0 && obj.amount_paid) {
                    await db.query(
                        `INSERT INTO subscription_payments (tenant_id, stripe_payment_id, stripe_invoice_id, amount, currency, status, description)
                         VALUES (?, ?, ?, ?, 'mxn', 'succeeded', 'Renovacion automatica de suscripcion')`,
                        [ts[0].id, obj.payment_intent || null, obj.id || null, obj.amount_paid / 100]
                    );
                }

                console.log(`[STRIPE] Renovacion aplicada a suscripcion: ${stripeSubscriptionId}`);
            }
        }

        // Pago fallido
        if (event.type === 'invoice.payment_failed') {
            const stripeSubscriptionId = obj.subscription;
            if (stripeSubscriptionId) {
                await db.query(
                    `UPDATE tenants SET subscription_status = 'past_due' WHERE stripe_subscription_id = ?`,
                    [stripeSubscriptionId]
                );
                console.warn(`[STRIPE] Pago fallido. Estado past_due para suscripcion: ${stripeSubscriptionId}`);
            }
        }

        // Suscripcion cancelada
        if (event.type === 'customer.subscription.deleted') {
            const stripeSubscriptionId = obj.id;
            await db.query(
                `UPDATE tenants SET subscription_status = 'canceled', subscription_expires_at = NOW()
                 WHERE stripe_subscription_id = ?`,
                [stripeSubscriptionId]
            );
            console.log(`[STRIPE] Suscripcion cancelada: ${stripeSubscriptionId}`);
        }

        // Suscripcion actualizada (upgrade/downgrade)
        if (event.type === 'customer.subscription.updated') {
            const stripeSubscriptionId = obj.id;
            const expiresAt = obj.current_period_end ? new Date(obj.current_period_end * 1000) : null;
            const newStatus = obj.status === 'active' ? 'active' : (obj.status === 'past_due' ? 'past_due' : 'canceled');

            await db.query(
                `UPDATE tenants SET subscription_status = ?, subscription_expires_at = ?
                 WHERE stripe_subscription_id = ?`,
                [newStatus, expiresAt, stripeSubscriptionId]
            );
        }

        res.json({ received: true });
    } catch (error) {
        console.error('[STRIPE WEBHOOK HANDLER ERROR]:', error);
        res.status(500).json({ message: 'Error procesando evento.' });
    }
};

// Activar plan directamente sin Stripe (modo interno / soporte)
exports.subscribePlan = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const { plan_id, billing_cycle = 'monthly' } = req.body;

        if (!plan_id) {
            return res.status(400).json({ message: 'El plan_id es obligatorio.' });
        }

        const [plans] = await db.query('SELECT * FROM saas_plans WHERE id = ? AND is_active = 1', [plan_id]);
        if (plans.length === 0) {
            return res.status(404).json({ message: 'Plan de suscripcion no encontrado.' });
        }
        const plan = plans[0];

        const days = billing_cycle === 'yearly' ? 365 : 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        await db.query(
            `UPDATE tenants
             SET plan_id = ?, subscription_status = 'active',
                 subscription_expires_at = ?, trial_ends_at = NULL
             WHERE id = ?`,
            [plan.id, expiresAt, tenantId]
        );

        res.json({
            message: `Suscripcion al plan "${plan.name}" activada exitosamente.`,
            tenant: {
                plan_id: plan.id,
                plan_name: plan.name,
                subscription_status: 'active',
                subscription_expires_at: expiresAt,
                max_branches: plan.max_branches,
                max_users: plan.max_users
            }
        });
    } catch (error) {
        console.error('[BILLING] Error al activar suscripcion:', error);
        res.status(500).json({ message: 'Error al procesar la activacion de la suscripcion.' });
    }
};
