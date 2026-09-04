import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { servicesCatalog, repairService, uploadService } from '../../services/api';
import {
    Smartphone,
    Wrench,
    FileText,
    Camera,
    Upload,
    X,
    ChevronLeft,
    CheckCircle
} from 'lucide-react';
import './NewQuoteForm.css';

export default function NewQuoteForm() {
    const [deviceTypes, setDeviceTypes] = useState([]);
    const [brands, setBrands] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [images, setImages] = useState([]);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        device_type_id: '',
        brand_id: '',
        brand_other: '',
        model: '',
        color: '',
        storage_capacity: '',
        serial_number: '',
        imei: '',
        problem_description: '',
        service_id: '',
        priority: 'normal',
        accessories_received: '',
        device_password: ''
    });

    useEffect(() => {
        loadFormData();
    }, []);

    const loadFormData = async () => {
        try {
            const [typesData, brandsData, servicesData] = await Promise.all([
                servicesCatalog.getDeviceTypes(),
                servicesCatalog.getBrands(),
                servicesCatalog.getAll({ active_only: 'true' })
            ]);
            setDeviceTypes(typesData);
            setBrands(brandsData);
            setServices(servicesData);
        } catch (err) {
            console.error('Error cargando datos:', err);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 10) {
            setError('Máximo 10 imágenes permitidas');
            return;
        }

        const previews = files.map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));
        setImages(prev => [...prev, ...previews].slice(0, 10));
    };

    const removeImage = (index) => {
        setImages(prev => {
            const newImages = [...prev];
            URL.revokeObjectURL(newImages[index].preview);
            newImages.splice(index, 1);
            return newImages;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Crear la reparación/cotización
            const response = await repairService.create(formData);

            // Subir imágenes si hay
            if (images.length > 0 && response.repair?.id) {
                const files = images.map(img => img.file);
                await uploadService.uploadImages(response.repair.id, files);
            }

            setSuccess(true);
            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);
        } catch (err) {
            setError(err.message || 'Error al enviar cotización');
        } finally {
            setLoading(false);
        }
    };

    const filteredServices = formData.device_type_id
        ? services.filter(s => !s.device_type_id || s.device_type_id == formData.device_type_id)
        : services;

    if (success) {
        return (
            <div className="success-state-container animate-fadeIn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 'var(--sp-6)' }}>
                <div className="success-state" style={{ textAlign: 'center', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-8) var(--sp-6)', maxWidth: '480px', width: '100%', boxShadow: 'var(--shadow-md)' }}>
                    <div className="success-icon" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--sp-5)' }}>
                        <CheckCircle size={40} />
                    </div>
                    <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 800, marginBottom: 'var(--sp-2)' }}>¡Cotización Enviada!</h2>
                    <p className="text-muted" style={{ fontSize: 'var(--font-sm)', lineHeight: 1.5 }}>Tu solicitud ha sido recibida correctamente. Te notificaremos por correo electrónico una vez que tengamos un diagnóstico detallado.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="quote-container animate-fadeIn">
            <header className="page-header" style={{ marginBottom: 'var(--sp-6)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700 }}>Nueva Cotización</h1>
                    <p className="text-muted">Completa el formulario para solicitar el presupuesto de tu reparación</p>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="quote-form-premium">
                {error && <div className="error-alert" style={{ marginBottom: 'var(--sp-4)' }}>{error}</div>}

                {/* Información del dispositivo */}
                <section className="form-section">
                    <h2>
                        <Smartphone size={20} className="text-primary" />
                        Información del Dispositivo
                    </h2>

                    <div className="form-grid">
                        <div className="input-group">
                            <label htmlFor="device_type_id">Tipo de Dispositivo *</label>
                            <select
                                id="device_type_id"
                                name="device_type_id"
                                className="select"
                                value={formData.device_type_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Selecciona...</option>
                                {deviceTypes.map(type => (
                                    <option key={type.id} value={type.id}>{type.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="brand_id">Marca *</label>
                            <select
                                id="brand_id"
                                name="brand_id"
                                className="select"
                                value={formData.brand_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Selecciona...</option>
                                {brands.map(brand => (
                                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                                ))}
                            </select>
                        </div>

                        {formData.brand_id && brands.find(b => b.id == formData.brand_id)?.name === 'Otro' && (
                            <div className="input-group">
                                <label htmlFor="brand_other">Especificar Marca</label>
                                <input
                                    type="text"
                                    id="brand_other"
                                    name="brand_other"
                                    className="input"
                                    placeholder="Nombre de la marca"
                                    value={formData.brand_other}
                                    onChange={handleChange}
                                />
                            </div>
                        )}

                        <div className="input-group">
                            <label htmlFor="model">Modelo *</label>
                            <input
                                type="text"
                                id="model"
                                name="model"
                                className="input"
                                placeholder="Ej: iPhone 14 Pro, Galaxy S23"
                                value={formData.model}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="color">Color</label>
                            <input
                                type="text"
                                id="color"
                                name="color"
                                className="input"
                                placeholder="Ej: Negro, Gris Espacial"
                                value={formData.color}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="storage_capacity">Capacidad de Almacenamiento</label>
                            <input
                                type="text"
                                id="storage_capacity"
                                name="storage_capacity"
                                className="input"
                                placeholder="Ej: 128GB, 256GB"
                                value={formData.storage_capacity}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="serial_number">Número de Serie</label>
                            <input
                                type="text"
                                id="serial_number"
                                name="serial_number"
                                className="input"
                                placeholder="Opcional"
                                value={formData.serial_number}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="imei">IMEI (Solo para celulares)</label>
                            <input
                                type="text"
                                id="imei"
                                name="imei"
                                className="input"
                                placeholder="15 dígitos"
                                value={formData.imei}
                                onChange={handleChange}
                                maxLength={15}
                            />
                        </div>
                    </div>
                </section>

                {/* Problema */}
                <section className="form-section">
                    <h2>
                        <Wrench size={20} className="text-primary" />
                        Descripción del Problema
                    </h2>

                    <div className="form-grid">
                        <div className="input-group full-width">
                            <label htmlFor="service_id">Servicios Comunes Relacionados</label>
                            <select
                                id="service_id"
                                name="service_id"
                                className="select"
                                value={formData.service_id}
                                onChange={handleChange}
                            >
                                <option value="">Selecciona un tipo de servicio (opcional)</option>
                                {filteredServices.map(service => (
                                    <option key={service.id} value={service.id}>
                                        {service.name} — Precio base aproximado: ${service.base_price}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group full-width">
                            <label htmlFor="problem_description">Cuéntanos detalladamente qué le pasa *</label>
                            <textarea
                                id="problem_description"
                                name="problem_description"
                                className="input textarea"
                                placeholder="Describe el fallo, cómo ocurrió y qué síntomas presenta el dispositivo..."
                                value={formData.problem_description}
                                onChange={handleChange}
                                rows={5}
                                required
                            />
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', width: 'auto' }}
                                onClick={async () => {
                                    if (!formData.problem_description.trim()) {
                                        alert('Por favor describe primero el problema para que la IA lo analice.');
                                        return;
                                    }
                                    try {
                                        setError('');
                                        const res = await import('../../services/api').then(m => m.aiService.parseQuote(formData.problem_description));
                                        if (res) {
                                            setFormData(prev => ({
                                                ...prev,
                                                device_type_id: res.device_type_id || prev.device_type_id,
                                                brand_id: res.brand_id || prev.brand_id,
                                                brand_other: res.brand_other || prev.brand_other,
                                                model: res.model || prev.model,
                                                color: res.color || prev.color,
                                                service_id: res.service_id || prev.service_id
                                            }));
                                            alert('¡Formulario auto-completado con éxito por la IA!');
                                        }
                                    } catch (err) {
                                        setError(err.message || 'Error al procesar el análisis de IA');
                                    }
                                }}
                            >
                                ✨ Auto-completar Formulario con IA
                            </button>
                        </div>

                        <div className="input-group">
                            <label htmlFor="priority">Prioridad de Reparación</label>
                            <select
                                id="priority"
                                name="priority"
                                className="select"
                                value={formData.priority}
                                onChange={handleChange}
                            >
                                <option value="normal">Normal</option>
                                <option value="urgent">Urgente (aplica tarifas exprés)</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Información adicional */}
                <section className="form-section">
                    <h2>
                        <FileText size={20} className="text-primary" />
                        Detalles Adicionales de Entrega
                    </h2>

                    <div className="form-grid">
                        <div className="input-group">
                            <label htmlFor="accessories_received">Accesorios que entregas</label>
                            <input
                                type="text"
                                id="accessories_received"
                                name="accessories_received"
                                className="input"
                                placeholder="Ej: Funda protectora, cargador original, caja"
                                value={formData.accessories_received}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="device_password">Contraseña o Patrón de Desbloqueo</label>
                            <input
                                type="text"
                                id="device_password"
                                name="device_password"
                                className="input"
                                placeholder="Opcional (para verificar funciones en diagnóstico)"
                                value={formData.device_password}
                                onChange={handleChange}
                            />
                            <small className="input-hint" style={{ display: 'block', marginTop: '4px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                Los datos de seguridad están protegidos confidencialmente.
                            </small>
                        </div>
                    </div>
                </section>

                {/* Imágenes */}
                <section className="form-section">
                    <h2>
                        <Camera size={20} className="text-primary" />
                        Evidencia Fotográfica
                    </h2>
                    <p className="text-muted" style={{ fontSize: 'var(--font-xs)', marginBottom: 'var(--sp-4)' }}>
                        Agrega fotos del dispositivo (pantalla, golpes, detalles) para acelerar el presupuesto (hasta 10 fotos).
                    </p>

                    <div className="image-upload-dropzone">
                        <input
                            type="file"
                            id="images"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            className="file-input-hidden"
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="images" className="upload-label-interactive">
                            <Upload size={32} className="upload-icon text-primary" />
                            <span className="upload-text">Seleccionar archivos fotográficos</span>
                            <span className="upload-subtext">Formatos válidos: PNG, JPG, JPEG (Máx. 5MB por archivo)</span>
                        </label>
                    </div>

                    {images.length > 0 && (
                        <div className="image-previews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
                            {images.map((img, index) => (
                                <div key={index} className="image-preview-card" style={{ position: 'relative', aspectRatio: '1', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                    <img src={img.preview} alt={`Preview ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button
                                        type="button"
                                        className="remove-img-btn"
                                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                        onClick={() => removeImage(index)}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <div className="quote-form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate('/dashboard')}
                    >
                        <ChevronLeft size={16} />
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                    >
                        {loading ? 'Enviando Solicitud...' : 'Enviar Solicitud de Cotización'}
                    </button>
                </div>
            </form>
        </div>
    );
}
