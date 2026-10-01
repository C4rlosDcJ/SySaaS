import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { draftStorage } from '../../utils/draftStorage';
import {
    customerService,
    repairService,
    servicesCatalog,
    settingsService,
    userService
} from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import {
    Save, X, User, Smartphone, Wrench, ClipboardCheck,
    DollarSign, Search, ChevronRight, CheckCircle2,
    Image as ImageIcon, Plus, Trash2, Camera, UploadCloud, RotateCcw
} from 'lucide-react';
import CameraCaptureModal from '../../components/CameraCaptureModal';
import './NewRepairPage.css';

export default function NewRepairPage() {
    const navigate = useNavigate();
    const { tenant, activeBranchId } = useTenant();
    const tenantId = tenant?.id;

    const isRestoringRef = useRef(true);
    const [hasDraft, setHasDraft] = useState(false);

    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [deviceTypes, setDeviceTypes] = useState([]);
    const [brands, setBrands] = useState([]);
    const [services, setServices] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [settings, setSettings] = useState({});

    const [selectedImages, setSelectedImages] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [showCameraModal, setShowCameraModal] = useState(false);
    
    // Checkbox explicitly needed to submit if there are conditions
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const [customerSearch, setCustomerSearch] = useState('');
    const [searchingCustomers, setSearchingCustomers] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [_selectedService, setSelectedService] = useState(null);
    const [serviceSearch, setServiceSearch] = useState('');
    const [showServiceDropdown, setShowServiceDropdown] = useState(false);
    const [showMobileCosts, setShowMobileCosts] = useState(false);

    const [formData, setFormData] = useState({
        customer_id: '',
        device_type_id: '',
        brand_id: '',
        brand_other: '',
        model: '',
        color: '',
        storage_capacity: '',
        serial_number: '',
        imei: '',
        device_password: '',
        accessories_received: '',
        physical_condition: 5,
        existing_damage: '',
        problem_description: '',
        service_id: '',
        service_requested: '',
        priority: 'normal',
        estimated_delivery: '',
        diagnosis_cost: 0,
        labor_cost: 0,
        parts_cost: 0,
        discount: 0,
        advance_payment: 0,
        warranty_days: 30,
        technician_id: '',
        battery_health: '',
        screen_status: '',
        account_status: '',
        technical_observations: '',
        function_checklist: {
            power: true,
            display: true,
            touch: true,
            cameras: true,
            audio: true,
            wifi: true,
            charging: true,
            buttons: true
        }
    });

    useEffect(() => {
        fetchInitialData();

        // Cerrar dropdown de servicios si se hace click fuera
        const closeDropdown = (e) => {
            if (!e.target.closest('.service-search-container')) {
                setShowServiceDropdown(false);
            }
        };
        document.addEventListener('click', closeDropdown);
        return () => document.removeEventListener('click', closeDropdown);
    }, []);

    const [allCatalogServices, setAllCatalogServices] = useState([]);

    const fetchInitialData = async () => {
        try {
            const [types, brandsData, settingsData, staff, allServs] = await Promise.all([
                servicesCatalog.getDeviceTypes(),
                servicesCatalog.getBrands(),
                settingsService.getAll(),
                userService.getTechnicians(),
                servicesCatalog.getAll({ active_only: 'true' })
            ]);
            setDeviceTypes(types || []);
            setBrands(brandsData || []);
            setTechnicians(staff || []);
            setSettings(settingsData || {});
            setAllCatalogServices(allServs || []);
            setServices(allServs || []);

            const defWarranty = settingsData?.default_warranty_days || tenant?.default_warranty_days;
            if (defWarranty) {
                const parsedDays = parseInt(defWarranty, 10);
                if (!isNaN(parsedDays)) {
                    setFormData(prev => ({
                        ...prev,
                        warranty_days: parsedDays
                    }));
                }
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    };

    useEffect(() => {
        // Cargar borrador persistido para el tenant y sucursal activa
        const draft = draftStorage.loadDraft('new_repair', tenantId, activeBranchId);
        if (draft) {
            if (draft.formData) {
                setFormData(prev => ({
                    ...prev,
                    ...draft.formData
                }));
            }
            if (draft.selectedCustomer) {
                setSelectedCustomer(draft.selectedCustomer);
            }
            if (draft._selectedService) {
                setSelectedService(draft._selectedService);
            }
            if (draft.acceptedTerms !== undefined) {
                setAcceptedTerms(draft.acceptedTerms);
            }
            setHasDraft(true);
        }
        setTimeout(() => {
            isRestoringRef.current = false;
        }, 150);
    }, [tenantId, activeBranchId]);

    // Guardado automatico de borrador cuando cambian los datos
    useEffect(() => {
        if (isRestoringRef.current) return;

        const hasContent = Boolean(
            formData.customer_id ||
            formData.model ||
            formData.problem_description ||
            formData.brand_id ||
            formData.device_type_id ||
            selectedCustomer ||
            formData.labor_cost > 0 ||
            formData.parts_cost > 0
        );

        if (hasContent) {
            draftStorage.saveDraft('new_repair', {
                formData,
                selectedCustomer,
                _selectedService,
                acceptedTerms
            }, tenantId, activeBranchId);
            setHasDraft(true);
        }
    }, [formData, selectedCustomer, _selectedService, acceptedTerms, tenantId, activeBranchId]);

    const handleClearDraft = () => {
        if (window.confirm('¿Deseas descartar los datos capturados y limpiar el formulario?')) {
            draftStorage.clearDraft('new_repair', tenantId, activeBranchId);
            setHasDraft(false);
            setSelectedCustomer(null);
            setSelectedService(null);
            setAcceptedTerms(false);
            setSelectedImages([]);
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
            setImagePreviews([]);
            setFormData({
                customer_id: '',
                device_type_id: '',
                brand_id: '',
                brand_other: '',
                model: '',
                color: '',
                storage_capacity: '',
                serial_number: '',
                imei: '',
                device_password: '',
                accessories_received: '',
                physical_condition: 5,
                existing_damage: '',
                problem_description: '',
                service_id: '',
                service_requested: '',
                priority: 'normal',
                estimated_delivery: '',
                diagnosis_cost: 0,
                labor_cost: 0,
                parts_cost: 0,
                discount: 0,
                advance_payment: 0,
                warranty_days: settings?.default_warranty_days ? parseInt(settings.default_warranty_days) : 30,
                technician_id: '',
                battery_health: '',
                screen_status: '',
                account_status: '',
                technical_observations: '',
                function_checklist: {
                    power: true,
                    display: true,
                    touch: true,
                    cameras: true,
                    audio: true,
                    wifi: true,
                    charging: true,
                    buttons: true
                }
            });
        }
    };

    const handleCustomerSearch = async (e) => {
        const value = e.target.value;
        setCustomerSearch(value);
        if (value.length < 3) {
            setCustomers([]);
            return;
        }

        try {
            setSearchingCustomers(true);
            const data = await customerService.getAll({ search: value, limit: 10 });
            setCustomers(data.customers || []);
        } catch (error) {
            console.error('Error searching customers:', error);
        } finally {
            setSearchingCustomers(false);
        }
    };

    const selectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setFormData(prev => ({ ...prev, customer_id: customer.id }));
        setCustomerSearch('');
        setCustomers([]);
    };

    const handleDeviceTypeChange = (e) => {
        const typeId = e.target.value;
        setFormData(prev => ({ ...prev, device_type_id: typeId, service_id: '' }));
        setSelectedService(null);
        setServiceSearch('');
        setShowServiceDropdown(false);
    };

    // Filtrar servicios compatibles según tipo y marca si están seleccionados
    useEffect(() => {
        if (!allCatalogServices.length) return;

        let filtered = [...allCatalogServices];

        if (formData.device_type_id) {
            filtered = filtered.filter(s => !s.device_type_id || s.device_type_id.toString() === formData.device_type_id.toString());
        }

        if (formData.brand_id && formData.brand_id !== 'other') {
            const selectedBrandObj = brands.find(b => b.id.toString() === formData.brand_id.toString());
            if (selectedBrandObj) {
                const brandNameLower = selectedBrandObj.name.toLowerCase();
                filtered = filtered.filter(s => {
                    if (s.brand_id && s.brand_id.toString() === formData.brand_id.toString()) return true;
                    const serviceNameLower = s.name.toLowerCase();
                    const serviceDescLower = (s.description || '').toLowerCase();
                    return serviceNameLower.includes(brandNameLower) || 
                           serviceDescLower.includes(brandNameLower) ||
                           (!serviceNameLower.includes('iphone') && 
                            !serviceNameLower.includes('samsung') && 
                            !serviceNameLower.includes('motorola') && 
                            !serviceNameLower.includes('huawei') && 
                            !serviceNameLower.includes('xiaomi') && 
                            !serviceNameLower.includes('oppo'));
                });
            }
        }

        setServices(filtered);
    }, [formData.brand_id, formData.device_type_id, brands, allCatalogServices]);

    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setSelectedImages(prev => [...prev, ...files]);

        const newPreviews = files.map(file => URL.createObjectURL(file));
        setImagePreviews(prev => [...prev, ...newPreviews]);
    };

    const handleAddCameraImages = (files) => {
        const fileList = Array.isArray(files) ? files : [files];
        if (fileList.length === 0) return;

        setSelectedImages(prev => [...prev, ...fileList]);
        const newPreviews = fileList.map(file => URL.createObjectURL(file));
        setImagePreviews(prev => [...prev, ...newPreviews]);
    };

    const handleRemoveImage = (index) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => {
            URL.revokeObjectURL(prev[index]);
            return prev.filter((_, i) => i !== index);
        });
    };

    // Función inteligente para calcular fecha/hora estimada a partir de texto de tiempo (ej. '2 horas', '1 dia')
    const calculateSuggestedDelivery = (timeStr) => {
        if (!timeStr) return '';
        const now = new Date();
        const lower = timeStr.toLowerCase().trim();
        
        let hoursToAdd = 0;
        const matchHours = lower.match(/(\d+)\s*(?:hora|hr|h)/i);
        const matchDays = lower.match(/(\d+)\s*(?:d[ií]a|day|d)/i);
        
        if (matchDays) {
            hoursToAdd = parseInt(matchDays[1], 10) * 24;
        } else if (matchHours) {
            hoursToAdd = parseInt(matchHours[1], 10);
        } else if (lower.includes('inmediato') || lower.includes('express')) {
            hoursToAdd = 1;
        }

        if (hoursToAdd > 0) {
            now.setHours(now.getHours() + hoursToAdd);
            // Formatear para input type="datetime-local" (YYYY-MM-DDTHH:mm)
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        return '';
    };

    const selectService = (service) => {
        setSelectedService(service);
        setServiceSearch(service ? `${service.name} - ${formatCurrency(service.base_price)}` : '');
        setShowServiceDropdown(false);

        if (!service) {
            setFormData(prev => ({
                ...prev,
                service_id: '',
                service_requested: '',
                labor_cost: 0
            }));
            return;
        }

        const labor = parseFloat(service.base_price) || 0;
        const parts = parseFloat(service.default_parts_cost) || 0;
        const suggestedDelivery = calculateSuggestedDelivery(service.estimated_time);

        setFormData(prev => {
            const updated = {
                ...prev,
                service_id: service.id.toString(),
                service_requested: service.name,
                labor_cost: labor,
                // Si el servicio incluye costo predeterminado de refaccion/pieza, se asigna automaticamente
                parts_cost: parts > 0 ? parts : prev.parts_cost
            };

            // Auto-completar tipo de equipo si el servicio tiene uno asignado
            if (service.device_type_id && (!prev.device_type_id || prev.device_type_id.toString() !== service.device_type_id.toString())) {
                updated.device_type_id = service.device_type_id.toString();
            }

            // Auto-completar marca si el servicio tiene marca específica
            if (service.brand_id && (!prev.brand_id || prev.brand_id.toString() !== service.brand_id.toString())) {
                updated.brand_id = service.brand_id.toString();
            }

            // Auto-completar falla/descripción si está vacía
            if (!prev.problem_description.trim()) {
                updated.problem_description = service.description || service.name;
            }

            // Auto-sugerir entrega estimada si está vacía y se pudo calcular
            if (!prev.estimated_delivery && suggestedDelivery) {
                updated.estimated_delivery = suggestedDelivery;
            }

            return updated;
        });
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox' && name.startsWith('check_')) {
            const checkKey = name.replace('check_', '');
            setFormData(prev => ({
                ...prev,
                function_checklist: {
                    ...prev.function_checklist,
                    [checkKey]: checked
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e, shouldPrint = false) => {
        e.preventDefault();
        if (!formData.customer_id) {
            alert('Por favor selecciona un cliente');
            return;
        }
        if (!acceptedTerms) {
            alert('Por favor confirma los términos de recepción antes de continuar.');
            return;
        }

        try {
            setLoading(true);
            const result = await repairService.create(formData);
            const newRepairId = result.repair.id;

            // Handle images if any
            if (selectedImages.length > 0) {
                try {
                    const { uploadService } = await import('../../services/api');
                    await uploadService.uploadImages(newRepairId, selectedImages, 'before');
                } catch (imgError) {
                    console.error('Error uploading initial images:', imgError);
                    alert('La reparación se creó pero hubo un error subiendo las imágenes iniciales.');
                }
            }
            
            // Clean up object URLs to prevent memory leaks
            imagePreviews.forEach(url => URL.revokeObjectURL(url));

            // Generate and download PDF if requested
            if (shouldPrint) {
                try {
                    const { generateServiceTicket } = await import('../../utils/pdfGenerator');
                    // We need to fetch the full updated repair with joins (customer name, etc) for the ticket
                    const fullRepair = await repairService.getById(newRepairId);
                    await generateServiceTicket(fullRepair, settings);
                } catch (printError) {
                    console.error('Error printing ticket:', printError);
                    alert('Ocurrió un error al intentar generar el recibo PDF.');
                }
            }

            // Limpiar borrador persistido al completar la orden
            draftStorage.clearDraft('new_repair', tenantId, activeBranchId);
            setHasDraft(false);

            navigate(`/admin/reparaciones/${newRepairId}`);
        } catch (error) {
            console.error('Error creating repair:', error);
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotal = () => {
        const { diagnosis_cost, labor_cost, discount } = formData;
        // El precio cobrado al cliente (labor_cost / precio base del servicio) ya es el precio final.
        // El costo de refacciones/gastos no se suma al precio del cliente, sino que se deduce internamente de la ganancia.
        return Math.max(0, (parseFloat(diagnosis_cost) || 0) +
            (parseFloat(labor_cost) || 0) -
            (parseFloat(discount) || 0));
    };

    return (
        <div className="new-repair-page">
            <header className="page-header">
                <div>
                    <h1>Nueva Reparación</h1>
                    <p>Ingresa los detalles para la nueva orden de servicio</p>
                </div>
                {hasDraft && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-primary)', background: 'var(--color-bg-elevated)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                            Borrador guardado
                        </span>
                        <button
                            type="button"
                            onClick={handleClearDraft}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--color-text-muted)' }}
                            title="Descartar borrador y limpiar formulario"
                        >
                            <Trash2 size={15} />
                            <span>Limpiar Formulario</span>
                        </button>
                    </div>
                )}
            </header>

            <form onSubmit={(e) => handleSubmit(e, false)} className="repair-form-layout">
                {/* ── Left Column: Form Details ── */}
                <div className="repair-form-main">
                    
                    {/* SECCIÓN 1: CLIENTE */}
                    <section className="form-card">
                        <div className="form-card-header">
                            <User size={20} className="icon-primary" />
                            <h2>Información del Cliente</h2>
                        </div>
                        
                        {selectedCustomer ? (
                            <div className="selected-customer">
                                <div className="new-repair-customer-avatar">
                                    {selectedCustomer.first_name[0]}{selectedCustomer.last_name[0]}
                                </div>
                                <div className="customer-info">
                                    <strong>{selectedCustomer.first_name} {selectedCustomer.last_name}</strong>
                                    <span>{selectedCustomer.email} • {selectedCustomer.phone}</span>
                                </div>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomer(null)}>
                                    Cambiar
                                </button>
                            </div>
                        ) : (
                            <div className="customer-search">
                                <div className="search-box">
                                    <Search size={18} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre, email o teléfono..."
                                        value={customerSearch}
                                        onChange={handleCustomerSearch}
                                        className="input"
                                    />
                                </div>
                                {searchingCustomers && <p className="text-muted text-sm mt-xs">Buscando...</p>}
                                {customers.length > 0 && (
                                    <div className="search-results mt-sm">
                                        {customers.map(c => (
                                            <button
                                                key={c.id} type="button"
                                                className="search-item"
                                                onClick={() => selectCustomer(c)}
                                            >
                                                <div className="search-item-avatar text-xs font-bold">
                                                    {c.first_name[0]}{c.last_name[0]}
                                                </div>
                                                <div className="search-item-info">
                                                    <strong>{c.first_name} {c.last_name}</strong>
                                                    <span>{c.email}</span>
                                                </div>
                                                <ChevronRight size={16} className="text-muted" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* SECCIÓN RÁPIDA: SERVICIO PRECONFIGURADO */}
                    <section className="form-card quick-service-banner">
                        <div className="form-card-header" style={{ marginBottom: 'var(--sp-3)', paddingBottom: 'var(--sp-2)' }}>
                            <Wrench size={20} className="icon-primary" />
                            <div style={{ flex: 1 }}>
                                <h2>Selección Rápida de Servicio (Auto-completado)</h2>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                                    Selecciona o busca un servicio para rellenar automáticamente tipo de equipo, marca, costos de mano de obra y refacción.
                                </p>
                            </div>
                        </div>

                        <div className="service-search-container" style={{ position: 'relative' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)' }} />
                                <input
                                    type="text"
                                    className="input"
                                    style={{ paddingLeft: '38px', height: '42px', fontWeight: 500 }}
                                    placeholder="Buscar servicio base (ej: Pantalla iPhone, Centro de Carga, Mantenimiento...)"
                                    value={serviceSearch}
                                    onChange={(e) => {
                                        setServiceSearch(e.target.value);
                                        setShowServiceDropdown(true);
                                    }}
                                    onFocus={() => setShowServiceDropdown(true)}
                                />
                                {formData.service_id && (
                                    <button
                                        type="button"
                                        onClick={() => selectService(null)}
                                        className="btn btn-ghost btn-sm"
                                        style={{ position: 'absolute', right: '8px', padding: '4px 8px', fontSize: '12px' }}
                                        title="Quitar servicio seleccionado"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>

                            {showServiceDropdown && (
                                <div className="search-results" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: '240px', overflowY: 'auto', marginTop: '4px' }}>
                                    {allCatalogServices.filter(s => 
                                        !serviceSearch || 
                                        s.name.toLowerCase().includes(serviceSearch.split(' - ')[0].toLowerCase()) ||
                                        (s.device_type_name && s.device_type_name.toLowerCase().includes(serviceSearch.toLowerCase())) ||
                                        (s.brand_name && s.brand_name.toLowerCase().includes(serviceSearch.toLowerCase()))
                                    ).length === 0 ? (
                                        <div style={{ padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)', background: 'var(--color-bg-elevated)', textAlign: 'center' }}>
                                            No se encontraron servicios en el catálogo
                                        </div>
                                    ) : (
                                        allCatalogServices.filter(s => 
                                            !serviceSearch || 
                                            s.name.toLowerCase().includes(serviceSearch.split(' - ')[0].toLowerCase()) ||
                                            (s.device_type_name && s.device_type_name.toLowerCase().includes(serviceSearch.toLowerCase())) ||
                                            (s.brand_name && s.brand_name.toLowerCase().includes(serviceSearch.toLowerCase()))
                                        ).map(s => {
                                            const partsCost = parseFloat(s.default_parts_cost) || 0;
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className="search-item"
                                                    onClick={() => selectService(s)}
                                                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                                                        <strong style={{ fontSize: '13px' }}>{s.name}</strong>
                                                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                                            {s.device_type_name ? s.device_type_name : 'General'} {s.brand_name ? `• ${s.brand_name}` : ''} {s.estimated_time ? `• Est: ${s.estimated_time}` : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                                        <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 700 }}>
                                                            {formatCurrency(s.base_price)}
                                                        </span>
                                                        {partsCost > 0 && (
                                                            <span style={{ fontSize: '10px', color: 'var(--color-warning)', background: 'rgba(234, 179, 8, 0.1)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                                                                Refacción: {formatCurrency(partsCost)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECCIÓN 2: DISPOSITIVO */}
                    <section className="form-card">
                        <div className="form-card-header">
                            <Smartphone size={20} className="icon-primary" />
                            <h2>Detalles del Equipo</h2>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Tipo de Equipo *</label>
                                <select name="device_type_id" className="select" value={formData.device_type_id} onChange={handleDeviceTypeChange} required>
                                    <option value="">Seleccionar...</option>
                                    {deviceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Marca *</label>
                                <select name="brand_id" className="select" value={formData.brand_id} onChange={handleChange}>
                                    <option value="">Seleccionar...</option>
                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    <option value="other">Otra...</option>
                                </select>
                            </div>
                            {formData.brand_id === 'other' && (
                                <div className="form-group col-span-full">
                                    <label>Especificar Marca</label>
                                    <input type="text" name="brand_other" className="input" value={formData.brand_other} onChange={handleChange} />
                                </div>
                            )}
                            <div className="form-group">
                                <label>Modelo *</label>
                                <input type="text" name="model" className="input" value={formData.model} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label>Color</label>
                                <input type="text" name="color" className="input" value={formData.color} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Capacidad (GB)</label>
                                <input type="text" name="storage_capacity" className="input" value={formData.storage_capacity} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>IMEI / No. Serie</label>
                                <input type="text" name="imei" className="input" value={formData.imei} onChange={handleChange} />
                            </div>
                            <div className="form-group col-span-full">
                                <label>Contraseña / Patrón de Desbloqueo</label>
                                <input type="text" name="device_password" className="input" value={formData.device_password} onChange={handleChange} placeholder="Para pruebas de calidad..." />
                            </div>
                            <div className="form-group">
                                <label>Estado Batería</label>
                                <input type="text" name="battery_health" className="input" value={formData.battery_health} onChange={handleChange} placeholder="Ej: 85% o 'Mantenimiento'" />
                            </div>
                            <div className="form-group">
                                <label>Cuenta / iCloud</label>
                                <input type="text" name="account_status" className="input" value={formData.account_status} onChange={handleChange} placeholder="Libre, Bloqueada, etc." />
                            </div>
                            <div className="form-group col-span-full">
                                <label>Estado de Pantalla</label>
                                <input type="text" name="screen_status" className="input" value={formData.screen_status} onChange={handleChange} placeholder="Original, Cambiada, Estrellada..." />
                            </div>
                        </div>
                    </section>

                    {/* SECCIÓN 3: INSPECCIÓN */}
                    <section className="form-card">
                        <div className="form-card-header">
                            <ClipboardCheck size={20} className="icon-primary" />
                            <h2>Inspección de Entrada</h2>
                        </div>
                        <div className="form-group mb-md">
                            <label>Condición Física General (1-5)</label>
                            <div className="rating-selector">
                                {[1, 2, 3, 4, 5].map(v => (
                                    <button
                                        key={v} type="button"
                                        className={`rating-btn ${formData.physical_condition === v ? 'active' : ''}`}
                                        onClick={() => setFormData(prev => ({ ...prev, physical_condition: v }))}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="form-group mb-md">
                            <label>Accesorios Recibidos</label>
                            <input type="text" name="accessories_received" className="input" value={formData.accessories_received} onChange={handleChange} placeholder="Funda, cargador, sim card..." />
                        </div>
                        <div className="form-group mb-md">
                            <label>Daños Físicos o Estéticos Existentes</label>
                            <textarea name="existing_damage" className="input" rows="2" value={formData.existing_damage} onChange={handleChange} placeholder="Describa rayones, golpes, etc..."></textarea>
                        </div>
                        <div className="form-group mb-md">
                            <label>Observaciones Técnicas Adicionales</label>
                            <textarea name="technical_observations" className="input" rows="2" value={formData.technical_observations} onChange={handleChange} placeholder="Notas internas para el técnico..."></textarea>
                        </div>
                        
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ margin: 0 }}>Checklist Funcional Inicial</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        style={{ fontSize: '11px', padding: '2px 8px' }}
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                function_checklist: Object.keys(prev.function_checklist).reduce((acc, k) => {
                                                    acc[k] = true;
                                                    return acc;
                                                }, {})
                                            }));
                                        }}
                                    >
                                        Marcar Todo OK
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--color-text-muted)' }}
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                function_checklist: Object.keys(prev.function_checklist).reduce((acc, k) => {
                                                    acc[k] = false;
                                                    return acc;
                                                }, {})
                                            }));
                                        }}
                                    >
                                        Desmarcar Todo
                                    </button>
                                </div>
                            </div>
                            <div className="checklist-grid">
                                {Object.entries(formData.function_checklist).map(([key, value]) => (
                                    <label key={key} className={`checklist-item ${value ? 'checked' : ''}`}>
                                        <input type="checkbox" name={`check_${key}`} checked={value} onChange={handleChange} className="hidden-checkbox" />
                                        <div className="checklist-box">
                                            {value && <CheckCircle2 size={16} />}
                                        </div>
                                        <span className="capitalize">{key === 'display' ? 'pantalla' : key}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-group mt-md">
                            <div className="flex justify-between items-center mb-xs" style={{ flexWrap: 'wrap', gap: '8px' }}>
                                <span style={{ fontWeight: 600 }}>Fotografías del Equipo (Recepción)</span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm text-primary pointer m-0"
                                        onClick={() => setShowCameraModal(true)}
                                    >
                                        <Camera size={16} className="mr-xs" /> Tomar con Cámara
                                    </button>
                                    <label className="btn btn-ghost btn-sm text-muted pointer m-0">
                                        <UploadCloud size={16} className="mr-xs" /> Archivo
                                        <input type="file" multiple hidden accept="image/*" onChange={handleImageSelect} />
                                    </label>
                                </div>
                            </div>
                            
                            {imagePreviews.length > 0 ? (
                                <div className="image-preview-grid">
                                    {imagePreviews.map((url, index) => (
                                        <div key={index} className="preview-thumbnail">
                                            <img src={url} alt={`Preview ${index}`} />
                                            <button type="button" className="remove-btn" onClick={() => handleRemoveImage(index)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-images-area">
                                    <ImageIcon size={24} className="text-muted mb-xs" />
                                    <p className="text-sm text-muted">No se han agregado fotos de recepción.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECCIÓN 4: SERVICIO AL QUE INGRESA */}
                    <section className="form-card">
                        <div className="form-card-header">
                            <Wrench size={20} className="icon-primary" />
                            <h2>Detalle del Servicio</h2>
                        </div>
                        
                        <div className="form-group mb-md">
                            <label>Nombre del Servicio / Trabajo Realizado *</label>
                            <input
                                type="text"
                                name="service_requested"
                                className="input"
                                placeholder="Ej: Cambio de Pantalla OLED, Reballing..."
                                value={formData.service_requested}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group mb-md">
                            <label>Falla Reportada / Descripción de Solicitud *</label>
                            <textarea name="problem_description" className="input" rows="3" value={formData.problem_description} onChange={handleChange} required placeholder="Lo que el cliente reporta que falla..."></textarea>
                        </div>
                        
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Técnico Asignado</label>
                                <select name="technician_id" className="select" value={formData.technician_id} onChange={handleChange}>
                                    <option value="">Sin asignar</option>
                                    {technicians.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Prioridad</label>
                                <select name="priority" className="select" value={formData.priority} onChange={handleChange}>
                                    <option value="normal">Normal</option>
                                    <option value="urgent">Urgente</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Entrega Estimada (Fecha y Hora)</label>
                                <input type="datetime-local" name="estimated_delivery" className="input" value={formData.estimated_delivery} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Garantía (Días)</label>
                                <input type="number" name="warranty_days" className="input" value={formData.warranty_days} onChange={handleChange} />
                            </div>
                        </div>
                    </section>
                </div>

                {/* ── Right Column: Sticky Costs summary ── */}
                <div className={`repair-form-sidebar ${showMobileCosts ? 'mobile-open' : ''}`}>
                    <div className="costs-summary-card">
                        <div className="form-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="flex items-center gap-xs">
                                <DollarSign size={20} className="icon-success" />
                                <h2>Presupuesto</h2>
                            </div>
                            <button type="button" className="mobile-costs-close" onClick={() => setShowMobileCosts(false)} style={{ display: 'none', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="costs-inputs">
                            <div className="cost-row input-mode">
                                <label>Diagnóstico</label>
                                <div className="input-with-icon">
                                    <span>$</span>
                                    <input type="number" name="diagnosis_cost" className="input input-sm text-right" value={formData.diagnosis_cost} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="cost-row input-mode">
                                <label>Precio Servicio / Mano de Obra</label>
                                <div className="input-with-icon">
                                    <span>$</span>
                                    <input type="number" name="labor_cost" className="input input-sm text-right" value={formData.labor_cost} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="cost-row input-mode">
                                <div>
                                    <label>Costo de Pieza / Insumo</label>
                                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)' }}>Gasto interno (se descuenta del cobro)</span>
                                </div>
                                <div className="input-with-icon">
                                    <span>$</span>
                                    <input type="number" name="parts_cost" className="input input-sm text-right" value={formData.parts_cost} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="cost-row input-mode">
                                <label>Descuento</label>
                                <div className="input-with-icon">
                                    <span>-$</span>
                                    <input type="number" name="discount" className="input input-sm text-right" value={formData.discount} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        {/* Indicador de Desglose Ganancia Neta Real vs Costo de Insumo */}
                        <div style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Precio Final al Cliente:</span>
                                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(calculateTotal())}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Costo Refacción / Gasto (-):</span>
                                <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>-{formatCurrency(formData.parts_cost || 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px dashed var(--color-border)' }}>
                                <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Ganancia Neta Real:</span>
                                <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                                    {formatCurrency(calculateTotal() - (parseFloat(formData.parts_cost) || 0))}
                                </span>
                            </div>
                        </div>

                        <div className="costs-divider"></div>
                        
                        <div className="cost-row total-row">
                            <span>Total a Cobrar al Cliente</span>
                            <strong>{formatCurrency(calculateTotal())}</strong>
                        </div>

                        <div className="cost-row input-mode mt-md">
                            <label className="font-bold">Anticipo</label>
                            <div className="input-with-icon highlight-input">
                                <span>$</span>
                                <input type="number" name="advance_payment" className="input input-sm text-right" value={formData.advance_payment} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="cost-row pending-row mt-sm">
                            <span>Restante a Pagar</span>
                            <strong>{formatCurrency(calculateTotal() - formData.advance_payment)}</strong>
                        </div>

                        <div className="reception-terms bg-bg-elevated p-md rounded-md mt-lg border border-border">
                            <label className="flex items-start gap-sm cursor-pointer m-0">
                                <input 
                                    type="checkbox" 
                                    className="mt-xs" 
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                    required 
                                />
                                <span className="text-sm">
                                    Confirmo que el cliente comprende las condiciones de recepción, ha sido informado de los daños físicos, y autoriza el diagnóstico/reparación de este equipo.
                                </span>
                            </label>
                        </div>

                        <div className="costs-actions mt-lg">
                            <button type="submit" className="btn btn-primary w-full" disabled={loading || !acceptedTerms}>
                                <Save size={18} /> {loading ? 'Procesando...' : 'Crear Orden'}
                            </button>
                            <button type="button" onClick={(e) => handleSubmit(e, true)} className="btn btn-secondary w-full" disabled={loading || !acceptedTerms} style={{borderColor: 'var(--color-primary-muted)', color: 'var(--color-primary)'}}>
                                Guardar e Imprimir Recibo
                            </button>
                            <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost w-full">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* Burbuja flotante de Presupuesto en Móvil */}
            <button
                type="button"
                className="mobile-costs-trigger-badge"
                onClick={() => setShowMobileCosts(true)}
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '96px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-primary-contrast)',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                    cursor: 'pointer',
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999
                }}
            >
                <DollarSign size={24} />
            </button>

            {/* Modal de Captura de Fotografía con Cámara */}
            {showCameraModal && (
                <CameraCaptureModal
                    isOpen={showCameraModal}
                    onClose={() => setShowCameraModal(false)}
                    onCapture={handleAddCameraImages}
                    title="Evidencias de Recepción"
                    multiple={true}
                />
            )}
        </div>
    );
}
