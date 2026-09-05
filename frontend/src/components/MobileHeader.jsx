import { useState, useEffect } from 'react';
import { Menu, X, Wrench, Shield } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { getImageUrl, publicService } from '../services/api';
import './MobileHeader.css';

export default function MobileHeader({ isOpen, toggleMenu }) {
    const { businessLogo, businessName } = useTheme();
    const { tenant } = useTenant();
    const { isSuperAdmin, isImpersonating } = useAuth();
    const [platformName, setPlatformName] = useState(() => localStorage.getItem('platform_name') || 'SySaaS');
    const [platformLogo, setPlatformLogo] = useState(() => localStorage.getItem('platform_logo') || '');

    useEffect(() => {
        if (isSuperAdmin) {
            publicService.getPlatformInfo()
                .then(info => {
                    if (info?.platform_name) setPlatformName(info.platform_name);
                    if (info?.platform_logo !== undefined) setPlatformLogo(info.platform_logo);
                })
                .catch(() => {});
        }
    }, [isSuperAdmin]);

    const currentName = (isSuperAdmin && !isImpersonating)
        ? platformName
        : (tenant?.company_name || 'Mi Empresa');

    const currentLogo = (isSuperAdmin && !isImpersonating)
        ? platformLogo
        : (tenant?.logo_url || '');

    const renderBusinessName = () => {
        const name = currentName;
        if (name.includes('-')) {
            const parts = name.split('-');
            return <>{parts[0]}<span className="text-primary">-{parts.slice(1).join('-')}</span></>;
        }
        if (name.includes(' ')) {
            const parts = name.split(' ');
            return <>{parts[0]} <span className="text-primary">{parts.slice(1).join(' ')}</span></>;
        }
        return <>{name}</>;
    };

    return (
        <header className="mobile-header">
            <div className="mobile-header-left">
                <button
                    className="menu-toggle-btn"
                    onClick={toggleMenu}
                    aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
                >
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <div className="mobile-logo">
                    {currentLogo ? (
                        <img 
                            src={getImageUrl(currentLogo)} 
                            alt="Logo" 
                            className="logo-img-mobile" 
                            style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: 'var(--logo-radius, 6px)' }} 
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    ) : (isSuperAdmin && !isImpersonating) ? (
                        <Shield size={20} className="logo-icon text-primary" />
                    ) : (
                        <Wrench size={20} className="logo-icon" />
                    )}
                    <span className="logo-text">{renderBusinessName()}</span>
                </div>
            </div>
            <div className="mobile-header-right">
                {/* Posibilidad de añadir notificaciones o perfil aquí en el futuro */}
            </div>
        </header>
    );
}
