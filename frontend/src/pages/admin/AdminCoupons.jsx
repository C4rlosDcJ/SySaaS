import { useState, useEffect } from 'react';
import { couponService } from '../../services/api';
import { Tag, Plus, CheckCircle2, XCircle, Clock, Percent, DollarSign, AlertCircle } from 'lucide-react';
import { showAlert, showConfirm } from '../../utils/swal';
import { formatCurrency } from '../../utils/constants';

export default function AdminCoupons() {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        min_purchase: '0',
        max_uses: '',
        expires_at: ''
    });

    useEffect(() => {
        loadCoupons();
    }, []);

    const loadCoupons = async () => {
        setLoading(true);
        try {
            const data = await couponService.getAll();
            setCoupons(data || []);
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cargar cupones', icon: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCoupon = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await couponService.create(form);
            showAlert({ title: 'Cupón Creado', text: 'El nuevo cupón ha sido registrado exitosamente.', icon: 'success' });
            setShowModal(false);
            setForm({
                code: '',
                discount_type: 'percentage',
                discount_value: '',
                min_purchase: '0',
                max_uses: '',
                expires_at: ''
            });
            loadCoupons();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al crear cupón', icon: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (coupon) => {
        try {
            await couponService.toggleStatus(coupon.id);
            showAlert({ title: 'Estado Actualizado', text: `Cupón ${coupon.is_active ? 'desactivado' : 'activado'}.`, icon: 'success' });
            loadCoupons();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cambiar estado', icon: 'error' });
        }
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Tag size={28} className="text-primary" />
                        <span>Cupones & Promociones</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Crea cupones de descuento aplicables en caja (POS) y tienda.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Crear Cupón
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><div className="spinner"></div></div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Código de Cupón</th>
                                    <th>Descuento</th>
                                    <th>Compra Mínima</th>
                                    <th>Usos Realizados</th>
                                    <th>Expiración</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coupons.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>No hay cupones creados.</td></tr>
                                ) : (
                                    coupons.map(c => (
                                        <tr key={c.id}>
                                            <td>
                                                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '15px', color: 'var(--color-primary)' }}>
                                                    {c.code}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                {c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `${formatCurrency(c.discount_value)} OFF`}
                                            </td>
                                            <td>{c.min_purchase > 0 ? formatCurrency(c.min_purchase) : 'Sin mínimo'}</td>
                                            <td>
                                                {c.uses_count} {c.max_uses ? `/ ${c.max_uses}` : ''}
                                            </td>
                                            <td style={{ fontSize: '12px' }}>
                                                {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Sin expiración'}
                                            </td>
                                            <td>
                                                <span style={{ color: c.is_active ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600, fontSize: '12px' }}>
                                                    {c.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={() => handleToggleStatus(c)}
                                                    style={{ color: c.is_active ? 'var(--color-error)' : 'var(--color-success)' }}
                                                >
                                                    {c.is_active ? 'Desactivar' : 'Activar'}
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

            {/* Modal Crear Cupón */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Crear Cupón de Descuento</h3>
                        <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="label">Código Promocional *</label>
                                <input
                                    type="text" className="input" placeholder="Ej. VERANO15"
                                    value={form.code}
                                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    required
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Tipo Descuento *</label>
                                    <select className="select" value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
                                        <option value="percentage">Porcentaje (%)</option>
                                        <option value="fixed">Monto Fijo ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Valor Descuento *</label>
                                    <input
                                        type="number" step="0.01" className="input" placeholder={form.discount_type === 'percentage' ? 'Ej. 15' : 'Ej. 100'}
                                        value={form.discount_value}
                                        onChange={e => setForm({ ...form, discount_value: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Compra Mínima ($)</label>
                                    <input
                                        type="number" step="0.01" className="input" placeholder="0"
                                        value={form.min_purchase}
                                        onChange={e => setForm({ ...form, min_purchase: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Máximo de Usos</label>
                                    <input
                                        type="number" className="input" placeholder="Sin límite"
                                        value={form.max_uses}
                                        onChange={e => setForm({ ...form, max_uses: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label">Fecha de Expiración</label>
                                <input
                                    type="date" className="input"
                                    value={form.expires_at}
                                    onChange={e => setForm({ ...form, expires_at: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>Crear Cupón</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
