import { useState, useEffect } from 'react';
import { settingsService, uploadService, getImageUrl } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useTenant } from '../../context/TenantContext';
import { compressImage } from '../../utils/imageCompressor';
import {
    Save,
    RefreshCw,
    Building2,
    Upload,
    Trash2,
    Image,
    Wrench,
    Bell,
    LayoutGrid
} from 'lucide-react';
import { showAlert, showConfirm } from '../../utils/swal';
import './SettingsPage.css';

export default function SettingsPage() {
    const {
        theme,
        borderRadius,
        setBorderRadius,
        logoBorderRadius,
        setLogoBorderRadius,
        companyNameTransform,
        setCompanyNameTransform,
        brandFont,
        setBrandFont,
        setBusinessName,
        setBusinessLogo
    } = useTheme();

    const isDark = theme === 'dark';
    const { tenant, updateTenantInfo } = useTenant();
    // Use only a real numeric tenant id so the effect does not fire before the tenant loads
    const tenantId = tenant?.id ?? null;

    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'repairs' | 'notifications' | 'branding'

    const [settings, setSettings] = useState({
        business_name: tenant?.company_name || 'Sys-Teck',
        tax_id: '',
        contact_email: '',
        contact_phone: '',
        contact_address: '',
        contact_schedule: '',
        currency: 'MXN',
        tax_rate: '16',
        default_warranty_days: '30',
        repair_ticket_prefix: 'REP-',
        ticket_terms_conditions: 'Garantía válida únicamente presentando este comprobante. No aplica por caídas, humedad o manipulación de terceros.',
        ticket_footer_note: 'Gracias por su confianza. Consulte el estado de su orden en línea.',
        notify_email_on_status_change: 'true',
        whatsapp_ready_template: 'Hola {cliente}, tu equipo {modelo} (Folio: {folio}) está listo para entrega en nuestra sucursal. Saludos de {empresa}.',
        business_logo: tenant?.logo_url || ''
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoLoadError, setLogoLoadError] = useState(false);

    // Cargar configuraciones exclusivas de este tenant
    // Only run when we have a real tenant id to prevent fetching with wrong context
    useEffect(() => {
        if (!tenantId) return;
        fetchSettings();
    }, [tenantId]);

    // Sincronizar si tenant cargó de forma asíncrona
    useEffect(() => {
        if (tenant?.logo_url && !settings.business_logo) {
            setSettings(prev => ({
                ...prev,
                business_logo: prev.business_logo || tenant.logo_url
            }));
            setLogoLoadError(false);
        }
    }, [tenant?.logo_url]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const data = await settingsService.getAll();
            if (data) {
                setSettings(prev => ({
                    ...prev,
                    ...data,
                    business_logo: data.business_logo || prev.business_logo || tenant?.logo_url || ''
                }));
                setLogoLoadError(false);
            }
        } catch (error) {
            console.error('Error al cargar configuraciones:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingLogo(true);
            setLogoLoadError(false);

            const compressed = await compressImage(file, { maxWidth: 500, maxHeight: 500, quality: 0.85 });
            const formData = new FormData();
            formData.append('image', compressed);

            const res = await uploadService.uploadSingle(formData);
            if (res?.url) {
                const persistentUrl = res.url;

                // 1. Guardar de forma inmediata en la base de datos para que nunca se pierda
                await settingsService.update({ business_logo: persistentUrl });

                // 2. Actualizar estado local del formulario
                setSettings(prev => ({ ...prev, business_logo: persistentUrl }));

                // 3. Sincronizar contextos globales
                if (updateTenantInfo) {
                    updateTenantInfo({ logo_url: persistentUrl });
                }
                if (setBusinessLogo) {
                    setBusinessLogo(persistentUrl);
                }

                showAlert({
                    title: 'Logotipo Actualizado',
                    text: 'El logotipo de tu empresa se ha subido y guardado exitosamente.',
                    icon: 'success'
                });
            }
        } catch (err) {
            console.error('Error subiendo logo de empresa:', err);
            // Fallback base64
            const reader = new FileReader();
            reader.onload = async (event) => {
                const img = new window.Image();
                img.onload = async () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 250;
                        const MAX_HEIGHT = 250;
                        let width = img.width;
                        let height = img.height;
                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const compressedBase64 = canvas.toDataURL('image/png', 0.8);

                        // Persistir base64 de inmediato en la base de datos
                        await settingsService.update({ business_logo: compressedBase64 });
                        setSettings(prev => ({ ...prev, business_logo: compressedBase64 }));
                        if (updateTenantInfo) {
                            updateTenantInfo({ logo_url: compressedBase64 });
                        }
                        if (setBusinessLogo) {
                            setBusinessLogo(compressedBase64);
                        }

                        showAlert({
                            title: 'Logotipo Actualizado',
                            text: 'El logotipo se ha guardado correctamente.',
                            icon: 'success'
                        });
                    } catch (persistErr) {
                        showAlert({
                            title: 'Error al Guardar Logo',
                            text: persistErr.message || 'No se pudo guardar el logotipo.',
                            icon: 'error'
                        });
                    } finally {
                        setUploadingLogo(false);
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
            return;
        } finally {
            setUploadingLogo(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleRemoveLogo = async () => {
        const confirmed = await showConfirm({
            title: '¿Eliminar Logotipo?',
            text: '¿Estás seguro de que deseas quitar el logotipo de tu empresa?',
            icon: 'warning',
            confirmText: 'Sí, eliminar'
        });
        if (!confirmed) return;

        try {
            setSaving(true);
            // Persistir inmediatamente en BD
            await settingsService.update({ business_logo: '' });
            setSettings(prev => ({ ...prev, business_logo: '' }));
            setLogoLoadError(false);

            if (updateTenantInfo) {
                updateTenantInfo({ logo_url: '' });
            }
            if (setBusinessLogo) {
                setBusinessLogo('');
            }

            showAlert({
                title: 'Logotipo Eliminado',
                text: 'El logotipo ha sido eliminado correctamente.',
                icon: 'info'
            });
        } catch (error) {
            showAlert({
                title: 'Error',
                text: error.message || 'No se pudo eliminar el logotipo.',
                icon: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await settingsService.update({
                ...settings,
                border_radius: borderRadius,
                logo_border_radius: logoBorderRadius,
                company_name_transform: companyNameTransform
            });
            // Only update TenantContext after a successful explicit save by the user.
            // Limit the update to visible branding fields to avoid contaminating other tenant data.
            if (updateTenantInfo) {
                const patch = {};
                if (settings.business_name) patch.company_name = settings.business_name;
                if (settings.business_logo !== undefined) patch.logo_url = settings.business_logo;
                if (Object.keys(patch).length > 0) updateTenantInfo(patch);
            }
            showAlert({
                title: 'Configuración Guardada',
                text: 'Los parámetros y logotipo de tu empresa han sido actualizados con éxito.',
                icon: 'success'
            });
        } catch (error) {
            showAlert({
                title: 'Error al Guardar',
                text: error.message || 'No se pudieron guardar las configuraciones.',
                icon: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="settings-container">
                <main className="dashboard-main">
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Cargando configuraciones de la empresa...</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="settings-container animate-fadeIn" style={{ paddingTop: 'var(--sp-4)' }}>
            
            {/* Header */}
            <header className="settings-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Configuración de Empresa</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
                        Parámetros fiscales, políticas de garantía para tickets y notificaciones a clientes
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSubmit}
                    disabled={saving}
                    style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', padding: '8px 18px', fontWeight: 700 }}
                >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{saving ? 'Guardando...' : 'Guardar Todo'}</span>
                </button>
            </header>

            {/* Barra de Pestañas Tipo Cápsula (Estilo idéntico a botón Guardar Todo) */}
            <div style={{
                display: 'inline-flex',
                gap: '4px',
                marginBottom: '24px',
                background: 'var(--color-bg-card)',
                padding: '5px',
                borderRadius: '9999px',
                border: '1px solid var(--color-border)',
                flexWrap: 'wrap'
            }}>
                {[
                    { id: 'general', label: 'Datos de Empresa', icon: Building2 },
                    { id: 'repairs', label: 'Taller & Tickets', icon: Wrench },
                    { id: 'notifications', label: 'Notificaciones a Clientes', icon: Bell },
                    { id: 'branding', label: 'Identidad & Logo', icon: LayoutGrid }
                ].map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;

                    const activeBg = isDark ? '#ffffff' : '#000000';
                    const activeColor = isDark ? '#000000' : '#ffffff';
                    const inactiveColor = isDark ? '#a1a1aa' : '#71717a';

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '8px 20px',
                                fontSize: '13px',
                                fontWeight: isActive ? 800 : 600,
                                borderRadius: '9999px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: isActive ? activeBg : 'transparent',
                                color: isActive ? activeColor : inactiveColor,
                                boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
                                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                        >
                            <Icon size={15} style={{ color: isActive ? activeColor : inactiveColor }} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            <form onSubmit={handleSubmit}>
                {/* ══════════════════════════════════════════════════════════
                    PESTAÑA 1: DATOS DE EMPRESA
                   ══════════════════════════════════════════════════════════ */}
                {activeTab === 'general' && (
                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Building2 size={18} className="text-primary" /> Información Comercial & Fiscal
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                                Estos datos aparecerán en encabezados de recibos, cotizaciones y órdenes de servicio de tu empresa.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Nombre Comercial de la Empresa
                                </label>
                                <input
                                    type="text"
                                    name="business_name"
                                    value={settings.business_name}
                                    onChange={handleChange}
                                    className="input input-sm"
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    RFC / Identificación Fiscal (Tax ID)
                                </label>
                                <input
                                    type="text"
                                    name="tax_id"
                                    placeholder="XAXX010101000"
                                    value={settings.tax_id || ''}
                                    onChange={handleChange}
                                    className="input input-sm"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Correo de Contacto / Soporte
                                </label>
                                <input
                                    type="email"
                                    name="contact_email"
                                    placeholder="soporte@empresa.com"
                                    value={settings.contact_email}
                                    onChange={handleChange}
                                    className="input input-sm"
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Teléfono Principal de Atención
                                </label>
                                <input
                                    type="text"
                                    name="contact_phone"
                                    placeholder="55 1234 5678"
                                    value={settings.contact_phone}
                                    onChange={handleChange}
                                    className="input input-sm"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Dirección Matriz / Ubicación
                                </label>
                                <input
                                    type="text"
                                    name="contact_address"
                                    placeholder="Av. Principal #123, Ciudad"
                                    value={settings.contact_address || ''}
                                    onChange={handleChange}
                                    className="input input-sm"
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Horario de Servicio
                                </label>
                                <input
                                    type="text"
                                    name="contact_schedule"
                                    placeholder="Lun - Sáb: 9:00 AM - 7:00 PM"
                                    value={settings.contact_schedule || ''}
                                    onChange={handleChange}
                                    className="input input-sm"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Moneda del Sistema
                                </label>
                                <select
                                    name="currency"
                                    value={settings.currency || 'MXN'}
                                    onChange={handleChange}
                                    className="select select-sm"
                                >
                                    <option value="MXN">MXN - Peso Mexicano ($)</option>
                                    <option value="USD">USD - Dólar Estadounidense ($)</option>
                                    <option value="EUR">EUR - Euro (€)</option>
                                    <option value="COP">COP - Peso Colombiano ($)</option>
                                    <option value="CLP">CLP - Peso Chileno ($)</option>
                                    <option value="PEN">PEN - Sol Peruano (S/)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Tasa de Impuesto / IVA (%)
                                </label>
                                <input
                                    type="number"
                                    name="tax_rate"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={settings.tax_rate || '16'}
                                    onChange={handleChange}
                                    className="input input-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    PESTAÑA 2: TALLER & TICKETS
                   ══════════════════════════════════════════════════════════ */}
                {activeTab === 'repairs' && (
                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Wrench size={18} className="text-primary" /> Parámetros de Taller & Impresión
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                                Configura los folios, garantías por defecto y las leyendas legales en tickets de reparación.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Días de Garantía por Defecto
                                </label>
                                <input
                                    type="number"
                                    name="default_warranty_days"
                                    min="0"
                                    value={settings.default_warranty_days}
                                    onChange={handleChange}
                                    className="input input-sm"
                                    required
                                />
                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                                    Plazo asignado automáticamente al entregar una orden.
                                </span>
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Prefijo de Ticket de Orden
                                </label>
                                <input
                                    type="text"
                                    name="repair_ticket_prefix"
                                    placeholder="REP-"
                                    value={settings.repair_ticket_prefix || 'REP-'}
                                    onChange={handleChange}
                                    className="input input-sm"
                                />
                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                                    Ejemplo: REP-000123
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '18px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                Términos & Condiciones Legales (Al reverso/pie de orden)
                            </label>
                            <textarea
                                name="ticket_terms_conditions"
                                rows="3"
                                value={settings.ticket_terms_conditions || ''}
                                onChange={handleChange}
                                className="input"
                                style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                                placeholder="Garantía válida únicamente presentando este comprobante..."
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                Nota de Agradecimiento / Pie de Ticket
                            </label>
                            <input
                                type="text"
                                name="ticket_footer_note"
                                value={settings.ticket_footer_note || ''}
                                onChange={handleChange}
                                className="input input-sm"
                                placeholder="Gracias por su preferencia. Consulte su estado en línea."
                            />
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    PESTAÑA 3: NOTIFICACIONES A CLIENTES
                   ══════════════════════════════════════════════════════════ */}
                {activeTab === 'notifications' && (
                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Bell size={18} className="text-primary" /> Mensajería & Notificaciones Automáticas
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                                Automatiza el contacto con tus clientes cuando su equipo cambie de estado o esté listo para entrega.
                            </p>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                Plantilla de WhatsApp / SMS (Orden Lista para Entrega)
                            </label>
                            <textarea
                                name="whatsapp_ready_template"
                                rows="3"
                                value={settings.whatsapp_ready_template || ''}
                                onChange={handleChange}
                                className="input"
                                style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                                placeholder="Hola {cliente}, tu equipo {modelo} (Folio: {folio}) está listo para entrega..."
                            />
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                                <span className="badge-neutral" style={{ fontSize: '10px' }}>{'{cliente}'} = Nombre del Cliente</span>
                                <span className="badge-neutral" style={{ fontSize: '10px' }}>{'{modelo}'} = Modelo del Dispositivo</span>
                                <span className="badge-neutral" style={{ fontSize: '10px' }}>{'{folio}'} = Folio del Ticket</span>
                                <span className="badge-neutral" style={{ fontSize: '10px' }}>{'{empresa}'} = Nombre de la Empresa</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    PESTAÑA 4: IDENTIDAD & LOGO
                   ══════════════════════════════════════════════════════════ */}
                {activeTab === 'branding' && (
                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <LayoutGrid size={18} className="text-primary" /> Logotipo & Estilo Visual de tu Empresa
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                                Este logotipo pertenece exclusivamente a tu organización y aparecerá en tus tickets y reportes.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                            {/* Logo */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Logotipo de la Empresa
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                                    {uploadingLogo ? (
                                        <div style={{
                                            width: '80px', height: '80px', borderRadius: logoBorderRadius || '12px',
                                            border: '1px solid var(--color-border)', display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center',
                                            background: 'var(--color-bg-tertiary)', gap: '6px',
                                            transition: 'border-radius 0.2s ease'
                                        }}>
                                            <RefreshCw size={20} className="animate-spin text-primary" />
                                            <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Subiendo...</span>
                                        </div>
                                    ) : (settings.business_logo && !logoLoadError) ? (
                                        <div style={{
                                            width: '80px', height: '80px', borderRadius: logoBorderRadius || '12px',
                                            border: '1px solid var(--color-border)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                            background: 'var(--color-bg-tertiary)',
                                            transition: 'border-radius 0.2s ease'
                                        }}>
                                            <img 
                                                src={getImageUrl(settings.business_logo)} 
                                                alt="Logo" 
                                                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: logoBorderRadius || '12px' }} 
                                                onError={() => setLogoLoadError(true)}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{
                                            width: '80px', height: '80px', borderRadius: logoBorderRadius || '12px',
                                            border: '1px dashed var(--color-border)', display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)',
                                            background: 'var(--color-bg-tertiary)', fontSize: '10px', textAlign: 'center', padding: '4px',
                                            transition: 'border-radius 0.2s ease'
                                        }}>
                                            <Image size={28} style={{ marginBottom: '2px', opacity: 0.6 }} />
                                            {logoLoadError ? <span>Error al cargar</span> : <span>Sin logo</span>}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label className={`btn btn-secondary btn-sm ${uploadingLogo ? 'disabled' : ''}`} style={{ cursor: uploadingLogo ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            {uploadingLogo ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                                            <span>{uploadingLogo ? 'Subiendo...' : (settings.business_logo ? 'Cambiar Imagen' : 'Seleccionar Imagen')}</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                disabled={uploadingLogo}
                                                style={{ display: 'none' }}
                                            />
                                        </label>

                                        {settings.business_logo && !uploadingLogo && (
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                onClick={handleRemoveLogo}
                                            >
                                                <Trash2 size={14} /> Eliminar Logo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Curvatura de Bordes del Logotipo */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Curvatura de Bordes del Logotipo
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginTop: '8px' }}>
                                    {[
                                        { id: '0px', label: 'Recto (0px)' },
                                        { id: '6px', label: 'Suave (6px)' },
                                        { id: '12px', label: 'Redondeado (12px)' },
                                        { id: '20px', label: 'Máximo (20px)' },
                                        { id: '9999px', label: 'Circular' }
                                    ].map(b => (
                                        <button
                                            key={b.id}
                                            type="button"
                                            onClick={() => setLogoBorderRadius(b.id)}
                                            style={{
                                                padding: '8px', fontSize: '12px', fontWeight: 600,
                                                borderRadius: 'var(--radius-sm)',
                                                border: (logoBorderRadius || '12px') === b.id ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border)',
                                                background: (logoBorderRadius || '12px') === b.id ? 'var(--color-bg-tertiary)' : 'transparent',
                                                color: (logoBorderRadius || '12px') === b.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {b.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Curvatura de Bordes en Interfaz */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Curvatura de Bordes en Interfaz
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' }}>
                                    {[
                                        { id: '0px', label: 'Recto (0px)' },
                                        { id: '6px', label: 'Suave (6px)' },
                                        { id: '12px', label: 'Redondeado (12px)' },
                                        { id: '20px', label: 'Máximo (20px)' }
                                    ].map(b => (
                                        <button
                                            key={b.id}
                                            type="button"
                                            onClick={() => setBorderRadius(b.id)}
                                            style={{
                                                padding: '8px', fontSize: '12px', fontWeight: 600,
                                                borderRadius: 'var(--radius-sm)',
                                                border: borderRadius === b.id ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border)',
                                                background: borderRadius === b.id ? 'var(--color-bg-tertiary)' : 'transparent',
                                                color: borderRadius === b.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {b.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Formato del Nombre de la Empresa */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Formato del Nombre de la Empresa
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' }}>
                                    {[
                                        { id: 'none', label: 'Tal cual se guardó', sample: settings.business_name || 'SysTeck' },
                                        { id: 'uppercase', label: 'TODO MAYÚSCULAS', sample: (settings.business_name || 'SysTeck').toUpperCase() },
                                        { id: 'capitalize', label: 'Capitalizado', sample: (settings.business_name || 'SysTeck').charAt(0).toUpperCase() + (settings.business_name || 'SysTeck').slice(1).toLowerCase() },
                                        { id: 'lowercase', label: 'todo minúsculas', sample: (settings.business_name || 'SysTeck').toLowerCase() }
                                    ].map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setCompanyNameTransform(c.id)}
                                            style={{
                                                padding: '8px', fontSize: '12px', fontWeight: 600,
                                                borderRadius: 'var(--radius-sm)',
                                                border: (companyNameTransform || 'none') === c.id ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border)',
                                                background: (companyNameTransform || 'none') === c.id ? 'var(--color-bg-tertiary)' : 'transparent',
                                                color: (companyNameTransform || 'none') === c.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                                gap: '2px'
                                            }}
                                        >
                                            <span>{c.label}</span>
                                            <span style={{ fontSize: '10px', opacity: 0.6, textTransform: c.id }}>{c.sample}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Estilo de Tipografía (Nothing / Sistema) */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Estilo de Tipografía (Nothing / Sistema)
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginTop: '8px' }}>
                                    {[
                                        { id: "'Silkscreen', 'VT323', monospace", label: 'Nothing Pixel', sub: 'Matriz de Puntos', font: "'Silkscreen', monospace" },
                                        { id: "'Space Mono', monospace", label: 'Nothing Mono', sub: 'Técnica / Código', font: "'Space Mono', monospace" },
                                        { id: "'Inter', -apple-system, system-ui, sans-serif", label: 'Moderna / Sistema', sub: 'Inter Minimalista', font: "'Inter', sans-serif" }
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => setBrandFont(f.id)}
                                            style={{
                                                padding: '10px 12px', fontSize: '12px', fontWeight: 600,
                                                borderRadius: 'var(--radius-sm)',
                                                border: (brandFont || "'Silkscreen', 'VT323', monospace") === f.id ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border)',
                                                background: (brandFont || "'Silkscreen', 'VT323', monospace") === f.id ? 'var(--color-bg-tertiary)' : 'transparent',
                                                color: (brandFont || "'Silkscreen', 'VT323', monospace") === f.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                                gap: '4px',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <span style={{ fontWeight: 700 }}>{f.label}</span>
                                            <span style={{ fontSize: '10px', opacity: 0.6 }}>{f.sub}</span>
                                            <span style={{ fontSize: '13px', fontFamily: f.font, marginTop: '2px', color: 'var(--color-text)' }}>
                                                {settings.business_name || 'SysTeck'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
}
