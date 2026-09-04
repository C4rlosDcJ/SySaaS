const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
export const BACKEND_URL = API_URL.replace('/api', '');

// Helper para resolver URLs de imágenes estáticas
export const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
        return path;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${BACKEND_URL}${cleanPath}`;
};

// Helper para hacer peticiones
async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const activeBranchId = localStorage.getItem('activeBranchId');

    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(activeBranchId && { 'X-Branch-ID': activeBranchId }),
            ...options.headers,
        },
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('activeBranchId');
        window.location.href = '/login';
        throw new Error('Sesión expirada');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Error en la petición');
    }

    return data;
}

// Auth Service
export const authService = {
    registerCompany: (companyData) => fetchAPI('/auth/register-company', {
        method: 'POST',
        body: JSON.stringify(companyData)
    }),

    register: (userData) => fetchAPI('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
    }),

    login: (credentials) => fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
    }),

    getMe: () => fetchAPI('/auth/me'),

    updateProfile: (data) => fetchAPI('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
    }),

    impersonateTenant: (tenant_id) => fetchAPI('/auth/impersonate-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenant_id })
    }),

    changePassword: (data) => fetchAPI('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify(data)
    }),

    forgotPassword: (email) => fetchAPI('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
    }),

    resetPassword: (token, password) => fetchAPI('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
    })
};

// Repairs Service
export const repairService = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/repairs${query ? `?${query}` : ''}`);
    },

    getById: (id) => fetchAPI(`/repairs/${id}`),

    create: (data) => fetchAPI('/repairs', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    update: (id, data) => fetchAPI(`/repairs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),

    updateStatus: (id, status, notes, estimated_delivery = null, signature = null) => fetchAPI(`/repairs/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, notes, estimated_delivery, signature })
    }),

    addNote: (id, note, isInternal = false) => fetchAPI(`/repairs/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note, is_internal: isInternal })
    }),

    submitReview: (id, rating, reviewText) => fetchAPI(`/repairs/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating, review_text: reviewText })
    }),

    delete: (id) => fetchAPI(`/repairs/${id}`, { method: 'DELETE' }),

    claimWarranty: (id, data) => fetchAPI(`/repairs/${id}/claim-warranty`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
};

// Services Catalog Service
export const servicesCatalogService = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/services${query ? `?${query}` : ''}`);
    },
    getById: (id) => fetchAPI(`/services/${id}`),
    create: (data) => fetchAPI('/services', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    update: (id, data) => fetchAPI(`/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    delete: (id) => fetchAPI(`/services/${id}`, { method: 'DELETE' }),

    getDeviceTypes: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/services/device-types${query ? `?${query}` : ''}`);
    },
    createDeviceType: (data) => fetchAPI('/services/device-types', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateDeviceType: (id, data) => fetchAPI(`/services/device-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    deleteDeviceType: (id) => fetchAPI(`/services/device-types/${id}`, { method: 'DELETE' }),

    getBrands: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/services/brands${query ? `?${query}` : ''}`);
    },
    createBrand: (data) => fetchAPI('/services/brands', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateBrand: (id, data) => fetchAPI(`/services/brands/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    deleteBrand: (id) => fetchAPI(`/services/brands/${id}`, { method: 'DELETE' }),

    formatCurrency: (amount) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount || 0);
    }
};

export const servicesCatalog = servicesCatalogService;


// Customer Service
export const customerService = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/customers${query ? `?${query}` : ''}`);
    },
    getById: (id) => fetchAPI(`/customers/${id}`),
    getRepairs: (id, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/customers/${id}/repairs${query ? `?${query}` : ''}`);
    },
    create: (data) => fetchAPI('/customers', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    update: (id, data) => fetchAPI(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    delete: (id) => fetchAPI(`/customers/${id}`, {
        method: 'DELETE'
    })
};

// User/Staff Service
export const userService = {
    getTechnicians: () => fetchAPI('/auth/technicians'),
    getTenantUsers: () => fetchAPI('/auth/tenant-users'),
    createTenantUser: (data) => fetchAPI('/auth/tenant-users', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateTenantUser: (id, data) => fetchAPI(`/auth/tenant-users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    toggleTenantUserStatus: (id) => fetchAPI(`/auth/tenant-users/${id}/toggle-status`, {
        method: 'PATCH'
    })
};

// Stats Service
export const statsService = {
    getDashboard: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/stats/dashboard${query ? `?${query}` : ''}`);
    },
    getEnterpriseAnalytics: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/stats/analytics${query ? `?${query}` : ''}`);
    },
    getRevenue: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/stats/revenue${query ? `?${query}` : ''}`);
    },
    getTechnicians: () => fetchAPI('/stats/technicians'),
    getTechniciansStats: () => fetchAPI('/stats/technicians'),
    getStats: () => fetchAPI('/pos/sales/stats')
};

