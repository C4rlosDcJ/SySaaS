import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const AlertContext = createContext(null);

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert debe usarse dentro de un AlertProvider');
    }
    return context;
};

export const AlertProvider = ({ children }) => {
    const [alertConfig, setAlertConfig] = useState(null);

    const showAlert = useCallback(({ title, text, icon = 'info', confirmText = 'Aceptar', showCancel = false, cancelText = 'Cancelar', onConfirm, onCancel }) => {
        setAlertConfig({
            title,
            text,
            icon,
            confirmText,
            showCancel,
            cancelText,
            onConfirm: () => {
                setAlertConfig(null);
                if (onConfirm) onConfirm();
            },
            onCancel: () => {
                setAlertConfig(null);
                if (onCancel) onCancel();
            }
        });
    }, []);

    const closeAlert = useCallback(() => {
        setAlertConfig(null);
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, closeAlert }}>
            {children}
            {alertConfig && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'var(--color-bg-card, #1e1e1e)',
                        color: 'var(--color-text, #ffffff)',
                        border: '1px solid var(--color-border, #333333)',
                        borderRadius: '16px',
                        padding: '28px',
                        width: '100%',
                        maxWidth: '420px',
                        textAlign: 'center',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
                        position: 'relative'
                    }}>
                        {/* Icon */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
                            {alertConfig.icon === 'success' && (
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCircle2 size={32} />
                                </div>
                            )}
                            {alertConfig.icon === 'error' && (
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <AlertCircle size={32} />
                                </div>
                            )}
                            {alertConfig.icon === 'warning' && (
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <AlertCircle size={32} />
                                </div>
                            )}
                            {alertConfig.icon === 'info' && (
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Info size={32} />
                                </div>
                            )}
                        </div>

                        {/* Title & Text */}
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 700 }}>{alertConfig.title}</h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--color-text-secondary, #a0a0a0)', lineHeight: 1.5 }}>{alertConfig.text}</p>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            {alertConfig.showCancel && (
                                <button
                                    onClick={alertConfig.onCancel}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--color-border, #333)',
                                        background: 'transparent',
                                        color: 'var(--color-text, #fff)',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        flex: 1
                                    }}
                                >
                                    {alertConfig.cancelText}
                                </button>
                            )}
                            <button
                                onClick={alertConfig.onConfirm}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: alertConfig.icon === 'error' ? '#ef4444' : (alertConfig.icon === 'warning' ? '#f59e0b' : 'var(--color-primary, #3b82f6)'),
                                    color: '#ffffff',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    flex: 1
                                }}
                            >
                                {alertConfig.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AlertContext.Provider>
    );
};
