const db = require('../config/database');

// =====================================================
// Categorías de productos (SaaS Scoped)
// =====================================================
exports.getCategories = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const [categories] = await db.query(
            'SELECT * FROM product_categories WHERE tenant_id = ? AND is_active = TRUE ORDER BY name',
            [tenantId]
        );
        res.json(categories);
    } catch (error) {
        console.error('[INVENTORY] Error al obtener categorías:', error);
        res.status(500).json({ message: 'Error al obtener categorías.' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, description, color } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        if (!name) return res.status(400).json({ message: 'El nombre es obligatorio.' });

        const [result] = await db.query(
            'INSERT INTO product_categories (tenant_id, name, description, color) VALUES (?, ?, ?, ?)',
            [tenantId, name, description || null, color || '#6366f1']
        );
        res.status(201).json({ id: result.insertId, message: 'Categoría creada.' });
    } catch (error) {
        console.error('[INVENTORY] Error al crear categoría:', error);
        res.status(500).json({ message: 'Error al crear categoría.' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, color, is_active } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        const [result] = await db.query(
            'UPDATE product_categories SET name = ?, description = ?, color = ?, is_active = ? WHERE id = ? AND tenant_id = ?',
            [name, description, color, is_active !== undefined ? is_active : true, id, tenantId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Categoría no encontrada o no pertenece a tu empresa.' });
        }

        res.json({ message: 'Categoría actualizada.' });
    } catch (error) {
        console.error('[INVENTORY] Error al actualizar categoría:', error);
        res.status(500).json({ message: 'Error al actualizar categoría.' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [result] = await db.query(
            'UPDATE product_categories SET is_active = FALSE WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Categoría no encontrada.' });
        }

        res.json({ message: 'Categoría eliminada.' });
    } catch (error) {
        console.error('[INVENTORY] Error al eliminar categoría:', error);
        res.status(500).json({ message: 'Error al eliminar categoría.' });
    }
};


// =====================================================
// Productos (SaaS & Multi-Branch Scoped)
// =====================================================
exports.getProducts = async (req, res) => {
    try {
        const { category_id, search, low_stock, branch_id: filterBranchId, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        const tenantId = req.tenantCtx.tenantId;
        const activeBranchId = req.tenantCtx.branchId;

        const isAdmin = ['tenant_admin', 'admin', 'superadmin'].includes(req.user.role);
        const isAllBranches = isAdmin && filterBranchId === 'all';
        const branchId = (isAdmin && filterBranchId && filterBranchId !== 'all') 
            ? parseInt(filterBranchId, 10) 
            : activeBranchId;

        let query = `
            SELECT p.*, pc.name as category_name, pc.color as category_color,
                   COALESCE(bi.stock, 0) as stock, COALESCE(bi.min_stock, p.min_stock) as min_stock,
                   bi.location_in_store
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = ?
            WHERE p.tenant_id = ? AND p.is_active = TRUE
        `;
        const params = [branchId, tenantId];

        if (category_id) {
            query += ' AND p.category_id = ?';
            params.push(category_id);
        }
        if (search) {
            query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term);
        }
        if (low_stock === 'true') {
            query += ' AND (p.is_unique IS FALSE OR p.is_unique = 0) AND COALESCE(bi.stock, 0) <= COALESCE(bi.min_stock, p.min_stock) AND COALESCE(bi.stock, 0) > 0';
        }

        query += ' ORDER BY p.name ASC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [products] = await db.query(query, params);

        // Obtener desglose de stock de los productos en todas las sucursales de la empresa
        if (products.length > 0) {
            const productIds = products.map(p => p.id);
            const [allBranchStocks] = await db.query(`
                SELECT 
                    bi.product_id,
                    b.id as branch_id,
                    b.name as branch_name,
                    b.code as branch_code,
                    b.is_main,
                    COALESCE(bi.stock, 0) as stock,
                    COALESCE(bi.min_stock, 0) as min_stock
                FROM branches b
                JOIN products p ON p.id IN (?)
                LEFT JOIN branch_inventory bi ON bi.branch_id = b.id AND bi.product_id = p.id
                WHERE b.tenant_id = ? AND b.is_active = TRUE
                ORDER BY b.is_main DESC, b.name ASC
            `, [productIds, tenantId]);

            // Mapear por product_id
            const stockMap = {};
            for (const row of allBranchStocks) {
                if (!stockMap[row.product_id]) {
                    stockMap[row.product_id] = [];
                }
                stockMap[row.product_id].push({
                    branch_id: row.branch_id,
                    branch_name: row.branch_name,
                    branch_code: row.branch_code,
                    is_main: !!row.is_main,
                    stock: parseInt(row.stock || 0, 10),
                    min_stock: parseInt(row.min_stock || 0, 10)
                });
            }

            // Adjuntar datos enriquecidos a cada producto
            products.forEach(p => {
                const bStock = stockMap[p.id] || [];
                p.branches_stock = bStock;
                p.other_branches_stock = bStock.filter(bs => bs.branch_id !== branchId);
                p.other_branches_total = p.other_branches_stock.reduce((sum, bs) => sum + bs.stock, 0);
                p.total_company_stock = bStock.reduce((sum, bs) => sum + bs.stock, 0);
            });
        }

        // Contar total
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM products p
            LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = ?
            WHERE p.tenant_id = ? AND p.is_active = TRUE
        `;
        const countParams = [branchId, tenantId];

        if (category_id) {
            countQuery += ' AND p.category_id = ?';
            countParams.push(category_id);
        }
        if (search) {
            countQuery += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
            const term = `%${search}%`;
            countParams.push(term, term, term);
        }
        if (low_stock === 'true') {
            countQuery += ' AND COALESCE(bi.stock, 0) <= COALESCE(bi.min_stock, p.min_stock)';
        }
        const [countResult] = await db.query(countQuery, countParams);

        res.json({
            products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('[INVENTORY] Error al obtener productos:', error);
        res.status(500).json({ message: 'Error al obtener productos.' });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        const [products] = await db.query(
            `SELECT p.*, pc.name as category_name, pc.color as category_color,
                    COALESCE(bi.stock, 0) as stock, COALESCE(bi.min_stock, p.min_stock) as min_stock,
                    bi.location_in_store
             FROM products p
             LEFT JOIN product_categories pc ON p.category_id = pc.id
             LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = ?
             WHERE p.id = ? AND p.tenant_id = ?`,
            [branchId, id, tenantId]
        );
        if (products.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado.' });
        }

        const product = products[0];

        // Obtener stock en todas las sucursales
        const [allBranchStocks] = await db.query(`
            SELECT 
                b.id as branch_id,
                b.name as branch_name,
                b.code as branch_code,
                b.is_main,
                COALESCE(bi.stock, 0) as stock,
                COALESCE(bi.min_stock, 0) as min_stock
            FROM branches b
            LEFT JOIN branch_inventory bi ON bi.branch_id = b.id AND bi.product_id = ?
            WHERE b.tenant_id = ? AND b.is_active = TRUE
            ORDER BY b.is_main DESC, b.name ASC
        `, [id, tenantId]);

        product.branches_stock = allBranchStocks.map(bs => ({
            branch_id: bs.branch_id,
            branch_name: bs.branch_name,
            branch_code: bs.branch_code,
            is_main: !!bs.is_main,
            stock: parseInt(bs.stock || 0, 10),
            min_stock: parseInt(bs.min_stock || 0, 10)
        }));
        product.other_branches_stock = product.branches_stock.filter(bs => bs.branch_id !== branchId);
        product.other_branches_total = product.other_branches_stock.reduce((sum, bs) => sum + bs.stock, 0);
        product.total_company_stock = product.branches_stock.reduce((sum, bs) => sum + bs.stock, 0);

        res.json(product);
    } catch (error) {
        console.error('[INVENTORY] Error al obtener producto:', error);
        res.status(500).json({ message: 'Error al obtener producto.' });
    }
};

exports.createProduct = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { sku, barcode, name, description, category_id, purchase_price, sale_price, stock, min_stock, is_unique, location_in_store, image_url, target_branch_id } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const isAdmin = ['tenant_admin', 'admin', 'superadmin', 'branch_manager'].includes(req.user.role);
        const branchId = (isAdmin && target_branch_id) ? parseInt(target_branch_id, 10) : req.tenantCtx.branchId;

        if (!name || !sale_price) {
            return res.status(400).json({ message: 'Nombre y precio de venta son obligatorios.' });
        }

        // Restricción de plan: Fotografías de productos exclusivas para Pro y Enterprise
        const planSlug = (req.tenantCtx?.tenant?.plan_slug || req.tenantCtx?.tenant?.plan_name || '').toLowerCase();
        const isPhotoPlanAllowed = 
            ['pro', 'enterprise'].some(p => planSlug.includes(p)) || 
            (req.tenantCtx?.tenant?.plan_id && Number(req.tenantCtx.tenant.plan_id) >= 2);

        if (image_url && typeof image_url === 'string' && image_url.trim() !== '' && !isPhotoPlanAllowed) {
            await connection.rollback();
            return res.status(403).json({
                message: 'La subida de fotografías de productos está reservada para los planes Pro y Enterprise.'
            });
        }

        // Generar SKU automático si no se proporciona
        const finalSku = sku || `PRD-${Date.now().toString(36).toUpperCase()}`;

        // Generar Código de Barras automático si no se proporciona
        const finalBarcode = barcode || Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');

        // 1. Insertar el producto base
        const [result] = await connection.query(
            `INSERT INTO products (tenant_id, sku, barcode, name, description, category_id, purchase_price, sale_price, stock, min_stock, is_unique, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tenantId, finalSku, finalBarcode, name, description || null, category_id || null,
             purchase_price || 0, sale_price, stock || 0, min_stock || 5, is_unique ? 1 : 0, image_url || null]
        );

        const newProductId = result.insertId;

        // 2. Crear registro de stock para la sucursal asignada
        await connection.query(
            `INSERT INTO branch_inventory (product_id, branch_id, stock, min_stock, location_in_store)
             VALUES (?, ?, ?, ?, ?)`,
            [newProductId, branchId, stock || 0, min_stock || 5, location_in_store || null]
        );

        // 3. Registrar movimiento de stock inicial si hay stock
        if (stock && stock > 0) {
            await connection.query(
                `INSERT INTO stock_movements (tenant_id, branch_id, product_id, type, quantity, reference, notes, created_by)
                 VALUES (?, ?, ?, 'in', ?, 'INITIAL', 'Stock inicial', ?)`,
                [tenantId, branchId, newProductId, stock, req.user.id]
            );
        }

        await connection.commit();
        res.status(201).json({ id: newProductId, sku: finalSku, message: 'Producto creado exitosamente.' });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'El SKU o código de barras ya existe.' });
        }
        console.error('[INVENTORY] Error al crear producto:', error);
        res.status(500).json({ message: 'Error al crear producto.' });
    } finally {
        connection.release();
    }
};

