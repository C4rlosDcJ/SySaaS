import { useState, useEffect } from 'react';
import { tenantService } from '../../services/api';
import { 
    Layers, Plus, Edit2, Check, X, Shield, Users, GitBranch, 
    Sparkles, MessageSquare, ShoppingBag, BarChart2, Headphones, Star,
    ShoppingCart, PackageCheck, Search
} from 'lucide-react';

export default function SuperPlansPage() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const initialForm = {
        name: '',
        slug: '',
        description: '',
        popular: false,
        price_monthly: 299,
        price_yearly: 2990,
        max_branches: 1,
        max_users: 3,
        max_monthly_repairs: 100,
        pos_sales: true,
        inventory: true,
        public_tracking: true,
        transfers: false,
        whatsapp_notifications: false,
        ai_assistant: false,
        ecommerce: false,
        advanced_reports: false,
        support_tier: 'Soporte técnico por correo',
        custom_features: ''
    };

    const [formData, setFormData] = useState(initialForm);

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            setLoading(true);
            const res = await tenantService.getPlans();
            setPlans(res || []);
        } catch (err) {
            setError(err.message || 'Error al obtener planes.');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (plan) => {
        let parsedFeatures = {};
        try {
            parsedFeatures = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {});
        } catch (e) {
            parsedFeatures = {};
        }

        setEditingPlan(plan.id);
        setFormData({
            name: plan.name || '',
            slug: plan.slug || '',
            description: parsedFeatures.description || '',
            popular: !!parsedFeatures.popular,
            price_monthly: plan.price_monthly,
            price_yearly: plan.price_yearly,
            max_branches: plan.max_branches,
            max_users: plan.max_users,
            max_monthly_repairs: plan.max_monthly_repairs !== null && plan.max_monthly_repairs !== undefined ? plan.max_monthly_repairs : '',
            pos_sales: parsedFeatures.pos_sales !== undefined ? !!parsedFeatures.pos_sales : true,
            inventory: parsedFeatures.inventory !== undefined ? !!parsedFeatures.inventory : true,
            public_tracking: parsedFeatures.public_tracking !== undefined ? !!parsedFeatures.public_tracking : true,
            transfers: !!parsedFeatures.transfers,
            whatsapp_notifications: !!parsedFeatures.whatsapp_notifications,
            ai_assistant: !!parsedFeatures.ai_assistant,
            ecommerce: !!parsedFeatures.ecommerce,
            advanced_reports: !!parsedFeatures.advanced_reports,
            support_tier: parsedFeatures.support_tier || 'Soporte técnico por correo',
            custom_features: Array.isArray(parsedFeatures.custom_features) ? parsedFeatures.custom_features.join('\n') : ''
        });
    };

    const handleSaveSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        const customFeaturesList = formData.custom_features
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean);

        const payload = {
            name: formData.name,
            slug: formData.slug,
            price_monthly: parseFloat(formData.price_monthly) || 0,
            price_yearly: parseFloat(formData.price_yearly) || 0,
            max_branches: parseInt(formData.max_branches) || 1,
            max_users: parseInt(formData.max_users) || 1,
            max_monthly_repairs: formData.max_monthly_repairs ? parseInt(formData.max_monthly_repairs) : null,
            features: {
                description: formData.description,
                popular: formData.popular,
                pos_sales: formData.pos_sales,
                inventory: formData.inventory,
                public_tracking: formData.public_tracking,
                transfers: formData.transfers,
                whatsapp_notifications: formData.whatsapp_notifications,
                ai_assistant: formData.ai_assistant,
                ecommerce: formData.ecommerce,
                advanced_reports: formData.advanced_reports,
                support_tier: formData.support_tier,
                custom_features: customFeaturesList
            }
        };

        try {
            if (editingPlan) {
                await tenantService.updatePlan(editingPlan, payload);
            } else {
                await tenantService.createPlan(payload);
            }
            setEditingPlan(null);
            setShowCreateModal(false);
            await loadPlans();
        } catch (err) {
            setError(err.message || 'Error al guardar el plan');
        } finally {
            setSubmitting(false);
        }
    };

    const formatPrice = (amount) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Layers size={28} className="text-primary" />
                        <span>Gestión de Planes y Precios SaaS</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Configura las tarifas, cuotas de infraestructura y módulos reales incluidos en los planes comerciales.
                    </p>
                </div>

                <button 
                    className="btn btn-primary"
                    onClick={() => {
                        setEditingPlan(null);
                        setFormData(initialForm);
                        setShowCreateModal(true);
                    }}
                >
                    <Plus size={16} />
                    Nuevo Plan
                </button>
            </div>

            {error && <div className="error-alert" style={{ marginBottom: '20px' }}>{error}</div>}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {plans.map(plan => {
                        let features = {};
                        try {
                            features = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {});
                        } catch (e) {
                            features = {};
                        }

                        const isPopular = !!features.popular;
                        const isUnlimitedBranches = plan.max_branches >= 99;
                        const isUnlimitedUsers = plan.max_users >= 999;
                        const isUnlimitedRepairs = !plan.max_monthly_repairs;

                        const featureChecklist = [
                            { label: 'Punto de Venta POS y Facturación', active: features.pos_sales !== false, icon: ShoppingCart },
                            { label: 'Control de Inventario y Stock', active: features.inventory !== false, icon: PackageCheck },
                            { label: 'Rastreo Público para Clientes', active: features.public_tracking !== false, icon: Search },
                            { label: 'Traspasos entre Sucursales', active: !!features.transfers, icon: GitBranch },
                            { label: 'Notificaciones por WhatsApp', active: !!features.whatsapp_notifications, icon: MessageSquare },
                            { label: 'Asistente de Inteligencia Artificial', active: !!features.ai_assistant, icon: Sparkles },
                            { label: 'Catálogo E-Commerce & Tienda Web', active: !!features.ecommerce, icon: ShoppingBag },
                            { label: 'Reportes Financieros y Machine Learning', active: !!features.advanced_reports, icon: BarChart2 }
                        ];

                        return (
                            <div 
                                key={plan.id} 
                                className="card" 
                                style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    justifyContent: 'space-between', 
                                    padding: '24px', 
                                    position: 'relative',
                                    border: isPopular ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-lg)'
                                }}
                            >
                                {isPopular && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-12px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        background: 'var(--color-primary)',
                                        color: '#fff',
                                        padding: '2px 12px',
                                        borderRadius: '999px',
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        letterSpacing: '0.08em',
                                        fontFamily: 'var(--font-mono)',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                    }}>
                                        RECOMENDADO
                                    </div>
                                )}

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{plan.name}</h3>
                                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                                                slug: {plan.slug}
                                            </span>
                                        </div>
                                        <button 
                                            className="btn btn-ghost btn-sm btn-icon"
                                            onClick={() => {
                                                handleEditClick(plan);
                                                setShowCreateModal(true);
                                            }}
                                            title="Editar Plan"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </div>

                                    {features.description && (
                                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 16px 0', minHeight: '36px', lineHeight: 1.4 }}>
                                            {features.description}
                                        </p>
                                    )}

                                    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                        <span style={{ fontSize: '30px', fontWeight: 800 }}>{formatPrice(plan.price_monthly)}</span>
                                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>/ mes</span>
                                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                                            ({formatPrice(plan.price_yearly)} / año)
                                        </span>
                                    </div>

                                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '14px 0' }} />

                                    {/* Cuotas de Infraestructura */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginBottom: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <GitBranch size={15} className="text-primary" />
                                            <span>
                                                {isUnlimitedBranches ? <strong>Sucursales ilimitadas</strong> : <>Hasta <strong>{plan.max_branches}</strong> sucursal(es)</>}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Users size={15} className="text-primary" />
                                            <span>
                                                {isUnlimitedUsers ? <strong>Usuarios y staff ilimitados</strong> : <>Hasta <strong>{plan.max_users}</strong> usuarios</>}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Shield size={15} className="text-primary" />
                                            <span>
                                                Reparaciones: <strong>{isUnlimitedRepairs ? 'Ilimitadas' : `${plan.max_monthly_repairs} / mes`}</strong>
                                            </span>
                                        </div>
                                    </div>

                                    <hr style={{ border: 'none', borderTop: '1px dotted var(--color-border)', margin: '12px 0' }} />

                                    {/* Módulos y Capacidades del Sistema */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px' }}>
                                        {featureChecklist.map((item, idx) => (
                                            <div 
                                                key={idx} 
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '8px', 
                                                    color: item.active ? 'var(--color-text)' : 'var(--color-text-muted)' 
                                                }}
                                            >
                                                {item.active ? (
                                                    <Check size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                                                ) : (
                                                    <X size={14} style={{ color: 'var(--color-text-muted)', opacity: 0.6, flexShrink: 0 }} />
                                                )}
                                                <span style={{ textDecoration: item.active ? 'none' : 'none' }}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        ))}

                                        {/* Nivel de Soporte */}
                                        {features.support_tier && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)', marginTop: '4px' }}>
                                                <Headphones size={14} className="text-primary" style={{ flexShrink: 0 }} />
                                                <span style={{ fontWeight: 500 }}>{features.support_tier}</span>
                                            </div>
                                        )}

                                        {/* Características Personalizadas */}
                                        {Array.isArray(features.custom_features) && features.custom_features.map((cf, cIdx) => (
                                            <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                                                <Check size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                                                <span>{cf}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Crear / Editar Plan */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: '28px' }}>
                        <button 
                            onClick={() => setShowCreateModal(false)}
                            style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700 }}>
                            {editingPlan ? 'Editar Plan SaaS' : 'Nuevo Plan SaaS'}
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                            Configura precios, cuotas de infraestructura y módulos reales ofrecidos en SySaaS.
                        </p>

                        <form onSubmit={handleSaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Nombre, Slug y Recomendado */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Nombre del Plan *</label>
                                    <input 
                                        type="text" 
                                        className="input" 
                                        placeholder="Ej. Plan Pro"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="label">Slug Identificador *</label>
                                    <input 
                                        type="text" 
                                        className="input" 
                                        placeholder="pro"
                                        value={formData.slug}
                                        onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                        required 
                                        disabled={!!editingPlan}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Descripción Comercial</label>
                                <input 
                                    type="text" 
                                    className="input" 
                                    placeholder="Ej. La opción recomendada para cadenas en expansión."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, background: 'var(--color-bg-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                                <input 
                                    type="checkbox" 
                                    checked={formData.popular}
                                    onChange={e => setFormData({ ...formData, popular: e.target.checked })}
                                />
                                <span>Marcar como plan RECOMENDADO (Badge destacado)</span>
                            </label>

                            {/* Precios */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Precio Mensual ($ MXN) *</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        value={formData.price_monthly}
                                        onChange={e => setFormData({ ...formData, price_monthly: e.target.value })}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="label">Precio Anual ($ MXN) *</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        value={formData.price_yearly}
                                        onChange={e => setFormData({ ...formData, price_yearly: e.target.value })}
                                        required 
                                    />
                                </div>
                            </div>

                            {/* Cuotas */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label className="label">Max Sucursales (99: ilimitadas)</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        value={formData.max_branches}
                                        onChange={e => setFormData({ ...formData, max_branches: e.target.value })}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="label">Max Usuarios (999: ilimitados)</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        value={formData.max_users}
                                        onChange={e => setFormData({ ...formData, max_users: e.target.value })}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="label">Reparaciones/mes (vacío: ilimitadas)</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        placeholder="Ilimitadas"
                                        value={formData.max_monthly_repairs}
                                        onChange={e => setFormData({ ...formData, max_monthly_repairs: e.target.value })}
                                    />
                                </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
                            
                            {/* Módulos y Funcionalidades del Sistema */}
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
                                    Módulos y Capacidades del Sistema
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
                                    Activa o desactiva las capacidades operativas disponibles para las empresas en este plan:
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={formData.pos_sales}
                                            onChange={e => setFormData({ ...formData, pos_sales: e.target.checked })}
                                        />
                                        <span>Punto de Venta POS & Facturación</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={formData.inventory}
                                            onChange={e => setFormData({ ...formData, inventory: e.target.checked })}
                                        />
                                        <span>Control de Inventario y Stock</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={formData.public_tracking}
                                            onChange={e => setFormData({ ...formData, public_tracking: e.target.checked })}
                                        />
                                        <span>Rastreo Público para Clientes</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={formData.transfers}
                                            onChange={e => setFormData({ ...formData, transfers: e.target.checked })}
                                        />
                                        <span>Traspasos entre Sucursales</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={formData.whatsapp_notifications}
                                            onChange={e => setFormData({ ...formData, whatsapp_notifications: e.target.checked })}
                                        />
                                        <span>Notificaciones por WhatsApp</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={formData.ai_assistant}
                                            onChange={e => setFormData({ ...formData, ai_assistant: e.target.checked })}
                                        />
                                        <span>Diagnóstico Predictivo con IA</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={formData.ecommerce}
                                            onChange={e => setFormData({ ...formData, ecommerce: e.target.checked })}
                                        />
                                        <span>Catálogo E-Commerce / Tienda Web</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={formData.advanced_reports}
                                            onChange={e => setFormData({ ...formData, advanced_reports: e.target.checked })}
                                        />
                                        <span>Reportes y Machine Learning</span>
                                    </label>
                                </div>
                            </div>

                            {/* Nivel de Soporte */}
                            <div>
                                <label className="label">Nivel de Soporte Técnico</label>
                                <input 
                                    type="text" 
                                    className="input" 
                                    placeholder="Ej. Soporte 24/7 y Onboarding dedicado"
                                    value={formData.support_tier}
                                    onChange={e => setFormData({ ...formData, support_tier: e.target.value })}
                                />
                            </div>

                            {/* Características Adicionales */}
                            <div>
                                <label className="label">Características Adicionales (Una por línea)</label>
                                <textarea 
                                    className="input" 
                                    rows={3}
                                    placeholder="Módulo POS & Traspasos avanzados&#10;Reportes ejecutivos de red"
                                    value={formData.custom_features}
                                    onChange={e => setFormData({ ...formData, custom_features: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Guardando...' : 'Guardar Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
