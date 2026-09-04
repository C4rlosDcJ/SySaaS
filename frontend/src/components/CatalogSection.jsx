import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { publicService, orderService } from '../services/api';
import {
    Wrench, Package, Search, ShoppingCart, X, Trash2,
    Plus, Minus, Check, ChevronRight, ChevronLeft, Clock, Tag,
    Smartphone, Laptop, Monitor, Gamepad2, Watch, Tablet,
    ShoppingBag, ArrowRight, Sparkles, Send
} from 'lucide-react';
import './CatalogSection.css';

const DEVICE_ICON_MAP = {
    smartphone: Smartphone, phone: Smartphone,
    laptop: Laptop, monitor: Monitor, desktop: Monitor,
    gamepad: Gamepad2, console: Gamepad2,
    watch: Watch, smartwatch: Watch,
    tablet: Tablet, wrench: Wrench, device: Package,
    default: Wrench
};

const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

export default function CatalogSection({ embedded = false, showCartButton = true }) {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // Data
    const [activeTab, setActiveTab] = useState('services');
    const [services, setServices] = useState([]);
    const [deviceTypes, setDeviceTypes] = useState([]);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDeviceType, setFilterDeviceType] = useState(null);
    const [filterCategory, setFilterCategory] = useState(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth > 900 ? 12 : 6);

    useEffect(() => {
        const handleResize = () => setItemsPerPage(window.innerWidth > 900 ? 12 : 6);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Reset pagination on filter or tab change
    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterDeviceType, filterCategory, activeTab]);

    // Cart
    const [cart, setCart] = useState(() => {
        const saved = localStorage.getItem('sysaas_cart');
        return saved ? JSON.parse(saved) : [];
    });
    const [cartOpen, setCartOpen] = useState(false);
    const [cartNotes, setCartNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(null);

    // Editing order state
    const [editingOrder, setEditingOrder] = useState(() => {
        const id = localStorage.getItem('sysaas_editing_order_id');
        const num = localStorage.getItem('sysaas_editing_order_number');
        return id ? { id, order_number: num } : null;
    });

    const cancelEditing = () => {
        if (!confirm('¿Deseas cancelar la edición de este pedido? Se vaciará tu carrito actual.')) return;
        localStorage.removeItem('sysaas_editing_order_id');
        localStorage.removeItem('sysaas_editing_order_number');
        localStorage.removeItem('sysaas_cart');
        setEditingOrder(null);
        setCart([]);
    };

    const searchTimeout = useRef(null);

    // Save cart to localStorage
    useEffect(() => {
        localStorage.setItem('sysaas_cart', JSON.stringify(cart));
    }, [cart]);

    // Load data
    useEffect(() => {
        loadCatalog();
    }, []);

    const loadCatalog = async () => {
        setLoading(true);
        try {
            const [svcData, prodData] = await Promise.all([
                publicService.getCatalogServices(),
                publicService.getCatalogProducts()
            ]);
            setServices(svcData.services || []);
            setDeviceTypes(svcData.deviceTypes || []);
            setProducts(prodData.products || []);
            setCategories(prodData.categories || []);
        } catch (err) {
            console.error('Error loading catalog:', err);
        } finally {
            setLoading(false);
        }
    };

    // Search with debounce for products
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            try {
                const params = {};
                if (searchTerm) params.search = searchTerm;
                if (filterCategory) params.category_id = filterCategory;
                const data = await publicService.getCatalogProducts(params);
                setProducts(data.products || []);
            } catch (err) {
                console.error('Error searching products:', err);
            }
        }, 300);
        return () => clearTimeout(searchTimeout.current);
    }, [searchTerm, filterCategory]);

    // Filter services client-side
    const filteredServices = services.filter(s => {
        if (filterDeviceType && s.device_type_id !== filterDeviceType && s.device_type_id !== null) return false;
        if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !(s.description || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    // Pagination calculations
    const paginatedServices = filteredServices.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    const paginatedProducts = products.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    const totalServicesPages = Math.ceil(filteredServices.length / itemsPerPage);
    const totalProductsPages = Math.ceil(products.length / itemsPerPage);

    // Cart functions
    const addToCart = useCallback((item, type) => {
        setCart(prev => {
            const key = type === 'product' ? `p-${item.id}` : `s-${item.id}`;
            const existing = prev.find(c => c.key === key);
            if (existing) {
                if (type === 'product' && item.is_unique) return prev;
                if (type === 'product' && existing.quantity >= item.stock) return prev;
                return prev.map(c => c.key === key ? { ...c, quantity: c.quantity + 1 } : c);
            }
            return [...prev, {
                key,
                item_type: type,
                product_id: type === 'product' ? item.id : null,
                service_id: type === 'service' ? item.id : null,
                name: item.name,
                price: type === 'product' ? item.sale_price : item.base_price,
                quantity: 1,
                maxStock: type === 'product' ? (item.is_unique ? 1 : item.stock) : null,
                isUnique: type === 'product' ? !!item.is_unique : false,
                categoryColor: item.category_color || null
            }];
        });
    }, []);

    const updateQty = useCallback((key, delta) => {
        setCart(prev => prev.map(item => {
            if (item.key !== key) return item;
            if (item.item_type === 'product' && item.isUnique && delta > 0) return item;
            const newQty = item.quantity + delta;
            if (newQty < 1) return item;
            if (item.maxStock && newQty > item.maxStock) return item;
            return { ...item, quantity: newQty };
        }));
    }, []);

    const removeFromCart = useCallback((key) => {
        setCart(prev => prev.filter(c => c.key !== key));
    }, []);

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Checkout
    const handleCheckout = async () => {
        if (!isAuthenticated) {
            // Persist the intent by redirecting back to store
            const currentPath = window.location.pathname;
            navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
            return;
        }
        if (cart.length === 0) return;

        setSubmitting(true);
        try {
            const items = cart.map(c => ({
                item_type: c.item_type || (c.product_id ? 'product' : 'service'),
                product_id: c.product_id,
                service_id: c.service_id,
                quantity: c.quantity
            }));

            if (editingOrder) {
                await orderService.update(editingOrder.id, { items, notes: cartNotes || null });
                setOrderSuccess({
                    order_number: editingOrder.order_number,
                    total: cartTotal
                });
                localStorage.removeItem('sysaas_editing_order_id');
                localStorage.removeItem('sysaas_editing_order_number');
                setEditingOrder(null);
            } else {
                const result = await orderService.create({ items, notes: cartNotes || null });
                setOrderSuccess(result.order);
            }
            setCart([]);
            setCartNotes('');
            localStorage.removeItem('sysaas_cart');
            setCartOpen(false);
        } catch (err) {
            alert(err.message || 'Error al procesar el pedido');
        } finally {
            setSubmitting(false);
        }
    };

    const isInCart = (id, type) => {
        const key = type === 'product' ? `p-${id}` : `s-${id}`;
        return cart.some(c => c.key === key);
    };

    if (loading) {
        return (
            <section className="catalog-section">
                <div className="container">
                    <div className="catalog-loading">
                        <div className="spinner"></div>
                        <p>Cargando catálogo...</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <>
            <section id="catalogo" className="catalog-section">
                <div className="container">
                    {/* Header */}
                    <div className="catalog-header">
                        <span className="section-tag">
                            <ShoppingBag size={14} />
                            Catálogo
                        </span>
                        <h2>Nuestros <span className="text-accent">servicios y productos</span></h2>
                        <p>Explora todo lo que tenemos disponible para ti y realiza tu pedido en línea.</p>
                    </div>

                    {/* Editing Order Alert Banner */}
                    {editingOrder && (
                        <div className="editing-order-banner" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(230, 51, 88, 0.08)',
                            border: '1.5px solid rgba(230, 51, 88, 0.25)',
                            padding: '12px 20px',
                            borderRadius: '12px',
                            marginBottom: 'var(--sp-6)',
                            gap: '12px',
                            flexWrap: 'wrap'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sparkles size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                    Estás editando el pedido <strong>{editingOrder.order_number}</strong>. Modifica los artículos en tu carrito y confirma para actualizarlo.
                                </span>
                            </div>
                            <button
                                onClick={cancelEditing}
                                style={{
                                    padding: '6px 12px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: 'var(--color-text-secondary)',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#ef4444';
                                    e.currentTarget.style.color = '#ef4444';
                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                Cancelar Edición
                            </button>
                        </div>
                    )}

                    {/* Global Big Search Bar & Tabs */}
                    <div className="catalog-search-global-wrap">
                        <div className="catalog-search-large">
                            <Search size={22} className="search-icon-large" />
                            <input
                                type="text"
                                placeholder="¿Qué estás buscando hoy? (ej. pantalla...)"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button className="search-clear-inline-btn" onClick={() => setSearchTerm('')} title="Limpiar búsqueda">
                                    <X size={18} />
                                </button>
                            )}
                            <button className="search-submit-btn">
                                Buscar
                            </button>
                        </div>
                        
                        <div className="catalog-tabs">
                            <button
                                className={`catalog-tab ${activeTab === 'services' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('services'); setSearchTerm(''); }}
                            >
                                <Wrench size={18} />
                                Servicios
                                <span className="tab-count">{filteredServices.length}</span>
                            </button>
                            <button
                                className={`catalog-tab ${activeTab === 'products' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('products'); setSearchTerm(''); }}
                            >
                                <Package size={18} />
                                Productos
                                <span className="tab-count">{products.length}</span>
                            </button>
                        </div>
                    </div>

                    {/* Controls (Filters only) - Only shown when NOT searching */}
                    {searchTerm.trim() === '' && (
                        <div className="catalog-controls">
                            <div className="catalog-filters">
                                {activeTab === 'services' ? (
                                    <>
                                        <button
                                            className={`filter-chip ${!filterDeviceType ? 'active' : ''}`}
                                            onClick={() => setFilterDeviceType(null)}
                                        >
                                            Todos
                                        </button>
                                        {deviceTypes.map(dt => {
                                            const DtIcon = DEVICE_ICON_MAP[dt.icon?.toLowerCase()] || Wrench;
                                            return (
                                                <button
                                                    key={dt.id}
                                                    className={`filter-chip ${filterDeviceType === dt.id ? 'active' : ''}`}
                                                    onClick={() => setFilterDeviceType(filterDeviceType === dt.id ? null : dt.id)}
                                                >
                                                    <DtIcon size={14} />
                                                    {dt.name}
                                                </button>
                                            );
                                        })}
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className={`filter-chip ${!filterCategory ? 'active' : ''}`}
                                            onClick={() => setFilterCategory(null)}
                                        >
                                            Todos
                                        </button>
                                        {categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                className={`filter-chip ${filterCategory === cat.id ? 'active' : ''}`}
                                                onClick={() => setFilterCategory(filterCategory === cat.id ? null : cat.id)}
                                                style={filterCategory === cat.id ? {} : { '--chip-accent': cat.color }}
                                            >
                                                <Tag size={14} />
                                                {cat.name}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Grid / Global Search Results */}
                    {searchTerm.trim() !== '' ? (
                        <div className="search-results-container">
                            <div className="search-results-header">
                                <h3>Resultados para "{searchTerm}"</h3>
                                <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                                    <X size={16} /> Limpiar búsqueda
                                </button>
                            </div>

                            {/* Services Section */}
                            <div className="search-results-section">
                                <h4 className="search-section-title">
                                    <Wrench size={18} />
                                    Servicios Coincidentes ({filteredServices.length})
                                </h4>
                                {filteredServices.length > 0 ? (
                                    <>
                                        <div className="catalog-grid">
                                            {paginatedServices.map(service => {
                                                const DevIcon = DEVICE_ICON_MAP[service.device_type_icon?.toLowerCase()] || Wrench;
                                                const inCart = isInCart(service.id, 'service');
                                                return (
                                                    <div key={service.id} className="catalog-card">
                                                        <div className="catalog-card-header">
                                                            <div className="catalog-card-icon">
                                                                <DevIcon size={22} />
                                                            </div>
                                                            {service.device_type_name && (
                                                                <span className="catalog-card-badge badge-device">
                                                                    {service.device_type_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3>{service.name}</h3>
                                                        <p className="card-description">{service.description || 'Servicio profesional de reparación'}</p>
                                                        <div className="catalog-card-footer">
                                                            <div className="catalog-price">
                                                                {service.base_price > 0 && (
                                                                    <>
                                                                        <span className="price-label">Desde</span>
                                                                        {formatCurrency(service.base_price)}
                                                                    </>
                                                                )}
                                                                {service.estimated_time && (
                                                                    <span className="estimated-time">
                                                                        <Clock size={12} />
                                                                        {service.estimated_time}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {service.base_price > 0 ? (
                                                                <button
                                                                    className={`card-action-btn ${inCart ? '' : 'btn-outline-card'}`}
                                                                    onClick={() => inCart ? null : addToCart(service, 'service')}
                                                                    disabled={inCart}
                                                                >
                                                                    {inCart ? <><Check size={16} /> Agregado</> : <><Plus size={16} /> Agregar</>}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    className="card-action-btn btn-outline-card"
                                                                    onClick={() => navigate(isAuthenticated ? '/dashboard/nueva-cotizacion' : '/register')}
                                                                >
                                                                    Cotizar <ChevronRight size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {totalServicesPages > 1 && (
                                            <div className="pagination-controls">
                                                <button
                                                    className="btn-pagination"
                                                    disabled={page === 1}
                                                    onClick={() => setPage(page - 1)}
                                                >
                                                    <ChevronLeft size={16} /> Anterior
                                                </button>
                                                <span className="pagination-info">
                                                    Página {page} de {totalServicesPages}
                                                </span>
                                                <button
                                                    className="btn-pagination"
                                                    disabled={page === totalServicesPages}
                                                    onClick={() => setPage(page + 1)}
                                                >
                                                    Siguiente <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="catalog-empty-inline">
                                        <p>No se encontraron servicios que coincidan con tu búsqueda.</p>
                                    </div>
                                )}
                            </div>

                            {/* Products Section */}
                            <div className="search-results-section" style={{ marginTop: 'var(--sp-8)' }}>
                                <h4 className="search-section-title">
                                    <Package size={18} />
                                    Productos Coincidentes ({products.length})
                                </h4>
                                {products.length > 0 ? (
                                    <div className="catalog-grid">
                                        {products.map(product => {
                                            const inCart = isInCart(product.id, 'product');
                                            const isOutOfStock = product.stock <= 0;
                                            const isLowStock = product.stock > 0 && product.stock <= 5;
                                            return (
                                                <div
                                                    key={product.id}
                                                    className={`catalog-card ${isOutOfStock ? 'out-of-stock-card' : ''} ${isLowStock ? 'low-stock-card' : ''}`}
                                                    style={{ '--card-accent': product.category_color || 'var(--color-primary)' }}
                                                >
                                                    {(isOutOfStock || isLowStock) && (
                                                        <div className="catalog-card-status-banner">
                                                            {isOutOfStock ? 'No Disponible (Agotado)' : `¡Bajo Stock! Quedan ${product.stock}`}
                                                        </div>
                                                    )}
                                                    <div className="catalog-card-header">
                                                        <div className="catalog-card-icon">
                                                            <Package size={22} />
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                            {product.category_name && (
                                                                <span className="catalog-card-badge badge-category">
                                                                    {product.category_name}
                                                                </span>
                                                            )}
                                                            {product.is_unique ? (
                                                                <span className="catalog-card-badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)' }}>
                                                                    Pieza Única
                                                                </span>
                                                            ) : (
                                                                <span className={`catalog-card-badge badge-stock ${isOutOfStock ? 'out' : isLowStock ? 'low' : ''}`}>
                                                                    {isOutOfStock ? 'Agotado' : isLowStock ? `Quedan ${product.stock}` : 'En stock'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <h3>{product.name}</h3>
                                                    <p className="card-description">{product.description || 'Producto disponible'}</p>
                                                    <div className="catalog-card-footer">
                                                        <div className="catalog-price">
                                                            {formatCurrency(product.sale_price)}
                                                        </div>
                                                        <button
                                                            className={`card-action-btn ${inCart ? '' : isOutOfStock ? 'btn-out-of-stock' : 'btn-outline-card'}`}
                                                            onClick={() => inCart || isOutOfStock ? null : addToCart(product, 'product')}
                                                            disabled={inCart || isOutOfStock}
                                                        >
                                                            {inCart ? <><Check size={16} /> Agregado</> : isOutOfStock ? <><X size={16} /> Agotado</> : <><ShoppingCart size={16} /> Agregar</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="catalog-empty-inline">
                                        <p>No se encontraron productos que coincidan con tu búsqueda.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        activeTab === 'services' ? (
                            filteredServices.length > 0 ? (
                                <>
                                    <div className="catalog-grid">
                                        {paginatedServices.map(service => {
                                            const DevIcon = DEVICE_ICON_MAP[service.device_type_icon?.toLowerCase()] || Wrench;
                                            const inCart = isInCart(service.id, 'service');
                                            return (
                                                <div key={service.id} className="catalog-card">
                                                    <div className="catalog-card-header">
                                                        <div className="catalog-card-icon">
                                                            <DevIcon size={22} />
                                                        </div>
                                                        {service.device_type_name && (
                                                            <span className="catalog-card-badge badge-device">
                                                                {service.device_type_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3>{service.name}</h3>
                                                    <p className="card-description">{service.description || 'Servicio profesional de reparación'}</p>
                                                    <div className="catalog-card-footer">
                                                        <div className="catalog-price">
                                                            {service.base_price > 0 && (
                                                                <>
                                                                    <span className="price-label">Desde</span>
                                                                    {formatCurrency(service.base_price)}
                                                                </>
                                                            )}
                                                            {service.estimated_time && (
                                                                <span className="estimated-time">
                                                                    <Clock size={12} />
                                                                    {service.estimated_time}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {service.base_price > 0 ? (
                                                            <button
                                                                className={`card-action-btn ${inCart ? '' : 'btn-outline-card'}`}
                                                                onClick={() => inCart ? null : addToCart(service, 'service')}
                                                                disabled={inCart}
                                                            >
                                                                {inCart ? <><Check size={16} /> Agregado</> : <><Plus size={16} /> Agregar</>}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="card-action-btn btn-outline-card"
                                                                onClick={() => navigate(isAuthenticated ? '/dashboard/nueva-cotizacion' : '/register')}
                                                            >
                                                                Cotizar <ChevronRight size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {totalServicesPages > 1 && (
                                        <div className="pagination-controls">
                                            <button
                                                className="btn-pagination"
                                                disabled={page === 1}
                                                onClick={() => setPage(page - 1)}
                                            >
                                                <ChevronLeft size={16} /> Anterior
                                            </button>
                                            <span className="pagination-info">
                                                Página {page} de {totalServicesPages}
                                            </span>
                                            <button
                                                className="btn-pagination"
                                                disabled={page === totalServicesPages}
                                                onClick={() => setPage(page + 1)}
                                            >
                                                Siguiente <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="catalog-empty">
                                    <div className="catalog-empty-icon"><Wrench size={28} /></div>
                                    <h3>No se encontraron servicios</h3>
                                    <p>Intenta con otro filtro o término de búsqueda</p>
                                </div>
                            )
                        ) : (
                            products.length > 0 ? (
                                <>
                                    <div className="catalog-grid">
                                        {paginatedProducts.map(product => {
                                            const inCart = isInCart(product.id, 'product');
                                            const isOutOfStock = product.stock <= 0;
                                            const isLowStock = product.stock > 0 && product.stock <= 5;
                                            return (
                                                <div
                                                    key={product.id}
                                                    className={`catalog-card ${isOutOfStock ? 'out-of-stock-card' : ''} ${isLowStock ? 'low-stock-card' : ''}`}
                                                    style={{ '--card-accent': product.category_color || 'var(--color-primary)' }}
                                                >
                                                    {(isOutOfStock || isLowStock) && (
                                                        <div className="catalog-card-status-banner">
                                                            {isOutOfStock ? 'No Disponible (Agotado)' : `¡Bajo Stock! Quedan ${product.stock}`}
                                                        </div>
                                                    )}
                                                    <div className="catalog-card-header">
                                                        <div className="catalog-card-icon">
                                                            <Package size={22} />
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                            {product.category_name && (
                                                                <span className="catalog-card-badge badge-category">
                                                                    {product.category_name}
                                                                </span>
                                                            )}
                                                            {product.is_unique ? (
                                                                <span className="catalog-card-badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)' }}>
                                                                    Pieza Única
                                                                </span>
                                                            ) : (
                                                                <span className={`catalog-card-badge badge-stock ${isOutOfStock ? 'out' : isLowStock ? 'low' : ''}`}>
                                                                    {isOutOfStock ? 'Agotado' : isLowStock ? `Quedan ${product.stock}` : 'En stock'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <h3>{product.name}</h3>
                                                    <p className="card-description">{product.description || 'Producto disponible'}</p>
                                                    <div className="catalog-card-footer">
                                                        <div className="catalog-price">
                                                            {formatCurrency(product.sale_price)}
                                                        </div>
                                                        <button
                                                            className={`card-action-btn ${inCart ? '' : isOutOfStock ? 'btn-out-of-stock' : 'btn-outline-card'}`}
                                                            onClick={() => inCart || isOutOfStock ? null : addToCart(product, 'product')}
                                                            disabled={inCart || isOutOfStock}
                                                        >
                                                            {inCart ? <><Check size={16} /> Agregado</> : isOutOfStock ? <><X size={16} /> Agotado</> : <><ShoppingCart size={16} /> Agregar</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {totalProductsPages > 1 && (
                                        <div className="pagination-controls">
                                            <button
                                                className="btn-pagination"
                                                disabled={page === 1}
                                                onClick={() => setPage(page - 1)}
                                            >
                                                <ChevronLeft size={16} /> Anterior
                                            </button>
                                            <span className="pagination-info">
                                                Página {page} de {totalProductsPages}
                                            </span>
                                            <button
                                                className="btn-pagination"
                                                disabled={page === totalProductsPages}
                                                onClick={() => setPage(page + 1)}
                                            >
                                                Siguiente <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="catalog-empty">
                                    <div className="catalog-empty-icon"><Package size={28} /></div>
                                    <h3>No se encontraron productos</h3>
                                    <p>Intenta con otro filtro o término de búsqueda</p>
                                </div>
                            )
                        )
                    )}
                </div>
            </section>

            {/* Floating Cart Button */}
            {showCartButton && cart.length > 0 && (
                <button className="cart-floating-btn" onClick={() => setCartOpen(true)}>
                    <ShoppingCart size={26} />
                    <span className="cart-badge">{cartCount}</span>
                </button>
            )}

            {/* Cart Drawer */}
            {cartOpen && (
                <>
                    <div className="cart-overlay" onClick={() => setCartOpen(false)} />
                    <div className="cart-drawer">
                        <div className="cart-drawer-header">
                            <h3>
                                <ShoppingCart size={22} />
                                Mi Carrito
                                <span className="cart-count-label">({cartCount} {cartCount === 1 ? 'ítem' : 'ítems'})</span>
                            </h3>
                            <button className="cart-drawer-close" onClick={() => setCartOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="cart-drawer-body">
                            {cart.length === 0 ? (
                                <div className="cart-empty-state">
                                    <ShoppingBag size={48} />
                                    <p>Tu carrito está vacío</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.key} className="cart-item">
                                        <div
                                            className="cart-item-icon"
                                            style={item.categoryColor ? {
                                                background: `${item.categoryColor}1a`,
                                                color: item.categoryColor
                                            } : {}}
                                        >
                                            {item.item_type === 'product' ? <Package size={18} /> : <Wrench size={18} />}
                                        </div>
                                        <div className="cart-item-info">
                                            <h4>{item.name}</h4>
                                            <span className="cart-item-type">
                                                {item.item_type === 'product' ? 'Producto' : 'Servicio'} · {formatCurrency(item.price)}
                                            </span>
                                        </div>
                                        {item.item_type === 'product' && (
                                            <div className="cart-item-qty">
                                                <button onClick={() => updateQty(item.key, -1)}>−</button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => updateQty(item.key, 1)}>+</button>
                                            </div>
                                        )}
                                        <span className="cart-item-price">
                                            {formatCurrency(item.price * item.quantity)}
                                        </span>
                                        <button
                                            className="cart-item-remove"
                                            onClick={() => removeFromCart(item.key)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="cart-drawer-footer">
                                <div className="cart-totals">
                                    <div className="cart-total-row">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <div className="cart-total-row grand-total">
                                        <span>Total</span>
                                        <span>{formatCurrency(cartTotal)}</span>
                                    </div>
                                </div>
                                <textarea
                                    className="cart-notes-input"
                                    placeholder="Notas adicionales para tu pedido (opcional)"
                                    rows={2}
                                    value={cartNotes}
                                    onChange={e => setCartNotes(e.target.value)}
                                />
                                {isAuthenticated ? (
                                    <button
                                        className="cart-checkout-btn"
                                        onClick={handleCheckout}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <>Procesando...</>
                                        ) : (
                                            <><Send size={18} /> Confirmar Pedido</>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        className="cart-checkout-btn"
                                        onClick={() => navigate('/login')}
                                    >
                                        <ArrowRight size={18} /> Iniciar Sesión para Pedir
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Success Modal */}
            {orderSuccess && (
                <div className="order-success-overlay" onClick={() => setOrderSuccess(null)}>
                    <div className="order-success-modal" onClick={e => e.stopPropagation()}>
                        <div className="order-success-icon">
                            <Check size={36} />
                        </div>
                        <h3>¡Pedido Creado!</h3>
                        <p>Tu pedido ha sido registrado exitosamente. Te notificaremos cuando esté listo.</p>
                        <div className="order-number-display">{orderSuccess.order_number}</div>
                        <p style={{ fontSize: 'var(--font-xs)' }}>Total: {formatCurrency(orderSuccess.total)}</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setOrderSuccess(null);
                                if (isAuthenticated) navigate('/dashboard/pedidos');
                            }}
                        >
                            {isAuthenticated ? 'Ver Mis Pedidos' : 'Cerrar'}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
