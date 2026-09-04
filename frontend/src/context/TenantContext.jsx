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
        
        const branchIds = (branchList || []).map(b => b.id);
        if (defaultBranchId && branchIds.includes(defaultBranchId)) {
            updateActiveBranch(defaultBranchId);
        } else if (branchIds.length > 0) {
            const currentStored = localStorage.getItem('activeBranchId');
            const parsedStored = currentStored ? parseInt(currentStored, 10) : null;
            if (parsedStored && branchIds.includes(parsedStored)) {
                updateActiveBranch(parsedStored);
            } else {
                updateActiveBranch(branchIds[0]);
            }
        } else {
            updateActiveBranch(null);
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

    const setBranchesList = (branchList) => {
        setBranches(branchList || []);
        const branchIds = (branchList || []).map(b => b.id);
        if (branchIds.length > 0 && (!activeBranchId || !branchIds.includes(activeBranchId))) {
            updateActiveBranch(branchIds[0]);
        }
    };

    const updateTenantInfo = (partialData) => {
        setTenant(prev => prev ? ({ ...prev, ...partialData }) : partialData);
    };

    const value = {
        tenant,
        branches,
        activeBranchId,
        activeBranch: branches.find(b => b.id === activeBranchId) || null,
        setTenantData,
        updateActiveBranch,
        setBranchesList,
        updateTenantInfo,
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
