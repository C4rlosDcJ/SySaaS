import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ShoppingCart, Search, Package, Wrench, X, Plus, Minus, Trash2,
    CreditCard, Banknote, ArrowRightLeft, Printer, CheckCircle2,
    User, ShoppingBag, ClipboardList, Hash, AlertCircle, Store, Camera
} from 'lucide-react';
import { inventoryService, posService, customerService, servicesCatalog, settingsService, repairService, orderService, getImageUrl } from '../../services/api';
import { formatCurrency, STATUS_LABELS } from '../../utils/constants';
import PrintReceipt from '../../components/common/PrintReceipt';
import SignatureModal from '../../components/common/SignatureModal';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import { showAlert, showConfirm } from '../../utils/swal';
import './POSPage.css';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { draftStorage } from '../../utils/draftStorage';

export default function POSPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { activeBranchId, tenant } = useTenant();
    const { user, isSuperAdmin } = useAuth();
    const tenantId = tenant?.id;

    const isRestoringRef = useRef(true);

    // ─── State ───
    const [mode, setMode] = useState('products'); // 'products' | 'services' | 'repairs' | 'pending_sales'
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState([]);
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountReceived, setAmountReceived] = useState('');
    const [loading, setLoading] = useState(true);

    // Pending web sales state
    const [pendingSales, setPendingSales] = useState([]);
    const [pendingSearch, setPendingSearch] = useState('');
    const [loadedPendingSaleId, setLoadedPendingSaleId] = useState(null);

    // Billable repairs
    const [billableRepairs, setBillableRepairs] = useState([]);
    const [repairSearch, setRepairSearch] = useState('');

    // Customer
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showCustomerResults, setShowCustomerResults] = useState(false);

    // Repair link
    const [linkedRepair, setLinkedRepair] = useState(null);

    // Receipt modal
    const [showReceipt, setShowReceipt] = useState(false);
    const [lastSale, setLastSale] = useState(null);
    const [settings, setSettings] = useState({});
    const [showSigModal, setShowSigModal] = useState(false);

    // Toast
    const [toast, setToast] = useState(null);

    // Barcode scanner modal
    const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

    // Paginación y Carrito Móvil
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth > 900 ? 12 : 6);

    useEffect(() => {
        const handleResize = () => setItemsPerPage(window.innerWidth > 900 ? 12 : 6);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [showMobileCart, setShowMobileCart] = useState(false);

    // Reset de página al cambiar de modo
    useEffect(() => {
        setCurrentPage(1);
    }, [mode, selectedCategory, search, repairSearch, pendingSearch]);

    const searchRef = useRef(null);
    const customerSearchTimeout = useRef(null);
    const loadedRepairIdRef = useRef(null);

    // ─── Restaurar borrador de POS ───
    useEffect(() => {
        // Si viene con deep-link de reparacion, priorizar la orden y no restaurar borrador
        if (searchParams.get('repair_id')) {
            isRestoringRef.current = false;
            return;
        }

        const draft = draftStorage.loadDraft('pos', tenantId, activeBranchId);
        if (draft) {
            if (Array.isArray(draft.cart) && draft.cart.length > 0) {
                setCart(draft.cart);
            }
            if (draft.selectedCustomer) {
                setSelectedCustomer(draft.selectedCustomer);
            }
            if (draft.discount !== undefined) {
                setDiscount(draft.discount);
            }
            if (draft.paymentMethod) {
                setPaymentMethod(draft.paymentMethod);
            }
            if (draft.amountReceived !== undefined) {
                setAmountReceived(draft.amountReceived);
            }
            if (draft.linkedRepair) {
                setLinkedRepair(draft.linkedRepair);
            }
            if (draft.loadedPendingSaleId) {
                setLoadedPendingSaleId(draft.loadedPendingSaleId);
            }
        }

        setTimeout(() => {
            isRestoringRef.current = false;
        }, 150);
    }, [tenantId, activeBranchId]);

    // ─── Guardado automatico de borrador de POS ───
    useEffect(() => {
        if (isRestoringRef.current) return;

        if (cart.length > 0 || selectedCustomer || (discount && discount > 0)) {
            draftStorage.saveDraft('pos', {
                cart,
                selectedCustomer,
                discount,
                paymentMethod,
                amountReceived,
                linkedRepair,
                loadedPendingSaleId
            }, tenantId, activeBranchId);
        } else {
            draftStorage.clearDraft('pos', tenantId, activeBranchId);
        }
    }, [cart, selectedCustomer, discount, paymentMethod, amountReceived, linkedRepair, loadedPendingSaleId, tenantId, activeBranchId]);

    // ─── Load data ───
    useEffect(() => {
        loadData();
    }, [activeBranchId]);

    // ─── Deep-link: load repair from URL ───
    useEffect(() => {
        const repairId = searchParams.get('repair_id');
        if (repairId) {
            loadRepairFromURL(repairId);
        }
    }, [searchParams]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [catData, prodData, svcData, repairsData, settingsData, pendingSalesData] = await Promise.allSettled([
                inventoryService.getCategories(),
                inventoryService.getProducts({ limit: 200 }),
                servicesCatalog.getAll({ limit: 200 }),
                posService.getBillableRepairs(),
                settingsService.getAll(),
                isOrdersPlanAllowed ? orderService.getAll({ status: 'pending' }) : Promise.resolve({ orders: [] })
            ]);
            if (catData.status === 'fulfilled') setCategories(catData.value || []);
            if (prodData.status === 'fulfilled') setProducts(prodData.value?.products || []);
            if (svcData.status === 'fulfilled') {
                const val = svcData.value;
                setServices(Array.isArray(val) ? val : val?.services || []);
            }
            if (repairsData.status === 'fulfilled') setBillableRepairs(repairsData.value || []);
            if (settingsData.status === 'fulfilled') setSettings(settingsData.value || {});
            if (pendingSalesData.status === 'fulfilled') setPendingSales(pendingSalesData.value?.orders || []);
        } catch (err) {
            console.error('Error loading POS data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadRepairFromURL = async (repairId) => {
        if (loadedRepairIdRef.current === repairId) return;
        loadedRepairIdRef.current = repairId;
        try {
            const repair = await posService.getRepairForPOS(repairId);
            if (repair) {
                addRepairToCart(repair);
                // Clean URL param safely without mutating state directly
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('repair_id');
                setSearchParams(newParams, { replace: true });
            }
        } catch (err) {
            console.error('Error loading repair for POS:', err);
            showToast('No se pudo cargar la reparación', 'error');
        }
    };

    // ─── Load billable repairs (with search) ───
    useEffect(() => {
        if (mode !== 'repairs') return;
        const timeout = setTimeout(async () => {
            try {
                const params = {};
                if (repairSearch.trim()) params.search = repairSearch;
                const data = await posService.getBillableRepairs(params);
                setBillableRepairs(data || []);
            } catch (err) {
                console.error(err);
            }
        }, repairSearch ? 300 : 0);
        return () => clearTimeout(timeout);
    }, [mode, repairSearch]);

    // ─── Load pending web sales (with search) ───
    useEffect(() => {
        if (mode !== 'pending_sales' || !isOrdersPlanAllowed) return;
        const timeout = setTimeout(async () => {
            try {
                const params = { status: 'pending' };
                if (pendingSearch.trim()) params.search = pendingSearch;
                const data = await orderService.getAll(params);
                setPendingSales(data.orders || []);
            } catch (err) {
                console.error(err);
            }
        }, pendingSearch ? 300 : 0);
        return () => clearTimeout(timeout);
    }, [mode, pendingSearch]);

    // ─── Filtered items ───
    const filteredProducts = products.filter(p => {
        const matchSearch = !search ||
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
            (p.barcode && p.barcode.includes(search));
        const matchCategory = !selectedCategory || p.category_id === selectedCategory;
        return matchSearch && matchCategory;
    });

    const filteredServices = services.filter(s => {
        return !search || s.name.toLowerCase().includes(search.toLowerCase());
    });

    // ─── Cart operations ───
    const addToCart = useCallback((item, type = 'product') => {
        setCart(prev => {
            const key = type === 'product' ? `p-${item.id}` : `s-${item.id}`;
            const existing = prev.find(i => i.key === key);

            if (existing) {
                if (type === 'product' && item.is_unique) {
                    showToast('Este es un producto único, no se puede añadir más de 1 unidad', 'error');
                    return prev;
                }
                if (type === 'product' && existing.quantity >= item.stock) {
                    showToast('Sin stock disponible', 'error');
                    return prev;
                }
                return prev.map(i =>
                    i.key === key ? { ...i, quantity: i.quantity + 1 } : i
                );
            }

            return [...prev, {
                key,
                type,
                product_id: type === 'product' ? item.id : null,
                service_id: type === 'service' ? item.id : null,
                description: item.name,
                unit_price: parseFloat(type === 'product' ? item.sale_price : item.base_price) || 0,
                quantity: 1,
                discount: 0,
                maxStock: type === 'product' ? (item.is_unique ? 1 : item.stock) : 999,
                is_unique: type === 'product' ? !!item.is_unique : false
            }];
        });
    }, []);

    const addRepairToCart = (repair) => {
        const key = `r-${repair.id}`;

        // Auto-set customer from repair
        if (repair.customer_id && !selectedCustomer) {
            setSelectedCustomer({
                id: repair.customer_id,
                first_name: repair.customer_first_name,
                last_name: repair.customer_last_name,
                phone: repair.customer_phone
            });
        }

        // Link the repair
        setLinkedRepair({
            id: repair.id,
            ticket_number: repair.ticket_number
        });

        // Build repair description
        const device = `${repair.brand_name || repair.brand_other || ''} ${repair.model || ''}`.trim();
        const serviceName = repair.service_name || repair.service_requested || 'Reparación';
        const description = `${serviceName} — ${device} (${repair.ticket_number})`;

        // The amount to charge is the remaining balance
        const balance = repair.balance || (parseFloat(repair.total_cost) - parseFloat(repair.advance_payment || 0));

        // Build itemized breakdown for the cart
        const items = [];

        // Add as a single "repair charge" line with the full balance
        items.push({
            key,
            type: 'repair',
            product_id: null,
            service_id: null,
            repair_id: repair.id,
            description,
            unit_price: Math.max(0, balance),
            quantity: 1,
            discount: 0,
            maxStock: 1,
            isRepair: true
        });

        setCart(prev => {
            const existing = prev.find(i => i.key === key);
            if (existing) {
                return prev;
            }
            showToast(`Reparación ${repair.ticket_number} agregada`);
            return [...prev, ...items];
        });
    };

    const loadPendingSaleToCart = async (sale) => {
        try {
            const saleDetail = await orderService.getById(sale.id);
            clearCart();
            setLoadedPendingSaleId(saleDetail.id);

            if (saleDetail.customer_id) {
                setSelectedCustomer({
                    id: saleDetail.customer_id,
                    first_name: saleDetail.customer_first_name,
                    last_name: saleDetail.customer_last_name,
                    phone: saleDetail.customer_phone,
                    email: saleDetail.customer_email
                });
            }

            const cartItems = saleDetail.items.map(item => {
                const key = item.product_id ? `p-${item.product_id}` : `s-${item.service_id}`;
                return {
                    key,
                    type: item.product_id ? 'product' : 'service',
                    product_id: item.product_id,
                    service_id: item.service_id,
                    description: item.description,
                    unit_price: parseFloat(item.unit_price) || 0,
                    quantity: item.quantity,
                    discount: parseFloat(item.discount) || 0,
                    maxStock: 999
                };
            });
            setCart(cartItems);
            showToast(`Pedido ${saleDetail.order_number} cargado en el carrito`);
        } catch (err) {
            console.error(err);
            showToast('Error al cargar el pedido', 'error');
        }
    };

    const handleCancelPendingSale = async (sale) => {
        const confirmed = await showConfirm({
            title: '¿Cancelar Pedido?',
            text: `¿Estás seguro de que deseas cancelar el pedido ${sale.order_number}?`,
            icon: 'warning',
            confirmText: 'Sí, cancelar'
        });
        if (!confirmed) {
            return;
        }
        try {
            await orderService.cancel(sale.id);
            showToast(`Pedido ${sale.order_number} cancelado`, 'success');
            if (loadedPendingSaleId === sale.id) {
                clearCart();
            }
            // Refresh list
            const data = await orderService.getAll({ status: 'pending' });
            setPendingSales(data.orders || []);
        } catch (err) {
            console.error(err);
            showToast('Error al cancelar el pedido', 'error');
        }
    };

    const updateQuantity = (key, delta) => {
        setCart(prev => prev.map(item => {
            if (item.key !== key) return item;
            // Repairs can't change quantity
            if (item.type === 'repair') return item;
            if (item.type === 'product' && item.is_unique && delta > 0) {
                showToast('Este es un producto único, no se puede añadir más de 1 unidad', 'error');
                return item;
            }
            const newQty = item.quantity + delta;
            if (newQty < 1) return item;
            if (item.type === 'product' && newQty > item.maxStock) {
                showToast('Stock insuficiente', 'error');
                return item;
            }
            return { ...item, quantity: newQty };
        }));
    };

    const removeFromCart = (key) => {
        const item = cart.find(i => i.key === key);
        // If removing a repair, also unlink it
        if (item?.type === 'repair') {
            setLinkedRepair(null);
        }
        setCart(prev => prev.filter(i => i.key !== key));
    };

    const clearCart = () => {
        setCart([]);
        setDiscount(0);
        setAmountReceived('');
        setSelectedCustomer(null);
        setLinkedRepair(null);
        setLoadedPendingSaleId(null);
        draftStorage.clearDraft('pos', tenantId, activeBranchId);
    };

    // ─── Calculations ───
    const subtotal = cart.reduce((sum, item) =>
        sum + (item.unit_price * item.quantity) - (item.discount || 0), 0
    );
    const total = Math.max(0, subtotal - (parseFloat(discount) || 0));
    const changeAmount = paymentMethod === 'cash'
        ? Math.max(0, (parseFloat(amountReceived) || 0) - total)
        : 0;

    // ─── Customer search ───
    const handleCustomerSearch = (value) => {
        setCustomerSearch(value);
        if (customerSearchTimeout.current) clearTimeout(customerSearchTimeout.current);

        if (value.length < 2) {
            setCustomerResults([]);
            setShowCustomerResults(false);
            return;
        }

        customerSearchTimeout.current = setTimeout(async () => {
            try {
                const data = await customerService.getAll({ search: value, limit: 5 });
                setCustomerResults(data.customers || []);
                setShowCustomerResults(true);
            } catch (err) {
                console.error(err);
            }
        }, 300);
    };

    const selectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setCustomerSearch('');
        setShowCustomerResults(false);
    };

    // ─── Checkout ───
    const handleCheckout = async () => {
        if (cart.length === 0) return;

        if (paymentMethod === 'cash' && (parseFloat(amountReceived) || 0) < total) {
            showToast('Monto recibido insuficiente', 'error');
            return;
        }

        // Si hay una reparación vinculada en el carrito, requerimos la firma del cliente
        if (linkedRepair) {
            setShowSigModal(true);
            return;
        }

        // De lo contrario, cobro directo tradicional
        await completeCheckout(null);
    };

    const completeCheckout = async (signatureData) => {
        setShowSigModal(false);
        try {
            const saleData = {
                customer_id: selectedCustomer?.id || null,
                repair_id: linkedRepair?.id || null,
                pending_sale_id: loadedPendingSaleId || null,
                items: cart.map(item => ({
                    product_id: item.product_id,
                    service_id: item.service_id,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount: item.discount || 0
                })),
                discount: parseFloat(discount) || 0,
                payment_method: paymentMethod,
                amount_received: paymentMethod === 'cash' ? parseFloat(amountReceived) : total,
                notes: signatureData ? 'Cobrado en POS con firma de conformidad' : (linkedRepair ? 'Cobrado en POS sin firma de conformidad' : (loadedPendingSaleId ? 'Pedido web cobrado en sucursal' : null))
            };

            const result = await posService.createSale(saleData);
            
            // Si hay reparación vinculada, actualizar estado en backend a 'delivered' con la firma
            if (linkedRepair) {
                const note = signatureData ? 'Equipo entregado al cliente con firma (cobrado en POS)' : 'Equipo entregado al cliente (sin firma - cobrado en POS)';
                await repairService.updateStatus(linkedRepair.id, 'delivered', note, null, signatureData);
            }

            const saleDetail = await posService.getSaleById(result.sale.id);
            setLastSale(saleDetail);
            setShowReceipt(true);
            showToast(`Venta ${result.sale.sale_number} registrada`, 'success');
            clearCart();
            loadData();
        } catch (err) {
            showToast(err.message || 'Error al procesar venta', 'error');
        }
    };

    // ─── Toast ───
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ─── Barcode Scan Handler ───
    const handleBarcodeScanned = (code) => {
        if (!code) return { success: false };
        const query = code.trim().toLowerCase();

        // 1. Buscar coincidencia exacta en productos (barcode o SKU)
        const foundProduct = products.find(p => 
            (p.barcode && p.barcode.toLowerCase() === query) || 
            (p.sku && p.sku.toLowerCase() === query)
        );

        if (foundProduct) {
            addToCart(foundProduct, 'product');
            showToast(`Producto agregado: ${foundProduct.name}`);
            return { success: true, item: foundProduct, type: 'product' };
        }

        // 2. Buscar coincidencia exacta en servicios de catálogo (barcode)
        const foundService = services.find(s => 
            s.barcode && s.barcode.toLowerCase() === query
        );

        if (foundService) {
            addToCart(foundService, 'service');
            showToast(`Servicio agregado: ${foundService.name}`);
            return { success: true, item: foundService, type: 'service' };
        }

        // 3. Buscar coincidencia en órdenes de reparación (ticket_number)
        const foundRepair = billableRepairs.find(r => 
            r.ticket_number && r.ticket_number.toLowerCase() === query
        );

        if (foundRepair) {
            addRepairToCart(foundRepair);
            showToast(`Reparación cargada: ${foundRepair.ticket_number}`);
            return { success: true, item: foundRepair, type: 'repair' };
        }

        showToast(`No se encontró ningún artículo con código: ${code}`, 'error');
        return { success: false };
    };

    // ─── Plan Check: Lector de Cámara y Pedidos Web para Pro y Enterprise ───
    const planSlug = (tenant?.plan_slug || tenant?.plan_name || '').toLowerCase();
    const isOrdersPlanAllowed = 
        (tenant?.plan_id && Number(tenant.plan_id) >= 2) || 
        ['pro', 'enterprise'].some(p => planSlug.includes(p));
    const isScannerPlanAllowed = isOrdersPlanAllowed;

    const handleOpenScanner = () => {
        if (!isScannerPlanAllowed) {
            showAlert({
                title: 'Función Pro y Enterprise',
                text: 'El escaneo de códigos de barra con la cámara está reservado para los planes Pro y Enterprise. Actualiza tu suscripción para habilitar esta herramienta en tu punto de venta.',
                icon: 'warning',
                confirmButtonText: 'Aceptar'
            });
            return;
        }
        setShowBarcodeScanner(true);
    };

    // ─── Render ───
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Cargando punto de venta...</p>
            </div>
        );
    }

    return (
        <div className="pos-layout">
            {/* ═══ LEFT: Catalog ═══ */}
            <div className="pos-catalog">
                <div className="pos-catalog-header">
                    <h1>
                        <ShoppingBag size={22} className="pos-icon" />
                        Punto de Venta
                    </h1>
                    <div className="pos-search-row">
                        <div className="pos-search-input-group">
                            <div className="search-box">
                                <Search size={16} className="search-icon" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    className="input"
                                    placeholder={
                                        mode === 'products' ? 'Buscar producto, SKU o código...' :
                                        mode === 'services' ? 'Buscar servicio...' :
                                        mode === 'pending_sales' ? 'Buscar pedido por folio o cliente...' :
                                        'Buscar ticket, cliente o modelo...'
                                    }
                                    value={
                                        mode === 'repairs' ? repairSearch :
                                        mode === 'pending_sales' ? pendingSearch :
                                        search
                                    }
                                    onChange={(e) => {
                                        if (mode === 'repairs') setRepairSearch(e.target.value);
                                        else if (mode === 'pending_sales') setPendingSearch(e.target.value);
                                        else setSearch(e.target.value);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const query = (mode === 'repairs' ? repairSearch : mode === 'pending_sales' ? pendingSearch : search).trim();
                                            if (!query) return;

                                            // 1. Buscar coincidencia exacta en productos (barcode o SKU)
                                            const foundProduct = products.find(p => 
                                                (p.barcode && p.barcode.toLowerCase() === query.toLowerCase()) || 
                                                (p.sku && p.sku.toLowerCase() === query.toLowerCase())
                                            );

                                            if (foundProduct) {
                                                addToCart(foundProduct, 'product');
                                                setSearch('');
                                                setRepairSearch('');
                                                setPendingSearch('');
                                                setMode('products');
                                                showToast(`Producto agregado: ${foundProduct.name}`);
                                                e.preventDefault();
                                                return;
                                            }

                                            // 2. Buscar coincidencia exacta en servicios de catálogo (barcode)
                                            const foundService = services.find(s => 
                                                s.barcode && s.barcode.toLowerCase() === query.toLowerCase()
                                            );

                                            if (foundService) {
                                                addToCart(foundService, 'service');
                                                setSearch('');
                                                setRepairSearch('');
                                                setPendingSearch('');
                                                setMode('services');
                                                showToast(`Servicio agregado: ${foundService.name}`);
                                                e.preventDefault();
                                                return;
                                            }

                                            // 3. Buscar coincidencia exacta en reparaciones pendientes por cobrar (ticket_number)
                                            const foundRepair = billableRepairs.find(r => 
                                                r.ticket_number && r.ticket_number.toLowerCase() === query.toLowerCase()
                                            );

                                            if (foundRepair) {
                                                addRepairToCart(foundRepair);
                                                setSearch('');
                                                setRepairSearch('');
                                                setPendingSearch('');
                                                setMode('repairs');
                                                showToast(`Reparación cargada: ${foundRepair.ticket_number}`);
                                                e.preventDefault();
                                                return;
                                            }
                                        }
                                    }}
                                    id="pos-search"
                                />
                            </div>
                            <button
                                type="button"
                                className={`pos-scan-btn ${!isScannerPlanAllowed ? 'plan-locked' : ''}`}
                                title={isScannerPlanAllowed ? "Escanear código de barras con la cámara" : "Función exclusiva para planes Pro y Enterprise"}
                                aria-label="Escanear código de barras con la cámara"
                                onClick={handleOpenScanner}
                            >
                                <Camera size={18} />
                            </button>
                        </div>
                        <div className="pos-mode-toggle">
                            <button
                                className={mode === 'products' ? 'active' : ''}
                                onClick={() => { setMode('products'); setSearch(''); }}
                            >
                                <Package size={14} /> Productos
                            </button>
                            <button
                                className={mode === 'services' ? 'active' : ''}
                                onClick={() => { setMode('services'); setSearch(''); }}
                            >
                                <Wrench size={14} /> Servicios
                            </button>
                            <button
                                className={`${mode === 'repairs' ? 'active' : ''} ${billableRepairs.length > 0 ? 'has-badge' : ''}`}
                                onClick={() => { setMode('repairs'); setRepairSearch(''); }}
                            >
                                <ClipboardList size={14} /> Reparaciones
                                {billableRepairs.length > 0 && (
                                    <span className="mode-badge">{billableRepairs.length}</span>
                                )}
                            </button>
                            <button
                                className={`${mode === 'pending_sales' ? 'active' : ''} ${pendingSales.length > 0 ? 'has-badge' : ''}`}
                                onClick={() => {
                                    if (!isOrdersPlanAllowed) {
                                        showAlert({
                                            title: 'Función Pro y Enterprise',
                                            text: 'El apartado de Pedidos Web está reservado para los planes Pro y Enterprise.',
                                            icon: 'warning',
                                            confirmButtonText: 'Aceptar'
                                        });
                                        return;
                                    }
                                    setMode('pending_sales');
                                    setPendingSearch('');
                                }}
                            >
                                <ShoppingBag size={14} /> Pedidos Web
                                {!isOrdersPlanAllowed && (
                                    <span className="badge-plan-lock" style={{ marginLeft: '4px' }}>
                                        Pro
                                    </span>
                                )}
                                {isOrdersPlanAllowed && pendingSales.length > 0 && (
                                    <span className="mode-badge">{pendingSales.length}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Categories filter (products only) */}
                {mode === 'products' && categories.length > 0 && (
                    <div className="pos-categories">
                        <button
                            className={`pos-category-chip ${!selectedCategory ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(null)}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`pos-category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat.id)}
                                style={{ '--cat-color': cat.color }}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* ─── Content Grid ─── */}
                <div className="pos-products-grid">
                    {mode === 'products' ? (
                        /* ── Products Tab ── */
                        filteredProducts.length > 0 ? (
                            filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(product => {
                                const otherBranchesWithStock = (product.other_branches_stock || []).filter(b => b.stock > 0);
                                const hasStockOtherBranches = otherBranchesWithStock.length > 0;

                                return (
                                    <div
                                        key={product.id}
                                        className="pos-product-card"
                                        style={{ '--cat-color': product.category_color }}
                                        onClick={() => {
                                            if (product.stock > 0) {
                                                addToCart(product, 'product');
                                            } else if (hasStockOtherBranches) {
                                                const branchDetails = otherBranchesWithStock.map(b => `• ${b.branch_name}: ${b.stock} unidades`).join('\n');
                                                showAlert({
                                                    title: 'Disponible en otra sucursal',
                                                    text: `"${product.name}" no cuenta con existencias en esta sede, pero está disponible en:\n\n${branchDetails}\n\nPuedes solicitar un traspaso de inventario en el módulo de Inventario.`,
                                                    icon: 'info'
                                                });
                                            }
                                        }}
                                    >
                                        {product.image_url && (
                                            <div style={{ width: '100%', height: '70px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '2px', background: 'var(--color-bg-elevated)' }}>
                                                <img 
                                                    src={getImageUrl(product.image_url)} 
                                                    alt={product.name} 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                    onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                                                />
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                            <span className="pos-product-name">{product.name}</span>
                                            {product.is_unique ? (
                                                <span style={{ fontSize: '8px', fontWeight: 700, background: 'rgba(255, 255, 255, 0.08)', border: '1px solid var(--color-border-strong)', padding: '1px 4px', borderRadius: '3px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Único</span>
                                            ) : null}
                                        </div>
                                        <span className="pos-product-meta">{product.sku}</span>
                                        <span className="pos-product-price">{formatCurrency(product.sale_price)}</span>
                                        
                                        {/* Stock Badge */}
                                        {product.stock > 0 ? (
                                            <span className={`pos-product-stock ${
                                                product.is_unique ? 'in-stock' :
                                                product.stock <= product.min_stock ? 'low-stock' : 'in-stock'
                                            }`}>
                                                {product.is_unique ? 'Único disponible' :
                                                 product.stock <= product.min_stock ? `¡${product.stock} uds!` :
                                                 `${product.stock} uds`}
                                            </span>
                                        ) : hasStockOtherBranches ? (
                                            <span 
                                                className="pos-product-stock other-branch" 
                                                title={`Disponible en: ${otherBranchesWithStock.map(b => `${b.branch_name} (${b.stock} uds)`).join(', ')}`}
                                            >
                                                <Store size={11} style={{ marginRight: 4, flexShrink: 0 }} />
                                                <span>{product.other_branches_total} {product.other_branches_total === 1 ? 'ud' : 'uds'} en otra sede</span>
                                            </span>
                                        ) : product.is_unique ? (
                                            <span className="pos-product-stock sold">
                                                Vendido
                                            </span>
                                        ) : (
                                            <span className="pos-product-stock no-stock">
                                                Sin stock
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <Package size={40} className="empty-icon" />
                                <h3>Sin productos</h3>
                                <p>Agrega productos desde Inventario</p>
                            </div>
                        )
                    ) : mode === 'services' ? (
                        /* ── Services Tab ── */
                        filteredServices.length > 0 ? (
                            filteredServices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(service => (
                                <div
                                    key={service.id}
                                    className="pos-service-card"
                                    onClick={() => addToCart(service, 'service')}
                                >
                                    <span className="pos-product-name">{service.name}</span>
                                    <span className="pos-product-meta">{service.estimated_time || ''}</span>
                                    <span className="pos-product-price">{formatCurrency(service.base_price)}</span>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <Wrench size={40} className="empty-icon" />
                                <h3>Sin servicios</h3>
                                <p>Agrega servicios desde el catálogo</p>
                            </div>
                        )
                    ) : mode === 'pending_sales' ? (
                        /* ── Pending Web Sales Tab ── */
                        pendingSales.length > 0 ? (
                            pendingSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(sale => {
                                const isLoaded = loadedPendingSaleId === sale.id;
                                return (
                                    <div
                                        key={sale.id}
                                        className={`pos-repair-card ${isLoaded ? 'in-cart' : ''}`}
                                        onClick={() => !isLoaded && loadPendingSaleToCart(sale)}
                                        style={{ borderColor: isLoaded ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.08)' }}
                                    >
                                        <div className="repair-card-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', marginBottom: '8px' }}>
                                            <span className="repair-card-ticket" style={{ color: 'var(--color-text)', fontSize: '0.8rem' }}>
                                                <ShoppingBag size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                                {sale.order_number}
                                            </span>
                                            <span className="status-badge-mini status-pending" style={{ fontSize: '0.55rem', padding: '2px 6px' }}>
                                                Pendiente
                                            </span>
                                        </div>
                                        <span className="pos-product-name">
                                            {sale.customer_first_name} {sale.customer_last_name}
                                        </span>
                                        <span className="pos-product-meta">
                                            {sale.item_count} {sale.item_count === 1 ? 'artículo' : 'artículos'}
                                        </span>
                                        <span className="pos-product-meta" style={{ fontSize: '0.65rem' }}>
                                            Nota: {sale.notes || 'Sin nota'}
                                        </span>
                                        <div className="repair-card-pricing" style={{ marginTop: 'var(--sp-2)' }}>
                                            <div className="repair-price-row balance">
                                                <span>Por pagar:</span>
                                                <span style={{ color: 'var(--color-primary)', fontWeight: '800' }}>{formatCurrency(sale.total)}</span>
                                            </div>
                                        </div>
                                        {/* Action buttons */}
                                        <div className="pos-card-actions" style={{ marginTop: 'var(--sp-3)', display: 'flex', gap: '8px' }}>
                                            <button
                                                className="btn btn-outline btn-sm btn-danger-pos"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancelPendingSale(sale);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px',
                                                    fontSize: '0.75rem',
                                                    padding: '6px 8px',
                                                    borderColor: 'var(--color-border)',
                                                    color: 'var(--color-text-secondary)',
                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                    cursor: 'pointer',
                                                    borderRadius: 'var(--radius-sm, 6px)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#fff';
                                                    e.currentTarget.style.color = '#000';
                                                    e.currentTarget.style.borderColor = '#fff';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                                }}
                                            >
                                                <X size={12} /> Cancelar Pedido
                                            </button>
                                        </div>
                                        {isLoaded && (
                                            <span className="repair-in-cart-badge">
                                                <CheckCircle2 size={12} /> Cargado
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <ShoppingBag size={40} className="empty-icon" />
                                <h3>Sin pedidos web</h3>
                                <p>Los pedidos creados por clientes aparecerán aquí</p>
                            </div>
                        )
                    ) : (
                        /* ── Repairs Tab ── */
                        billableRepairs.length > 0 ? (
                            billableRepairs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(repair => {
                                const isInCart = cart.some(i => i.key === `r-${repair.id}`);
                                return (
                                    <div
                                        key={repair.id}
                                        className={`pos-repair-card ${isInCart ? 'in-cart' : ''}`}
                                        onClick={() => !isInCart && addRepairToCart(repair)}
                                    >
                                        <div className="repair-card-header">
                                            <span className="repair-card-ticket">
                                                <Hash size={12} />
                                                {repair.ticket_number}
                                            </span>
                                            <span className={`status-badge-mini status-${repair.status}`}>
                                                {STATUS_LABELS[repair.status]}
                                            </span>
                                        </div>
                                        <span className="pos-product-name">
                                            {repair.brand_name || repair.brand_other} {repair.model}
                                        </span>
                                        <span className="pos-product-meta">
                                            {repair.customer_first_name} {repair.customer_last_name}
                                        </span>
                                        <span className="pos-product-meta" style={{ fontSize: '0.65rem' }}>
                                            {repair.service_name || repair.service_requested || 'Reparación'}
                                        </span>
                                        <div className="repair-card-pricing">
                                            <div className="repair-price-row">
                                                <span>Total:</span>
                                                <span>{formatCurrency(repair.total_cost)}</span>
                                            </div>
                                            {parseFloat(repair.advance_payment) > 0 && (
                                                <div className="repair-price-row advance">
                                                    <span>Anticipo:</span>
                                                    <span>-{formatCurrency(repair.advance_payment)}</span>
                                                </div>
                                            )}
                                            <div className="repair-price-row balance">
                                                <span>Saldo:</span>
                                                <span>{formatCurrency(repair.balance)}</span>
                                            </div>
                                        </div>
                                        {isInCart && (
                                            <span className="repair-in-cart-badge">
                                                <CheckCircle2 size={12} /> En carrito
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <ClipboardList size={40} className="empty-icon" />
                                <h3>Sin reparaciones pendientes</h3>
                                <p>Las reparaciones listas para cobrar aparecerán aquí</p>
                            </div>
                        )
                    )}
                </div>

                {/* Controles de Paginación del Catálogo */}
                {(() => {
                    const listLength = mode === 'products' ? filteredProducts.length
                                     : mode === 'services' ? filteredServices.length
                                     : mode === 'pending_sales' ? pendingSales.length
                                     : billableRepairs.length;
                    const totalPages = Math.ceil(listLength / itemsPerPage);
                    if (totalPages <= 1) return null;
                    return (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-4)' }}>
                            <button
                                className="btn btn-secondary"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            >
                                Anterior
                            </button>
                            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            >
                                Siguiente
                            </button>
                        </div>
                    );
                })()}
            </div>

            {/* ═══ RIGHT: Cart (Condicional en Móvil) ═══ */}
            <div className={`pos-cart ${showMobileCart ? 'mobile-open' : ''}`}>
                <div className="pos-cart-header">
                    <h2>
                        <ShoppingCart size={18} />
                        Carrito
                        {cart.length > 0 && <span className="cart-count">{cart.length}</span>}
                    </h2>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {cart.length > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={clearCart}>
                                <Trash2 size={14} /> Limpiar
                            </button>
                        )}
                        <button className="btn btn-ghost btn-icon mobile-cart-close" onClick={() => setShowMobileCart(false)} style={{ display: 'none' }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Customer Selector */}
                <div className="pos-customer-select">
                    <label>Cliente {linkedRepair ? '' : '(opcional)'}</label>
                    {selectedCustomer ? (
                        <div className="selected-customer">
                            <span className="customer-name">
                                <User size={14} style={{ marginRight: 6, opacity: 0.5 }} />
                                {selectedCustomer.first_name} {selectedCustomer.last_name}
                            </span>
                            {!linkedRepair && (
                                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomer(null)}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="customer-search-input">
                            <input
                                className="input"
                                placeholder="Buscar cliente..."
                                value={customerSearch}
                                onChange={(e) => handleCustomerSearch(e.target.value)}
                                onBlur={() => setTimeout(() => setShowCustomerResults(false), 200)}
                                id="pos-customer-search"
                            />
                            {showCustomerResults && customerResults.length > 0 && (
                                <div className="customer-results">
                                    {customerResults.map(c => (
                                        <div
                                            key={c.id}
                                            className="customer-result-item"
                                            onClick={() => selectCustomer(c)}
                                        >
                                            <span>{c.first_name} {c.last_name}</span>
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
                                                {c.phone || c.email}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Linked Pending Web Sale */}
                {loadedPendingSaleId && (
                    <div className="pos-repair-link" style={{ marginBottom: 'var(--sp-2)' }}>
                        <div className="repair-link-badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
                            <ShoppingBag size={14} />
                            <span>Pedido Web Cargado</span>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                clearCart();
                            }} style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }}>
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Linked Repair Badge */}
                {linkedRepair && (
                    <div className="pos-repair-link">
                        <div className="repair-link-badge">
                            <Hash size={14} />
                            <span>Reparación Vinculada: {linkedRepair.ticket_number}</span>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                // Remove repair item from cart
                                const repairKey = `r-${linkedRepair.id}`;
                                setCart(prev => prev.filter(item => item.key !== repairKey));
                                setLinkedRepair(null);
                            }} style={{ marginLeft: 'auto' }}>
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Cart Items */}
                <div className="pos-cart-items">
                    {cart.length === 0 ? (
                        <div className="pos-cart-empty">
                            <ShoppingCart size={40} className="empty-icon" />
                            <h3>Carrito vacío</h3>
                            <p>Haz clic en los productos para agregarlos</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.key} className={`cart-item ${item.type === 'repair' ? 'cart-item-repair' : ''}`}>
                                <div className="cart-item-info">
                                    <div className="cart-item-name">
                                        {item.description}
                                    </div>
                                    <div className="cart-item-price">
                                        {formatCurrency(item.unit_price)}
                                        {item.discount > 0 && (
                                            <span style={{ fontSize: '10px', color: 'var(--color-primary)', marginLeft: '6px' }}>
                                                (desc. -{formatCurrency(item.discount)})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {item.type !== 'repair' && (
                                    <div className="cart-item-qty">
                                        <button onClick={() => updateQuantity(item.key, -1)}>
                                            <Minus size={12} />
                                        </button>
                                        <span style={{ minWidth: '16px', textAlign: 'center', fontSize: 'var(--font-xs)', fontWeight: 'bold' }}>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.key, 1)}>
                                            <Plus size={12} />
                                        </button>
                                    </div>
                                )}
                                <button className="cart-item-remove" onClick={() => removeFromCart(item.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Cart Footer */}
                {cart.length > 0 && (
                    <div className="pos-cart-footer">
                        <div className="cart-totals">
                            <div className="cart-total-row">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="cart-total-row">
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Descuento General
                                </span>
                                <input
                                    type="number"
                                    className="input input-sm"
                                    placeholder="0"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    style={{ width: '90px', textAlign: 'right', flexShrink: 0 }}
                                />
                            </div>
                            <div className="cart-total-row grand-total">
                                <span>Total</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                        </div>

                        {/* Payment Method Selector */}
                        <div className="pos-payment-methods">
                            <button
                                className={`payment-method-btn ${paymentMethod === 'cash' ? 'selected' : ''}`}
                                onClick={() => setPaymentMethod('cash')}
                            >
                                <Banknote size={18} />
                                Efectivo
                            </button>
                            <button
                                className={`payment-method-btn ${paymentMethod === 'card' ? 'selected' : ''}`}
                                onClick={() => setPaymentMethod('card')}
                            >
                                <CreditCard size={18} />
                                Tarjeta
                            </button>
                            <button
                                className={`payment-method-btn ${paymentMethod === 'transfer' ? 'selected' : ''}`}
                                onClick={() => setPaymentMethod('transfer')}
                            >
                                <ArrowRightLeft size={18} />
                                Transferencia
                            </button>
                        </div>

                        {/* Cash input */}
                        {paymentMethod === 'cash' && (
                            <div className="cash-payment-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                                <div className="cash-input-box" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Efectivo Recibido</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="$0.00"
                                        value={amountReceived}
                                        onChange={(e) => setAmountReceived(e.target.value)}
                                        id="pos-amount-received"
                                        style={{ width: '100%', fontSize: '1.25rem', fontWeight: 800, textAlign: 'center', height: '42px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)' }}
                                    />
                                </div>
                                <div className="cash-change-box" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: parseFloat(amountReceived) >= total ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.01)', border: parseFloat(amountReceived) >= total ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', justifyContent: 'center', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: parseFloat(amountReceived) >= total ? 'var(--color-success)' : 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cambio a Devolver</span>
                                    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: parseFloat(amountReceived) >= total ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                        {parseFloat(amountReceived) >= total ? formatCurrency(changeAmount) : '$0.00'}
                                    </span>
                                </div>
                            </div>
                        )}

                        <button
                            className="pos-checkout-btn"
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || (paymentMethod === 'cash' && (parseFloat(amountReceived) || 0) < total)}
                            id="pos-checkout"
                        >
                            <CheckCircle2 size={20} />
                            Cobrar {formatCurrency(total)}
                        </button>
                    </div>
                )}
            </div>

            {/* Burbuja flotante de Carrito en Móvil */}
            <button
                className="pos-mobile-cart-badge"
                onClick={() => setShowMobileCart(true)}
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
                <ShoppingCart size={24} />
                {cart.length > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        borderRadius: '50%',
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}>
                        {cart.length}
                    </span>
                )}
            </button>

            {/* ═══ Receipt Modal ═══ */}
            <PrintReceipt
                isOpen={showReceipt}
                onClose={() => setShowReceipt(false)}
                data={lastSale}
                type="pos"
                settings={settings}
            />

            <SignatureModal
                isOpen={showSigModal}
                onClose={() => setShowSigModal(false)}
                onSave={completeCheckout}
                title="Confirmar Entrega de Equipo"
                description="Por favor firme para confirmar la recepción y entrega de conformidad de su equipo."
            />

            {/* Toast */}
            {toast && (
                <div className={`pos-toast ${toast.type}`}>
                    {toast.message}
                </div>
            )}

            {/* ═══ Barcode Scanner Camera Modal ═══ */}
            {showBarcodeScanner && isScannerPlanAllowed && (
                <BarcodeScannerModal
                    isOpen={showBarcodeScanner}
                    onClose={() => setShowBarcodeScanner(false)}
                    onScan={handleBarcodeScanned}
                />
            )}
        </div>
    );
}