// Settings Service
export const settingsService = {
    getAll: () => fetchAPI('/settings'),
    update: (data) => fetchAPI('/settings', {
        method: 'POST',
        body: JSON.stringify(data)
    })
};

// Inventory Service (Admin)
export const inventoryService = {
    getCategories: () => fetchAPI('/inventory/categories'),
    createCategory: (data) => fetchAPI('/inventory/categories', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateCategory: (id, data) => fetchAPI(`/inventory/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    deleteCategory: (id) => fetchAPI(`/inventory/categories/${id}`, { method: 'DELETE' }),

    getProducts: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/inventory/products${query ? `?${query}` : ''}`);
    },
    getProductById: (id) => fetchAPI(`/inventory/products/${id}`),
    createProduct: (data) => fetchAPI('/inventory/products', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateProduct: (id, data) => fetchAPI(`/inventory/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    deleteProduct: (id) => fetchAPI(`/inventory/products/${id}`, { method: 'DELETE' }),

    getStockMovements: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/inventory/stock-movements${query ? `?${query}` : ''}`);
    },
    getProductMovements: (id) => fetchAPI(`/inventory/products/${id}/movements`),
    bulkDelete: (product_ids) => fetchAPI('/inventory/products/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ product_ids })
    }),
    bulkUpdateCategory: (product_ids, category_id) => fetchAPI('/inventory/products/bulk-category', {
        method: 'POST',
        body: JSON.stringify({ product_ids, category_id })
    }),
    addStockMovement: (data) => fetchAPI('/inventory/stock-movements', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    getStats: () => fetchAPI('/inventory/stats')
};

// POS Service (Admin)
export const posService = {
    createSale: (data) => fetchAPI('/pos/sales', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    getSales: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/pos/sales${query ? `?${query}` : ''}`);
    },
    getSaleById: (id) => fetchAPI(`/pos/sales/${id}`),
    cancelSale: (id) => fetchAPI(`/pos/sales/${id}/cancel`, { method: 'PUT' }),
    getSalesStats: () => fetchAPI('/pos/sales/stats'),
    getBillableRepairs: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/pos/repairs/billable${query ? `?${query}` : ''}`);
    },
    getRepairForPOS: (id) => fetchAPI(`/pos/repairs/${id}`)
};

// Upload Service
export const uploadService = {
    upload: (formData) => {
        const token = localStorage.getItem('token');
        const activeBranchId = localStorage.getItem('activeBranchId');
        return fetch(`${API_URL}/uploads`, {
            method: 'POST',
            headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
                ...(activeBranchId && { 'X-Branch-ID': activeBranchId })
            },
            body: formData
        }).then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error al subir archivo');
            return data;
        });
    },
    uploadSingle: (formData) => {
        const token = localStorage.getItem('token');
        const activeBranchId = localStorage.getItem('activeBranchId');
        return fetch(`${API_URL}/uploads/single`, {
            method: 'POST',
            headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
                ...(activeBranchId && { 'X-Branch-ID': activeBranchId })
            },
            body: formData
        }).then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error al subir archivo');
            return data;
        });
    }
};

