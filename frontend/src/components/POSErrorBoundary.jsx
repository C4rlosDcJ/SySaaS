import { Component } from 'react';

export default class POSErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[POSErrorBoundary] Render crash en POS:', error, info);
    }

    handleClearAndReload = () => {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sysaas_paused_orders_') || key.startsWith('sysaas_draft_pos'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    gap: '16px',
                    background: 'var(--color-bg, #0a0a0a)',
                    color: 'var(--color-text, #fff)',
                    padding: '32px',
                    textAlign: 'center'
                }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                        Error al cargar el Punto de Venta
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary, #999)', maxWidth: '420px', margin: 0, fontSize: '0.9rem' }}>
                        Se encontraron datos locales corruptos que impiden la carga del modulo.
                        Haz clic en el boton para limpiar los datos temporales y recargar.
                    </p>
                    <button
                        onClick={this.handleClearAndReload}
                        style={{
                            background: 'var(--color-primary, #6366f1)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 24px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Limpiar datos y recargar
                    </button>
                    {this.state.error && (
                        <details style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #666)', maxWidth: '600px' }}>
                            <summary style={{ cursor: 'pointer' }}>Detalle del error</summary>
                            <pre style={{ textAlign: 'left', marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {this.state.error.toString()}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