exports.updateProduct = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { sku, barcode, name, description, category_id, purchase_price, sale_price, stock, min_stock, is_unique, location_in_store, image_url, target_branch_id } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const isAdmin = ['tenant_admin', 'admin', 'superadmin', 'branch_manager'].includes(req.user.role);
        const branchId = (isAdmin && target_branch_id) ? parseInt(target_branch_id, 10) : req.tenantCtx.branchId;

        // Restricción de plan: Fotografías de productos exclusivas para Pro y Enterprise
        const planSlug = (req.tenantCtx?.tenant?.plan_slug || req.tenantCtx?.tenant?.plan_name || '').toLowerCase();
        const isPhotoPlanAllowed = 
            ['pro', 'enterprise'].some(p => planSlug.includes(p)) || 
            (req.tenantCtx?.tenant?.plan_id && Number(req.tenantCtx.tenant.plan_id) >= 2);

        if (image_url && typeof image_url === 'string' && image_url.trim() !== '' && !isPhotoPlanAllowed) {
            await connection.rollback();
            return res.status(403).json({
                message: 'La subida de fotografías de productos está reservada para los planes Pro y Enterprise.'
            });
        }

        // Obtener stock actual de esta sucursal
        const [existing] = await connection.query(
            'SELECT stock FROM branch_inventory WHERE product_id = ? AND branch_id = ?', 
            [id, branchId]
        );
        
        let oldStock = 0;
        let existsInBranch = false;
        if (existing.length > 0) {
            oldStock = existing[0].stock;
            existsInBranch = true;
        }

        // Actualizar datos del producto base
        const [prodResult] = await connection.query(
            `UPDATE products SET sku = ?, barcode = ?, name = ?, description = ?, category_id = ?,
             purchase_price = ?, sale_price = ?, is_unique = ?, image_url = ? WHERE id = ? AND tenant_id = ?`,
            [sku, barcode || null, name, description || null, category_id || null,
             purchase_price || 0, sale_price, is_unique ? 1 : 0, image_url !== undefined ? image_url : null, id, tenantId]
        );

        if (prodResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Producto no encontrado o no pertenece a tu empresa.' });
        }

        // Actualizar o insertar el stock por sucursal
        if (existsInBranch) {
            await connection.query(
                `UPDATE branch_inventory SET stock = ?, min_stock = ?, location_in_store = ?
                 WHERE product_id = ? AND branch_id = ?`,
                [stock, min_stock || 5, location_in_store || null, id, branchId]
            );
        } else {
            await connection.query(
                `INSERT INTO branch_inventory (product_id, branch_id, stock, min_stock, location_in_store)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, branchId, stock || 0, min_stock || 5, location_in_store || null]
            );
        }

        // Registrar movimiento si cambió el stock
        if (stock !== undefined && stock !== oldStock) {
            const diff = stock - oldStock;
            await connection.query(
                `INSERT INTO stock_movements (tenant_id, branch_id, product_id, type, quantity, reference, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, 'ADJUSTMENT', ?, ?)`,
                [tenantId, branchId, id, diff > 0 ? 'in' : 'adjustment', Math.abs(diff),
                 `Ajuste manual: ${oldStock} → ${stock}`, req.user.id]
            );
        }

        await connection.commit();
        res.json({ message: 'Producto actualizado exitosamente.' });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'El SKU o código de barras ya existe.' });
        }
        console.error('[INVENTORY] Error al actualizar producto:', error);
        res.status(500).json({ message: 'Error al actualizar producto.' });
    } finally {
        connection.release();
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [result] = await db.query(
            'UPDATE products SET is_active = FALSE WHERE id = ? AND tenant_id = ?', 
            [id, tenantId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado.' });
        }

        res.json({ message: 'Producto desactivado.' });
    } catch (error) {
        console.error('[INVENTORY] Error al eliminar producto:', error);
        res.status(500).json({ message: 'Error al eliminar producto.' });
    }
};

// =====================================================
// Acciones en lote (Bulk Actions)
// =====================================================
exports.bulkDeleteProducts = async (req, res) => {
    try {
        const { product_ids } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
            return res.status(400).json({ message: 'No se enviaron productos para eliminar.' });
        }

        await db.query(
            'UPDATE products SET is_active = FALSE WHERE id IN (?) AND tenant_id = ?',
            [product_ids, tenantId]
        );

        res.json({ message: `${product_ids.length} producto(s) desactivado(s) exitosamente.` });
    } catch (error) {
        console.error('[INVENTORY] Error en bulkDelete:', error);
        res.status(500).json({ message: 'Error al eliminar productos en lote.' });
    }
};

exports.bulkUpdateCategory = async (req, res) => {
    try {
        const { product_ids, category_id } = req.body;
        const tenantId = req.tenantCtx.tenantId;

        if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
            return res.status(400).json({ message: 'No se enviaron productos.' });
        }

        await db.query(
            'UPDATE products SET category_id = ? WHERE id IN (?) AND tenant_id = ?',
            [category_id || null, product_ids, tenantId]
        );

        res.json({ message: `Categoría actualizada para ${product_ids.length} producto(s).` });
    } catch (error) {
        console.error('[INVENTORY] Error en bulkUpdateCategory:', error);
        res.status(500).json({ message: 'Error al actualizar categoría en lote.' });
    }
};

// =====================================================
// Stock Movements (SaaS & Multi-Branch)
// =====================================================
exports.addStockMovement = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { product_id, type, quantity, reference, notes, target_branch_id } = req.body;
        const tenantId = req.tenantCtx.tenantId;
        const isAdmin = ['tenant_admin', 'admin', 'superadmin', 'branch_manager'].includes(req.user.role);
        const branchId = (isAdmin && target_branch_id) ? parseInt(target_branch_id, 10) : req.tenantCtx.branchId;

        if (!product_id || !type || !quantity) {
            return res.status(400).json({ message: 'Producto, tipo y cantidad son obligatorios.' });
        }

        // Verificar que el producto pertenece al tenant
        const [prodCheck] = await connection.query('SELECT id FROM products WHERE id = ? AND tenant_id = ?', [product_id, tenantId]);
        if (prodCheck.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Producto no encontrado.' });
        }

        // Asegurar que exista registro de stock en branch_inventory
        const [existing] = await connection.query(
            'SELECT stock FROM branch_inventory WHERE product_id = ? AND branch_id = ?',
            [product_id, branchId]
        );

        const operator = type === 'in' ? '+' : '-';
        if (existing.length > 0) {
            await connection.query(
                `UPDATE branch_inventory SET stock = stock ${operator} ? WHERE product_id = ? AND branch_id = ?`,
                [Math.abs(quantity), product_id, branchId]
            );
        } else {
            const initialStock = type === 'in' ? Math.abs(quantity) : -Math.abs(quantity);
            await connection.query(
                `INSERT INTO branch_inventory (product_id, branch_id, stock) VALUES (?, ?, ?)`,
                [product_id, branchId, initialStock]
            );
        }

        // Registrar el movimiento de stock
        await connection.query(
            `INSERT INTO stock_movements (tenant_id, branch_id, product_id, type, quantity, reference, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [tenantId, branchId, product_id, type, Math.abs(quantity), reference || null, notes || null, req.user.id]
        );

        await connection.commit();
        res.status(201).json({ message: 'Movimiento de stock registrado.' });
    } catch (error) {
        await connection.rollback();
        console.error('[INVENTORY] Error al agregar movimiento:', error);
        res.status(500).json({ message: 'Error al registrar movimiento de stock.' });
    } finally {
        connection.release();
    }
};

