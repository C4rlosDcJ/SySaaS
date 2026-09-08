import { useState, useEffect, Fragment, useRef } from 'react';
import {
    Package, Plus, Search, Edit3, Trash2, X, ArrowDownCircle,
    ArrowUpCircle, AlertTriangle, DollarSign, PackageX, Boxes,
    Tag, Palette, Check, FolderPlus, Barcode, Printer, ArrowLeftRight,
    Store, ChevronDown, ChevronUp, Layers, Info, History, Download,
    FileSpreadsheet, Image as ImageIcon, UploadCloud, Eye, CheckSquare,
    Square, Building2, Globe, Sparkles, FileText, Camera
} from 'lucide-react';
import { inventoryService, transferService, branchService, getImageUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { formatCurrency } from '../../utils/constants';
import { showAlert, showConfirm } from '../../utils/swal';
import { compressToBase64 } from '../../utils/imageCompressor';
import CameraCaptureModal from '../../components/CameraCaptureModal';
import './InventoryPage.css';

// Predefined palette colors for category indicators
const CATEGORY_COLORS = [
    '#38bdf8', // Cool Cyan
    '#34d399', // Cool Teal
    '#818cf8', // Cool Slate Blue
    '#60a5fa', // Cool Sky
    '#a78bfa', // Cool Indigo
    '#f87171', // Cool Rose
    '#fbbf24', // Cool Amber
    '#94a3b8'  // Slate Gray
];

export default function InventoryPage() {
    const { user, isTenantAdmin, isSuperAdmin } = useAuth();
    const { activeBranchId, branches: tenantBranches, tenant } = useTenant();
    const isAdmin = isTenantAdmin || isSuperAdmin || user?.role === 'admin' || user?.role === 'tenant_admin' || user?.role === 'superadmin';

    // ─── Main States ───
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [branches, setBranches] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    // ─── Filters & Multi-Branch View ───
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low_or_zero' | 'zero' | 'in_stock'
    const [selectedBranchFilter, setSelectedBranchFilter] = useState('current'); // 'current' | 'all' | branchId

    const isGlobalMatrixView = isAdmin && selectedBranchFilter === 'all';

    // ─── Bulk Actions ───
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
    const [bulkCategoryId, setBulkCategoryId] = useState('');

    // ─── Pagination ───
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth > 900 ? 12 : 6);

    useEffect(() => {
        const handleResize = () => setItemsPerPage(window.innerWidth > 900 ? 12 : 6);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ─── Modals ───
    const [showProductModal, setShowProductModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [showCategoryCreator, setShowCategoryCreator] = useState(false);
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);
    const [showQuickTransferModal, setShowQuickTransferModal] = useState(false);
    const [showMovementsModal, setShowMovementsModal] = useState(false);
    const [showImagePreviewModal, setShowImagePreviewModal] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState('');

    // Quick Transfer & Breakdown
    const [quickTransferProduct, setQuickTransferProduct] = useState(null);
    const [quickTransferForm, setQuickTransferForm] = useState({ source_branch_id: '', quantity: 1, notes: '' });
    const [submittingTransfer, setSubmittingTransfer] = useState(false);
    const [expandedStockProductId, setExpandedStockProductId] = useState(null);

    // Movements History
    const [movementsProduct, setMovementsProduct] = useState(null);
    const [productMovements, setProductMovements] = useState([]);
    const [loadingMovements, setLoadingMovements] = useState(false);

    // Editing / Modals product references
    const [editingProduct, setEditingProduct] = useState(null);
    const [stockProduct, setStockProduct] = useState(null);
    const [barcodeProduct, setBarcodeProduct] = useState(null);
    const [printCopies, setPrintCopies] = useState(1);

    // ─── Form state ───
    const [form, setForm] = useState({
        name: '', sku: '', barcode: '', description: '',
        category_id: '', purchase_price: '', sale_price: '',
        stock: '0', min_stock: '5', is_unique: false,
        image_url: '', target_branch_id: ''
    });

    const [stockForm, setStockForm] = useState({
        type: 'in', quantity: '', notes: '', target_branch_id: ''
    });

    // Category Creator State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

    // Image Uploading State
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showProductCamera, setShowProductCamera] = useState(false);
    const fileInputRef = useRef(null);

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    // ─── Initial Load & Reload on Filter ───
    useEffect(() => {
        loadAll(selectedBranchFilter);
    }, [selectedBranchFilter, activeBranchId]);

    // Barcode rendering
    useEffect(() => {
        if (showBarcodeModal && barcodeProduct?.barcode) {
            setTimeout(() => {
                try {
                    if (window.JsBarcode) {
                        window.JsBarcode("#barcode-svg", barcodeProduct.barcode, {
                            format: "CODE128",
                            lineColor: "#000000",
                            width: 2,
                            height: 60,
                            displayValue: true,
                            fontSize: 12
                        });
                    }
                } catch (err) {
                    console.error("Error al renderizar código de barras:", err);
                }
            }, 100);
        }
    }, [showBarcodeModal, barcodeProduct]);

    const loadAll = async (branchFilter = selectedBranchFilter) => {
        setLoading(true);
        try {
            const branchQueryParam = branchFilter === 'all' 
                ? 'all' 
                : (branchFilter === 'current' ? '' : branchFilter);

            const [prodData, catData, statsData, branchData] = await Promise.all([
                inventoryService.getProducts({ 
                    limit: 300, 
                    ...(branchQueryParam ? { branch_id: branchQueryParam } : {}) 
                }),
                inventoryService.getCategories(),
                inventoryService.getStats(),
                branchService.getAll()
            ]);
            setProducts(prodData.products || []);
            setCategories(catData || []);
            setStats(statsData);
            const bList = Array.isArray(branchData) ? branchData : (branchData?.branches || []);
            setBranches(bList.filter(b => b.is_active));
        } catch (err) {
            console.error('Error loading inventory:', err);
            showToast('Error al cargar datos del inventario', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ─── Image Upload with Compression ───
    const processAndUploadProductImage = async (file) => {
        if (!file) return;

        if (!isPhotoUploadPlanAllowed) {
            showPhotoUploadPlanAlert();
            return;
        }

        try {
            setUploadingImage(true);
            showToast('Comprimiendo y optimizando imagen...', 'info');

            // Comprimir imagen en el navegador y obtener base64 directamente
            // La imagen queda almacenada en la BD como string, persistiendo entre deploys
            const base64DataUrl = await compressToBase64(file, { maxWidth: 800, maxHeight: 800, quality: 0.82 });

            if (base64DataUrl && base64DataUrl.startsWith('data:image')) {
                setForm(prev => ({ ...prev, image_url: base64DataUrl }));
                showToast('Imagen lista. Se guardara al confirmar el producto.', 'success');
            } else {
                setForm(prev => ({ ...prev, image_url: '' }));
                showAlert({ title: 'Error', text: 'No se pudo procesar la imagen.', icon: 'error' });
            }
        } catch (err) {
            console.error('Error procesando imagen:', err);
            setForm(prev => ({ ...prev, image_url: editingProduct?.image_url || '' }));
            showAlert({ title: 'Error', text: err.message || 'No se pudo procesar la imagen.', icon: 'error' });
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleImageChange = (e) => {
        if (!isPhotoUploadPlanAllowed) {
            showPhotoUploadPlanAlert();
            if (e.target) e.target.value = '';
            return;
        }
        const file = e.target.files?.[0];
        if (file) {
            processAndUploadProductImage(file);
        }
    };

    const handleRemoveImage = () => {
        setForm(prev => ({ ...prev, image_url: '' }));
    };

    // ─── Filtered Products & Multi-Selection ───
    const filtered = products.filter(p => {
        let matchSearch = true;
        if (search && search.trim()) {
            const terms = search.toLowerCase().trim().split(/\s+/);
            const searchableText = [
                p.name,
                p.sku,
                p.barcode,
                p.category_name,
                p.brand,
                p.model,
                p.description,
                p.notes
            ].filter(Boolean).join(' ').toLowerCase();
            matchSearch = terms.every(term => searchableText.includes(term));
        }
        const matchCategory = !filterCategory || p.category_id == filterCategory;
        
        let matchStock = true;
        if (stockFilter === 'low_or_zero') {
            // Bajo stock incluye tanto los que están en o por debajo del mínimo como los que tienen 0 unidades (sin stock)
            matchStock = (!p.is_unique && p.stock <= p.min_stock) || (p.is_unique && p.stock === 0) || p.stock === 0;
        } else if (stockFilter === 'zero') {
            // Solo los que tienen 0 unidades (sin stock / agotados)
            matchStock = p.stock === 0;
        } else if (stockFilter === 'in_stock') {
            // Solo con existencias disponibles
            matchStock = p.stock > 0;
        }

        return matchSearch && matchCategory && matchStock;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedFiltered = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Reset pagination on filter
    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterCategory, stockFilter, selectedBranchFilter]);

    // Toggle single selection
    const toggleSelectProduct = (id) => {
        setSelectedProductIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // Toggle select all on current page or all filtered
    const handleSelectAll = () => {
        if (selectedProductIds.length === filtered.length) {
            setSelectedProductIds([]);
        } else {
            setSelectedProductIds(filtered.map(p => p.id));
        }
    };

    // ─── Export CSV con Datos de la Empresa y Multi-Sucursal ───
    const handleExportCSV = (itemsToExport = filtered) => {
        if (itemsToExport.length === 0) {
            showAlert({ title: 'Atención', text: 'No hay productos para exportar.', icon: 'warning' });
            return;
        }

        const companyName = tenant?.company_name || tenant?.name || tenant?.business_name || user?.tenant_name || 'Mi Empresa';
        const currentBranchObj = branches.find(b => b.id === parseInt(activeBranchId, 10));
        const viewName = isGlobalMatrixView ? 'Todas las Sucursales (Vista Global Empresa)' : (currentBranchObj ? currentBranchObj.name : 'Sucursal Actual');
        const formattedDate = new Date().toLocaleString('es-MX');
        
        let totalVal = 0;
        let totalUnits = 0;
        itemsToExport.forEach(p => {
            const qty = p.stock || 0;
            const price = p.sale_price || 0;
            totalVal += (qty * price);
            totalUnits += qty;
        });

        // Encabezado corporativo de metadatos
        const metadataRows = [
            `"EMPRESA / NEGOCIO:","${companyName.replace(/"/g, '""')}"`,
            `"SUCURSAL / VISTA:","${viewName.replace(/"/g, '""')}"`,
            `"FECHA DE GENERACIÓN:","${formattedDate}"`,
            `"GENERADO POR:","${(user?.first_name || 'Usuario') + ' ' + (user?.last_name || '')}"`,
            `"TOTAL PRODUCTOS LISTADOS:","${itemsToExport.length}"`,
            `"TOTAL UNIDADES (STOCK):","${totalUnits}"`,
            `"VALOR TOTAL ESTIMADO (VENTA):","$${totalVal.toFixed(2)}"`,
            `""` // Fila vacía para separar
        ];

        // Columnas principales
        const tableHeaders = [
            'SKU',
            'Código de Barras',
            'Producto',
            'Categoría',
            'Tipo',
            'Precio Compra ($)',
            'Precio Venta ($)',
            'Margen Ganancia ($)',
            'Margen (%)',
            'Stock Sede Actual',
            'Stock Total Empresa',
            'Valor Inventario Sede ($)'
        ];

        // Agregar columnas para cada sucursal registrada
        branches.forEach(b => tableHeaders.push(`Stock [${b.name.replace(/,/g, '')}]`));

        // Mapeo de filas
        const dataRows = itemsToExport.map(p => {
            const cost = parseFloat(p.purchase_price) || 0;
            const sale = parseFloat(p.sale_price) || 0;
            const profit = sale - cost;
            const marginPct = sale > 0 ? ((profit / sale) * 100).toFixed(1) : 0;
            const itemTotalVal = (p.stock || 0) * sale;

            const row = [
                `"${(p.sku || '').replace(/"/g, '""')}"`,
                `"${(p.barcode || '').replace(/"/g, '""')}"`,
                `"${(p.name || '').replace(/"/g, '""')}"`,
                `"${(p.category_name || 'Sin categoría').replace(/"/g, '""')}"`,
                p.is_unique ? 'Único (IMEI/Serie)' : 'Estándar',
                cost.toFixed(2),
                sale.toFixed(2),
                profit.toFixed(2),
                `${marginPct}%`,
                p.stock || 0,
                p.total_company_stock || p.stock || 0,
                itemTotalVal.toFixed(2)
            ];

            branches.forEach(b => {
                const bStock = (p.branches_stock || []).find(bs => bs.branch_id === b.id);
                row.push(bStock ? bStock.stock : 0);
            });

            return row.join(',');
        });

        const csvContent = '\uFEFF' + [...metadataRows, tableHeaders.join(','), ...dataRows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const sanitizedCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
        link.setAttribute('download', `Inventario_${sanitizedCompanyName}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Reporte CSV generado con membrete corporativo');
    };

    // ─── Print Inventory Sheet Profesional con Membrete y Auditoría ───
    const handlePrintInventory = (itemsToPrint = filtered) => {
        if (itemsToPrint.length === 0) {
            showAlert({ title: 'Atención', text: 'No hay productos para imprimir.', icon: 'warning' });
            return;
        }

        const companyName = tenant?.company_name || tenant?.name || tenant?.business_name || user?.tenant_name || 'Mi Empresa';
        const currentBranchObj = branches.find(b => b.id === parseInt(activeBranchId, 10));
        const branchTitle = isGlobalMatrixView ? 'Todas las Sucursales (Consolidado Corporativo)' : (currentBranchObj ? `${currentBranchObj.name} (${currentBranchObj.code || ''})` : 'Sucursal Actual');
        const currentDate = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
        const userName = `${user?.first_name || 'Admin'} ${user?.last_name || ''}`;

        let totalUnitsCount = 0;
        let totalEstimatedValue = 0;
        itemsToPrint.forEach(p => {
            totalUnitsCount += (p.stock || 0);
            totalEstimatedValue += ((p.stock || 0) * (parseFloat(p.sale_price) || 0));
        });

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.left = '-600px';
        document.body.appendChild(iframe);

        const rowsHtml = itemsToPrint.map((p, index) => `
            <tr>
                <td style="text-align: center; font-weight: 600; width: 28px; color: #475569;">${index + 1}</td>
                <td style="font-family: monospace; font-size: 10px; font-weight: bold; white-space: nowrap;">${p.sku || '-'}</td>
                <td style="font-family: monospace; font-size: 10px; color: #64748b; white-space: nowrap;">${p.barcode || '-'}</td>
                <td>
                    <div style="font-weight: 700; color: #0f172a;">${p.name}</div>
                    ${p.is_unique ? '<span style="display:inline-block; font-size:8px; font-weight:800; border:1px solid #cbd5e1; background:#f1f5f9; padding:0px 4px; border-radius:2px; text-transform:uppercase;">Único / Serie</span>' : ''}
                </td>
                <td style="font-size: 10px; color: #334155;">${p.category_name || 'General'}</td>
                <td style="text-align: right; font-weight: 700; white-space: nowrap;">${formatCurrency(p.sale_price)}</td>
                <td style="text-align: center; font-weight: 800; font-size: 12px; color: #0f172a; background: #f8fafc;">${p.stock}</td>
                <td style="text-align: center; color: #64748b; font-size: 10px;">${p.total_company_stock || p.stock}</td>
                <td style="width: 75px; text-align: center; border-bottom: 1px dashed #94a3b8; background: #fff;">&nbsp;</td>
                <td style="width: 75px; text-align: center; border-bottom: 1px dashed #cbd5e1; background: #fff;">&nbsp;</td>
                <td style="width: 100px; border-bottom: 1px dashed #cbd5e1; background: #fff;">&nbsp;</td>
            </tr>
        `).join('');

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Auditoría de Inventario - ${companyName}</title>
                <style>
                    @page {
                        size: letter portrait;
                        margin: 10mm;
                    }
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        color: #0f172a;
                        margin: 0;
                        padding: 0;
                        font-size: 11px;
                        line-height: 1.3;
                    }
                    .header-container {
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 10px;
                        margin-bottom: 12px;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                    }
                    .company-title {
                        font-size: 20px;
                        font-weight: 900;
                        color: #0f172a;
                        letter-spacing: -0.02em;
                        margin: 0 0 2px 0;
                        text-transform: uppercase;
                    }
                    .report-subtitle {
                        font-size: 12px;
                        font-weight: 700;
                        color: #2563eb;
                        margin: 0;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .meta-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 8px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        padding: 8px 12px;
                        margin-bottom: 14px;
                    }
                    .meta-item {
                        display: flex;
                        flex-direction: column;
                    }
                    .meta-label {
                        font-size: 9px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .meta-value {
                        font-size: 11px;
                        font-weight: 700;
                        color: #0f172a;
                        margin-top: 1px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 6px;
                    }
                    th {
                        background: #0f172a;
                        color: #ffffff;
                        font-size: 9px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                        padding: 6px 6px;
                        border: 1px solid #0f172a;
                        text-align: left;
                    }
                    td {
                        border: 1px solid #cbd5e1;
                        padding: 5px 6px;
                        font-size: 10px;
                        vertical-align: middle;
                    }
                    tr:nth-child(even) td {
                        background-color: #f8fafc;
                    }
                    .signature-section {
                        margin-top: 30px;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 40px;
                        page-break-inside: avoid;
                    }
                    .signature-box {
                        border-top: 1px solid #0f172a;
                        padding-top: 6px;
                        text-align: center;
                    }
                    .signature-title {
                        font-size: 11px;
                        font-weight: 800;
                        color: #0f172a;
                    }
                    .signature-role {
                        font-size: 9px;
                        color: #64748b;
                    }
                    .footer-note {
                        margin-top: 16px;
                        text-align: center;
                        font-size: 8px;
                        color: #94a3b8;
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div>
                        <h1 class="company-title">${companyName}</h1>
                        <p class="report-subtitle">Control y Auditoría Física de Inventario</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; font-weight: 700; color: #475569;">${companyName}</div>
                        <div style="font-size: 9px; color: #64748b;">${currentDate}</div>
                    </div>
                </div>

                <div class="meta-grid">
                    <div class="meta-item">
                        <span class="meta-label">Sucursal / Ubicación</span>
                        <span class="meta-value">${branchTitle}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Responsable de Emisión</span>
                        <span class="meta-value">${userName}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Total Artículos</span>
                        <span class="meta-value">${itemsToPrint.length} productos (${totalUnitsCount} uds)</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Valor en Inventario</span>
                        <span class="meta-value">${formatCurrency(totalEstimatedValue)}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 25px; text-align: center;">#</th>
                            <th>SKU</th>
                            <th>Código</th>
                            <th>Descripción del Producto</th>
                            <th>Categoría</th>
                            <th style="text-align: right;">P. Venta</th>
                            <th style="text-align: center;">Stock Sede</th>
                            <th style="text-align: center;">Stock Global</th>
                            <th style="text-align: center; background: #1e293b;">Conteo Físico</th>
                            <th style="text-align: center; background: #1e293b;">Diferencia</th>
                            <th style="text-align: center; background: #1e293b;">Observaciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="signature-section">
                    <div class="signature-box">
                        <div class="signature-title">Firma de Quien Realiza el Conteo</div>
                        <div class="signature-role">Auditor / Encargado de Almacén</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-title">Firma de Supervisión y Aprobación</div>
                        <div class="signature-role">Gerencia / Administración de Sucursal</div>
                    </div>
                </div>

                <div class="footer-note">
                    Documento oficial generado por ${companyName}.
                </div>

                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                        setTimeout(function() {
                            window.parent.document.body.removeChild(window.frameElement);
                        }, 600);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();
    };

    // ─── Product Movements History (Kardex) ───
    const openProductMovements = async (product) => {
        setMovementsProduct(product);
        setShowMovementsModal(true);
        setLoadingMovements(true);
        try {
            const data = await inventoryService.getProductMovements(product.id);
            setProductMovements(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error al cargar movimientos:', err);
            showAlert({ title: 'Error', text: 'No se pudo cargar el historial de movimientos.', icon: 'error' });
        } finally {
            setLoadingMovements(false);
        }
    };

    // ─── Bulk Actions Handlers ───
    const handleBulkDelete = async () => {
        if (selectedProductIds.length === 0) return;
        const confirm = await showConfirm(
            `¿Estás seguro de desactivar ${selectedProductIds.length} producto(s) seleccionados?`,
            'Esta acción ocultará los productos del catálogo.'
        );
        if (!confirm) return;

        try {
            await inventoryService.bulkDelete(selectedProductIds);
            showAlert({ title: 'Éxito', text: `${selectedProductIds.length} productos desactivados.`, icon: 'success' });
            setSelectedProductIds([]);
            loadAll();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al eliminar productos.', icon: 'error' });
        }
    };

    const handleBulkCategorySubmit = async (e) => {
        e.preventDefault();
        if (selectedProductIds.length === 0) return;

        try {
            await inventoryService.bulkUpdateCategory(selectedProductIds, bulkCategoryId || null);
            showAlert({ title: 'Éxito', text: `Categoría asignada a ${selectedProductIds.length} productos.`, icon: 'success' });
            setShowBulkCategoryModal(false);
            setBulkCategoryId('');
            setSelectedProductIds([]);
            loadAll();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al actualizar categoría.', icon: 'error' });
        }
    };

    // ─── Plan Check: Códigos de barras exclusivo para Pro y Enterprise ───
    const planSlug = (tenant?.plan_slug || tenant?.plan_name || '').toLowerCase();
    const isBarcodePlanAllowed = 
        (tenant?.plan_id && Number(tenant.plan_id) >= 2) || 
        ['pro', 'enterprise'].some(p => planSlug.includes(p));

    // ─── Plan Check: Subida de fotos de productos exclusivo para Pro y Enterprise ───
    const isPhotoUploadPlanAllowed = 
        (tenant?.plan_id && Number(tenant.plan_id) >= 2) || 
        ['pro', 'enterprise'].some(p => planSlug.includes(p));

    const showPhotoUploadPlanAlert = () => {
        showAlert({
            title: 'Función Pro y Enterprise',
            text: 'La subida de fotografías de productos está reservada para los planes Pro y Enterprise.',
            icon: 'warning',
            confirmButtonText: 'Aceptar'
        });
    };

    // ─── Barcode Printing ───
    const openBarcodeModal = (product) => {
        if (!isBarcodePlanAllowed) {
            showAlert({
                title: 'Función Pro y Enterprise',
                text: 'La impresión de etiquetas de código de barras está reservada para los planes Pro y Enterprise.',
                icon: 'warning',
                confirmButtonText: 'Aceptar'
            });
            return;
        }
        setBarcodeProduct(product);
        setPrintCopies(1);
        setShowBarcodeModal(true);
    };

    const handlePrintBarcodes = () => {
        if (!barcodeProduct?.barcode) return;
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.left = '-600px';
        document.body.appendChild(iframe);

        const svgContent = document.getElementById('barcode-svg').outerHTML;
        const productName = barcodeProduct.name;
        const price = formatCurrency(barcodeProduct.sale_price);

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
                    @page { size: auto; margin: 0mm; }
                    body { font-family: 'Inter', -apple-system, sans-serif; margin: 0; padding: 10px; background: white; color: black; display: flex; flex-direction: column; gap: 15px; align-items: center; }
                    .label-container { width: 50mm; height: 30mm; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 1px dashed #ccc; padding: 2mm; box-sizing: border-box; page-break-inside: avoid; text-align: center; }
                    .product-name { font-size: 8px; font-weight: bold; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
                    .barcode-wrapper svg { width: 45mm; height: auto; max-height: 18mm; }
                    .price-tag { font-size: 9px; font-weight: 800; margin-top: 2px; }
                </style>
            </head>
            <body>
                ${labelsHtml}
                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                        setTimeout(() => window.parent.document.body.removeChild(window.frameElement), 500);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();
    };

    // ─── Quick Transfer Handlers ───
    const openQuickTransfer = (product, suggestedSourceBranchId = '') => {
        const currentBId = parseInt(activeBranchId || user?.branch_id, 10);
        const availableSources = (product.branches_stock || []).filter(
            bs => bs.branch_id !== currentBId && bs.stock > 0
        );

        let initialSource = suggestedSourceBranchId;
        if (!initialSource && availableSources.length > 0) {
            initialSource = String(availableSources[0].branch_id);
        }

        setQuickTransferProduct(product);
        setQuickTransferForm({
            source_branch_id: initialSource,
            quantity: 1,
            notes: `Solicitud de traspaso para ${product.name} (SKU: ${product.sku || 'N/A'})`
        });
        setExpandedStockProductId(null);
        setShowQuickTransferModal(true);
    };

    const handleQuickTransferSubmit = async (e) => {
        e.preventDefault();
        if (!quickTransferForm.source_branch_id) {
            showAlert({ title: 'Atención', text: 'Selecciona una sucursal de origen con stock disponible.', icon: 'warning' });
            return;
        }

        const sourceStockObj = (quickTransferProduct?.branches_stock || []).find(
            bs => String(bs.branch_id) === String(quickTransferForm.source_branch_id)
        );
        const maxAvailable = sourceStockObj ? sourceStockObj.stock : 0;
        const requestedQty = parseInt(quickTransferForm.quantity, 10) || 1;

        if (requestedQty <= 0) {
            showAlert({ title: 'Atención', text: 'La cantidad a traspasar debe ser mayor a 0.', icon: 'warning' });
            return;
        }

        if (requestedQty > maxAvailable) {
            showAlert({ title: 'Stock Insuficiente', text: `La sucursal de origen solo cuenta con ${maxAvailable} unidad(es) de este producto.`, icon: 'warning' });
            return;
        }

        const destBranchId = parseInt(activeBranchId || user?.branch_id, 10);
        const srcBranchId = parseInt(quickTransferForm.source_branch_id, 10);

        if (destBranchId === srcBranchId) {
            showAlert({ title: 'Atención', text: 'La sucursal de origen y destino no pueden ser la misma.', icon: 'warning' });
            return;
        }

        setSubmittingTransfer(true);
        try {
            await transferService.create({
                source_branch_id: srcBranchId,
                destination_branch_id: destBranchId,
                notes: quickTransferForm.notes,
                items: [{
                    product_id: quickTransferProduct.id,
                    quantity: requestedQty
                }]
            });
            setShowQuickTransferModal(false);
            showAlert({
                title: 'Solicitud Registrada',
                text: `Se ha solicitado el traspaso de ${requestedQty} unidad(es) de "${quickTransferProduct.name}". Puedes consultar y gestionar el despacho en el módulo de Traspasos.`,
                icon: 'success'
            });
            await loadAll();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al solicitar traspaso.', icon: 'error' });
        } finally {
            setSubmittingTransfer(false);
        }
    };

    // ─── Product CRUD ───
    const openNewProduct = () => {
        setEditingProduct(null);
        setForm({
            name: '', sku: '', barcode: '', description: '',
            category_id: '', purchase_price: '', sale_price: '',
            stock: '0', min_stock: '5', is_unique: false,
            image_url: '', target_branch_id: activeBranchId || ''
        });
        setShowProductModal(true);
    };

    const openEditProduct = (product) => {
        setEditingProduct(product);
        setForm({
            name: product.name,
            sku: product.sku || '',
            barcode: product.barcode || '',
            description: product.description || '',
            category_id: product.category_id || '',
            purchase_price: product.purchase_price || '',
            sale_price: product.sale_price || '',
            stock: product.stock,
            min_stock: product.min_stock,
            is_unique: !!product.is_unique,
            image_url: product.image_url || '',
            target_branch_id: activeBranchId || ''
        });
        setShowProductModal(true);
    };

    const handleSaveProduct = async () => {
        if (!form.name || !form.sale_price) {
            showToast('Nombre y precio de venta son obligatorios', 'error');
            return;
        }
        setSaving(true);
        try {
            if (editingProduct) {
                await inventoryService.updateProduct(editingProduct.id, form);
                showToast('Producto actualizado exitosamente');
            } else {
                await inventoryService.createProduct(form);
                showToast('Producto creado exitosamente');
            }
            setShowProductModal(false);
            loadAll();
        } catch (err) {
            showToast(err.message || 'Error al guardar', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProduct = async (id) => {
        const confirm = await showConfirm('¿Eliminar este producto?', 'El producto será desactivado del inventario.');
        if (!confirm) return;
        try {
            await inventoryService.deleteProduct(id);
            showToast('Producto desactivado');
            loadAll();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // ─── Category Creation ───
    const handleCreateCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) {
            showToast('Por favor, indica un nombre de categoría', 'error');
            return;
        }
        setSaving(true);
        try {
            const response = await inventoryService.createCategory({
                name: newCategoryName.trim(),
                color: newCategoryColor
            });
            showToast('Categoría creada exitosamente');
            const updatedCategories = await inventoryService.getCategories();
            setCategories(updatedCategories || []);
            if (response && response.id) {
                setForm(prev => ({ ...prev, category_id: response.id }));
            }
            setNewCategoryName('');
            setShowCategoryCreator(false);
        } catch (err) {
            showToast(err.message || 'Error al guardar categoría', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ─── Stock Movement ───
    const openStockModal = (product) => {
        setStockProduct(product);
        setStockForm({
            type: 'in',
            quantity: '',
            notes: '',
            target_branch_id: String(activeBranchId || user?.branch_id || '')
        });
        setShowStockModal(true);
    };

    const handleStockMovement = async () => {
        if (!stockForm.quantity || parseInt(stockForm.quantity, 10) <= 0) {
            showToast('Cantidad inválida', 'error');
            return;
        }
        setSaving(true);
        try {
            await inventoryService.addStockMovement({
                product_id: stockProduct.id,
                type: stockForm.type,
                quantity: parseInt(stockForm.quantity, 10),
                notes: stockForm.notes,
                target_branch_id: stockForm.target_branch_id || undefined
            });
            showToast(`Stock ${stockForm.type === 'in' ? 'ingresado' : 'retirado'} exitosamente`);
            setShowStockModal(false);
            loadAll();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    if (loading && products.length === 0) {
        return <div className="loading-screen"><div className="spinner"></div><p>Cargando inventario...</p></div>;
    }

    return (
        <div className="inventory-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>Inventario</span>
                        {isGlobalMatrixView && (
                            <span style={{ fontSize: '11px', fontWeight: 800, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                                Vista Global Empresa
                            </span>
                        )}
                    </h1>
                    <p className="text-muted">Administra el stock, fotos, catálogo y control multi-sucursal</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => handleExportCSV(filtered)} title="Exportar productos a formato CSV">
                        <Download size={15} /> Exportar CSV
                    </button>
                    <button className="btn btn-secondary" onClick={() => handlePrintInventory(filtered)} title="Imprimir hoja de inventario para conteo físico">
                        <Printer size={15} /> Imprimir Hoja
                    </button>
                    <button className="btn btn-secondary" onClick={() => {
                        setNewCategoryName('');
                        setShowCategoryCreator(true);
                    }}>
                        <FolderPlus size={15} /> Crear Categoría
                    </button>
                    <button className="btn btn-primary" onClick={openNewProduct} id="btn-new-product">
                        <Plus size={16} /> Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="inventory-stats">
                <div className="inv-stat-card">
                    <div className="inv-stat-icon" style={{ background: 'var(--cool-slate-blue-bg)', color: 'var(--cool-slate-blue)', border: '1px solid var(--cool-slate-blue-border)' }}>
                        <Package size={22} />
                    </div>
                    <div>
                        <div className="inv-stat-value">{stats.totalProducts || 0}</div>
                        <div className="inv-stat-label">Productos Registrados</div>
                    </div>
                </div>
                <div className="inv-stat-card">
                    <div className="inv-stat-icon" style={{ background: 'var(--cool-amber-bg)', color: 'var(--cool-amber)', border: '1px solid var(--cool-amber-border)' }}>
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <div className="inv-stat-value">{stats.lowStockCount || 0}</div>
                        <div className="inv-stat-label">Bajo Stock</div>
                    </div>
                </div>
                <div className="inv-stat-card">
                    <div className="inv-stat-icon" style={{ background: 'var(--cool-rose-bg)', color: 'var(--cool-rose)', border: '1px solid var(--cool-rose-border)' }}>
                        <PackageX size={22} />
                    </div>
                    <div>
                        <div className="inv-stat-value">{stats.outOfStockCount || 0}</div>
                        <div className="inv-stat-label">Sin Stock</div>
                    </div>
                </div>
                <div className="inv-stat-card">
                    <div className="inv-stat-icon" style={{ background: 'var(--cool-teal-bg)', color: 'var(--cool-teal)', border: '1px solid var(--cool-teal-border)' }}>
                        <DollarSign size={22} />
                    </div>
                    <div>
                        <div className="inv-stat-value">{formatCurrency(stats.totalInventoryValue || 0)}</div>
                        <div className="inv-stat-label">Valor Estimado</div>
                    </div>
                </div>
            </div>

            {/* Admin Multi-Branch Selector Tabs */}
            {isAdmin && branches.length > 1 && (
                <div className="branch-view-selector-bar">
                    <div className="branch-selector-title">
                        <Building2 size={15} />
                        <span>Vista de Sucursal:</span>
                    </div>
                    <div className="branch-selector-tabs">
                        <button
                            type="button"
                            className={`branch-tab-pill ${selectedBranchFilter === 'current' ? 'active' : ''}`}
                            onClick={() => setSelectedBranchFilter('current')}
                        >
                            <Store size={13} />
                            <span>Sucursal Actual</span>
                        </button>
                        {branches.map(b => (
                            <button
                                key={b.id}
                                type="button"
                                className={`branch-tab-pill ${selectedBranchFilter === String(b.id) ? 'active' : ''}`}
                                onClick={() => setSelectedBranchFilter(String(b.id))}
                            >
                                <span>{b.name}</span>
                                {b.is_main ? <span className="badge-main-mini">Matriz</span> : null}
                            </button>
                        ))}
                        <button
                            type="button"
                            className={`branch-tab-pill global-tab ${selectedBranchFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setSelectedBranchFilter('all')}
                            title="Ver comparativa de existencias de todas las sucursales"
                        >
                            <Globe size={13} />
                            <span>Todas las Sedes (Consolidado)</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Filters Bar */}
            <div className="inventory-table-actions">
                <div className="inventory-filters-row">
                    <div className="inventory-search-box">
                        <Search size={16} className="search-icon" />
                        <input
                            className="inventory-search-input"
                            placeholder="Buscar por nombre, SKU, código de barras, marca o categoría..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            id="inv-search"
                        />
                        {search && (
                            <button
                                type="button"
                                className="search-clear-btn"
                                onClick={() => setSearch('')}
                                title="Limpiar búsqueda"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <select 
                        className="select inventory-category-select" 
                        value={filterCategory} 
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="">Todas las categorías</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <div className="inventory-stock-tabs">
                        <button
                            type="button"
                            className={`inv-stock-tab ${stockFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setStockFilter('all')}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            className={`inv-stock-tab ${stockFilter === 'low_or_zero' ? 'active' : ''}`}
                            onClick={() => setStockFilter('low_or_zero')}
                            title="Muestra productos con stock menor o igual al mínimo, incluyendo agotados"
                        >
                            <AlertTriangle size={13} /> Bajo Stock / Sin Stock
                        </button>
                        <button
                            type="button"
                            className={`inv-stock-tab ${stockFilter === 'zero' ? 'active' : ''}`}
                            onClick={() => setStockFilter('zero')}
                            title="Muestra solo productos con 0 existencias"
                        >
                            Agotados
                        </button>
                        <button
                            type="button"
                            className={`inv-stock-tab ${stockFilter === 'in_stock' ? 'active' : ''}`}
                            onClick={() => setStockFilter('in_stock')}
                            title="Muestra solo productos con existencias disponibles"
                        >
                            En Stock
                        </button>
                    </div>

                    {(search || filterCategory || stockFilter !== 'all') && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setSearch(''); setFilterCategory(''); setStockFilter('all'); }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}
                        >
                            <X size={13} /> Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Action Bar (when 1 or more items selected) */}
            {selectedProductIds.length > 0 && (
                <div className="bulk-actions-toolbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="bulk-badge-count">{selectedProductIds.length} seleccionados</span>
                        <button 
                            type="button" 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => setSelectedProductIds([])}
                            style={{ fontSize: '11px' }}
                        >
                            Deseleccionar
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => {
                                const selectedItems = products.filter(p => selectedProductIds.includes(p.id));
                                handleExportCSV(selectedItems);
                            }}
                        >
                            <Download size={13} /> Exportar Seleccionados
                        </button>
                        <button 
                            type="button" 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => setShowBulkCategoryModal(true)}
                        >
                            <Tag size={13} /> Asignar Categoría
                        </button>
                        <button 
                            type="button" 
                            className="btn btn-danger btn-sm" 
                            onClick={handleBulkDelete}
                        >
                            <Trash2 size={13} /> Desactivar Seleccionados
                        </button>
                    </div>
                </div>
            )}

            {/* Products Table */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: '38px', textAlign: 'center' }}>
                                <input
                                    type="checkbox"
                                    checked={filtered.length > 0 && selectedProductIds.length === filtered.length}
                                    onChange={handleSelectAll}
                                    style={{ cursor: 'pointer' }}
                                />
                            </th>
                            <th style={{ width: '48px', textAlign: 'center' }}>Foto</th>
                            <th>SKU</th>
                            <th>Producto</th>
                            <th>Categoría</th>
                            <th>P. Compra</th>
                            <th>P. Venta</th>
                            
                            {/* Columnas según el modo de vista */}
                            {isGlobalMatrixView ? (
                                <>
                                    {branches.map(b => (
                                        <th key={b.id} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {b.name}
                                        </th>
                                    ))}
                                    <th style={{ textAlign: 'center', fontWeight: 800 }}>Total Empresa</th>
                                </>
                            ) : (
                                <>
                                    <th>Stock Local</th>
                                    <th>En Otras Sucursales</th>
                                </>
                            )}
                            
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedFiltered.length === 0 ? (
                            <tr>
                                <td colSpan={isGlobalMatrixView ? (8 + branches.length) : 9}>
                                    <div className="empty-state">
                                        <Package size={36} className="empty-icon" />
                                        <h3>Sin productos encontrados</h3>
                                        <p>Agrega productos o modifica los criterios de búsqueda.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedFiltered.map(p => {
                                const isSelected = selectedProductIds.includes(p.id);
                                return (
                                    <Fragment key={p.id}>
                                        <tr style={{
                                            ...(expandedStockProductId === p.id ? { background: 'var(--color-bg-tertiary)' } : {}),
                                            ...(isSelected ? { background: 'rgba(59, 130, 246, 0.05)' } : {})
                                        }}>
                                            {/* Checkbox de selección */}
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectProduct(p.id)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </td>

                                            {/* Foto / Miniatura */}
                                            <td style={{ textAlign: 'center' }}>
                                                {p.image_url ? (
                                                    <div 
                                                        className="product-thumbnail-wrapper"
                                                        onClick={() => {
                                                            setPreviewImageUrl(p.image_url);
                                                            setShowImagePreviewModal(true);
                                                        }}
                                                        title="Ver foto ampliada"
                                                    >
                                                        <img 
                                                            src={getImageUrl(p.image_url)} 
                                                            alt={p.name} 
                                                            className="product-thumbnail" 
                                                            onError={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="product-thumbnail-placeholder" title="Sin imagen">
                                                        <Package size={16} />
                                                    </div>
                                                )}
                                            </td>

                                            <td><span className="font-mono" style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>{p.sku || 'N/A'}</span></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{p.name}</span>
                                                    {p.is_unique ? (
                                                        <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(255, 255, 255, 0.08)', border: '1px solid var(--color-border-strong)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', letterSpacing: '0.02em' }}>Único</span>
                                                    ) : null}
                                                </div>
                                                {p.barcode && <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{p.barcode}</span>}
                                            </td>
                                            <td>
                                                {p.category_name ? (
                                                    <span className="category-badge">
                                                        <span className="category-dot" style={{ background: p.category_color || 'var(--color-primary)' }}></span>
                                                        {p.category_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted" style={{ fontSize: 'var(--font-xs)' }}>Sin categoría</span>
                                                )}
                                            </td>
                                            <td>{formatCurrency(p.purchase_price)}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--color-text)' }}>{formatCurrency(p.sale_price)}</td>
                                            
                                            {/* Desglose Multi-Sede según vista */}
                                            {isGlobalMatrixView ? (
                                                <>
                                                    {branches.map(b => {
                                                        const bStockObj = (p.branches_stock || []).find(bs => bs.branch_id === b.id);
                                                        const bQty = bStockObj ? bStockObj.stock : 0;
                                                        return (
                                                            <td key={b.id} style={{ textAlign: 'center' }}>
                                                                <span style={{
                                                                    fontWeight: 700,
                                                                    fontSize: '12px',
                                                                    color: bQty > 0 ? 'var(--color-text)' : 'var(--color-text-muted)'
                                                                }}>
                                                                    {bQty}
                                                                </span>
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span style={{
                                                            fontWeight: 700,
                                                            fontSize: '13px',
                                                            color: (p.total_company_stock || 0) > 0 ? 'var(--color-text)' : '#f87171'
                                                        }}>
                                                            {p.total_company_stock || 0} <span style={{ fontSize: '11px', fontWeight: 500, color: (p.total_company_stock || 0) > 0 ? 'var(--color-text-secondary)' : 'rgba(248, 113, 113, 0.7)' }}>uds</span>
                                                        </span>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Stock Local */}
                                                    <td>
                                                        {p.is_unique ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{
                                                                    width: '6px',
                                                                    height: '6px',
                                                                    borderRadius: '50%',
                                                                    background: p.stock > 0 ? '#10b981' : '#64748b',
                                                                    display: 'inline-block'
                                                                }}></span>
                                                                <span style={{
                                                                    fontSize: '12.5px',
                                                                    fontWeight: 600,
                                                                    color: p.stock > 0 ? 'var(--color-text)' : 'var(--color-text-muted)'
                                                                }}>
                                                                    {p.stock > 0 ? 'Disponible' : 'Vendido'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                                <span style={{
                                                                    fontWeight: 700,
                                                                    fontSize: '13px',
                                                                    color: p.stock === 0 
                                                                        ? '#f87171' 
                                                                        : (p.stock <= p.min_stock ? '#fbbf24' : 'var(--color-text)')
                                                                }}>
                                                                    {p.stock} <span style={{ fontSize: '11px', fontWeight: 500, color: p.stock === 0 ? 'rgba(248, 113, 113, 0.7)' : 'var(--color-text-secondary)' }}>{p.stock === 1 ? 'ud' : 'uds'}</span>
                                                                </span>
                                                                {p.min_stock > 0 && (
                                                                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>/ mín {p.min_stock}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Stock en Otras Sucursales */}
                                                    <td>
                                                        {p.other_branches_total > 0 ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedStockProductId(expandedStockProductId === p.id ? null : p.id)}
                                                                title="Ver desglose por sucursal"
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    padding: '3px 8px',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    fontSize: '12px',
                                                                    fontWeight: 500,
                                                                    background: expandedStockProductId === p.id ? 'var(--color-bg-hover)' : 'var(--color-bg-secondary)',
                                                                    border: '1px solid var(--color-border)',
                                                                    color: 'var(--color-text)',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                            >
                                                                <Store size={13} style={{ color: 'var(--color-text-muted)' }} />
                                                                <span>{p.other_branches_total} {p.other_branches_total === 1 ? 'ud' : 'uds'} en {p.other_branches_stock.filter(b => b.stock > 0).length} {p.other_branches_stock.filter(b => b.stock > 0).length === 1 ? 'sede' : 'sedes'}</span>
                                                                {expandedStockProductId === p.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                                                {p.is_unique 
                                                                    ? (p.stock === 0 ? 'Vendido' : 'Solo aquí')
                                                                    : (p.stock === 0 ? <span style={{ color: '#f87171', fontWeight: 500 }}>Agotado global</span> : 'Solo aquí')}
                                                            </span>
                                                        )}
                                                    </td>
                                                </>
                                            )}

                                            {/* Acciones */}
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="product-actions">
                                                    {p.other_branches_total > 0 && (
                                                        <button 
                                                            className="btn btn-ghost btn-icon" 
                                                            title="Solicitar Traspaso desde otra sucursal" 
                                                            onClick={() => openQuickTransfer(p)}
                                                            style={{ color: 'var(--color-text-secondary)' }}
                                                        >
                                                            <ArrowLeftRight size={15} />
                                                        </button>
                                                    )}
                                                    <button 
                                                        className="btn btn-ghost btn-icon" 
                                                        title="Ver historial de movimientos (Kardex)" 
                                                        onClick={() => openProductMovements(p)}
                                                    >
                                                        <History size={15} />
                                                    </button>
                                                    {p.barcode && (
                                                        <button className="btn btn-ghost btn-icon" title="Imprimir Código de Barras" onClick={() => openBarcodeModal(p)}>
                                                            <Barcode size={15} />
                                                        </button>
                                                    )}
                                                    <button className="btn btn-ghost btn-icon" title="Agregar/Retirar stock" onClick={() => openStockModal(p)}>
                                                        <Boxes size={15} />
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon" title="Editar" onClick={() => openEditProduct(p)}>
                                                        <Edit3 size={15} />
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon btn-danger" title="Eliminar" onClick={() => handleDeleteProduct(p.id)}>
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Sub-fila expandible para desglose de stock por sede */}
                                        {expandedStockProductId === p.id && !isGlobalMatrixView && (
                                            <tr className="expanded-stock-row" style={{ background: 'var(--color-bg-tertiary)' }}>
                                                <td colSpan="9" style={{ padding: '14px 20px', borderBottom: '2px solid var(--color-border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Store size={16} style={{ color: 'var(--color-text-secondary)' }} />
                                                            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>
                                                                Disponibilidad de "{p.name}" en todas las sucursales:
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                                                Stock Global: <strong>{p.total_company_stock}</strong> unidades
                                                            </span>
                                                            <button 
                                                                type="button" 
                                                                className="btn btn-secondary btn-sm" 
                                                                onClick={() => setExpandedStockProductId(null)}
                                                                style={{ padding: '2px 10px', fontSize: '11px' }}
                                                            >
                                                                Cerrar Detalle
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                                                        {(p.branches_stock || []).map(b => (
                                                            <div 
                                                                key={b.branch_id} 
                                                                style={{ 
                                                                    background: 'var(--color-bg-card)', 
                                                                    border: '1px solid var(--color-border)', 
                                                                    borderRadius: 'var(--radius-md)', 
                                                                    padding: '10px 14px', 
                                                                    display: 'flex', 
                                                                    justifyContent: 'space-between', 
                                                                    alignItems: 'center', 
                                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)' 
                                                                }}
                                                            >
                                                                <div>
                                                                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>
                                                                        {b.branch_name}
                                                                    </div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                                                        {b.branch_code} {b.branch_id === parseInt(activeBranchId || user?.branch_id, 10) ? '(Tu sede actual)' : ''}
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <span style={{ fontWeight: 700, fontSize: '13px', color: b.stock > 0 ? 'var(--color-text)' : '#f87171' }}>
                                                                        {b.stock} <span style={{ fontSize: '11px', fontWeight: 500, color: b.stock > 0 ? 'var(--color-text-secondary)' : 'rgba(248, 113, 113, 0.7)' }}>uds</span>
                                                                    </span>
                                                                    {b.branch_id !== parseInt(activeBranchId || user?.branch_id, 10) && b.stock > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-secondary btn-sm"
                                                                            onClick={() => openQuickTransfer(p, String(b.branch_id))}
                                                                            style={{ padding: '4px 10px', fontSize: '11px', gap: '4px' }}
                                                                            title={`Solicitar traspaso desde ${b.branch_name}`}
                                                                        >
                                                                            <ArrowLeftRight size={12} /> <span>Pedir</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
                    <button 
                        className="btn btn-secondary" 
                        disabled={currentPage === 1} 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    >
                        Anterior
                    </button>
                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        Página {currentPage} de {totalPages} ({filtered.length} productos)
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

            {/* Product Modal (Create & Edit) with Image Upload */}
            {showProductModal && (
                <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
                    <div className="modal modal-product-custom" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, width: '95%' }}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Package size={20} className="text-primary" />
                                    <span>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</span>
                                </h3>
                                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                    {editingProduct ? `Modificando datos y existencias de "${editingProduct.name}"` : 'Completa la información para registrar el producto en el catálogo'}
                                </p>
                            </div>
                            <button className="modal-close" onClick={() => setShowProductModal(false)}><X size={18} /></button>
                        </div>
                        
                        <div className="product-modal-body">
                            {/* Layout de 2 columnas para Foto y Datos Principales */}
                            <div className="product-top-grid">
                                {/* Columna Izquierda: Fotografía */}
                                <div className="product-photo-card">
                                    <label className="section-subtitle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ImageIcon size={13} />
                                            <span>Fotografía</span>
                                        </span>
                                        {!isPhotoUploadPlanAllowed && (
                                            <span style={{
                                                fontSize: '9px',
                                                fontWeight: 800,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                color: '#ef4444',
                                                border: '1px solid rgba(239, 68, 68, 0.25)'
                                            }}>
                                                Pro & Enterprise
                                            </span>
                                        )}
                                    </label>
                                    <div className="photo-dropzone-box">
                                        {form.image_url ? (
                                            <div className="photo-preview-active">
                                                <img 
                                                    src={getImageUrl(form.image_url)} 
                                                    alt="Producto" 
                                                    className="photo-preview-img" 
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                                    }}
                                                />
                                                <div className="photo-overlay-actions">
                                                    <button 
                                                        type="button" 
                                                        className="btn-photo-action btn-photo-change" 
                                                        onClick={() => {
                                                            if (!isPhotoUploadPlanAllowed) {
                                                                showPhotoUploadPlanAlert();
                                                                return;
                                                            }
                                                            fileInputRef.current?.click();
                                                        }}
                                                        disabled={uploadingImage}
                                                        title="Elegir archivo del dispositivo"
                                                    >
                                                        Archivo
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        className="btn-photo-action btn-photo-camera" 
                                                        onClick={() => {
                                                            if (!isPhotoUploadPlanAllowed) {
                                                                showPhotoUploadPlanAlert();
                                                                return;
                                                            }
                                                            setShowProductCamera(true);
                                                        }}
                                                        disabled={uploadingImage}
                                                        title="Tomar foto con la cámara"
                                                    >
                                                        <Camera size={12} /> Cámara
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        className="btn-photo-action btn-photo-delete" 
                                                        onClick={handleRemoveImage}
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                                <span className="photo-badge-webp">WebP Optimizado</span>
                                            </div>
                                        ) : (
                                            <div className="photo-empty-container">
                                                <div 
                                                    className={`photo-empty-box ${uploadingImage ? 'uploading' : ''}`}
                                                    onClick={() => {
                                                        if (!isPhotoUploadPlanAllowed) {
                                                            showPhotoUploadPlanAlert();
                                                            return;
                                                        }
                                                        fileInputRef.current?.click();
                                                    }}
                                                >
                                                    <UploadCloud size={30} className="text-primary" style={{ marginBottom: '4px' }} />
                                                    <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-text)' }}>
                                                        {uploadingImage ? 'Comprimiendo...' : 'Subir Archivo'}
                                                    </div>
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--color-text-secondary)', lineHeight: 1.2 }}>
                                                        JPG, PNG o WebP
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-take-camera-photo"
                                                    onClick={() => {
                                                        if (!isPhotoUploadPlanAllowed) {
                                                            showPhotoUploadPlanAlert();
                                                            return;
                                                        }
                                                        setShowProductCamera(true);
                                                    }}
                                                    disabled={uploadingImage}
                                                >
                                                    <Camera size={14} /> Tomar con Cámara
                                                </button>
                                            </div>
                                        )}
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleImageChange} 
                                            accept="image/*" 
                                            style={{ display: 'none' }} 
                                        />
                                    </div>
                                </div>

                                {/* Columna Derecha: Información Principal */}
                                <div className="product-info-column">
                                    <div className="input-group full-width">
                                        <label>Nombre del Producto *</label>
                                        <input 
                                            className="input input-lg" 
                                            value={form.name} 
                                            onChange={(e) => setForm({ ...form, name: e.target.value })} 
                                            placeholder="Ej: Funda Silicona iPhone 15 Pro Max" 
                                            id="pf-name" 
                                            autoFocus
                                        />
                                    </div>

                                    <div className="form-grid">
                                        <div className="input-group">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label>SKU (Código Interno)</label>
                                                <button
                                                    type="button"
                                                    className="btn-link-action"
                                                    onClick={() => setForm({ ...form, sku: `PRD-${Date.now().toString(36).toUpperCase()}` })}
                                                >
                                                    Auto
                                                </button>
                                            </div>
                                            <input 
                                                className="input font-mono" 
                                                value={form.sku} 
                                                onChange={(e) => setForm({ ...form, sku: e.target.value })} 
                                                placeholder="Ej. FND-IPH15-SIL" 
                                            />
                                        </div>

                                        <div className="input-group">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label>Código de Barras</label>
                                                <button
                                                    type="button"
                                                    className="btn-link-action"
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
                                                        const generated = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
                                                        setForm({ ...form, barcode: generated });
                                                    }}
                                                >
                                                    Generar
                                                </button>
                                            </div>
                                            <input 
                                                className="input font-mono" 
                                                value={form.barcode} 
                                                onChange={(e) => setForm({ ...form, barcode: e.target.value })} 
                                                placeholder="816074556789" 
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group full-width">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label>Categoría</label>
                                            <button
                                                type="button"
                                                className="btn-link-action"
                                                onClick={() => setShowCategoryCreator(true)}
                                            >
                                                + Nueva Categoría
                                            </button>
                                        </div>
                                        <select 
                                            className="select" 
                                            value={form.category_id} 
                                            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                                        >
                                            <option value="">Seleccionar categoría del catálogo...</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Sección de Precios y Margen de Ganancia */}
                            <div className="product-section-card">
                                <div className="section-card-header">
                                    <label className="section-subtitle">
                                        <DollarSign size={13} />
                                        <span>Precios y Rentabilidad</span>
                                    </label>
                                    {/* Indicador dinámico de margen */}
                                    {parseFloat(form.sale_price) > 0 && (
                                        <div className="profit-margin-pill">
                                            {(() => {
                                                const cost = parseFloat(form.purchase_price) || 0;
                                                const sale = parseFloat(form.sale_price) || 0;
                                                const profit = sale - cost;
                                                const marginPercent = sale > 0 ? ((profit / sale) * 100).toFixed(1) : 0;
                                                return (
                                                    <span>
                                                        Ganancia estimada: <strong>{formatCurrency(profit)}</strong> ({marginPercent}%)
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                <div className="form-grid">
                                    <div className="input-group">
                                        <label>Costo de Compra ($)</label>
                                        <input 
                                            className="input" 
                                            type="number" 
                                            step="0.01" 
                                            value={form.purchase_price} 
                                            onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} 
                                            placeholder="0.00" 
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Precio de Venta al Público ($) *</label>
                                        <input 
                                            className="input" 
                                            type="number" 
                                            step="0.01" 
                                            value={form.sale_price} 
                                            onChange={(e) => setForm({ ...form, sale_price: e.target.value })} 
                                            placeholder="0.00" 
                                            id="pf-sale-price" 
                                            style={{ fontWeight: 700 }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sección de Inventario y Sucursal */}
                            <div className="product-section-card">
                                <label className="section-subtitle">
                                    <Boxes size={13} />
                                    <span>Control de Existencias</span>
                                </label>

                                <div className="form-grid">
                                    <div className="input-group">
                                        <label>Stock {editingProduct ? 'en Sede Actual' : 'Inicial'}</label>
                                        <input 
                                            className="input" 
                                            type="number" 
                                            value={form.stock} 
                                            onChange={(e) => setForm({ ...form, stock: e.target.value })} 
                                            placeholder="0" 
                                            disabled={form.is_unique && !editingProduct} 
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Stock Mínimo para Alerta</label>
                                        <input 
                                            className="input" 
                                            type="number" 
                                            value={form.min_stock} 
                                            onChange={(e) => setForm({ ...form, min_stock: e.target.value })} 
                                            placeholder="5" 
                                            disabled={form.is_unique} 
                                        />
                                    </div>
                                </div>

                                {/* Selector de Sucursal Asignada para Administradores */}
                                {isAdmin && branches.length > 1 && (
                                    <div className="input-group full-width" style={{ marginTop: '8px' }}>
                                        <label>Sucursal Destino del Stock</label>
                                        <select 
                                            className="select" 
                                            value={form.target_branch_id || activeBranchId || ''} 
                                            onChange={(e) => setForm({ ...form, target_branch_id: e.target.value })}
                                        >
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name} ({b.code}) {b.is_main ? '— Sede Matriz' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Card de Producto Único (IMEI / Segunda Mano) */}
                            <div 
                                className={`unique-product-toggle-card ${form.is_unique ? 'active' : ''}`}
                                onClick={() => {
                                    const nextVal = !form.is_unique;
                                    setForm(prev => ({
                                        ...prev,
                                        is_unique: nextVal,
                                        stock: nextVal ? '1' : prev.stock,
                                        min_stock: nextVal ? '0' : '5'
                                    }));
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div className={`custom-switch ${form.is_unique ? 'checked' : ''}`}>
                                        <div className="switch-handle"></div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                                            Es un Producto Único (1 sola unidad / número de serie / IMEI)
                                        </div>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                            Recomendado para equipos usados, celulares o piezas irrepetibles. Al venderse se marcará como "Vendido" y no generará alarmas de desabasto.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Descripción / Notas en Tarjeta Estilizada */}
                            <div className="product-section-card">
                                <label className="section-subtitle">
                                    <FileText size={13} />
                                    <span>Descripción y Especificaciones Adicionales</span>
                                </label>
                                <textarea 
                                    className="custom-product-textarea" 
                                    rows="3" 
                                    value={form.description} 
                                    onChange={(e) => setForm({ ...form, description: e.target.value })} 
                                    placeholder="Detalles técnicos, estado cosmético, compatibilidad, garantía o notas internas..." 
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="modal-actions" style={{ marginTop: 'var(--sp-4)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-4)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>
                                    Cancelar
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary" 
                                    onClick={handleSaveProduct} 
                                    disabled={saving || uploadingImage} 
                                    id="pf-save-btn"
                                    style={{ minWidth: '160px' }}
                                >
                                    {saving ? 'Guardando...' : (editingProduct ? 'Actualizar Producto' : 'Guardar Producto')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stock Adjustment Modal with Branch Selector for Admins */}
            {showStockModal && stockProduct && (
                <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Ajuste de Stock: {stockProduct.name}</h3>
                            <button className="modal-close" onClick={() => setShowStockModal(false)}><X size={16} /></button>
                        </div>
                        <div className="product-form">
                            {/* Branch Selector for Admin */}
                            {isAdmin && branches.length > 1 && (
                                <div className="input-group full-width">
                                    <label>Sucursal a Modificar</label>
                                    <select 
                                        className="select" 
                                        value={stockForm.target_branch_id || activeBranchId || ''} 
                                        onChange={(e) => setStockForm({ ...stockForm, target_branch_id: e.target.value })}
                                    >
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.name} ({b.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="input-group full-width">
                                <label>Tipo de Movimiento</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className={`btn ${stockForm.type === 'in' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setStockForm({ ...stockForm, type: 'in' })}
                                        style={{ justifyContent: 'center' }}
                                    >
                                        <ArrowDownCircle size={16} /> Entrada (+)
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${stockForm.type === 'out' ? 'btn-danger' : 'btn-secondary'}`}
                                        onClick={() => setStockForm({ ...stockForm, type: 'out' })}
                                        style={{ justifyContent: 'center' }}
                                    >
                                        <ArrowUpCircle size={16} /> Salida (-)
                                    </button>
                                </div>
                            </div>

                            <div className="input-group full-width">
                                <label>Cantidad de Unidades *</label>
                                <input
                                    className="input"
                                    type="number"
                                    min="1"
                                    value={stockForm.quantity}
                                    onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                                    placeholder="Ej: 10"
                                    autoFocus
                                />
                            </div>

                            <div className="input-group full-width">
                                <label>Motivo / Observaciones</label>
                                <input
                                    className="input"
                                    value={stockForm.notes}
                                    onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                                    placeholder="Ej: Compra directa a proveedor, ajuste por daño, etc."
                                />
                            </div>

                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowStockModal(false)}>Cancelar</button>
                                <button className="btn btn-primary" onClick={handleStockMovement} disabled={saving}>
                                    {saving ? 'Guardando...' : 'Aplicar Ajuste'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Movements History Modal (Kardex) */}
            {showMovementsModal && movementsProduct && (
                <div className="modal-overlay" onClick={() => setShowMovementsModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <History size={18} />
                                    <span>Kardex / Historial: {movementsProduct.name}</span>
                                </h3>
                                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                    SKU: {movementsProduct.sku || 'N/A'} | Stock Total Empresa: {movementsProduct.total_company_stock || movementsProduct.stock} uds
                                </p>
                            </div>
                            <button className="modal-close" onClick={() => setShowMovementsModal(false)}><X size={16} /></button>
                        </div>
                        <div style={{ padding: 'var(--sp-4)', maxHeight: '420px', overflowY: 'auto' }}>
                            {loadingMovements ? (
                                <div style={{ textAlign: 'center', padding: '30px' }}>
                                    <div className="spinner" style={{ margin: '0 auto 10px auto' }}></div>
                                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Cargando movimientos...</p>
                                </div>
                            ) : productMovements.length === 0 ? (
                                <div className="empty-state" style={{ padding: '30px 0' }}>
                                    <History size={32} className="empty-icon" />
                                    <h4>Sin movimientos registrados</h4>
                                    <p>No se encontraron entradas, salidas ni ventas registradas aún para este producto.</p>
                                </div>
                            ) : (
                                <table className="table" style={{ fontSize: '12px' }}>
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Sucursal</th>
                                            <th>Tipo</th>
                                            <th style={{ textAlign: 'center' }}>Cantidad</th>
                                            <th>Referencia / Notas</th>
                                            <th>Usuario</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productMovements.map(m => {
                                            const isEntry = m.type === 'in';
                                            return (
                                                <tr key={m.id}>
                                                    <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                                                        {new Date(m.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </td>
                                                    <td>
                                                        <strong style={{ fontSize: '11px' }}>{m.branch_name}</strong>
                                                    </td>
                                                    <td>
                                                        <span className={`movement-tag ${isEntry ? 'tag-in' : 'tag-out'}`}>
                                                            {isEntry ? 'Entrada' : m.type === 'sale' ? 'Venta' : m.type === 'transfer' ? 'Traspaso' : 'Salida / Ajuste'}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 800, color: isEntry ? '#10b981' : '#ef4444' }}>
                                                        {isEntry ? `+${m.quantity}` : `-${m.quantity}`}
                                                    </td>
                                                    <td style={{ fontSize: '11px' }}>
                                                        <div>{m.reference || '-'}</div>
                                                        {m.notes && <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>{m.notes}</span>}
                                                    </td>
                                                    <td style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                                        {m.first_name ? `${m.first_name} ${m.last_name || ''}` : 'Sistema'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Transfer Modal */}
            {showQuickTransferModal && quickTransferProduct && (
                <div className="modal-overlay" onClick={() => setShowQuickTransferModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Traspaso Rápido de Stock</h3>
                            <button className="modal-close" onClick={() => setShowQuickTransferModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleQuickTransferSubmit} className="product-form">
                            <div style={{ background: 'var(--color-bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{quickTransferProduct.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                    SKU: {quickTransferProduct.sku || 'N/A'} | Stock en tu sede actual: {quickTransferProduct.stock} uds
                                </div>
                            </div>

                            <div className="input-group full-width">
                                <label>Sucursal de Origen (Donde hay existencias) *</label>
                                <select
                                    className="select"
                                    value={quickTransferForm.source_branch_id}
                                    onChange={(e) => setQuickTransferForm({ ...quickTransferForm, source_branch_id: e.target.value })}
                                    required
                                >
                                    <option value="">Selecciona sucursal de origen...</option>
                                    {(quickTransferProduct.branches_stock || [])
                                        .filter(bs => bs.branch_id !== parseInt(activeBranchId || user?.branch_id, 10))
                                        .map(bs => (
                                            <option key={bs.branch_id} value={bs.branch_id} disabled={bs.stock <= 0}>
                                                {bs.branch_name} ({bs.branch_code}) — {bs.stock > 0 ? `${bs.stock} uds disponibles` : 'Sin stock'}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="input-group full-width">
                                <label>Cantidad a Traspasar a tu Sucursal *</label>
                                <input
                                    className="input"
                                    type="number"
                                    min="1"
                                    value={quickTransferForm.quantity}
                                    onChange={(e) => setQuickTransferForm({ ...quickTransferForm, quantity: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="input-group full-width">
                                <label>Nota / Motivo del Traspaso</label>
                                <input
                                    className="input"
                                    value={quickTransferForm.notes}
                                    onChange={(e) => setQuickTransferForm({ ...quickTransferForm, notes: e.target.value })}
                                    placeholder="Ej: Requerido para venta en mostrador"
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowQuickTransferModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={submittingTransfer}>
                                    {submittingTransfer ? 'Procesando...' : 'Crear Solicitud de Traspaso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Assign Category Modal */}
            {showBulkCategoryModal && (
                <div className="modal-overlay" onClick={() => setShowBulkCategoryModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Asignar Categoría en Bloque</h3>
                            <button className="modal-close" onClick={() => setShowBulkCategoryModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleBulkCategorySubmit} className="product-form">
                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                                Se actualizará la categoría para los <strong>{selectedProductIds.length}</strong> productos seleccionados.
                            </p>
                            <div className="input-group full-width">
                                <label>Selecciona Categoría</label>
                                <select 
                                    className="select" 
                                    value={bulkCategoryId} 
                                    onChange={(e) => setBulkCategoryId(e.target.value)}
                                >
                                    <option value="">Sin Categoría (Limpiar)</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkCategoryModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {showImagePreviewModal && previewImageUrl && (
                <div className="modal-overlay" onClick={() => setShowImagePreviewModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, textAlign: 'center', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                            <button className="modal-close" onClick={() => setShowImagePreviewModal(false)}><X size={16} /></button>
                        </div>
                        <img 
                            src={getImageUrl(previewImageUrl)} 
                            alt="Preview ampliado" 
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                            }}
                            style={{ maxWidth: '100%', maxHeight: '450px', borderRadius: 'var(--radius-md)', objectFit: 'contain' }} 
                        />
                    </div>
                </div>
            )}

            {/* Barcode Print Modal */}
            {showBarcodeModal && barcodeProduct && isBarcodePlanAllowed && (
                <div className="modal-overlay" onClick={() => setShowBarcodeModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Código de Barras</h3>
                            <button className="modal-close" onClick={() => setShowBarcodeModal(false)}><X size={16} /></button>
                        </div>
                        <div className="product-form" style={{ textAlign: 'center' }}>
                            <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd', display: 'inline-block', margin: '0 auto' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000', marginBottom: '4px' }}>{barcodeProduct.name}</div>
                                <svg id="barcode-svg"></svg>
                                <div style={{ fontSize: '14px', fontWeight: '800', color: '#000', marginTop: '4px' }}>{formatCurrency(barcodeProduct.sale_price)}</div>
                            </div>
                            <div className="input-group full-width" style={{ marginTop: '16px' }}>
                                <label style={{ textAlign: 'left' }}>Número de copias</label>
                                <input className="input" type="number" min="1" max="100" value={printCopies} onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))} />
                            </div>
                            <div className="modal-actions" style={{ marginTop: '16px' }}>
                                <button className="btn btn-secondary" onClick={() => setShowBarcodeModal(false)}>Cerrar</button>
                                <button className="btn btn-primary" onClick={handlePrintBarcodes}>
                                    <Printer size={15} /> Imprimir {printCopies} {printCopies === 1 ? 'etiqueta' : 'etiquetas'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Creator Modal */}
            {showCategoryCreator && (
                <div className="modal-overlay" onClick={() => setShowCategoryCreator(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Nueva Categoría</h3>
                            <button className="modal-close" onClick={() => setShowCategoryCreator(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleCreateCategory} className="product-form">
                            <div className="input-group full-width">
                                <label>Nombre de la Categoría *</label>
                                <input
                                    className="input"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="Ej: Pantallas, Baterías, Accesorios..."
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="input-group full-width">
                                <label>Color Identificador</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                    {CATEGORY_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setNewCategoryColor(c)}
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: c,
                                                border: newCategoryColor === c ? '2px solid white' : '1px solid rgba(0,0,0,0.2)',
                                                outline: newCategoryColor === c ? `2px solid ${c}` : 'none',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryCreator(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Guardando...' : 'Crear Categoría'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Captura de Fotografía con Cámara */}
            {showProductCamera && isPhotoUploadPlanAllowed && (
                <CameraCaptureModal
                    isOpen={showProductCamera}
                    onClose={() => setShowProductCamera(false)}
                    onCapture={processAndUploadProductImage}
                    title="Tomar Foto del Producto"
                    multiple={false}
                />
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`pos-toast ${toast.type}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}
