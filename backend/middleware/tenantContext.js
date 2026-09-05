const db = require('../config/database');

/**
 * Middleware de Contexto Multi-Tenant
 * 
 * Se ejecuta DESPUES de auth.js. Lee el tenant_id del usuario autenticado
 * y la sucursal activa de la cabecera X-Branch-ID.
 * 
 * Inyecta req.tenantCtx con:
 *   - tenantId: ID de la empresa
 *   - branchId: ID de la sucursal activa
 *   - tenant: objeto completo del tenant
 *   - planFeatures: features del plan del tenant
 */
const tenantContext = async (req, res, next) => {
    try {
        // Si es SuperAdmin, verificar si especifica un tenant mediante cabecera X-Tenant-ID
        let tenantId = req.user.tenant_id;
        if (req.user.role === 'superadmin') {
            const explicitTenantId = req.headers['x-tenant-id'] ? parseInt(req.headers['x-tenant-id'], 10) : null;
            if (explicitTenantId) {
                tenantId = explicitTenantId;
            } else if (!tenantId) {
                req.tenantCtx = {
                    tenantId: null,
                    branchId: null,
                    tenant: null,
                    planFeatures: null,
                    isSuperAdmin: true
                };
                return next();
            }
        }

        if (!tenantId) {
            return res.status(403).json({ 
                message: 'Usuario sin empresa asignada. Contacta al administrador.' 
            });
        }

        // Obtener datos del tenant con su plan
        const [tenants] = await db.query(
            `SELECT t.*, sp.name as plan_name, sp.slug as plan_slug,
                    sp.max_branches, sp.max_users, sp.max_monthly_repairs, sp.features as plan_features
             FROM tenants t
             JOIN saas_plans sp ON t.plan_id = sp.id
             WHERE t.id = ?`,
            [tenantId]
        );

        if (tenants.length === 0) {
            return res.status(403).json({ 
                message: 'Empresa no encontrada.' 
            });
        }

        const tenant = tenants[0];

        // Parsear features del plan
        let planFeatures = {};
        try {
            planFeatures = typeof tenant.plan_features === 'string' 
                ? JSON.parse(tenant.plan_features) 
                : (tenant.plan_features || {});
        } catch (e) {
            planFeatures = {};
        }

        // Determinar branch_id activa
        let branchId = null;

        // 1. Prioridad: cabecera X-Branch-ID del request
        const headerBranchId = req.headers['x-branch-id'];
        if (headerBranchId) {
            branchId = parseInt(headerBranchId, 10);
        }

        // 2. Fallback para clientes: usar su branch_id directo de la tabla users
        if (!branchId && req.user.role === 'client') {
            branchId = req.user.branch_id;
        }

        // 3. Fallback para staff: buscar su sucursal por defecto en user_branch_assignments
        if (!branchId && req.user.role !== 'client') {
            const [defaults] = await db.query(
                `SELECT branch_id FROM user_branch_assignments 
                 WHERE user_id = ? AND is_default = TRUE LIMIT 1`,
                [req.user.id]
            );
            if (defaults.length > 0) {
                branchId = defaults[0].branch_id;
            } else {
                // Si no tiene default, buscar cualquier sucursal asignada
                const [anyBranch] = await db.query(
                    `SELECT branch_id FROM user_branch_assignments 
                     WHERE user_id = ? LIMIT 1`,
                    [req.user.id]
                );
                if (anyBranch.length > 0) {
                    branchId = anyBranch[0].branch_id;
                }
            }
        }

        // 4. Ultimo fallback: sucursal principal del tenant
        if (!branchId) {
            const [mainBranch] = await db.query(
                `SELECT id FROM branches WHERE tenant_id = ? AND is_main = TRUE AND is_active = TRUE LIMIT 1`,
                [tenantId]
            );
            if (mainBranch.length > 0) {
                branchId = mainBranch[0].id;
            }
        }

        // Validar que la sucursal pertenezca al tenant (o auto-corregir a la sucursal matriz)
        if (branchId) {
            const [branchCheck] = await db.query(
                `SELECT id FROM branches WHERE id = ? AND tenant_id = ? AND is_active = TRUE`,
                [branchId, tenantId]
            );
            if (branchCheck.length === 0) {
                const [mainBranch] = await db.query(
                    `SELECT id FROM branches WHERE tenant_id = ? AND is_main = TRUE AND is_active = TRUE LIMIT 1`,
                    [tenantId]
                );
                branchId = mainBranch.length > 0 ? mainBranch[0].id : null;
            }
        }

        // Validar que el staff no administrador tenga acceso a la sucursal
        const isGlobalAdmin = ['tenant_admin', 'admin', 'superadmin'].includes(req.user.role);
        const isAssignedDirectly = req.user.branch_id === branchId;

        if (branchId && req.user.role !== 'client' && !isGlobalAdmin && !isAssignedDirectly) {
            const [access] = await db.query(
                `SELECT id FROM user_branch_assignments 
                 WHERE user_id = ? AND branch_id = ?`,
                [req.user.id, branchId]
            );
            if (access.length === 0) {
                return res.status(403).json({ 
                    message: 'No tienes acceso a esta sucursal.' 
                });
            }
        }

        // Inyectar contexto en el request
        req.tenantCtx = {
            tenantId,
            branchId,
            tenant,
            planFeatures,
            planLimits: {
                maxBranches: tenant.max_branches,
                maxUsers: tenant.max_users,
                maxMonthlyRepairs: tenant.max_monthly_repairs
            },
            isSuperAdmin: false
        };

        next();
    } catch (error) {
        console.error('[TENANT-CTX] Error en middleware de contexto:', error.message);
        res.status(500).json({ message: 'Error al resolver contexto de empresa.' });
    }
};

module.exports = tenantContext;
