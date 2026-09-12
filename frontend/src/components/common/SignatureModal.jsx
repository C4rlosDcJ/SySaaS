import React, { useRef, useState, useEffect, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Check, Eraser } from 'lucide-react';

const SignatureModal = ({ isOpen, onClose, onSave, title, description }) => {
    const sigCanvas = useRef({});
    const containerRef = useRef(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 200 });

    // Resize the canvas to always fill its container (critical for touch on mobile)
    const updateCanvasSize = useCallback(() => {
        if (containerRef.current) {
            const w = containerRef.current.offsetWidth;
            setCanvasSize({ width: w, height: 200 });
            // After a size change the canvas resets; mark as empty
            setIsEmpty(true);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        // Give the DOM a tick to render before measuring
        const t = setTimeout(updateCanvasSize, 50);
        window.addEventListener('resize', updateCanvasSize);
        return () => {
            clearTimeout(t);
            window.removeEventListener('resize', updateCanvasSize);
        };
    }, [isOpen, updateCanvasSize]);

    if (!isOpen) return null;

    const clear = () => {
        sigCanvas.current.clear();
        setIsEmpty(true);
    };

    const save = () => {
        if (isEmpty) {
            alert('Por favor agrega una firma para continuar.');
            return;
        }
        const signatureData = sigCanvas.current.toDataURL('image/png');
        onSave(signatureData);
    };

    return (
        <div
            className="modal-overlay"
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                // Prevent accidental scroll-behind on mobile
                overscrollBehavior: 'contain'
            }}
        >
            <div
                className="modal-content"
                style={{
                    background: '#1a1a1a', padding: '2rem', borderRadius: '10px',
                    width: '95%', maxWidth: '600px', border: '1px solid #333'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>{title || 'Firma Requerida'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <p style={{ color: '#ccc', marginBottom: '1.5rem', fontSize: '14px' }}>
                    {description || 'Por favor firma en el recuadro a continuacion para confirmar.'}
                </p>

                {/* Canvas container: touch-action none prevents iOS scroll from interfering */}
                <div
                    ref={containerRef}
                    style={{
                        border: '2px dashed #444',
                        borderRadius: '8px',
                        background: '#fff',
                        marginBottom: '1.5rem',
                        overflow: 'hidden',
                        // KEY: disables browser touch scrolling inside this element
                        touchAction: 'none'
                    }}
                >
                    {canvasSize.width > 0 && (
                        <SignatureCanvas
                            ref={sigCanvas}
                            penColor="black"
                            canvasProps={{
                                width: canvasSize.width,
                                height: canvasSize.height,
                                className: 'sigCanvas',
                                style: {
                                    width: '100%',
                                    height: `${canvasSize.height}px`,
                                    display: 'block',
                                    // touch-action must also be on the canvas element itself
                                    touchAction: 'none'
                                }
                            }}
                            onBegin={() => setIsEmpty(false)}
                        />
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={clear}
                        className="btn btn-ghost"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff6b6b' }}
                    >
                        <Eraser size={18} /> Limpiar
                    </button>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => onSave(null)}
                            className="btn btn-ghost"
                            style={{ color: 'var(--color-primary)' }}
                        >
                            Omitir Firma
                        </button>
                        <button
                            onClick={onClose}
                            className="btn btn-secondary"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={save}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Check size={18} /> Confirmar Firma
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignatureModal;
