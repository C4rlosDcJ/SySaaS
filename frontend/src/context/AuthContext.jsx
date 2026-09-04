import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import { useTenant } from './TenantContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { setTenantData, clearTenantData } = useTenant();

    // Verificar sesión al cargar
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            checkAuth();
        } else {
            setLoading(false);
        }
    }, []);

    const checkAuth = async () => {
        try {
            const userData = await authService.getMe();
            setUser({
                id: userData.id,
                email: userData.email,
                first_name: userData.first_name,
                last_name: userData.last_name,
                phone: userData.phone,
                role: userData.role,
                tenant_id: userData.tenant_id,
                branch_id: userData.branch_id
            });
            if (userData.tenant) {
                setTenantData(userData.tenant, userData.branches, userData.default_branch_id);
            }
        } catch {
            localStorage.removeItem('token');
            localStorage.removeItem('activeBranchId');
            setUser(null);
            clearTenantData();
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            setError(null);
            const response = await authService.login({ email, password });
            localStorage.setItem('token', response.token);
            setUser(response.user);
            
            if (response.tenant) {
                setTenantData(response.tenant, response.branches, response.default_branch_id);
            } else {
                clearTenantData();
            }

            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const register = async (userData) => {
        try {
            setError(null);
            const response = await authService.register(userData);
            localStorage.setItem('token', response.token);
            setUser(response.user);
            
            if (response.tenant) {
                setTenantData(response.tenant, response.branches, response.default_branch_id);
            } else {
                clearTenantData();
            }

            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('activeBranchId');
        setUser(null);
        clearTenantData();
    };

    const updateProfile = async (data) => {
        try {
            await authService.updateProfile(data);
            setUser(prev => ({ ...prev, ...data }));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const registerCompany = async (companyData) => {
        try {
            setError(null);
            const response = await authService.registerCompany(companyData);
            localStorage.setItem('token', response.token);
            setUser(response.user);
            
            if (response.tenant) {
                setTenantData(response.tenant, response.branches, response.default_branch_id);
            } else {
                clearTenantData();
            }

            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const impersonateTenant = async (tenantId) => {
        try {
            setError(null);
            // Guardar token original de SuperAdmin para poder regresar
            const originalToken = localStorage.getItem('token');
            localStorage.setItem('superadmin_token', originalToken);
            
            const response = await authService.impersonateTenant(tenantId);
            localStorage.setItem('token', response.token);
            setUser(response.user);
            
            if (response.tenant) {
                setTenantData(response.tenant, response.branches, response.default_branch_id);
            } else {
                clearTenantData();
            }

            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const exitImpersonation = async () => {
        try {
            const superadminToken = localStorage.getItem('superadmin_token');
            if (!superadminToken) {
                throw new Error('No se encontro sesion de SuperAdmin para restaurar.');
            }
            localStorage.setItem('token', superadminToken);
            localStorage.removeItem('superadmin_token');
            clearTenantData();
            await checkAuth();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const isImpersonating = !!localStorage.getItem('superadmin_token');

    const value = {
        user,
        loading,
        error,
        isAuthenticated: !!user,
        isSuperAdmin: user?.role === 'superadmin',
        isTenantAdmin: user?.role === 'tenant_admin' || user?.role === 'admin' || user?.role === 'superadmin',
        isAdmin: ['admin', 'tenant_admin', 'branch_manager', 'superadmin', 'technician', 'salesperson', 'cashier'].includes(user?.role),
        isStaff: ['admin', 'tenant_admin', 'branch_manager', 'superadmin', 'technician', 'salesperson', 'cashier'].includes(user?.role),
        isBranchManager: user?.role === 'branch_manager',
        isTechnician: user?.role === 'technician',
        isSalesperson: user?.role === 'salesperson',
        isCashier: user?.role === 'cashier' || user?.role === 'salesperson',
        isClient: user?.role === 'client',
        isImpersonating,
        login,
        register,
        registerCompany,
        impersonateTenant,
        exitImpersonation,
        logout,
        updateProfile,
        checkAuth
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider');
    }
    return context;
}


export default AuthContext;
