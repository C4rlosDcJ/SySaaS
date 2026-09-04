import { useState, useEffect, useRef } from 'react';
import { Settings, Save, Globe, Mail, Shield, Clock, ToggleLeft, ToggleRight, UploadCloud, Image as ImageIcon, Trash2, CheckCircle2 } from 'lucide-react';
import { superAdminService, uploadService, getImageUrl } from '../../services/api';
import { compressImage } from '../../utils/imageCompressor';

export default function SuperSettingsPage() {
    const fileInputRef = useRef(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
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
        gemini_api_key: ''
    });
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);

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
                    gemini_api_key: res.gemini_api_key || prev.gemini_api_key
                }));
            }
        } catch (err) {
            setError(err.message || 'Error al obtener configuraciones');
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploadingLogo(true);
            setError('');
            const localPreview = URL.createObjectURL(file);
            setSettings(prev => ({ ...prev, platform_logo: localPreview }));

            const compressed = await compressImage(file, { maxWidth: 500, maxHeight: 500, quality: 0.85 });
            const formData = new FormData();
            formData.append('image', compressed);

            const res = await uploadService.uploadSingle(formData);
            setSettings(prev => ({ ...prev, platform_logo: res.url }));
            localStorage.setItem('platform_logo', res.url);
        } catch (err) {
            console.error('Error subiendo logo de plataforma:', err);
            setError('No se pudo subir el logo de la plataforma: ' + err.message);
        } finally {
            setUploadingLogo(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveLogo = () => {
        setSettings(prev => ({ ...prev, platform_logo: '' }));
        localStorage.removeItem('platform_logo');
    };

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const handleSave = async () => {
        try {
            setError('');
            await superAdminService.updateGlobalSettings(settings);
            if (settings.platform_name) localStorage.setItem('platform_name', settings.platform_name);
            if (settings.platform_logo) localStorage.setItem('platform_logo', settings.platform_logo);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err.message || 'Error al guardar configuraciones');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <div className="spinner"></div>
            </div>
        );
    }


    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Settings size={28} className="text-primary" />
                        <span>Configuracion de Plataforma</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Ajustes globales que afectan a toda la plataforma SySaaS SaaS.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleSave}>
                    <Save size={16} />
                    {saved ? 'Guardado' : 'Guardar Cambios'}
                </button>
            </div>

            {error && (
                <div className="error-alert" style={{ marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            {saved && (
                <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', color: '#10b981', marginBottom: '20px', fontSize: '14px' }}>
                    Configuracion guardada exitosamente.
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
                {/* General & Branding de Plataforma */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                        <Globe size={18} className="text-primary" /> Identidad y General
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Logo Oficial de la Plataforma */}
                        <div>
                            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ImageIcon size={14} className="text-primary" />
                                <span>Logo Oficial de la Plataforma</span>
                            </label>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', background: 'var(--color-bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-elevated)', border: '1px dashed var(--color-border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                    {settings.platform_logo ? (
                                        <img 
                                            src={getImageUrl(settings.platform_logo)} 
                                            alt="Logo Plataforma" 
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <Shield size={28} className="text-primary" />
                                    )}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button 
                                            type="button" 
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingLogo}
                                        >
                                            <UploadCloud size={14} />
                                            {uploadingLogo ? 'Subiendo...' : (settings.platform_logo ? 'Cambiar Logo' : 'Subir Logo')}
                                        </button>

                                        {settings.platform_logo && (
                                            <button 
                                                type="button" 
                                                className="btn btn-danger btn-sm"
                                                onClick={handleRemoveLogo}
                                                disabled={uploadingLogo}
                                            >
                                                <Trash2 size={14} />
                                                Quitar
                                            </button>
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleLogoUpload} 
                                        accept="image/*" 
                                        style={{ display: 'none' }} 
                                    />
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '6px', display: 'block', lineHeight: 1.3 }}>
                                        Logo exclusivo de la plataforma SaaS (SuperAdmin y portal principal). Aislado de las empresas clientes.
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="label">Nombre de la Plataforma</label>
                            <input type="text" className="input" value={settings.platform_name} onChange={e => handleChange('platform_name', e.target.value)} placeholder="SySaaS" />
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>Se muestra en el sidebar SuperAdmin, landing page y correos globales.</span>
                        </div>
                        <div>
                            <label className="label">URL del Frontend (Produccion)</label>
                            <input type="url" className="input" value={settings.frontend_url} onChange={e => handleChange('frontend_url', e.target.value)} placeholder="https://app.sysaas.com" />
                        </div>
                        <div>
                            <label className="label">Tamaño Maximo de Archivos (MB)</label>
                            <input type="number" className="input" value={settings.max_file_upload_mb} onChange={e => handleChange('max_file_upload_mb', parseInt(e.target.value) || 10)} min="1" max="100" />
                        </div>
                    </div>
                </div>

                {/* Soporte */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                        <Mail size={18} className="text-primary" /> Soporte y Contacto
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label className="label">Correo de Soporte</label>
                            <input type="email" className="input" value={settings.support_email} onChange={e => handleChange('support_email', e.target.value)} placeholder="soporte@sysaas.com" />
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>Correo visible para los usuarios de la plataforma.</span>
                        </div>
                    </div>
                </div>

                {/* Registro y Trial */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                        <Shield size={18} className="text-primary" /> Registro y Suscripciones
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label className="label">Modo de Registro</label>
                            <select className="input" value={settings.registration_mode} onChange={e => handleChange('registration_mode', e.target.value)}>
                                <option value="open">Abierto -- Cualquier empresa puede registrarse</option>
                                <option value="invite">Solo Invitacion -- El SuperAdmin debe crear empresas</option>
                                <option value="approval">Con Aprobacion -- Las solicitudes requieren aprobacion</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Periodo de Prueba por Defecto (dias)</label>
                            <input type="number" className="input" value={settings.default_trial_days} onChange={e => handleChange('default_trial_days', parseInt(e.target.value) || 7)} min="0" max="90" />
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>Dias de trial gratuito al registrar una nueva empresa. 0 = sin trial.</span>
                        </div>
                    </div>
                </div>

                {/* Feature Toggles */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                        <Clock size={18} className="text-primary" /> Funcionalidades Globales
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {[
                            { key: 'maintenance_mode', label: 'Modo Mantenimiento', desc: 'Bloquea el acceso a todos los tenants excepto SuperAdmin.', danger: true },
                            { key: 'allow_public_store', label: 'Tienda Publica', desc: 'Permite a las empresas activar su catalogo publico de productos.' }
                        ].map(toggle => (
                            <div key={toggle.key} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '14px 16px', borderRadius: 'var(--radius-md)',
                                border: `1px solid ${toggle.danger && settings[toggle.key] ? 'var(--color-error)' : 'var(--color-border)'}`,
                                background: toggle.danger && settings[toggle.key] ? 'rgba(239,68,68,0.05)' : 'transparent'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text)' }}>{toggle.label}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{toggle.desc}</div>
                                </div>
                                <button
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

                {/* IA / Gemini API Key */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                        <Clock size={18} className="text-primary" /> Inteligencia Artificial (Gemini)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label className="label">Google Gemini API Key</label>
                            <input 
                                type="text" 
                                className="input" 
                                value={settings.gemini_api_key} 
                                onChange={e => handleChange('gemini_api_key', e.target.value)} 
                                placeholder="AIzaSy..." 
                            />
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                                Clave global utilizada para diagnósticos automáticos e IA chatbot en todas las sucursales.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
