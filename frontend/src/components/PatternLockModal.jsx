import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw, Grid } from 'lucide-react';
import './PatternLockModal.css';

export default function PatternLockModal({ isOpen, onClose, onSave, initialPattern = '' }) {
    const [pattern, setPattern] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const svgRef = useRef(null);

    // Los 9 puntos del patrón 3x3 numerados del 1 al 9:
    // 1 2 3
    // 4 5 6
    // 7 8 9
    const points = [
        { id: 1, x: 50, y: 50 },
        { id: 2, x: 150, y: 50 },
        { id: 3, x: 250, y: 50 },
        { id: 4, x: 50, y: 150 },
        { id: 5, x: 150, y: 150 },
        { id: 6, x: 250, y: 150 },
        { id: 7, x: 50, y: 250 },
        { id: 8, x: 150, y: 250 },
        { id: 9, x: 250, y: 250 },
    ];

    const [cursorPos, setCursorPos] = useState(null);

    useEffect(() => {
        if (isOpen && initialPattern) {
            // Si viene con formato "Patrón: 1-2-3-6-9" o similar
            const matches = initialPattern.match(/\d+/g);
            if (matches && matches.length > 0) {
                const nums = matches.map(Number).filter(n => n >= 1 && n <= 9);
                setPattern(nums);
            } else {
                setPattern([]);
            }
        } else if (isOpen) {
            setPattern([]);
        }
        setCursorPos(null);
    }, [isOpen, initialPattern]);

    const getPointUnderCoords = (clientX, clientY) => {
        if (!svgRef.current) return null;
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = 300 / rect.width;
        const scaleY = 300 / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        // radio de tolerancia 26px
        for (const p of points) {
            const dx = p.x - x;
            const dy = p.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < 26) {
                return { point: p, svgCoords: { x, y } };
            }
        }
        return { point: null, svgCoords: { x, y } };
    };

    const handleStart = (clientX, clientY) => {
        setIsDrawing(true);
        const { point, svgCoords } = getPointUnderCoords(clientX, clientY);
        setCursorPos(svgCoords);
        if (point) {
            setPattern([point.id]);
        } else {
            setPattern([]);
        }
    };

    const handleMove = (clientX, clientY) => {
        if (!isDrawing) return;
        const { point, svgCoords } = getPointUnderCoords(clientX, clientY);
        setCursorPos(svgCoords);
        if (point && !pattern.includes(point.id)) {
            setPattern(prev => [...prev, point.id]);
        }
    };

    const handleEnd = () => {
        setIsDrawing(false);
        setCursorPos(null);
    };

    const handleClear = () => {
        setPattern([]);
        setCursorPos(null);
    };

    const handleConfirm = () => {
        if (pattern.length === 0) {
            onSave('');
        } else {
            onSave(`Patrón: ${pattern.join('-')}`);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="pattern-modal-overlay" onClick={onClose}>
            <div className="pattern-modal-card" onClick={e => e.stopPropagation()}>
                <div className="pattern-modal-header">
                    <div className="flex items-center gap-xs">
                        <Grid size={18} className="text-primary" />
                        <h3>Dibujar Patrón de Desbloqueo</h3>
                    </div>
                    <button type="button" className="btn-icon btn-ghost" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="pattern-modal-body">
                    <p className="pattern-hint">
                        Arrastra o toca los puntos en orden para trazar el patrón de seguridad del equipo:
                    </p>

                    <div className="pattern-svg-wrapper">
                        <svg
                            ref={svgRef}
                            viewBox="0 0 300 300"
                            className="pattern-svg"
                            onMouseDown={e => handleStart(e.clientX, e.clientY)}
                            onMouseMove={e => handleMove(e.clientX, e.clientY)}
                            onMouseUp={handleEnd}
                            onTouchStart={e => {
                                if (e.touches[0]) {
                                    handleStart(e.touches[0].clientX, e.touches[0].clientY);
                                }
                            }}
                            onTouchMove={e => {
                                if (e.touches[0]) {
                                    handleMove(e.touches[0].clientX, e.touches[0].clientY);
                                }
                            }}
                            onTouchEnd={handleEnd}
                        >
                            {/* Líneas ya conectadas */}
                            {pattern.map((pointId, index) => {
                                if (index === 0) return null;
                                const prevPoint = points.find(p => p.id === pattern[index - 1]);
                                const currPoint = points.find(p => p.id === pointId);
                                if (!prevPoint || !currPoint) return null;
                                return (
                                    <line
                                        key={`line-${index}`}
                                        x1={prevPoint.x}
                                        y1={prevPoint.y}
                                        x2={currPoint.x}
                                        y2={currPoint.y}
                                        className="pattern-line"
                                    />
                                );
                            })}

                            {/* Línea flotante hacia el cursor/dedo mientras dibuja */}
                            {isDrawing && pattern.length > 0 && cursorPos && (
                                <line
                                    x1={points.find(p => p.id === pattern[pattern.length - 1]).x}
                                    y1={points.find(p => p.id === pattern[pattern.length - 1]).y}
                                    x2={cursorPos.x}
                                    y2={cursorPos.y}
                                    className="pattern-line-active"
                                />
                            )}

                            {/* Los 9 nodos */}
                            {points.map(p => {
                                const isSelected = pattern.includes(p.id);
                                const order = pattern.indexOf(p.id) + 1;
                                return (
                                    <g key={p.id} className="pattern-node-group">
                                        {/* Círculo exterior táctil */}
                                        <circle
                                            cx={p.x}
                                            cy={p.y}
                                            r="22"
                                            className={`pattern-node-outer ${isSelected ? 'selected' : ''}`}
                                        />
                                        {/* Punto central */}
                                        <circle
                                            cx={p.x}
                                            cy={p.y}
                                            r="8"
                                            className={`pattern-node-center ${isSelected ? 'selected' : ''}`}
                                        />
                                        {/* Número de orden si está seleccionado */}
                                        {isSelected && (
                                            <text
                                                x={p.x}
                                                y={p.y + 3}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                className="pattern-order-text"
                                            >
                                                {order}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    <div className="pattern-preview-text">
                        {pattern.length > 0 ? (
                            <span>Secuencia trazada: <strong>{pattern.join(' → ')}</strong></span>
                        ) : (
                            <span className="text-muted">Aún no se ha trazado ningún patrón</span>
                        )}
                    </div>
                </div>

                <div className="pattern-modal-footer">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleClear}>
                        <RotateCcw size={14} className="mr-xs" /> Limpiar
                    </button>
                    <div className="flex gap-xs">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleConfirm}
                        >
                            <Check size={14} className="mr-xs" /> Aplicar Patrón
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
