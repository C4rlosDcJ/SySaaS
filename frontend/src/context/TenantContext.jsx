import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
    const [tenant, setTenant] = useState(null);
    const [branches, setBranches] = useState([]);
    const [activeBranchId, setActiveBranchId] = useState(() => {
        const cached = localStorage.getItem('activeBranchId');
        return cached ? parseInt(cached, 10) : null;
    });

    const setTenantData = (tenantData, branchList, defaultBranchId) => {
        setTenant(tenantData);
        setBranches(branchList || []);
        
        // Si no hay branch activa o la guardada no está en la lista del tenant, reestablecer
        const branchIds = (branchList || []).map(b => b.id);
        if (defaultBranchId && !activeBranchId) {
            updateActiveBranch(defaultBranchId);
        } else if (activeBranchId && !branchIds.includes(activeBranchId)) {
            if (branchIds.length > 0) {
                updateActiveBranch(branchIds[0]);
            } else {
                updateActiveBranch(null);
            }
        }
    };

    const updateActiveBranch = (branchId) => {
        if (branchId) {
            localStorage.setItem('activeBranchId', branchId.toString());
            setActiveBranchId(branchId);
        } else {
            localStorage.removeItem('activeBranchId');
            setActiveBranchId(null);
        }
    };

    const clearTenantData = () => {
        setTenant(null);
        setBranches([]);
        updateActiveBranch(null);
    };

    const value = {
        tenant,
        branches,
        activeBranchId,
        activeBranch: branches.find(b => b.id === activeBranchId) || null,
        setTenantData,
        updateActiveBranch,
        clearTenantData
    };

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenant() {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant debe usarse dentro de un TenantProvider');
    }
    return context;
}
