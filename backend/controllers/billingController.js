const db = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Crear Checkout Session (TenantAdmin inicia la compra/suscripcion)
exports.createCheckoutSession = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const { plan_slug } = req.body;

        if (!plan_slug) {
            return res.status(400).json({ message: 'El plan_slug es obligatorio.' });
        }

        // Obtener plan de la base de datos
        const [plans] = await db.query('SELECT * FROM saas_plans WHERE slug = ?', [plan_slug]);
        if (plans.length === 0) {
            return res.status(400).json({ message: 'Plan de suscripción no válido.' });
        }
        const plan = plans[0];

        // Obtener datos del tenant
        const [tenants] = await db.query('SELECT company_name, stripe_customer_id FROM tenants WHERE id = ?', [tenantId]);
        if (tenants.length === 0) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }
        let stripeCustomerId = tenants[0].stripe_customer_id;

        // Si el tenant no tiene customer id de Stripe, lo creamos
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: tenants[0].company_name,
                metadata: { tenant_id: tenantId }
            });
            stripeCustomerId = customer.id;
            await db.query('UPDATE tenants SET stripe_customer_id = ? WHERE id = ?', [stripeCustomerId, tenantId]);
        }

        // Crear la sesion en Stripe
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: plan.stripe_price_id,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/suscripcion?success=true`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/suscripcion?canceled=true`,
            metadata: {
                tenant_id: tenantId.toString(),
                plan_id: plan.id.toString(),
                plan_slug: plan.slug
            }
        });

        res.json({ id: session.id, url: session.url });
    } catch (error) {
        console.error('[STRIPE] Error al crear checkout session:', error);
        res.status(500).json({ message: 'Error al contactar con la pasarela de pagos.' });
    }
};

// Crear Customer Portal Session (Para que autogestionen su suscripcion en Stripe)
exports.createPortalSession = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;

        const [tenants] = await db.query('SELECT stripe_customer_id FROM tenants WHERE id = ?', [tenantId]);
        if (tenants.length === 0 || !tenants[0].stripe_customer_id) {
            return res.status(400).json({ message: 'No tienes una cuenta de facturación activa.' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: tenants[0].stripe_customer_id,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/suscripcion`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('[STRIPE] Error al crear portal session:', error);
        res.status(500).json({ message: 'Error al redirigir al portal de Stripe.' });
    }
};

// Webhook seguro de Stripe
exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`[STRIPE WEBHOOK ERROR]: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        const session = event.data.object;

        if (event.type === 'checkout.session.completed') {
            const tenantId = session.metadata.tenant_id;
            const planId = session.metadata.plan_id;
            const stripeSubscriptionId = session.subscription;

            // Actualizar tenant con datos de suscripcion de Stripe
            const subscriptionDetail = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            const expiresAt = new Date(subscriptionDetail.current_period_end * 1000);

            await db.query(
                `UPDATE tenants 
                 SET plan_id = ?, 
                     subscription_status = 'active', 
                     stripe_subscription_id = ?, 
                     subscription_expires_at = ?,
                     trial_ends_at = NULL
                 WHERE id = ?`,
                [planId, stripeSubscriptionId, expiresAt, tenantId]
            );
            console.log(`[STRIPE] Suscripción activada para el tenant ID: ${tenantId}`);
        }

        if (event.type === 'invoice.payment_succeeded') {
            // El cobro recurrente fue exitoso, extender periodo
            const stripeSubscriptionId = session.subscription;
            if (stripeSubscriptionId) {
                const subscriptionDetail = await stripe.subscriptions.retrieve(stripeSubscriptionId);
                const expiresAt = new Date(subscriptionDetail.current_period_end * 1000);

                await db.query(
                    `UPDATE tenants 
                     SET subscription_status = 'active', 
                         subscription_expires_at = ?
                     WHERE stripe_subscription_id = ?`,
                    [expiresAt, stripeSubscriptionId]
                );
                console.log(`[STRIPE] Factura pagada. Renovación aplicada a suscripción: ${stripeSubscriptionId}`);
            }
        }

        if (event.type === 'invoice.payment_failed') {
            // Pago fallido
            const stripeSubscriptionId = session.subscription;
            if (stripeSubscriptionId) {
                await db.query(
                    `UPDATE tenants SET subscription_status = 'past_due' WHERE stripe_subscription_id = ?`,
                    [stripeSubscriptionId]
                );
                console.warn(`[STRIPE] Pago fallido. Estado past_due para suscripción: ${stripeSubscriptionId}`);
            }
        }

        if (event.type === 'customer.subscription.deleted') {
            // Suscripción cancelada
            const stripeSubscriptionId = session.id;
            await db.query(
                `UPDATE tenants 
                 SET subscription_status = 'canceled', 
                     subscription_expires_at = NOW() 
                 WHERE stripe_subscription_id = ?`,
                [stripeSubscriptionId]
            );
            console.log(`[STRIPE] Suscripción cancelada: ${stripeSubscriptionId}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('[STRIPE WEBHOOK HANDLER ERROR]:', error);
        res.status(500).json({ message: 'Error procesando evento.' });
    }
};