// Public Service (sin auth)
export const publicService = {
    getPlatformInfo: async () => {
        try {
            const response = await fetch(`${API_URL}/public/platform`);
            const data = await response.json();
            if (!response.ok) return { platform_name: 'SySaaS', support_email: 'soporte@sysaas.com' };
            return data;
        } catch {
            return { platform_name: 'SySaaS', support_email: 'soporte@sysaas.com' };
        }
    },
    trackRepair: async (ticket) => {
        const response = await fetch(`${API_URL}/public/track/${encodeURIComponent(ticket)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al buscar la reparación');
        return data;
    },
    getTheme: async (slug) => {
        const response = await fetch(`${API_URL}/public/theme/${encodeURIComponent(slug)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al obtener la configuración visual');
        return data;
    },
    getCatalogServices: async (slug, params = {}) => {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`${API_URL}/public/catalog/services/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al obtener servicios');
        return data;
    },
    getCatalogProducts: async (slug, params = {}) => {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`${API_URL}/public/catalog/products/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al obtener productos');
        return data;
    },
    getPlans: async () => {
        try {
            const response = await fetch(`${API_URL}/public/plans`);
            const data = await response.json();
            if (!response.ok) return { plans: [] };
            return data;
        } catch {
            return { plans: [] };
        }
    }
};

// Orders Service (authenticated)
export const orderService = {
    create: (data) => fetchAPI('/orders', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/orders${query ? `?${query}` : ''}`);
    },
    getById: (id) => fetchAPI(`/orders/${id}`),
    updateStatus: (id, status) => fetchAPI(`/orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
    }),
    cancel: (id) => fetchAPI(`/orders/${id}/cancel`, { method: 'PUT' }),
    update: (id, data) => fetchAPI(`/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    getStats: () => fetchAPI('/orders/stats')
};

// Search Service (Admin)
export const searchService = {
    globalSearch: (query) => fetchAPI(`/search?q=${encodeURIComponent(query)}`)
};

// AI Service
export const aiService = {
    diagnose: (data) => fetchAPI('/ai/diagnose', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    parseQuote: (description) => fetchAPI('/ai/parse-quote', {
        method: 'POST',
        body: JSON.stringify({ description })
    }),
    improveNote: (note) => fetchAPI('/ai/improve-note', {
        method: 'POST',
        body: JSON.stringify({ note })
    }),
    chat: (message, history) => fetchAPI('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history })
    })
};

// Tenants Service (SaaS Multi-Tenant)
export const tenantService = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/tenants${query ? `?${query}` : ''}`);
    },
    create: (data) => fetchAPI('/tenants', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    getById: (id) => fetchAPI(`/tenants/${id}`),
    update: (id, data) => fetchAPI(`/tenants/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    suspend: (id) => fetchAPI(`/tenants/${id}/suspend`, { method: 'PUT' }),
    activate: (id) => fetchAPI(`/tenants/${id}/activate`, { method: 'PUT' }),
    getMyTenant: () => fetchAPI('/tenants/me'),
    updateMyTenant: (data) => fetchAPI('/tenants/me', {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    getPlans: () => fetchAPI('/tenants/plans'),
    createPlan: (data) => fetchAPI('/tenants/plans', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updatePlan: (id, data) => fetchAPI(`/tenants/plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    extendTrial: (id, days) => fetchAPI(`/tenants/${id}/extend-trial`, {
        method: 'PUT',
        body: JSON.stringify({ days })
    }),
    getAnalytics: () => fetchAPI('/tenants/analytics')
};

// SuperAdmin Analytics & Management Service
export const superAdminService = {
    getStats: () => fetchAPI('/stats/superadmin'),
    getAnalytics: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/stats/superadmin/analytics${query ? `?${query}` : ''}`);
    },
    getAuditLogs: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/stats/audit-logs${query ? `?${query}` : ''}`);
    },
    getTenantDetail: (id) => fetchAPI(`/stats/tenant-detail/${id}`),
    getGlobalUsers: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/tenants/users${query ? `?${query}` : ''}`);
    },
    toggleUserStatus: (id) => fetchAPI(`/tenants/users/${id}/toggle-status`, { method: 'PUT' }),
    resetUserPassword: (id, new_password) => fetchAPI(`/tenants/users/${id}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ new_password })
    }),
    changeTenantPlan: (tenantId, plan_id) => fetchAPI(`/tenants/${tenantId}/change-plan`, {
        method: 'PUT',
        body: JSON.stringify({ plan_id })
    }),
    getGlobalSettings: () => fetchAPI('/settings/global'),
    updateGlobalSettings: (data) => fetchAPI('/settings/global', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    changeCredentials: (data) => fetchAPI('/settings/change-superadmin-password', {
        method: 'POST',
        body: JSON.stringify(data)
    })
};

