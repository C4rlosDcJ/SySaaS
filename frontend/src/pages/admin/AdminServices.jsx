import { useState, useEffect } from 'react';
import { servicesCatalog } from '../../services/api';
import {
    RefreshCw,
    Plus,
    Edit,
    Trash2,
    X,
    Save,
    Search,
    Smartphone,
    Trophy,
    Wrench,
    Clock,
    Tag,
    Layers,
    ToggleLeft,
    CheckCircle,
    XCircle,
    HelpCircle,
    Barcode,
    Printer
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { showAlert } from '../../utils/swal';
import './AdminServices.css';

export default function AdminServices() {
    // State
    const [activeTab, setActiveTab] = useState('services'); // 'services', 'types', 'brands'
    const [services, setServices] = useState([]);
    const [deviceTypes, setDeviceTypes] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});

    // Plan check
    const { tenant } = useTenant();
    const planSlug = (tenant?.plan_slug || tenant?.plan_name || '').toLowerCase();
    const isBarcodePlanAllowed = 
        (tenant?.plan_id && Number(tenant.plan_id) >= 2) || 
        ['pro', 'enterprise'].some(p => planSlug.includes(p));
    
    // Barcode Printing States
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);
    const [barcodeItem, setBarcodeItem] = useState(null);
    const [printCopies, setPrintCopies] = useState(1);

    useEffect(() => {
        if (showBarcodeModal && barcodeItem?.barcode) {
            setTimeout(() => {
                try {
                    if (window.JsBarcode) {
                        window.JsBarcode("#service-barcode-svg", barcodeItem.barcode, {
                            format: "CODE128",
                            lineColor: "#000000",
                            width: 2,
                            height: 60,
                            displayValue: true,
                            fontSize: 12
                        });
                    }
                } catch (err) {
                    console.error("Error rendering barcode:", err);
                }
            }, 100);
        }
    }, [showBarcodeModal, barcodeItem]);

    const openBarcodeModal = (item) => {
        if (!isBarcodePlanAllowed) {
            showAlert({
                title: 'Función Pro y Enterprise',
                text: 'La impresión de etiquetas de código de barras está reservada para los planes Pro y Enterprise.',
                icon: 'warning',
                confirmButtonText: 'Aceptar'
            });
            return;
        }
        setBarcodeItem(item);
        setPrintCopies(1);
        setShowBarcodeModal(true);
    };

    const handlePrintBarcodes = () => {
        if (!barcodeItem?.barcode) return;
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.left = '-600px';
        document.body.appendChild(iframe);

        const svgContent = document.getElementById('service-barcode-svg').outerHTML;
        const productName = barcodeItem.name;
        const price = servicesCatalog.formatCurrency(barcodeItem.base_price);

        let labelsHtml = '';
        for (let i = 0; i < printCopies; i++) {
            labelsHtml += `
                <div class="label-container">
                    <div class="product-name">${productName}</div>
                    <div class="barcode-wrapper">${svgContent}</div>
                    <div class="price-tag">${price}</div>
                </div>
            `;
        }

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <style>
                    @page {
                        size: auto;
                        margin: 0mm;
                    }
                    body {
                        font-family: 'Inter', -apple-system, sans-serif;
                        margin: 0;
                        padding: 10px;
                        background: white;
                        color: black;
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                        align-items: center;
                    }
                    .label-container {
                        width: 50mm;
                        height: 30mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        border: 1px dashed #ccc;
                        padding: 2mm;
                        box-sizing: border-box;
                        page-break-inside: avoid;
                        text-align: center;
                    }
                    .product-name {
                        font-size: 8px;
                        font-weight: bold;
                        max-width: 100%;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        margin-bottom: 2px;
                    }
                    .barcode-wrapper svg {
                        width: 45mm;
                        height: auto;
                        max-height: 18mm;
                    }
                    .price-tag {
                        font-size: 9px;
                        font-weight: 800;
                        margin-top: 2px;
                    }
                </style>
            </head>
            <body>
                ${labelsHtml}
                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                        setTimeout(function() {
                            window.parent.document.body.removeChild(window.frameElement);
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'services') {
                const [sData, tData, bData] = await Promise.all([
                    servicesCatalog.getAll(),
                    servicesCatalog.getDeviceTypes(),
                    servicesCatalog.getBrands({ all: true })
                ]);
                setServices(sData || []);
                setDeviceTypes(tData || []);
                setBrands(bData || []);
            } else if (activeTab === 'types') {
                const data = await servicesCatalog.getDeviceTypes({ all: true });
                setDeviceTypes(data || []);
            } else if (activeTab === 'brands') {
                const data = await servicesCatalog.getBrands({ all: true });
                setBrands(data || []);
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (item = null) => {
        setEditingItem(item);
        if (activeTab === 'services') {
            setFormData(item ? { ...item } : {
                name: '',
                description: '',
                device_type_id: '',
                brand_id: '',
                base_price: '',
                estimated_time: '',
                is_active: true
            });
        } else {
            setFormData(item ? { ...item } : {
                name: '',
                is_active: true
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setFormData({});
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (activeTab === 'services') {
                if (editingItem) await servicesCatalog.update(editingItem.id, formData);
                else await servicesCatalog.create(formData);
            } else if (activeTab === 'types') {
                if (editingItem) await servicesCatalog.updateDeviceType(editingItem.id, formData);
                else await servicesCatalog.createDeviceType(formData);
            } else if (activeTab === 'brands') {
                if (editingItem) await servicesCatalog.updateBrand(editingItem.id, formData);
                else await servicesCatalog.createBrand(formData);
            }
            closeModal();
            fetchData();
        } catch (error) {
            console.error('Error al guardar:', error);
            alert(error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este elemento?')) return;
        try {
            if (activeTab === 'services') await servicesCatalog.delete(id);
            else if (activeTab === 'types') await servicesCatalog.deleteDeviceType(id);
            else if (activeTab === 'brands') await servicesCatalog.deleteBrand(id);
            fetchData();
        } catch (error) {
            console.error('Error al eliminar:', error);
            alert(error.message);
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth > 900 ? 12 : 6);

    useEffect(() => {
        const handleResize = () => setItemsPerPage(window.innerWidth > 900 ? 12 : 6);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const filteredServices = services.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesType = !filterType || s.device_type_id === parseInt(filterType);
        return matchesSearch && matchesType;
    });

    const filteredTypes = deviceTypes.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredBrands = brands.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calcular paginación sobre el array activo
    let activeArray = [];
    if (activeTab === 'services') activeArray = filteredServices;
    else if (activeTab === 'types') activeArray = filteredTypes;
    else if (activeTab === 'brands') activeArray = filteredBrands;

    const totalPages = Math.ceil(activeArray.length / itemsPerPage);
    const paginatedArray = activeArray.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Efecto para resetear paginación al buscar o cambiar de tab
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType, activeTab]);

    return (
        <div className="admin-services-container">
            <header className="page-header">
                <div>
                    <h1>Configuración de Catálogos</h1>
                    <p className="text-muted">Administra servicios, equipos y marcas de forma interactiva</p>
                </div>
                <div className="header-actions">
                    <button onClick={fetchData} className="btn btn-secondary">
                        <RefreshCw size={16} /> <span className="hide-on-mobile">Actualizar</span>
                    </button>
                    <button onClick={() => openModal()} className="btn btn-primary">
                        <Plus size={18} /> Nuevo <span className="hide-on-mobile">{activeTab === 'services' ? 'Servicio' : activeTab === 'types' ? 'Tipo' : 'Marca'}</span>
                    </button>
                </div>
            </header>

            {/* Pestañas Modernas */}
            <div className="tabs">
                <button
                    className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('services'); setSearchTerm(''); }}
                >
                    <Wrench size={16} /> Servicios
                </button>
                <button
                    className={`tab-btn ${activeTab === 'types' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('types'); setSearchTerm(''); }}
                >
                    <Smartphone size={16} /> Tipos de Equipo
                </button>
                <button
                    className={`tab-btn ${activeTab === 'brands' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('brands'); setSearchTerm(''); }}
                >
                    <Trophy size={16} /> Marcas
                </button>
            </div>

            {/* Buscador y Filtros */}
            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder={`Buscar ${activeTab === 'services' ? 'servicios' : activeTab === 'types' ? 'tipos de equipo' : 'marcas'}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input"
                    />
                </div>
                {activeTab === 'services' && (
                    <select
                        className="select filter-select"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="">Todos los tipos</option>
                        {deviceTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Contenido Visual en base a Pestaña Activa */}
            <div className="catalog-content">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Cargando datos del catálogo...</p>
                    </div>
                ) : (
                    <>
                        {/* 1. Vista de Servicios (Cards) */}
                        {activeTab === 'services' && (
                            paginatedArray.length === 0 ? (
                                <div className="empty-state">
                                    <XCircle size={48} className="text-muted" />
                                    <h3>No se encontraron servicios</h3>
                                    <p>Intenta ajustar tus filtros o registra un servicio nuevo.</p>
                                </div>
                            ) : (
                                <div className="services-grid animate-fadeIn">
                                    {paginatedArray.map(item => {
                                        const typeName = deviceTypes.find(t => t.id === item.device_type_id)?.name || 'General (Todos)';
                                        return (
                                            <div key={item.id} className={`service-card ${!item.is_active ? 'inactive' : ''}`}>
                                                <div className="service-card-header">
                                                    <span className="service-name">{item.name}</span>
                                                    <span className={`service-badge ${item.is_active ? 'active' : 'inactive'}`}>
                                                        {item.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </div>
                                                <p className="service-desc">{item.description || 'Sin descripción detallada disponible.'}</p>
                                                <div className="service-meta-row">
                                                    <span className="service-price">{servicesCatalog.formatCurrency(item.base_price)}</span>
                                                    <div className="service-time">
                                                        <Clock size={12} />
                                                        <span>{item.estimated_time || 'Bajo consulta'}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-2)' }}>
                                                    <span className="text-muted" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <Smartphone size={10} /> {typeName}
                                                    </span>
                                                    <div className="service-card-actions">
                                                        {item.barcode && (
                                                            <button onClick={() => openBarcodeModal(item)} className="btn btn-icon btn-ghost" title="Imprimir Código de Barras"><Barcode size={14} /></button>
                                                        )}
                                                        <button onClick={() => openModal(item)} className="btn btn-icon btn-ghost" title="Editar"><Edit size={14} /></button>
                                                        <button onClick={() => handleDelete(item.id)} className="btn btn-icon btn-ghost btn-danger" title="Eliminar"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {/* 2. Vista de Tipos de Dispositivo (Chips Interactivos) */}
                        {activeTab === 'types' && (
                            paginatedArray.length === 0 ? (
                                <div className="empty-state">
                                    <XCircle size={48} className="text-muted" />
                                    <h3>No se encontraron tipos de equipo</h3>
                                    <p>Registra un nuevo tipo para comenzar a clasificar servicios.</p>
                                </div>
                            ) : (
                                <div className="types-brands-grid animate-fadeIn">
                                    {paginatedArray.map(item => (
                                        <div key={item.id} className={`catalogue-chip-card ${!item.is_active ? 'inactive' : ''}`}>
                                            <div className="chip-card-info">
                                                <div className="chip-card-icon">
                                                    <Smartphone size={16} />
                                                </div>
                                                <div>
                                                    <div className="chip-card-name">{item.name}</div>
                                                    <div className="chip-card-status">{item.is_active ? 'Activo' : 'Inactivo'}</div>
                                                </div>
                                            </div>
                                            <div className="action-buttons">
                                                <button onClick={() => openModal(item)} className="btn btn-icon btn-ghost" title="Editar"><Edit size={14} /></button>
                                                <button onClick={() => handleDelete(item.id)} className="btn btn-icon btn-ghost btn-danger" title="Eliminar"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* 3. Vista de Marcas (Chips Interactivos) */}
                        {activeTab === 'brands' && (
                            paginatedArray.length === 0 ? (
                                <div className="empty-state">
                                    <XCircle size={48} className="text-muted" />
                                    <h3>No se encontraron marcas</h3>
                                    <p>Añade marcas al catálogo para usarlas en tus órdenes de servicio.</p>
                                </div>
                            ) : (
                                <div className="types-brands-grid animate-fadeIn">
                                    {paginatedArray.map(item => (
                                        <div key={item.id} className={`catalogue-chip-card ${!item.is_active ? 'inactive' : ''}`}>
                                            <div className="chip-card-info">
                                                <div className="chip-card-icon">
                                                    <Trophy size={16} />
                                                </div>
                                                <div>
                                                    <div className="chip-card-name">{item.name}</div>
                                                    <div className="chip-card-status">{item.is_active ? 'Activo' : 'Inactivo'}</div>
                                                </div>
                                            </div>
                                            <div className="action-buttons">
                                                <button onClick={() => openModal(item)} className="btn btn-icon btn-ghost" title="Editar"><Edit size={14} /></button>
                                                <button onClick={() => handleDelete(item.id)} className="btn btn-icon btn-ghost btn-danger" title="Eliminar"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* Controles de Paginación */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
                                <button 
                                    className="btn btn-secondary" 
                                    disabled={currentPage === 1} 
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                >
                                    Anterior
                                </button>
                                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                    Página {currentPage} de {totalPages}
                                </span>
                                <button 
                                    className="btn btn-secondary" 
                                    disabled={currentPage === totalPages} 
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                >
                                    Siguiente
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal de Registro / Edición */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingItem ? 'Editar' : 'Nuevo'} {activeTab === 'services' ? 'Servicio' : activeTab === 'types' ? 'Tipo' : 'Marca'}</h3>
                            <button onClick={closeModal} className="btn-icon"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="form">
                            <div className="input-group">
                                <label>Nombre del Elemento *</label>
                                <input type="text" name="name" className="input" value={formData.name || ''} onChange={handleChange} required placeholder="Ej. Cambio de Pantalla, iPhone, Samsung..." />
                            </div>
                            {activeTab === 'services' && (
                                <>
                                    <div className="input-group mt-sm">
                                        <label>Descripción del Servicio</label>
                                        <textarea name="description" className="input" rows="3" value={formData.description || ''} onChange={handleChange} placeholder="Detalla el alcance del servicio..."></textarea>
                                    </div>
                                    <div className="form-row mt-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
                                        <div className="input-group">
                                            <label>Tipo de Equipo compatible</label>
                                            <select name="device_type_id" className="select" value={formData.device_type_id || ''} onChange={handleChange}>
                                                <option value="">General (Todos)</option>
                                                {deviceTypes.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Marca compatible</label>
                                            <select name="brand_id" className="select" value={formData.brand_id || ''} onChange={handleChange}>
                                                <option value="">General (Todas)</option>
                                                {brands.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Precio Base ($ MXN)</label>
                                            <input type="number" name="base_price" className="input" value={formData.base_price || ''} onChange={handleChange} placeholder="0.00" />
                                        </div>
                                    </div>
                                    <div className="form-row mt-sm">
                                        <div className="input-group">
                                            <label>Tiempo Estimado de Entrega</label>
                                            <input type="text" name="estimated_time" className="input" placeholder="Ej: 1-2 horas, 1 día hábil..." value={formData.estimated_time || ''} onChange={handleChange} />
                                        </div>
                                        <div className="input-group">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label>Código de Barras</label>
                                                <button
                                                    type="button"
                                                    style={{ background: 'none', color: 'var(--color-primary)', fontSize: '0.65rem', fontWeight: 600, padding: 0, cursor: 'pointer' }}
                                                    onClick={() => {
                                                        if (!isBarcodePlanAllowed) {
                                                            showAlert({
                                                                title: 'Función Pro y Enterprise',
                                                                text: 'La generación automática de códigos de barras está reservada para los planes Pro y Enterprise.',
                                                                icon: 'warning',
                                                                confirmButtonText: 'Aceptar'
                                                            });
                                                            return;
                                                        }
                                                        const generated = `9${Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('')}`;
                                                        setFormData(prev => ({ ...prev, barcode: generated }));
                                                    }}
                                                >
                                                    Generar
                                                </button>
                                            </div>
                                            <input type="text" name="barcode" className="input" placeholder="Código de barras del servicio..." value={formData.barcode || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="mt-md" style={{ background: 'var(--color-bg-elevated)', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                <label className="checkbox-label">
                                    <input type="checkbox" name="is_active" checked={formData.is_active || false} onChange={handleChange} />
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        {formData.is_active ? <CheckCircle size={16} className="text-success" /> : <XCircle size={16} className="text-muted" />}
                                        Elemento Habilitado (Activo en Catálogo)
                                    </span>
                                </label>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={closeModal} className="btn btn-secondary">Cancelar</button>
                                <button type="submit" className="btn btn-primary"><Save size={18} /> Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Barcode Print Modal */}
            {showBarcodeModal && barcodeItem && isBarcodePlanAllowed && (
                <div className="modal-overlay" onClick={() => setShowBarcodeModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Imprimir Códigos de Barra</h3>
                            <button className="modal-close" onClick={() => setShowBarcodeModal(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', padding: 'var(--sp-4)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff', padding: '15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', justifyContent: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#000000', marginBottom: '5px', textAlign: 'center', display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {barcodeItem.name}
                                </span>
                                <div style={{ background: '#ffffff', padding: '5px', display: 'flex', justifyContent: 'center' }}>
                                    <svg id="service-barcode-svg"></svg>
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#000000', marginTop: '5px' }}>
                                    {servicesCatalog.formatCurrency(barcodeItem.base_price)}
                                </span>
                            </div>

                            <div className="input-group">
                                <label style={{ fontWeight: 600 }}>Número de copias a imprimir</label>
                                <input
                                    className="input"
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={printCopies}
                                    onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
                                />
                            </div>

                            <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
                                <button className="btn btn-secondary" onClick={() => setShowBarcodeModal(false)}>Cerrar</button>
                                <button className="btn btn-primary" onClick={handlePrintBarcodes} style={{ gap: '6px' }}>
                                    <Printer size={15} /> Imprimir etiquetas
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
