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

    const value = {
        user,
        loading,
        error,
        isAuthenticated: !!user,
        isSuperAdmin: user?.role === 'superadmin',
        isTenantAdmin: user?.role === 'tenant_admin' || user?.role === 'superadmin',
        isAdmin: ['admin', 'tenant_admin', 'branch_manager', 'superadmin'].includes(user?.role),
        isBranchManager: user?.role === 'branch_manager',
        isTechnician: user?.role === 'technician',
        isCashier: user?.role === 'cashier',
        isClient: user?.role === 'client',
        login,
        register,
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
