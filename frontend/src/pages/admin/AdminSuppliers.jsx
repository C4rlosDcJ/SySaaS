import { useState, useEffect } from 'react';
import { supplierService, inventoryService } from '../../services/api';
import { Truck, Plus, PackageCheck, Building2, Phone, Mail, FileText, CheckCircle2, Clock, XCircle, Search } from 'lucide-react';
import { showAlert, showConfirm } from '../../utils/swal';
import { formatCurrency } from '../../utils/constants';

export default function AdminSuppliers() {
    const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers' | 'orders'
    const [suppliers, setSuppliers] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modal proveedor
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [supplierForm, setSupplierForm] = useState({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        tax_id: '',
        address: '',
        notes: ''
    });

    // Modal Orden de Compra
    const [showPOModal, setShowPOModal] = useState(false);
    const [poSupplierId, setPOSupplierId] = useState('');
    const [poNotes, setPONotes] = useState('');
    const [poItems, setPOItems] = useState([
        { product_id: '', quantity: 1, unit_cost: 0 }
    ]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [supRes, poRes, prodRes] = await Promise.allSettled([
                supplierService.getAll(),
                supplierService.getPurchaseOrders(),
                inventoryService.getProducts({ limit: 300 })
            ]);

            if (supRes.status === 'fulfilled') setSuppliers(supRes.value || []);
            if (poRes.status === 'fulfilled') setPurchaseOrders(poRes.value || []);
            if (prodRes.status === 'fulfilled') setProducts(prodRes.value?.products || []);
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al cargar datos', icon: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // --- Manejo Proveedores ---
    const handleOpenSupplierModal = (sup = null) => {
        if (sup) {
            setEditingSupplier(sup);
            setSupplierForm({
                company_name: sup.company_name || '',
                contact_name: sup.contact_name || '',
                email: sup.email || '',
                phone: sup.phone || '',
                tax_id: sup.tax_id || '',
                address: sup.address || '',
                notes: sup.notes || ''
            });
        } else {
            setEditingSupplier(null);
            setSupplierForm({
                company_name: '',
                contact_name: '',
                email: '',
                phone: '',
                tax_id: '',
                address: '',
                notes: ''
            });
        }
        setShowSupplierModal(true);
    };

    const handleSaveSupplier = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingSupplier) {
                await supplierService.update(editingSupplier.id, supplierForm);
                showAlert({ title: 'Actualizado', text: 'Proveedor actualizado correctamente.', icon: 'success' });
            } else {
                await supplierService.create(supplierForm);
                showAlert({ title: 'Registrado', text: 'Nuevo proveedor registrado.', icon: 'success' });
            }
            setShowSupplierModal(false);
            loadData();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al guardar proveedor', icon: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSupplier = async (sup) => {
        const confirmed = await showConfirm({
            title: '¿Desactivar Proveedor?',
            text: `Se desactivará el registro de ${sup.company_name}.`,
            confirmText: 'Sí, desactivar'
        });
        if (!confirmed) return;

        try {
            await supplierService.delete(sup.id);
            showAlert({ title: 'Desactivado', text: 'Proveedor desactivado.', icon: 'success' });
            loadData();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al desactivar', icon: 'error' });
        }
    };

    // --- Manejo Ordenes de Compra ---
    const handleAddItemRow = () => {
        setPOItems([...poItems, { product_id: '', quantity: 1, unit_cost: 0 }]);
    };

    const handleRemoveItemRow = (index) => {
        if (poItems.length === 1) return;
        setPOItems(poItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, field, value) => {
        const updated = [...poItems];
        updated[index][field] = value;
        if (field === 'product_id') {
            const selectedProd = products.find(p => p.id === parseInt(value));
            if (selectedProd) {
                updated[index].unit_cost = selectedProd.purchase_price || 0;
            }
        }
        setPOItems(updated);
    };

    const handleCreatePO = async (e) => {
        e.preventDefault();
        if (!poSupplierId) {
            showAlert({ title: 'Atención', text: 'Selecciona un proveedor para la orden.', icon: 'warning' });
            return;
        }

        const validItems = poItems.filter(item => item.product_id && parseInt(item.quantity) > 0);
        if (validItems.length === 0) {
            showAlert({ title: 'Atención', text: 'Agrega al menos un producto válido.', icon: 'warning' });
            return;
        }

        setSubmitting(true);
        try {
            await supplierService.createPurchaseOrder({
                supplier_id: poSupplierId,
                items: validItems,
                notes: poNotes
            });
            showAlert({ title: 'Orden Creada', text: 'Orden de compra generada exitosamente.', icon: 'success' });
            setShowPOModal(false);
            setPOItems([{ product_id: '', quantity: 1, unit_cost: 0 }]);
            setPOSupplierId('');
            setPONotes('');
            loadData();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al crear orden de compra', icon: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleReceivePO = async (po) => {
        const confirmed = await showConfirm({
            title: '¿Recibir Mercadería?',
            text: `Se sumarán automáticamente los artículos de la Orden #${po.po_number} al inventario de esta sucursal.`,
            confirmText: 'Sí, recibir e incrementar inventario'
        });
        if (!confirmed) return;

        try {
            await supplierService.receivePurchaseOrder(po.id);
            showAlert({ title: 'Inventario Actualizado', text: 'Mercadería recibida y añadida al stock.', icon: 'success' });
            loadData();
        } catch (err) {
            showAlert({ title: 'Error', text: err.message || 'Error al recibir la orden', icon: 'error' });
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        !search || `${s.company_name} ${s.contact_name || ''} ${s.phone || ''} ${s.tax_id || ''}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '24px' }}>
                        <Truck size={28} className="text-primary" />
                        <span>Proveedores & Órdenes de Compra</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px', margin: 0 }}>
                        Gestiona contactos de proveedores y abastece el inventario por sucursal.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {activeTab === 'suppliers' ? (
                        <button className="btn btn-primary" onClick={() => handleOpenSupplierModal()}>
                            <Plus size={16} /> Nuevo Proveedor
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={() => setShowPOModal(true)}>
                            <Plus size={16} /> Nueva Orden de Compra
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '20px', gap: '20px' }}>
                <button
                    onClick={() => setActiveTab('suppliers')}
                    style={{
                        background: 'none', border: 'none', padding: '12px 16px', fontWeight: 600,
                        color: activeTab === 'suppliers' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        borderBottom: activeTab === 'suppliers' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Building2 size={18} /> Proveedores ({suppliers.length})
                </button>
                <button
                    onClick={() => setActiveTab('orders')}
                    style={{
                        background: 'none', border: 'none', padding: '12px 16px', fontWeight: 600,
                        color: activeTab === 'orders' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        borderBottom: activeTab === 'orders' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <PackageCheck size={18} /> Órdenes de Compra ({purchaseOrders.length})
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><div className="spinner"></div></div>
            ) : activeTab === 'suppliers' ? (
                <>
                    <div style={{ marginBottom: '16px' }}>
                        <input
                            type="text" className="input" placeholder="Buscar proveedor por empresa, contacto o teléfono..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{ maxWidth: '400px' }}
                        />
                    </div>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Empresa / Proveedor</th>
                                        <th>Contacto</th>
                                        <th>Teléfono / Email</th>
                                        <th>RFC / Tax ID</th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSuppliers.length === 0 ? (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>No hay proveedores registrados.</td></tr>
                                    ) : (
                                        filteredSuppliers.map(s => (
                                            <tr key={s.id}>
                                                <td><div style={{ fontWeight: 600 }}>{s.company_name}</div></td>
                                                <td>{s.contact_name || 'N/A'}</td>
                                                <td>
                                                    <div style={{ fontSize: '13px' }}>{s.phone || 'Sin tel'}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{s.email || ''}</div>
                                                </td>
                                                <td>{s.tax_id || 'N/A'}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="btn btn-sm btn-ghost" onClick={() => handleOpenSupplierModal(s)}>Editar</button>
                                                    <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteSupplier(s)} style={{ color: 'var(--color-error)' }}>Eliminar</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nº Orden</th>
                                    <th>Proveedor</th>
                                    <th>Sucursal Target</th>
                                    <th>Monto Total</th>
                                    <th>Estado</th>
                                    <th>Fecha</th>
                                    <th style={{ textAlign: 'right' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchaseOrders.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>No hay órdenes de compra registradas.</td></tr>
                                ) : (
                                    purchaseOrders.map(po => (
                                        <tr key={po.id}>
                                            <td style={{ fontWeight: 600 }}>#{po.po_number}</td>
                                            <td>{po.supplier_name}</td>
                                            <td>{po.branch_name}</td>
                                            <td style={{ fontWeight: 600 }}>{formatCurrency(po.total_amount)}</td>
                                            <td>
                                                <span className={`status-badge status-${po.status === 'received' ? 'delivered' : 'repairing'}`}>
                                                    {po.status === 'received' ? 'Recibida / En Stock' : 'Ordenada (Pendiente)'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '12px' }}>{new Date(po.created_at).toLocaleDateString()}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                {po.status !== 'received' && (
                                                    <button className="btn btn-sm btn-primary" onClick={() => handleReceivePO(po)}>
                                                        <PackageCheck size={14} /> Recibir Mercadería
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Crear / Editar Proveedor */}
            {showSupplierModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
                            {editingSupplier ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
                        </h3>
                        <form onSubmit={handleSaveSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="label">Nombre de Empresa *</label>
                                <input type="text" className="input" placeholder="Ej. Mayorista Refacciones S.A." value={supplierForm.company_name} onChange={e => setSupplierForm({ ...supplierForm, company_name: e.target.value })} required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Persona de Contacto</label>
                                    <input type="text" className="input" placeholder="Ej. Juan Pérez" value={supplierForm.contact_name} onChange={e => setSupplierForm({ ...supplierForm, contact_name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Teléfono</label>
                                    <input type="text" className="input" placeholder="555-0192" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Correo Electrónico</label>
                                    <input type="email" className="input" placeholder="ventas@proveedor.com" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">RFC / Tax ID</label>
                                    <input type="text" className="input" placeholder="RFC" value={supplierForm.tax_id} onChange={e => setSupplierForm({ ...supplierForm, tax_id: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="label">Dirección</label>
                                <input type="text" className="input" placeholder="Calle, Ciudad" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowSupplierModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>Guardar Proveedor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Crear Orden de Compra */}
            {showPOModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '640px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Nueva Orden de Compra</h3>
                        <form onSubmit={handleCreatePO} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label className="label">Selecciona Proveedor *</label>
                                <select className="select" value={poSupplierId} onChange={e => setPOSupplierId(e.target.value)} required>
                                    <option value="">-- Selecciona --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.company_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Productos a Solicitar</label>
                                {poItems.map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                        <select
                                            className="select"
                                            value={item.product_id}
                                            onChange={e => handleItemChange(idx, 'product_id', e.target.value)}
                                            required
                                        >
                                            <option value="">-- Selecciona Producto --</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || 'N/A'})</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number" className="input" placeholder="Cant." min="1"
                                            value={item.quantity}
                                            onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                            required
                                        />
                                        <input
                                            type="number" step="0.01" className="input" placeholder="Costo U."
                                            value={item.unit_cost}
                                            onChange={e => handleItemChange(idx, 'unit_cost', e.target.value)}
                                            required
                                        />
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemoveItemRow(idx)} style={{ color: 'var(--color-error)' }}>
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItemRow} style={{ marginTop: '4px' }}>
                                    + Agregar Otro Producto
                                </button>
                            </div>

                            <div>
                                <label className="label">Notas Adicionales</label>
                                <textarea className="input" rows="2" placeholder="Observaciones de la orden..." value={poNotes} onChange={e => setPONotes(e.target.value)}></textarea>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPOModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>Generar Orden de Compra</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