// Broadcasts Service (Anuncios Globales)
export const broadcastService = {
    getActive: () => fetchAPI('/broadcasts/active'),
    getAll: () => fetchAPI('/broadcasts'),
    create: (data) => fetchAPI('/broadcasts', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    toggleStatus: (id) => fetchAPI(`/broadcasts/${id}/toggle`, { method: 'PUT' })
};

// Branches Service (SaaS Multi-Branch)
export const branchService = {
    getAll: () => fetchAPI('/branches'),
    getBranches: () => fetchAPI('/branches'),
    create: (data) => fetchAPI('/branches', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    update: (id, data) => fetchAPI(`/branches/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    deactivate: (id) => fetchAPI(`/branches/${id}/deactivate`, { method: 'PUT' }),
    assignUser: (id, data) => fetchAPI(`/branches/${id}/assign-user`, {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    removeUser: (id, userId) => fetchAPI(`/branches/${id}/remove-user/${userId}`, { method: 'DELETE' }),
    getUsers: (id) => fetchAPI(`/branches/${id}/users`)
};

// Inventory Transfers Service
export const transferService = {
    getAll: () => fetchAPI('/transfers'),
    create: (data) => fetchAPI('/transfers', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    approve: (id) => fetchAPI(`/transfers/${id}/approve`, { method: 'PUT' }),
    complete: (id) => fetchAPI(`/transfers/${id}/complete`, { method: 'PUT' }),
    cancel: (id) => fetchAPI(`/transfers/${id}/cancel`, { method: 'PUT' })
};

// Supplier & Purchase Orders Service
export const supplierService = {
    getAll: () => fetchAPI('/suppliers'),
    create: (data) => fetchAPI('/suppliers', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    update: (id, data) => fetchAPI(`/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    delete: (id) => fetchAPI(`/suppliers/${id}`, { method: 'DELETE' }),
    getPurchaseOrders: () => fetchAPI('/suppliers/purchase-orders'),
    createPurchaseOrder: (data) => fetchAPI('/suppliers/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    receivePurchaseOrder: (id) => fetchAPI(`/suppliers/purchase-orders/${id}/receive`, { method: 'PUT' })
};

// Coupon & Discounts Service
export const couponService = {
    getAll: () => fetchAPI('/coupons'),
    create: (data) => fetchAPI('/coupons', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    toggleStatus: (id) => fetchAPI(`/coupons/${id}/toggle`, { method: 'PATCH' }),
    validate: (data) => fetchAPI('/coupons/validate', {
        method: 'POST',
        body: JSON.stringify(data)
    })
};

// ML Analytics Service (Scikit-Learn Python Backend)
export const analyticsService = {
    getForecast: () => fetchAPI('/analytics/forecast'),
    getCustomerSegmentation: () => fetchAPI('/analytics/customers-segmentation'),
    getChartPng: () => fetchAPI('/analytics/chart-png')
};

// Billing & Subscription Service
export const billingService = {
    createCheckoutSession: (plan_slug, billing_cycle = 'monthly') => fetchAPI('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan_slug, billing_cycle })
    }),
    verifySession: (session_id) => fetchAPI('/billing/verify-session', {
        method: 'POST',
        body: JSON.stringify({ session_id })
    }),
    createPortalSession: () => fetchAPI('/billing/portal', {
        method: 'POST'
    }),
    subscribePlan: (data) => fetchAPI('/billing/subscribe-plan', {
        method: 'POST',
        body: JSON.stringify(data)
    })
};

export default {
    auth: authService,
    repairs: repairService,
    services: servicesCatalogService,
    customers: customerService,
    stats: statsService,
    settings: settingsService,
    uploads: uploadService,
    inventory: inventoryService,
    pos: posService,
    public: publicService,
    search: searchService,
    ai: aiService,
    orders: orderService,
    tenants: tenantService,
    branches: branchService,
    transfers: transferService,
    suppliers: supplierService,
    coupons: couponService,
    broadcasts: broadcastService,
    analytics: analyticsService,
    billing: billingService
};
