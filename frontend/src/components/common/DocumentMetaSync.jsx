import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useTheme } from '../../context/ThemeContext';
import { publicService, getImageUrl } from '../../services/api';

const ROUTE_TITLES = {
    '/': 'Inicio',
    '/login': 'Iniciar Sesión',
    '/register': 'Registro de Empresa',
    '/rastrear': 'Rastreo de Reparación',
    '/recuperar-password': 'Recuperar Contraseña',
    '/tienda': 'Catálogo de Productos',

    // SuperAdmin
    '/superadmin': 'Panel SuperAdmin',
    '/superadmin/dashboard': 'Panel SuperAdmin',
    '/superadmin/reportes': 'Reportes Globales',
    '/superadmin/empresas': 'Empresas SaaS',
    '/superadmin/usuarios': 'Usuarios Globales',
    '/superadmin/planes': 'Planes de Suscripción',
    '/superadmin/anuncios': 'Anuncios Globales',
    '/superadmin/auditoria': 'Auditoría Global',
    '/superadmin/configuracion': 'Configuración de Plataforma',

    // Tenant Admin / Staff
    '/dashboard': 'Dashboard',
    '/reparaciones': 'Reparaciones',
    '/nueva-reparacion': 'Nueva Reparación',
    '/clientes': 'Directorio de Clientes',
    '/servicios': 'Catálogo de Servicios',
    '/reportes': 'Análisis & Reportes',
    '/configuracion': 'Configuración',
    '/pos': 'Punto de Venta',
    '/inventario': 'Inventario & Stock',
    '/ventas': 'Historial de Ventas',
    '/ordenes': 'Gestión de Pedidos',
    '/proveedores': 'Proveedores & OC',
    '/cupones': 'Cupones de Descuento',
    '/sucursales': 'Sucursales',
    '/traslados': 'Traslados de Stock',
    '/usuarios': 'Usuarios y Permisos',
    '/suscripcion': 'Mi Suscripción',

    // Client Portal
    '/portal': 'Mi Panel de Cliente',
    '/portal/cotizar': 'Nueva Solicitud',
    '/portal/reparaciones': 'Mis Reparaciones',
    '/portal/perfil': 'Mi Perfil',
    '/portal/tienda': 'Tienda de Productos',
    '/portal/pedidos': 'Mis Pedidos',
    '/portal/pagos': 'Mis Pagos'
};

export default function DocumentMetaSync() {
    const location = useLocation();
    const { user, isSuperAdmin, isImpersonating } = useAuth();
    const { tenant } = useTenant();
    const { businessName, businessLogo } = useTheme();

    const [platformInfo, setPlatformInfo] = useState(() => ({
        platform_name: localStorage.getItem('platform_name') || 'SySaaS',
        platform_logo: localStorage.getItem('platform_logo') || ''
    }));

    // Cargar info de plataforma
    useEffect(() => {
        publicService.getPlatformInfo()
            .then(info => {
                if (info?.platform_name || info?.platform_logo !== undefined) {
                    setPlatformInfo({
                        platform_name: info.platform_name || 'SySaaS',
                        platform_logo: info.platform_logo || ''
                    });
                    if (info.platform_name) localStorage.setItem('platform_name', info.platform_name);
                    if (info.platform_logo) localStorage.setItem('platform_logo', info.platform_logo);
                }
            })
            .catch(() => {});
    }, [location.pathname]);

    useEffect(() => {
        const isSuperAdminRoute = location.pathname.startsWith('/superadmin');
        const isSuperAdminUser = isSuperAdmin && !isImpersonating;

        // 1. Determinar el nombre de la entidad (Plataforma vs Empresa)
        let brandName = platformInfo.platform_name || 'SySaaS';
        let brandLogo = platformInfo.platform_logo || '';

        if (!isSuperAdminRoute && !isSuperAdminUser && (tenant?.company_name || user)) {
            // Contexto de empresa / tenant
            brandName = tenant?.company_name || businessName || 'Mi Empresa';
            brandLogo = tenant?.logo_url || businessLogo || platformInfo.platform_logo;
        }

        // 2. Actualizar document.title exclusivamente con el nombre correspondiente
        document.title = brandName;

        // 4. Actualizar Favicon dinámicamente
        if (brandLogo) {
            const resolvedFaviconUrl = getImageUrl(brandLogo);
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = resolvedFaviconUrl;
        }
    }, [location.pathname, isSuperAdmin, isImpersonating, tenant, businessName, businessLogo, platformInfo, user]);

    return null;
}