exports.getStockMovements = async (req, res) => {
    try {
        const { product_id, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        let query = `
            SELECT sm.*, p.name as product_name, p.sku,
                   u.first_name, u.last_name
            FROM stock_movements sm
            LEFT JOIN products p ON sm.product_id = p.id
            LEFT JOIN users u ON sm.created_by = u.id
            WHERE sm.tenant_id = ? AND sm.branch_id = ?
        `;
        const params = [tenantId, branchId];

        if (product_id) {
            query += ' AND sm.product_id = ?';
            params.push(product_id);
        }

        query += ' ORDER BY sm.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [movements] = await db.query(query, params);
        res.json(movements);
    } catch (error) {
        console.error('[INVENTORY] Error al obtener movimientos:', error);
        res.status(500).json({ message: 'Error al obtener movimientos de stock.' });
    }
};

exports.getProductMovements = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantCtx.tenantId;

        const [movements] = await db.query(`
            SELECT sm.*, b.name as branch_name, b.code as branch_code,
                   u.first_name, u.last_name
            FROM stock_movements sm
            JOIN branches b ON sm.branch_id = b.id
            LEFT JOIN users u ON sm.created_by = u.id
            WHERE sm.product_id = ? AND sm.tenant_id = ?
            ORDER BY sm.created_at DESC
            LIMIT 100
        `, [id, tenantId]);

        res.json(movements);
    } catch (error) {
        console.error('[INVENTORY] Error al obtener movimientos del producto:', error);
        res.status(500).json({ message: 'Error al obtener historial de movimientos.' });
    }
};

