import { useState, useEffect } from 'react';
import { broadcastService } from '../../services/api';
import { Megaphone, Plus, Bell, AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { showAlert } from '../../utils/swal';

export default function SuperBroadcastsPage() {
    const [broadcasts, setBroadcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        title: '',
        message: '',
        type: 'info',
        expires_at: ''
    });

    useEffect(() => {
        loadBroadcasts();
    }, []);

    const loadBroadcasts = async () => {
        setLoading(true);
        try {
            const data = await broadcastService.getAll();
            setBroadcasts(data || []);
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cargar avisos del sistema', icon: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBroadcast = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await broadcastService.create(form);
            showAlert({ title: 'Aviso Publicado', text: 'El comunicado global ha sido emitido a todas las empresas.', icon: 'success' });
            setShowModal(false);
            setForm({ title: '', message: '', type: 'info', expires_at: '' });
            loadBroadcasts();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al publicar aviso', icon: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (b) => {
        try {
            await broadcastService.toggleStatus(b.id);
            showAlert({ title: 'Estado Actualizado', text: `Comunicado ${b.is_active ? 'desactivado' : 'activado'}.`, icon: 'success' });
            loadBroadcasts();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cambiar estado', icon: 'error' });
        }
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Megaphone size={28} className="text-primary" />
                        <span>Anuncios & Comunicados del Sistema</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Emite avisos globales (mantenimiento, actualizaciones, ofertas) a los administradores de empresas.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Emitir Comunicado
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
                                    <th>Título del Anuncio</th>
                                    <th>Mensaje</th>
                                    <th>Nivel de Importancia</th>
                                    <th>Publicado Por</th>
                                    <th>Expiración</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {broadcasts.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>No hay anuncios del sistema publicados.</td></tr>
                                ) : (
                                    broadcasts.map(b => (
                                        <tr key={b.id}>
                                            <td style={{ fontWeight: 700 }}>{b.title}</td>
                                            <td style={{ maxWidth: '300px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{b.message}</td>
                                            <td>
                                                <span className={`status-badge status-${b.type === 'urgent' ? 'repairing' : b.type === 'warning' ? 'info' : 'delivered'}`}>
                                                    {b.type === 'urgent' ? 'Urgente' : b.type === 'warning' ? 'Advertencia' : 'Informativo'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px' }}>{b.author_name || 'SuperAdmin'}</td>
                                            <td style={{ fontSize: '12px' }}>{b.expires_at ? new Date(b.expires_at).toLocaleDateString() : 'Sin expiración'}</td>
                                            <td>
                                                <span style={{ color: b.is_active ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600, fontSize: '12px' }}>
                                                    {b.is_active ? 'Activo (Visible)' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={() => handleToggleStatus(b)}
                                                    style={{ color: b.is_active ? 'var(--color-error)' : 'var(--color-success)' }}
                                                >
                                                    {b.is_active ? 'Desactivar' : 'Activar'}
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

            {/* Modal Crear Comunicado */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Emitir Comunicado Global</h3>
                        <form onSubmit={handleCreateBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="label">Título del Anuncio *</label>
                                <input
                                    type="text" className="input" placeholder="Ej. Mantenimiento Programado"
                                    value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                                />
                            </div>
                            <div>
                                <label className="label">Nivel de Importancia *</label>
                                <select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                                    <option value="info">Informativo (Azul)</option>
                                    <option value="warning">Advertencia (Naranja)</option>
                                    <option value="urgent">Urgente (Rojo)</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Mensaje Completo *</label>
                                <textarea
                                    className="input" rows="4" placeholder="Escribe el mensaje que verán los usuarios..."
                                    value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required
                                ></textarea>
                            </div>
                            <div>
                                <label className="label">Fecha de Expiración (Opcional)</label>
                                <input
                                    type="date" className="input"
                                    value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>Publicar Comunicado</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
