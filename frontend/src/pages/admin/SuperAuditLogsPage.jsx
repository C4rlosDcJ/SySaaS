import { useState, useEffect } from 'react';
import { superAdminService } from '../../services/api';
import { Activity, Search, Shield, RefreshCw, Filter, Terminal, User, Building2, Calendar, Download } from 'lucide-react';

export default function SuperAuditLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const res = await superAdminService.getAuditLogs({ search });
            setLogs(res || []);
        } catch (err) {
            console.error('Error al cargar logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadLogs();
    };

    const handleExportCSV = () => {
        if (!logs || logs.length === 0) return;

        const headers = ['ID', 'Usuario Email', 'Empresa ID', 'Acción', 'Detalles', 'Fecha'];
        const rows = logs.map(l => [
            l.id,
            `"${(l.user_email || 'Sistema').replace(/"/g, '""')}"`,
            l.tenant_id || 'Global',
            `"${(l.action || '').replace(/"/g, '""')}"`,
            `"${(l.details || '').replace(/"/g, '""')}"`,
            new Date(l.created_at).toLocaleString()
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `auditoria_sysaas_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Terminal size={28} className="text-primary" />
                        <span>Auditoría Global & Logs del Sistema</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Registro en tiempo real de operaciones de escritura, modificaciones y eventos de seguridad en todas las empresas.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={handleExportCSV} title="Exportar logs a CSV">
                        <Download size={16} /> Exportar CSV
                    </button>
                    <button className="btn btn-secondary" onClick={loadLogs} title="Recargar logs">
                        <RefreshCw size={16} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* Buscador / Filtro */}
            <form onSubmit={handleSearchSubmit} className="card" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', padding: '12px var(--sp-4)' }}>
                <Search size={18} style={{ color: 'var(--color-text-secondary)' }} />
                <input 
                    type="text" 
                    className="input" 
                    placeholder="Filtrar logs por correo de usuario, tipo de acción o nombre de empresa..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    style={{ border: 'none', padding: 0, background: 'transparent', width: '100%' }}
                />
                <button type="submit" className="btn btn-primary btn-sm">
                    <Filter size={14} />
                    Filtrar
                </button>
            </form>

            {/* Tabla de Logs */}
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
                                    <th>Fecha / Hora</th>
                                    <th>Empresa</th>
                                    <th>Usuario</th>
                                    <th>Acción Ejecutada</th>
                                    <th style={{ textAlign: 'right' }}>Detalle</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '32px' }}>
                                            No se registraron logs de auditoría recientemente.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map(log => (
                                        <tr key={log.id}>
                                            <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Calendar size={13} />
                                                    {new Date(log.created_at).toLocaleString()}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Building2 size={14} className="text-primary" />
                                                    {log.company_name || 'Global / Plataforma'}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                                    <User size={14} style={{ color: 'var(--color-text-muted)' }} />
                                                    {log.user_email}
                                                </div>
                                            </td>
                                            <td>
                                                <span 
                                                    style={{ 
                                                        fontFamily: 'var(--font-mono)', 
                                                        fontSize: '12px',
                                                        padding: '2px 8px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: log.action.startsWith('POST') ? 'rgba(16, 185, 129, 0.1)' : (log.action.startsWith('DELETE') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'),
                                                        color: log.action.startsWith('POST') ? 'var(--color-success)' : (log.action.startsWith('DELETE') ? 'var(--color-error)' : 'var(--color-info)'),
                                                        border: '1px solid currentColor'
                                                    }}
                                                >
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button 
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={() => setSelectedLog(log)}
                                                >
                                                    Inspeccionar JSON
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

            {/* Modal Inspección de Payload JSON */}
            {selectedLog && (
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
                    <div className="card" style={{ width: '100%', maxWidth: '600px', position: 'relative', padding: '24px' }}>
                        <button 
                            onClick={() => setSelectedLog(null)}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                        >
                            ✕
                        </button>

                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>Detalles Técnicos del Evento</h3>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                            Payload registrado el {new Date(selectedLog.created_at).toLocaleString()} por {selectedLog.user_email}
                        </p>

                        <pre style={{
                            background: 'var(--color-bg-tertiary, #0a0a0a)',
                            padding: '16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            color: '#10b981',
                            overflowX: 'auto',
                            maxHeight: '350px'
                        }}>
                            {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
