/**
 * Utilidad de almacenamiento de borradores en localStorage
 * Aislado por tenant (empresa) y branch (sucursal)
 */

function getStorageKey(moduleKey, tenantId, branchId) {
    const tId = tenantId !== undefined && tenantId !== null ? tenantId : 'global';
    const bId = branchId !== undefined && branchId !== null ? branchId : 'main';
    return `sysaas_draft_${moduleKey}_t${tId}_b${bId}`;
}

export const draftStorage = {
    /**
     * Guarda el borrador del modulo actual
     */
    saveDraft: (moduleKey, data, tenantId, branchId) => {
        try {
            if (!data) return;
            const key = getStorageKey(moduleKey, tenantId, branchId);
            const payload = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.warn('[DRAFT_STORAGE] Error al guardar borrador:', error);
        }
    },

    /**
     * Carga el borrador del modulo actual
     * @param {string} moduleKey - Clave del modulo (ej. 'new_repair', 'pos')
     * @param {number|string} tenantId - ID del tenant
     * @param {number|string} branchId - ID de la sucursal
     * @param {number} maxAgeDays - Dias maximos de validez (por defecto 7)
     * @returns {any|null}
     */
    loadDraft: (moduleKey, tenantId, branchId, maxAgeDays = 7) => {
        try {
            const key = getStorageKey(moduleKey, tenantId, branchId);
            const raw = localStorage.getItem(key);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;

            // Verificar antiguedad
            if (parsed.timestamp) {
                const ageMs = Date.now() - parsed.timestamp;
                const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
                if (ageMs > maxAgeMs) {
                    localStorage.removeItem(key);
                    return null;
                }
            }

            return parsed.data || null;
        } catch (error) {
            console.warn('[DRAFT_STORAGE] Error al recuperar borrador:', error);
            return null;
        }
    },

    /**
     * Elimina el borrador del modulo actual
     */
    clearDraft: (moduleKey, tenantId, branchId) => {
        try {
            const key = getStorageKey(moduleKey, tenantId, branchId);
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('[DRAFT_STORAGE] Error al limpiar borrador:', error);
        }
    }
};

export default draftStorage;
