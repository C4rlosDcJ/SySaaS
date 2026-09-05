import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, RefreshCw, Check, Trash2, Zap, ZapOff, AlertCircle, Sparkles, Plus, Image as ImageIcon } from 'lucide-react';
import './CameraCaptureModal.css';

export default function CameraCaptureModal({
    isOpen,
    onClose,
    onCapture,
    title = 'Tomar Fotografía',
    multiple = false,
    maxPhotos = 8
}) {
    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [flashActive, setFlashActive] = useState(false);

    // En modo individual: foto capturada para revision
    const [singleCaptured, setSingleCaptured] = useState(null);

    // En modo multiple: lista de fotos acumuladas
    const [capturedList, setCapturedList] = useState([]);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const isMountedRef = useRef(false);
    const nativeFileRef = useRef(null);

    // Detener la camara y apagar tracks
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {
                    // Ignore track stop error
                }
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setTorchOn(false);
        setTorchAvailable(false);
    }, []);

    // Iniciar camara con deviceId o facingMode
    const startCamera = useCallback(async (cameraId = '') => {
        stopCamera();
        setCameraError(null);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('Este navegador no soporta el acceso a la camara.');
            return;
        }

        const videoConstraints = {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        };

        if (cameraId) {
            videoConstraints.deviceId = { exact: cameraId };
        } else {
            videoConstraints.facingMode = { ideal: 'environment' };
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: false
            });

            if (!isMountedRef.current) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {});
            }

            // Comprobar soporte de flash / torch
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack && videoTrack.getCapabilities) {
                const caps = videoTrack.getCapabilities();
                if (caps && caps.torch) {
                    setTorchAvailable(true);
                }
            }

        } catch (err) {
            console.error('Error accediendo a la camara:', err);
            if (isMountedRef.current) {
                if (err.name === 'NotAllowedError') {
                    setCameraError('Permiso de camara denegado. Permita el acceso en su navegador para capturar fotos.');
                } else {
                    setCameraError('No se pudo acceder a la camara. Verifique que no este en uso y que la conexion sea segura (HTTPS o localhost).');
                }
            }
        }
    }, [stopCamera]);

    // Alternar linterna/flash
    const toggleTorch = async () => {
        if (!streamRef.current || !torchAvailable) return;
        const track = streamRef.current.getVideoTracks()[0];
        if (!track) return;

        try {
            const nextState = !torchOn;
            await track.applyConstraints({
                advanced: [{ torch: nextState }]
            });
            setTorchOn(nextState);
        } catch (e) {
            console.error('Error alternando linterna:', e);
        }
    };

    // Cambiar de camara
    const switchCamera = () => {
        if (cameras.length < 2) return;
        const currentIndex = cameras.findIndex(c => c.deviceId === selectedCameraId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        const nextCam = cameras[nextIndex];
        setSelectedCameraId(nextCam.deviceId);
        startCamera(nextCam.deviceId);
    };

    // Inicializar dispositivos y camara al montar
    useEffect(() => {
        if (!isOpen) return;

        isMountedRef.current = true;
        setSingleCaptured(null);
        setCapturedList([]);

        navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
            if (!isMountedRef.current) return;
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setCameras(videoDevices);

            const backCam = videoDevices.find(d =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('trasera') ||
                d.label.toLowerCase().includes('environment') ||
                d.label.toLowerCase().includes('rear')
            );

            const targetId = backCam ? backCam.deviceId : (videoDevices[0]?.deviceId || '');
            setSelectedCameraId(targetId);
            startCamera(targetId);
        }).catch(() => {
            if (isMountedRef.current) {
                startCamera();
            }
        });

        return () => {
            isMountedRef.current = false;
            stopCamera();
        };
    }, [isOpen, startCamera, stopCamera]);

    // Tomar foto del fotograma actual de video
    const takePhoto = () => {
        if (!videoRef.current || !streamRef.current) return;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Disparo de efecto flash
        setFlashActive(true);
        setTimeout(() => setFlashActive(false), 120);

        canvas.toBlob((blob) => {
            if (!blob) return;
            const timestamp = Date.now();
            const fileName = `foto_${timestamp}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            const dataUrl = URL.createObjectURL(blob);

            if (multiple) {
                if (capturedList.length >= maxPhotos) {
                    alert(`Limite maximo de ${maxPhotos} fotos alcanzado.`);
                    return;
                }
                setCapturedList(prev => [...prev, { id: timestamp, file, dataUrl }]);
            } else {
                setSingleCaptured({ file, dataUrl });
                stopCamera();
            }
        }, 'image/jpeg', 0.88);
    };

    // Reintentar foto (modo individual)
    const handleRetake = () => {
        if (singleCaptured?.dataUrl) {
            URL.revokeObjectURL(singleCaptured.dataUrl);
        }
        setSingleCaptured(null);
        startCamera(selectedCameraId);
    };

    // Confirmar foto individual
    const handleConfirmSingle = () => {
        if (!singleCaptured) return;
        stopCamera();
        if (onCapture) {
            onCapture(singleCaptured.file);
        }
        onClose();
    };

    // Confirmar lista de fotos (modo multiple)
    const handleConfirmMultiple = () => {
        if (capturedList.length === 0) return;
        stopCamera();
        if (onCapture) {
            onCapture(capturedList.map(item => item.file));
        }
        onClose();
    };

    // Eliminar foto de la lista en modo multiple
    const handleRemoveFromList = (id) => {
        setCapturedList(prev => {
            const item = prev.find(p => p.id === id);
            if (item?.dataUrl) URL.revokeObjectURL(item.dataUrl);
            return prev.filter(p => p.id !== id);
        });
    };

    // Soporte para camara nativa del celular mediante input file
    const handleNativeFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (multiple) {
            const newItems = files.map(file => ({
                id: Date.now() + Math.random(),
                file,
                dataUrl: URL.createObjectURL(file)
            }));
            setCapturedList(prev => [...prev, ...newItems]);
        } else {
            const file = files[0];
            setSingleCaptured({
                file,
                dataUrl: URL.createObjectURL(file)
            });
            stopCamera();
        }
        if (nativeFileRef.current) nativeFileRef.current.value = '';
    };

    const handleClose = () => {
        stopCamera();
        if (singleCaptured?.dataUrl) URL.revokeObjectURL(singleCaptured.dataUrl);
        capturedList.forEach(item => {
            if (item.dataUrl) URL.revokeObjectURL(item.dataUrl);
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="camera-modal-overlay" onClick={handleClose}>
            <div className="camera-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Cabecera */}
                <div className="camera-modal-header">
                    <div className="camera-modal-title">
                        <Camera size={20} className="camera-modal-icon" />
                        <div>
                            <h3>{title}</h3>
                            <span className="camera-modal-subtitle">
                                {multiple ? `Modo multiple (${capturedList.length}/${maxPhotos} capturadas)` : 'Vista previa de camara'}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="camera-close-btn"
                        onClick={handleClose}
                        title="Cerrar camara"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Cuerpo del Visor */}
                <div className="camera-modal-body">
                    {cameraError ? (
                        <div className="camera-error-card">
                            <AlertCircle size={40} className="camera-error-icon" />
                            <p className="camera-error-text">{cameraError}</p>
                            <div className="camera-error-actions">
                                <button
                                    type="button"
                                    className="camera-retry-btn"
                                    onClick={() => startCamera(selectedCameraId)}
                                >
                                    <RefreshCw size={16} /> Reintentar
                                </button>
                                <button
                                    type="button"
                                    className="camera-native-btn"
                                    onClick={() => nativeFileRef.current?.click()}
                                >
                                    <Camera size={16} /> Abrir app de camara nativa
                                </button>
                            </div>
                        </div>
                    ) : singleCaptured ? (
                        /* Previsualizacion de foto tomada (modo individual) */
                        <div className="camera-review-box">
                            <img
                                src={singleCaptured.dataUrl}
                                alt="Foto capturada"
                                className="camera-review-img"
                            />
                            <div className="camera-review-actions">
                                <button
                                    type="button"
                                    className="camera-btn-retake"
                                    onClick={handleRetake}
                                >
                                    <RefreshCw size={16} /> Tomar de nuevo
                                </button>
                                <button
                                    type="button"
                                    className="camera-btn-confirm"
                                    onClick={handleConfirmSingle}
                                >
                                    <Check size={16} /> Usar esta foto
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Visor en tiempo real */
                        <div className="camera-viewport-wrapper">
                            <video
                                ref={videoRef}
                                className="camera-video-element"
                                autoPlay
                                playsInline
                                muted
                            />
                            {flashActive && <div className="camera-flash-overlay" />}

                            {/* Controles flotantes superiores en visor */}
                            <div className="camera-overlay-top-controls">
                                {torchAvailable && (
                                    <button
                                        type="button"
                                        className={`camera-floating-btn ${torchOn ? 'active' : ''}`}
                                        onClick={toggleTorch}
                                        title={torchOn ? 'Apagar flash' : 'Encender flash'}
                                    >
                                        {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
                                    </button>
                                )}
                                {cameras.length > 1 && (
                                    <button
                                        type="button"
                                        className="camera-floating-btn"
                                        onClick={switchCamera}
                                        title="Cambiar camara"
                                    >
                                        <RefreshCw size={18} />
                                    </button>
                                )}
                            </div>

                            {/* Boton de disparo central */}
                            <div className="camera-shutter-container">
                                <button
                                    type="button"
                                    className="camera-shutter-btn"
                                    onClick={takePhoto}
                                    title="Capturar foto"
                                >
                                    <div className="camera-shutter-inner" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Galeria inferior en modo multiple */}
                    {multiple && capturedList.length > 0 && (
                        <div className="camera-multiple-tray">
                            <div className="camera-tray-label">
                                Fotos listas ({capturedList.length}):
                            </div>
                            <div className="camera-thumbnails-scroll">
                                {capturedList.map((item, idx) => (
                                    <div key={item.id} className="camera-thumbnail-item">
                                        <img src={item.dataUrl} alt={`Foto ${idx + 1}`} />
                                        <button
                                            type="button"
                                            className="camera-thumb-del"
                                            onClick={() => handleRemoveFromList(item.id)}
                                            title="Eliminar foto"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="camera-btn-confirm-all"
                                onClick={handleConfirmMultiple}
                            >
                                <Check size={16} /> Guardar {capturedList.length} {capturedList.length === 1 ? 'Foto' : 'Fotos'}
                            </button>
                        </div>
                    )}

                    {/* Atajo secundario a camara nativa del telefono */}
                    <div className="camera-footer-hint">
                        <button
                            type="button"
                            className="camera-hint-link"
                            onClick={() => nativeFileRef.current?.click()}
                        >
                            O captura con la aplicacion de camara de tu dispositivo
                        </button>
                        <input
                            ref={nativeFileRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple={multiple}
                            style={{ display: 'none' }}
                            onChange={handleNativeFileChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
