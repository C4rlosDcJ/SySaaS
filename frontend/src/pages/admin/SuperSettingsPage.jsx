import { useState, useEffect, useRef } from 'react';
import { Settings, Save, Globe, Mail, Shield, Clock, ToggleLeft, ToggleRight, UploadCloud, Trash2, CheckCircle2, Lock, KeyRound, Eye, EyeOff, User, AlertCircle, Cpu, Sliders } from 'lucide-react';
import { superAdminService, uploadService, getImageUrl } from '../../services/api';
import { compressImage } from '../../utils/imageCompressor';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function SuperSettingsPage() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [activeTab, setActiveTab] = useState('identity'); // 'identity' | 'operations' | 'ai' | 'security'
    const fileInputRef = useRef(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoLoadError, setLogoLoadError] = useState(false);
    const [settings, setSettings] = useState({
        platform_name: 'SySaaS',
        platform_logo: '',
        support_email: 'soporte@sysaas.com',
        frontend_url: 'http://localhost:5173',
        registration_mode: 'open',
        default_trial_days: 14,
        maintenance_mode: false,
        allow_public_store: true,
        max_file_upload_mb: 50,
        gemini_api_key: '',
        logo_border_radius: '12px',
        company_name_transform: 'none',
        brand_font: "'Silkscreen', 'VT323', monospace"
    });
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    // Estado para cambio de credenciales de SuperAdmin
    const [credState, setCredState] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
        new_email: user?.email || 'superadmin@sysaas.com'
    });
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [credLoading, setCredLoading] = useState(false);
    const [credSuccess, setCredSuccess] = useState('');
    const [credError, setCredError] = useState('');

    useEffect(() => {
        if (user?.email) {
            setCredState(prev => ({ ...prev, new_email: user.email }));
        }
    }, [user]);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const res = await superAdminService.getGlobalSettings();
            if (res && Object.keys(res).length > 0) {
                setSettings(prev => ({
                    ...prev,
                    platform_name: res.platform_name || prev.platform_name,
                    platform_logo: res.platform_logo || res.platform_logo_url || prev.platform_logo,
                    support_email: res.support_email || prev.support_email,
                    frontend_url: res.frontend_url || prev.frontend_url,
                    registration_mode: res.registration_mode || prev.registration_mode,
                    default_trial_days: parseInt(res.default_trial_days) || prev.default_trial_days,
                    maintenance_mode: res.maintenance_mode === 'true' || res.maintenance_mode === true,
                    allow_public_store: res.allow_public_store === 'true' || res.allow_public_store === true,
                    max_file_upload_mb: parseInt(res.max_file_upload_mb) || prev.max_file_upload_mb,
                    gemini_api_key: res.gemini_api_key || prev.gemini_api_key,
                    logo_border_radius: res.logo_border_radius || '12px',
                    company_name_transform: res.company_name_transform || 'none',
                    brand_font: res.brand_font || "'Silkscreen', 'VT323', monospace"
                }));
                if (res.logo_border_radius) {
                    document.documentElement.style.setProperty('--logo-radius', res.logo_border_radius);
                }
                if (res.company_name_transform) {
                    document.documentElement.style.setProperty('--company-name-transform', res.company_name_transform);
                }
                if (res.brand_font) {
                    document.documentElement.style.setProperty('--brand-font', res.brand_font);
                }
                setLogoLoadError(false);
            }
        } catch (err) {
            setError(err.message || 'Error al obtener configuraciones');
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingLogo(true);
            setError('');
            setLogoLoadError(false);

            const compressed = await compressImage(file, { maxWidth: 500, maxHeight: 500, quality: 0.85 });
            const formData = new FormData();
            formData.append('image', compressed);

            const res = await uploadService.uploadSingle(formData);
            if (res?.url) {
                const persistentUrl = res.url;
                await superAdminService.updateGlobalSettings({ platform_logo: persistentUrl });

                setSettings(prev => ({ ...prev, platform_logo: persistentUrl }));
                localStorage.setItem('platform_logo', persistentUrl);

                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (err) {
            setError('Error al subir el logo: ' + (err.message || 'Revisa el formato de imagen.'));
        } finally {
            setUploadingLogo(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveLogo = async () => {
        try {
            setUploadingLogo(true);
            await superAdminService.updateGlobalSettings({ platform_logo: '' });
            setSettings(prev => ({ ...prev, platform_logo: '' }));
            localStorage.removeItem('platform_logo');
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err.message || 'Error al eliminar logo');
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const handleLogoRadiusChange = async (radius) => {
        setSettings(prev => ({ ...prev, logo_border_radius: radius }));
        document.documentElement.style.setProperty('--logo-radius', radius);
        localStorage.setItem('logoBorderRadius', radius);
        try {
            await superAdminService.updateGlobalSettings({ logo_border_radius: radius });
        } catch (e) {
            console.warn('Error al guardar radio de logo global:', e);
        }
    };

    const handleNameTransformChange = async (transform) => {
        setSettings(prev => ({ ...prev, company_name_transform: transform }));
        document.documentElement.style.setProperty('--company-name-transform', transform);
        localStorage.setItem('companyNameTransform', transform);
        try {
            await superAdminService.updateGlobalSettings({ company_name_transform: transform });
        } catch (e) {
            console.warn('Error al guardar formato de nombre global:', e);
        }
    };

    const handleBrandFontChange = async (font) => {
        setSettings(prev => ({ ...prev, brand_font: font }));
        document.documentElement.style.setProperty('--brand-font', font);
        localStorage.setItem('brandFont', font);
        try {
            await superAdminService.updateGlobalSettings({ brand_font: font });
        } catch (e) {
            console.warn('Error al guardar tipografía de marca global:', e);
        }
    };

    const handleSave = async () => {
        try {
            setError('');
            await superAdminService.updateGlobalSettings(settings);
            if (settings.platform_name) localStorage.setItem('platform_name', settings.platform_name);
            if (settings.platform_logo) localStorage.setItem('platform_logo', settings.platform_logo);
            if (settings.logo_border_radius) localStorage.setItem('logoBorderRadius', settings.logo_border_radius);
            if (settings.company_name_transform) localStorage.setItem('companyNameTransform', settings.company_name_transform);
            if (settings.brand_font) localStorage.setItem('brandFont', settings.brand_font);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err.message || 'Error al guardar configuraciones');
        }
    };

    const handleUpdateCredentials = async (e) => {
        e?.preventDefault();
        setCredError('');
        setCredSuccess('');

        if (!credState.current_password) {
            setCredError('Ingresa tu contraseña actual para autorizar los cambios.');
            return;
        }

        if (credState.new_password) {
            if (credState.new_password.length < 8) {
                setCredError('La nueva contraseña debe tener al menos 8 caracteres.');
                return;
            }
            if (credState.new_password !== credState.confirm_password) {
                setCredError('La confirmación de la nueva contraseña no coincide.');
                return;
            }
        }

        if (!credState.new_password && (!credState.new_email || credState.new_email === user?.email)) {
            setCredError('No has especificado cambios en la contraseña ni en el correo.');
            return;
        }

        try {
            setCredLoading(true);
            const payload = {
                current_password: credState.current_password,
                ...(credState.new_password ? { new_password: credState.new_password } : {}),
                ...(credState.new_email && credState.new_email !== user?.email ? { new_email: credState.new_email } : {})
            };
            const res = await superAdminService.changeCredentials(payload);
            setCredSuccess(res.message || 'Credenciales de SuperAdmin actualizadas exitosamente.');
            setCredState(prev => ({
                ...prev,
                current_password: '',
                new_password: '',
                confirm_password: ''
            }));
            setTimeout(() => setCredSuccess(''), 5000);
        } catch (err) {
            setCredError(err.message || 'Error al actualizar credenciales.');
        } finally {
            setCredLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '450px' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '14px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>Cargando configuraciones de la plataforma...</p>
            </div>
        );
    }

    return (
        <div className="container animate-fadeIn" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-8)' }}>
            
            {/* Header Corporativo con tipografía y estilo del sistema */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Settings size={26} className="text-primary" />
                        <span>Configuracion de Plataforma</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Ajustes globales que afectan a toda la plataforma SySaaS SaaS.
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSave}
                    style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', padding: '8px 18px', fontWeight: 700 }}
                >
                    <Save size={15} />
                    <span>{saved ? 'Guardado' : 'Guardar Cambios'}</span>
                </button>
            </div>

            {error && (
                <div className="error-alert" style={{ marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            {saved && (
                <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', color: '#10b981', marginBottom: '20px', fontSize: '14px' }}>
                    Configuración guardada exitosamente.
                </div>
            )}

            {/* Barra de Pestañas Tipo Cápsula (Estilo idéntico a SettingsPage y al estándar SaaS) */}
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
                    { id: 'identity', label: 'Identidad & Marca', icon: Globe },
                    { id: 'operations', label: 'Operación & Registro', icon: Shield },
                    { id: 'ai', label: 'Inteligencia Artificial', icon: Cpu },
                    { id: 'security', label: 'Seguridad & Acceso', icon: KeyRound }
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

            {/* ══════════════════════════════════════════════════════════
                PESTAÑA 1: IDENTIDAD & MARCA
               ══════════════════════════════════════════════════════════ */}
            {activeTab === 'identity' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Globe size={18} className="text-primary" /> Logotipo & Marca de la Plataforma
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                                Logotipo oficial exclusivo de la plataforma SaaS (SuperAdmin y portal principal).
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                            {/* Logo Oficial */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Logo Oficial de la Plataforma
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                                    <div style={{
                                        width: '80px', height: '80px',
                                        borderRadius: settings.logo_border_radius || '12px',
                                        border: '1px solid var(--color-border)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'var(--color-bg-tertiary)', overflow: 'hidden',
                                        flexShrink: 0,
                                        transition: 'border-radius 0.2s ease'
                                    }}>
                                        {uploadingLogo ? (
                                            <UploadCloud size={24} className="text-primary animate-bounce" />
                                        ) : (settings.platform_logo && !logoLoadError) ? (
                                            <img
                                                src={getImageUrl(settings.platform_logo)}
                                                alt="Logo Plataforma"
                                                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: settings.logo_border_radius || '12px' }}
                                                onError={() => setLogoLoadError(true)}
                                            />
                                        ) : (
                                            <Shield size={32} className="text-primary" />
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingLogo}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <UploadCloud size={14} />
                                            <span>{uploadingLogo ? 'Subiendo...' : (settings.platform_logo ? 'Cambiar Logo' : 'Subir Logo')}</span>
                                        </button>

                                        {settings.platform_logo && (
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={handleRemoveLogo}
                                                disabled={uploadingLogo}
                                                style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <Trash2 size={14} /> Quitar Logo
                                            </button>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleLogoUpload}
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px', display: 'block' }}>
                                    Aislado de las empresas clientes. Se muestra en el portal SuperAdmin y login general.
                                </span>
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
                                            onClick={() => handleLogoRadiusChange(b.id)}
                                            style={{
                                                padding: '8px', fontSize: '12px', fontWeight: 600,
                                                borderRadius: 'var(--radius-sm)',
                                                border: (settings.logo_border_radius || '12px') === b.id ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border)',
                                                background: (settings.logo_border_radius || '12px') === b.id ? 'var(--color-bg-tertiary)' : 'transparent',
                                                color: (settings.logo_border_radius || '12px') === b.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {b.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Nombre de la Plataforma */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Nombre de la Plataforma
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    value={settings.platform_name}
                                    onChange={e => handleChange('platform_name', e.target.value)}
                                    placeholder="SySaaS"
                                    style={{ width: '100%', marginTop: '8px' }}
                                />
                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                                    Se muestra en el sidebar SuperAdmin, landing page y correos globales.
                                </span>
                            </div>

                            {/* Formato del Nombre de la Plataforma */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Formato del Nombre de la Plataforma
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' }}>
                                    {[
                                        { id: 'none', label: 'Tal cual se guardó', sample: settings.platform_name || 'SySaaS' },
                                        { id: 'uppercase', label: 'TODO MAYÚSCULAS', sample: (settings.platform_name || 'SySaaS').toUpperCase() },
                                        { id: 'capitalize', label: 'Capitalizado', sample: (settings.platform_name || 'SySaaS').charAt(0).toUpperCase() + (settings.platform_name || 'SySaaS').slice(1).toLowerCase() },
                                        { id: 'lowercase', label: 'todo minúsculas', sample: (settings.platform_name || 'SySaaS').toLowerCase() }
                                    ].map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => handleNameTransformChange(c.id)}
                                            style={{
                                                padding: '8px', fontSize: '12px', fontWeight: 600,
                                                borderRadius: 'var(--radius-sm)',
                                                border: (settings.company_name_transform || 'none') === c.id ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border)',
                                                background: (settings.company_name_transform || 'none') === c.id ? 'var(--color-bg-tertiary)' : 'transparent',
                                                color: (settings.company_name_transform || 'none') === c.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                                gap: '2px',
                                                transition: 'all 0.15s ease'
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
                                            onClick={() => handleBrandFontChange(f.id)}
                                            style={{
                                                padding: '10px 12px', fontSize: '12px', fontWeight: 600,
                                                borderRadius: 'var(--radius-sm)',
                                                border: (settings.brand_font || "'Silkscreen', 'VT323', monospace") === f.id ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border)',
                                                background: (settings.brand_font || "'Silkscreen', 'VT323', monospace") === f.id ? 'var(--color-bg-tertiary)' : 'transparent',
                                                color: (settings.brand_font || "'Silkscreen', 'VT323', monospace") === f.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
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
                                                {settings.platform_name || 'SySaaS'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Parámetros Técnicos de la Plataforma */}
                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sliders size={18} className="text-primary" /> Parámetros Técnicos de la Plataforma
                            </h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    URL del Frontend (Producción)
                                </label>
                                <input type="url" className="input" value={settings.frontend_url} onChange={e => handleChange('frontend_url', e.target.value)} placeholder="https://app.sysaas.com" style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Tamaño Máximo de Archivos (MB)
                                </label>
                                <input type="number" className="input" value={settings.max_file_upload_mb} onChange={e => handleChange('max_file_upload_mb', parseInt(e.target.value) || 10)} min="1" max="100" style={{ width: '100%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                PESTAÑA 2: OPERACIÓN & REGISTRO
               ══════════════════════════════════════════════════════════ */}
            {activeTab === 'operations' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Shield size={18} className="text-primary" /> Registro y Suscripciones
                            </h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Modo de Registro
                                </label>
                                <select className="input" value={settings.registration_mode} onChange={e => handleChange('registration_mode', e.target.value)} style={{ width: '100%' }}>
                                    <option value="open">Abierto — Cualquier empresa puede registrarse</option>
                                    <option value="invite">Solo Invitación — El SuperAdmin debe crear empresas</option>
                                    <option value="approval">Con Aprobación — Las solicitudes requieren aprobación</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                    Período de Prueba por Defecto (días)
                                </label>
                                <input type="number" className="input" value={settings.default_trial_days} onChange={e => handleChange('default_trial_days', parseInt(e.target.value) || 7)} min="0" max="90" style={{ width: '100%' }} />
                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>Días de prueba gratuita al registrar una nueva empresa.</span>
                            </div>
                        </div>
                    </div>

                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Mail size={18} className="text-primary" /> Soporte y Contacto
                            </h2>
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                Correo de Soporte Oficial
                            </label>
                            <input type="email" className="input" value={settings.support_email} onChange={e => handleChange('support_email', e.target.value)} placeholder="soporte@sysaas.com" style={{ width: '100%', maxWidth: '500px' }} />
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>Correo visible para clientes y usuarios en el portal de ayuda.</span>
                        </div>
                    </div>

                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={18} className="text-primary" /> Funcionalidades Globales
                            </h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { key: 'maintenance_mode', label: 'Modo Mantenimiento', desc: 'Bloquea el acceso a todos los tenants excepto SuperAdmin.', danger: true },
                                { key: 'allow_public_store', label: 'Tienda Pública', desc: 'Permite a las empresas activar su catálogo público de productos.' }
                            ].map(toggle => (
                                <div key={toggle.key} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '14px 16px', borderRadius: 'var(--radius-md)',
                                    border: `1px solid ${toggle.danger && settings[toggle.key] ? 'var(--color-error)' : 'var(--color-border)'}`,
                                    background: toggle.danger && settings[toggle.key] ? 'rgba(239,68,68,0.05)' : 'var(--color-bg-tertiary)'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text)' }}>{toggle.label}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{toggle.desc}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleChange(toggle.key, !settings[toggle.key])}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                    >
                                        {settings[toggle.key] ? (
                                            <ToggleRight size={32} style={{ color: toggle.danger ? 'var(--color-error)' : 'var(--color-success)' }} />
                                        ) : (
                                            <ToggleLeft size={32} style={{ color: 'var(--color-text-secondary)' }} />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                PESTAÑA 3: INTELIGENCIA ARTIFICIAL
               ══════════════════════════════════════════════════════════ */}
            {activeTab === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Cpu size={18} className="text-primary" /> Inteligencia Artificial (Google Gemini)
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                                Clave global utilizada para diagnósticos inteligentes de dispositivos y chatbot de asistencia técnica.
                            </p>
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                                Google Gemini API Key
                            </label>
                            <input 
                                type="password" 
                                className="input" 
                                value={settings.gemini_api_key} 
                                onChange={e => handleChange('gemini_api_key', e.target.value)} 
                                placeholder="AIzaSy..." 
                                style={{ width: '100%', maxWidth: '500px' }}
                            />
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '6px', display: 'block' }}>
                                Activa el motor neuronal para diagnósticos de reparación en todas las organizaciones.
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                PESTAÑA 4: SEGURIDAD & ACCESO
               ══════════════════════════════════════════════════════════ */}
            {activeTab === 'security' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                                    <Lock size={18} className="text-primary" /> Acceso y Contraseña SuperAdmin
                                </h2>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                    Cuenta de administración suprema de la plataforma.
                                </p>
                            </div>
                            <span style={{ 
                                fontSize: '11px', 
                                padding: '3px 8px', 
                                borderRadius: 'var(--radius-sm)', 
                                background: 'rgba(59, 130, 246, 0.1)', 
                                color: '#3b82f6', 
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                fontWeight: 600
                            }}>
                                SuperAdmin Activo
                            </span>
                        </div>

                        <div style={{ 
                            padding: '12px 14px', 
                            background: 'var(--color-bg-tertiary)', 
                            border: '1px solid var(--color-border)', 
                            borderRadius: 'var(--radius-md)', 
                            marginBottom: '16px',
                            fontSize: '12px',
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.4
                        }}>
                            Esta es la única cuenta administrativa inicial de la plataforma. Puedes cambiar tu contraseña o correo en cualquier momento aquí.
                        </div>

                        {credError && (
                            <div className="error-alert" style={{ marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={16} />
                                <span>{credError}</span>
                            </div>
                        )}

                        {credSuccess && (
                            <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', color: '#10b981', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle2 size={16} />
                                <span>{credSuccess}</span>
                            </div>
                        )}

                        <form onSubmit={handleUpdateCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <User size={14} className="text-primary" /> Correo Electrónico
                                </label>
                                <input 
                                    type="email" 
                                    className="input" 
                                    value={credState.new_email} 
                                    onChange={e => setCredState(prev => ({ ...prev, new_email: e.target.value }))}
                                    placeholder="superadmin@sysaas.com" 
                                    style={{ maxWidth: '450px' }}
                                    required
                                />
                            </div>

                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <KeyRound size={14} className="text-primary" /> Contraseña Actual
                                </label>
                                <div style={{ position: 'relative', maxWidth: '450px' }}>
                                    <input 
                                        type={showCurrentPass ? 'text' : 'password'} 
                                        className="input" 
                                        value={credState.current_password} 
                                        onChange={e => setCredState(prev => ({ ...prev, current_password: e.target.value }))}
                                        placeholder="Ingresa tu contraseña actual" 
                                        style={{ paddingRight: '40px', width: '100%' }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--color-text-secondary)',
                                            cursor: 'pointer',
                                            padding: 0
                                        }}
                                    >
                                        {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', maxWidth: '450px' }}>
                                <div>
                                    <label className="label">Nueva Contraseña</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type={showNewPass ? 'text' : 'password'} 
                                            className="input" 
                                            value={credState.new_password} 
                                            onChange={e => setCredState(prev => ({ ...prev, new_password: e.target.value }))}
                                            placeholder="Min. 8 caracteres" 
                                            style={{ paddingRight: '40px', width: '100%' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPass(!showNewPass)}
                                            style={{
                                                position: 'absolute',
                                                right: '12px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--color-text-secondary)',
                                                cursor: 'pointer',
                                                padding: 0
                                            }}
                                        >
                                            {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Confirmar Contraseña</label>
                                    <input 
                                        type={showNewPass ? 'text' : 'password'} 
                                        className="input" 
                                        value={credState.confirm_password} 
                                        onChange={e => setCredState(prev => ({ ...prev, confirm_password: e.target.value }))}
                                        placeholder="Repite la contraseña" 
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                className="btn btn-primary" 
                                disabled={credLoading}
                                style={{ alignSelf: 'flex-start', marginTop: '6px' }}
                            >
                                <KeyRound size={16} />
                                {credLoading ? 'Guardando...' : 'Actualizar Credenciales SuperAdmin'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
