const db = require('../config/database');

// Listar cupones del tenant
exports.getCoupons = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const [coupons] = await db.query(
            'SELECT * FROM coupons WHERE tenant_id = ? ORDER BY created_at DESC',
            [tenantId]
        );
        res.json(coupons);
    } catch (error) {
        console.error('[COUPONS] Error al obtener cupones:', error);
        res.status(500).json({ message: 'Error al obtener cupones.' });
    }
};

// Crear cupón
exports.createCoupon = async (req, res) => {
    try {
        const { code, discount_type, discount_value, min_purchase, max_uses, expires_at } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        if (!code || !discount_value) {
            return res.status(400).json({ message: 'El código y el valor del descuento son requeridos.' });
        }

        const cleanCode = code.trim().toUpperCase();

        const [existing] = await db.query(
            'SELECT id FROM coupons WHERE tenant_id = ? AND code = ?',
            [tenantId, cleanCode]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Ya existe un cupón con este código en tu empresa.' });
        }

        const [result] = await db.query(`
            INSERT INTO coupons (tenant_id, code, discount_type, discount_value, min_purchase, max_uses, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            tenantId,
            cleanCode,
            discount_type || 'percentage',
            parseFloat(discount_value) || 0,
            parseFloat(min_purchase) || 0,
            max_uses ? parseInt(max_uses) : null,
            expires_at || null
        ]);

        res.status(201).json({ id: result.insertId, code: cleanCode, message: 'Cupón creado exitosamente.' });
    } catch (error) {
        console.error('[COUPONS] Error al crear cupón:', error);
        res.status(500).json({ message: 'Error al crear el cupón.' });
    }
};

// Desactivar / Activar cupón
exports.toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [coupons] = await db.query('SELECT id, is_active FROM coupons WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (coupons.length === 0) {
            return res.status(404).json({ message: 'Cupón no encontrado.' });
        }

        const newStatus = !coupons[0].is_active;
        await db.query('UPDATE coupons SET is_active = ? WHERE id = ? AND tenant_id = ?', [newStatus, id, tenantId]);

        res.json({ message: `Cupón ${newStatus ? 'activado' : 'desactivado'}.` });
    } catch (error) {
        console.error('[COUPONS] Error al cambiar estado del cupón:', error);
        res.status(500).json({ message: 'Error al actualizar cupón.' });
    }
};

// Validar cupón en tiempo real (usado en el POS o cotizaciones)
exports.validateCoupon = async (req, res) => {
    try {
        const { code, cart_subtotal } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        if (!code) {
            return res.status(400).json({ message: 'Código de cupón requerido.' });
        }

        const cleanCode = code.trim().toUpperCase();

        const [coupons] = await db.query(
            'SELECT * FROM coupons WHERE tenant_id = ? AND code = ? AND is_active = TRUE',
            [tenantId, cleanCode]
        );

        if (coupons.length === 0) {
            return res.status(404).json({ message: 'El cupón no es válido o ha expirado.' });
        }

        const coupon = coupons[0];

        // Validar expiración
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return res.status(400).json({ message: 'El cupón ha expirado.' });
        }

        // Validar usos máximos
        if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
            return res.status(400).json({ message: 'El cupón ha alcanzado el límite máximo de usos.' });
        }

        // Validar compra mínima
        const subtotal = parseFloat(cart_subtotal) || 0;
        if (coupon.min_purchase > 0 && subtotal < coupon.min_purchase) {
            return res.status(400).json({
                message: `El cupón requiere una compra mínima de $${parseFloat(coupon.min_purchase).toFixed(2)}.`
            });
        }

        // Calcular descuento
        let discountAmount = 0;
        if (coupon.discount_type === 'percentage') {
            discountAmount = subtotal * (parseFloat(coupon.discount_value) / 100);
        } else {
            discountAmount = parseFloat(coupon.discount_value);
        }

        res.json({
            valid: true,
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            calculated_discount: Math.min(discountAmount, subtotal)
        });
    } catch (error) {
        console.error('[COUPONS] Error al validar cupón:', error);
        res.status(500).json({ message: 'Error al validar cupón.' });
    }
};
