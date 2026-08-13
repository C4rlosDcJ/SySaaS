import { useState, useEffect } from 'react';
import { tenantService } from '../../services/api';
import { Building2, Search } from 'lucide-react';

export default function SuperDashboard() {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        try {
            setLoading(true);
            const res = await tenantService.getAll();
            setTenants(res.tenants || []);
        } catch (err) {
            alert(err.message || 'Error al obtener tenants');
        } finally {
            setLoading(false);
        }
    };

    const handleStatus = async (id, currentStatus) => {
        try {
            if (currentStatus === 'suspended') {
                await tenantService.activate(id);
            } else {
                if (!window.confirm('¿Deseas suspender esta empresa? Esto restringirá sus accesos.')) return;
                await tenantService.suspend(id);
            }
            loadTenants();
        } catch (err) {
            alert(err.message || 'Error al modificar estado');
        }
    };

    const filteredTenants = tenants.filter(t => 
        t.company_name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Building2 size={20} className="logo-icon" />
                        <span>SaaS SuperAdmin Dashboard</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Panel global de control de tenants, estados de facturación y planes.
                    </p>
                </div>
            </div>

            {/* Buscador */}
            <div className="card" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', padding: '12px var(--sp-4)' }}>
                <Search size={18} style={{ color: 'var(--color-text-secondary)' }} />
                <input 
                    type="text" 
                    className="input" 
                    placeholder="Buscar empresas por nombre o slug..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    style={{ border: 'none', padding: 0, background: 'transparent' }}
                />
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table className="table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Slug</th>
                                    <th>Plan</th>
                                    <th>Estado</th>
                                    <th>Registro</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTenants.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                            No se encontraron tenants registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTenants.map(t => (
                                        <tr key={t.id}>
                                            <td style={{ fontWeight: 600 }}>{t.company_name}</td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-xs)' }}>{t.slug}</td>
                                            <td style={{ textTransform: 'capitalize' }}>{t.plan_name}</td>
                                            <td>
                                                <span className="status-badge" style={{ 
                                                    color: t.subscription_status === 'active' ? 'var(--color-success)' : (t.subscription_status === 'suspended' ? 'var(--color-error)' : 'var(--color-warning)'),
                                                    borderColor: t.subscription_status === 'active' ? 'var(--color-success)' : (t.subscription_status === 'suspended' ? 'var(--color-error)' : 'var(--color-warning)')
                                                }}>
                                                    {t.subscription_status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td>{new Date(t.created_at).toLocaleDateString()}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button 
                                                    className={`btn btn-sm ${t.subscription_status === 'suspended' ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => handleStatus(t.id, t.subscription_status)}
                                                >
                                                    {t.subscription_status === 'suspended' ? 'Reactivar' : 'Suspender'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
