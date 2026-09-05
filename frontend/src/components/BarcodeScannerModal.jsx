import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Zap, ZapOff, RefreshCw, Volume2, VolumeX, CheckCircle, AlertCircle } from 'lucide-react';
import './BarcodeScannerModal.css';

const BarcodeScannerModal = ({ isOpen, onClose, onScan }) => {
    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [continuousMode, setContinuousMode] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Apunte la camara hacia el codigo de barras');
    const [statusType, setStatusType] = useState('info'); // info, success, error
    const [cameraError, setCameraError] = useState(null);

    const scannerRef = useRef(null);
    const lastScanRef = useRef({ code: '', time: 0 });
    const isStartingRef = useRef(false);
    const isStoppingRef = useRef(false);
    const isMountedRef = useRef(false);

    const playBeep = useCallback(() => {
        if (!soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(950, ctx.currentTime);
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (e) {
            // Audio context not allowed or failed
        }
    }, [soundEnabled]);

    // Detener scanner de forma 100% segura y controlada sin romper el DOM de React
    const stopScannerSafely = useCallback(async () => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;

        // Si la camara aun esta en proceso de inicio, esperar brevemente
        let waitAttempts = 0;
        while (isStartingRef.current && waitAttempts < 20) {
            await new Promise(r => setTimeout(r, 60));
            waitAttempts++;
        }

        try {
            const scanner = scannerRef.current;
            if (scanner) {
                scannerRef.current = null;
                try {
                    if (scanner.isScanning) {
                        await scanner.stop();
                    }
                } catch (stopErr) {
                    // Ignorar si ya estaba detenido
                }

                try {
                    scanner.clear();
                } catch (clearErr) {
                    // Ignorar si el DOM ya se limpio
                }
            }
        } catch (err) {
            console.warn('Error al detener scanner de forma segura:', err);
        } finally {
            isStoppingRef.current = false;
        }
    }, []);

    // Manejador del boton de cierre
    const handleClose = async () => {
        await stopScannerSafely();
        if (onClose) {
            onClose();
        }
    };

    const handleSuccessScan = useCallback((decodedText) => {
        const now = Date.now();
        // Evitar procesar el mismo codigo repetidamente dentro de 1.8 segundos
        if (lastScanRef.current.code === decodedText && (now - lastScanRef.current.time) < 1800) {
            return;
        }

        lastScanRef.current = { code: decodedText, time: now };
        playBeep();

        if (onScan) {
            const result = onScan(decodedText);
            const isOk = result && result.success !== false;
            
            if (isOk) {
                setStatusType('success');
                setStatusMessage(`Leido: ${decodedText}`);
                if (!continuousMode) {
                    setTimeout(async () => {
                        await handleClose();
                    }, 400);
                }
            } else {
                setStatusType('error');
                setStatusMessage(`No encontrado: ${decodedText}`);
            }

            // Restaurar estado a info luego de 2 segundos
            setTimeout(() => {
                if (isMountedRef.current) {
                    setStatusType('info');
                    setStatusMessage('Apunte la camara hacia el codigo de barras');
                }
            }, 2000);
        }
    }, [continuousMode, onScan, playBeep, stopScannerSafely]);

    // Iniciar el escaner con la camara elegida
    const startScanner = useCallback(async (cameraIdOrConfig) => {
        if (!isMountedRef.current || isStoppingRef.current) return;

        setCameraError(null);
        setStatusMessage('Iniciando camara...');
        setStatusType('info');

        await stopScannerSafely();

        if (!isMountedRef.current || isStoppingRef.current) return;

        isStartingRef.current = true;
        try {
            const viewport = document.getElementById('pos-barcode-viewport');
            if (!viewport) {
                isStartingRef.current = false;
                return;
            }

            const html5QrCode = new Html5Qrcode('pos-barcode-viewport', {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.ITF,
                    Html5QrcodeSupportedFormats.CODABAR
                ],
                verbose: false
            });

            scannerRef.current = html5QrCode;

            const config = {
                fps: 15,
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                    const width = Math.floor(minEdge * 0.85);
                    const height = Math.floor(width * 0.55);
                    return { width: Math.max(width, 220), height: Math.max(height, 140) };
                },
                aspectRatio: 1.333333
            };

            await html5QrCode.start(
                cameraIdOrConfig,
                config,
                (decodedText) => handleSuccessScan(decodedText),
                () => {}
            );

            // Si durante el await de start se pidio cerrar, detenerlo inmediatamente
            if (!isMountedRef.current || isStoppingRef.current) {
                try { await html5QrCode.stop(); } catch(e) {}
                try { html5QrCode.clear(); } catch(e) {}
                scannerRef.current = null;
                return;
            }

            setStatusMessage('Listo. Enfoca el codigo de barras.');

            // Comprobar soporte de linterna
            try {
                const capabilities = html5QrCode.getRunningTrackCapabilities();
                if (capabilities && capabilities.torch) {
                    setTorchAvailable(true);
                } else {
                    setTorchAvailable(false);
                }
            } catch (e) {
                setTorchAvailable(false);
            }

        } catch (err) {
            console.error('Error al iniciar camara:', err);
            if (isMountedRef.current) {
                setCameraError(
                    err.name === 'NotAllowedError'
                        ? 'Permiso de camara denegado. Habilite el acceso a la camara en la configuracion de su navegador.'
                        : 'No se pudo acceder a la camara. Verifique que no este en uso por otra aplicacion y que su conexion sea segura (HTTPS o localhost).'
                );
            }
        } finally {
            isStartingRef.current = false;
        }
    }, [handleSuccessScan, stopScannerSafely]);

    // Alternar linterna/flash
    const toggleTorch = async () => {
        if (!scannerRef.current || !torchAvailable) return;
        try {
            const nextState = !torchOn;
            await scannerRef.current.applyVideoConstraints({
                advanced: [{ torch: nextState }]
            });
            setTorchOn(nextState);
        } catch (e) {
            console.error('Error al alternar linterna:', e);
        }
    };

    // Alternar camara (cambiar entre trasera y delantera)
    const switchCamera = () => {
        if (cameras.length < 2) return;
        const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        const nextCam = cameras[nextIndex];
        setSelectedCameraId(nextCam.id);
        startScanner(nextCam.id);
    };

    // Inicializacion y deteccion de camaras al montar
    useEffect(() => {
        isMountedRef.current = true;

        Html5Qrcode.getCameras().then((devices) => {
            if (!isMountedRef.current) return;
            if (devices && devices.length) {
                setCameras(devices);
                // Preferir camara trasera
                const backCam = devices.find(d => 
                    d.label.toLowerCase().includes('back') || 
                    d.label.toLowerCase().includes('trasera') || 
                    d.label.toLowerCase().includes('environment') ||
                    d.label.toLowerCase().includes('rear')
                );
                const targetId = backCam ? backCam.id : devices[0].id;
                setSelectedCameraId(targetId);
                startScanner(targetId);
            } else {
                startScanner({ facingMode: "environment" });
            }
        }).catch((err) => {
            console.warn('Fallo getCameras, intentando facingMode:', err);
            if (isMountedRef.current) {
                startScanner({ facingMode: "environment" });
            }
        });

        return () => {
            isMountedRef.current = false;
            stopScannerSafely();
        };
    }, [startScanner, stopScannerSafely]);

    return (
        <div className="barcode-modal-overlay" onClick={handleClose}>
            <div className="barcode-modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="barcode-modal-header">
                    <div className="barcode-modal-title">
                        <Camera size={20} className="barcode-modal-icon" />
                        <div>
                            <h3>Escaner de Codigos</h3>
                            <span className="barcode-modal-subtitle">Camara del dispositivo</span>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="barcode-close-btn" 
                        onClick={handleClose}
                        title="Cerrar escaner"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="barcode-scanner-body">
                    {cameraError ? (
                        <div className="barcode-error-card">
                            <AlertCircle size={36} className="barcode-error-icon" />
                            <p className="barcode-error-text">{cameraError}</p>
                            <button 
                                type="button" 
                                className="barcode-retry-btn"
                                onClick={() => startScanner({ facingMode: "environment" })}
                            >
                                <RefreshCw size={16} /> Reintentar acceso
                            </button>
                        </div>
                    ) : (
                        <div className="barcode-viewport-wrapper">
                            <div id="pos-barcode-viewport" className="barcode-viewport"></div>
                            <div className="barcode-guide-overlay">
                                <div className="barcode-guide-box">
                                    <div className="laser-line"></div>
                                    <div className="corner-tl"></div>
                                    <div className="corner-tr"></div>
                                    <div className="corner-bl"></div>
                                    <div className="corner-br"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`barcode-status-bar status-${statusType}`}>
                        {statusType === 'success' && <CheckCircle size={16} />}
                        {statusType === 'error' && <AlertCircle size={16} />}
                        <span>{statusMessage}</span>
                    </div>

                    <div className="barcode-modal-controls">
                        <div className="barcode-control-toggles">
                            <label className="barcode-toggle-item" title="Mantener abierto tras cada lectura">
                                <input 
                                    type="checkbox" 
                                    checked={continuousMode} 
                                    onChange={(e) => setContinuousMode(e.target.checked)} 
                                />
                                <span>Escaneo continuo</span>
                            </label>

                            <button 
                                type="button" 
                                className={`barcode-icon-btn ${soundEnabled ? 'active' : ''}`}
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                title={soundEnabled ? "Sonido activado" : "Sonido desactivado"}
                            >
                                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                            </button>

                            {torchAvailable && (
                                <button 
                                    type="button" 
                                    className={`barcode-icon-btn ${torchOn ? 'active' : ''}`}
                                    onClick={toggleTorch}
                                    title={torchOn ? "Apagar flash" : "Encender flash"}
                                >
                                    {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
                                </button>
                            )}

                            {cameras.length > 1 && (
                                <button 
                                    type="button" 
                                    className="barcode-icon-btn"
                                    onClick={switchCamera}
                                    title="Cambiar camara"
                                >
                                    <RefreshCw size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BarcodeScannerModal;
