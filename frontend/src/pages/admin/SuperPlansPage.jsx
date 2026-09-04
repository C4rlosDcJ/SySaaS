import { useState, useEffect } from 'react';
import { tenantService } from '../../services/api';
import { Layers, Plus, Edit2, Check, X, Shield, DollarSign, Users, GitBranch } from 'lucide-react';

export default function SuperPlansPage() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        price_monthly: 0,
        price_yearly: 0,
        max_branches: 1,
        max_users: 3,
        max_monthly_repairs: 100,
        ecommerce: false,
        ai_assistant: false,
        advanced_reports: false
    });

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
            name: plan.name,
            slug: plan.slug,
            price_monthly: plan.price_monthly,
            price_yearly: plan.price_yearly,
            max_branches: plan.max_branches,
            max_users: plan.max_users,
            max_monthly_repairs: plan.max_monthly_repairs || '',
            ecommerce: !!parsedFeatures.ecommerce,
            ai_assistant: !!parsedFeatures.ai_assistant,
            advanced_reports: !!parsedFeatures.advanced_reports
        });
    };

    const handleSaveSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        const payload = {
            name: formData.name,
            slug: formData.slug,
            price_monthly: parseFloat(formData.price_monthly) || 0,
            price_yearly: parseFloat(formData.price_yearly) || 0,
            max_branches: parseInt(formData.max_branches) || 1,
            max_users: parseInt(formData.max_users) || 1,
            max_monthly_repairs: formData.max_monthly_repairs ? parseInt(formData.max_monthly_repairs) : null,
            features: {
                ecommerce: formData.ecommerce,
                ai_assistant: formData.ai_assistant,
                advanced_reports: formData.advanced_reports
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
            loadPlans();
        } catch (err) {
            setError(err.message || 'Error al guardar el plan');
        } finally {
            setSubmitting(false);
        }
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
                        Configura las tarifas, cuotas de sucursales y características incluidas en los planes comerciales.
                    </p>
                </div>

                <button 
                    className="btn btn-primary"
                    onClick={() => {
                        setEditingPlan(null);
                        setFormData({
                            name: '',
                            slug: '',
                            price_monthly: 299,
                            price_yearly: 2990,
                            max_branches: 1,
                            max_users: 3,
                            max_monthly_repairs: 100,
                            ecommerce: false,
                            ai_assistant: false,
                            advanced_reports: false
                        });
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    {plans.map(plan => {
                        let features = {};
                        try {
                            features = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {});
                        } catch (e) {
                            features = {};
                        }

                        return (
                            <div key={plan.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px', position: 'relative' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{plan.name}</h3>
                                            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
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

                                    <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                        <span style={{ fontSize: '32px', fontWeight: 800 }}>${plan.price_monthly}</span>
                                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>/ mes</span>
                                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                                            (${plan.price_yearly} / año)
                                        </span>
                                    </div>

                                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '16px 0' }} />

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <GitBranch size={16} className="text-primary" />
                                            <span>Hasta <strong>{plan.max_branches}</strong> sucursal(es)</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Users size={16} className="text-primary" />
                                            <span>Hasta <strong>{plan.max_users}</strong> usuarios</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Shield size={16} className="text-primary" />
                                            <span>Reparaciones: <strong>{plan.max_monthly_repairs || 'Ilimitadas'}</strong></span>
                                        </div>

                                        <hr style={{ border: 'none', borderTop: '1px dotted var(--color-border)', margin: '8px 0' }} />

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: features.ecommerce ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                            {features.ecommerce ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <X size={16} />}
                                            <span>E-Commerce / Tienda Web</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: features.ai_assistant ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                            {features.ai_assistant ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <X size={16} />}
                                            <span>Asistente Diagnóstico IA</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: features.advanced_reports ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                            {features.advanced_reports ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <X size={16} />}
                                            <span>Reportes Financieros Avanzados</span>
                                        </div>
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
                    <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative', padding: '24px' }}>
                        <button 
                            onClick={() => setShowCreateModal(false)}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>
                            {editingPlan ? 'Editar Plan SaaS' : 'Nuevo Plan SaaS'}
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                            Ajusta precios, cuotas de infraestructura y módulos habilitados.
                        </p>

                        <form onSubmit={handleSaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Nombre del Plan *</label>
                                    <input 
                                        type="text" 
                                        className="input" 
                                        placeholder="Ej. Pro Taller"
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
                                        placeholder="pro-taller"
                                        value={formData.slug}
                                        onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                        required 
                                        disabled={!!editingPlan}
                                    />
                                </div>
                            </div>

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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label className="label">Max Sucursales</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        value={formData.max_branches}
                                        onChange={e => setFormData({ ...formData, max_branches: e.target.value })}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="label">Max Usuarios</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        value={formData.max_users}
                                        onChange={e => setFormData({ ...formData, max_users: e.target.value })}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="label">Reparaciones/mes</label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        placeholder="Ilimitadas"
                                        value={formData.max_monthly_repairs}
                                        onChange={e => setFormData({ ...formData, max_monthly_repairs: e.target.value })}
                                    />
                                </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '8px 0' }} />
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>Características Habilitadas</div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={formData.ecommerce}
                                        onChange={e => setFormData({ ...formData, ecommerce: e.target.checked })}
                                    />
                                    <span>E-Commerce / Tienda Pública</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={formData.ai_assistant}
                                        onChange={e => setFormData({ ...formData, ai_assistant: e.target.checked })}
                                    />
                                    <span>Asistente IA de Diagnóstico</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={formData.advanced_reports}
                                        onChange={e => setFormData({ ...formData, advanced_reports: e.target.checked })}
                                    />
                                    <span>Reportes Financieros Avanzados</span>
                                </label>
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