// =====================================================
// Estadísticas de inventario
// =====================================================
exports.getInventoryStats = async (req, res) => {
    try {
        const tenantId = req.tenantCtx.tenantId;
        const branchId = req.tenantCtx.branchId;

        const [totalProducts] = await db.query(
            'SELECT COUNT(*) as count FROM products WHERE tenant_id = ? AND is_active = TRUE',
            [tenantId]
        );
        
        const [lowStock] = await db.query(
            `SELECT COUNT(*) as count 
             FROM products p
             LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = ?
             WHERE p.tenant_id = ? AND p.is_active = TRUE 
             AND (p.is_unique IS FALSE OR p.is_unique = 0)
             AND COALESCE(bi.stock, 0) <= COALESCE(bi.min_stock, p.min_stock)
             AND COALESCE(bi.stock, 0) > 0`,
            [branchId, tenantId]
        );
        
        const [outOfStock] = await db.query(
            `SELECT COUNT(*) as count 
             FROM products p
             LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = ?
             WHERE p.tenant_id = ? AND p.is_active = TRUE 
             AND (p.is_unique IS FALSE OR p.is_unique = 0)
             AND COALESCE(bi.stock, 0) = 0`,
            [branchId, tenantId]
        );
        
        const [totalValue] = await db.query(
            `SELECT SUM(COALESCE(bi.stock, 0) * p.sale_price) as value 
             FROM products p
             JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = ?
             WHERE p.tenant_id = ? AND p.is_active = TRUE`,
            [branchId, tenantId]
        );

        res.json({
            totalProducts: totalProducts[0].count,
            lowStockCount: lowStock[0].count,
            outOfStockCount: outOfStock[0].count,
            totalInventoryValue: totalValue[0].value || 0
        });
    } catch (error) {
        console.error('[INVENTORY] Error al obtener estadísticas:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas de inventario.' });
    }
};
