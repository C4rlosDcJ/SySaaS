import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customerService, branchService } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import {
    Search,
    RefreshCw,
    Users,
    Mail,
    Phone,
    Eye,
    EyeOff,
    Plus,
    Edit2,
    X,
    Filter,
    ArrowUpDown,
    Check,
    Copy,
    AlertCircle,
    Trash2,
    Lock,
    Key,
    Sparkles
} from 'lucide-react';
import './AdminCustomers.css';

export default function AdminCustomers() {
    const { activeBranchId, branches: tenantBranches } = useTenant();
    const [branchesList, setBranchesList] = useState([]);

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Local Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth > 900 ? 12 : 6);

    useEffect(() => {
        const handleResize = () => setItemsPerPage(window.innerWidth > 900 ? 12 : 6);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Advanced Filtering and Sorting States
    const [sortBy, setSortBy] = useState('recent'); // 'recent', 'repairs_desc', 'name_asc'
    const [filterActive, setFilterActive] = useState('all'); // 'all', 'active', 'inactive'
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [fetchError, setFetchError] = useState('');

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [modalError, setModalError] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    // Temp Password for created customer
    const [tempPassword, setTempPassword] = useState('');
    const [copied, setCopied] = useState(false);

    // Password creation mode for New Customer: 'auto' | 'manual'
    const [passwordMode, setPasswordMode] = useState('auto');
    const [manualPassword, setManualPassword] = useState('');
    const [showManualPassword, setShowManualPassword] = useState(false);

    // Password change for Edit Customer
    const [editPassword, setEditPassword] = useState('');
    const [showEditPassword, setShowEditPassword] = useState(false);

    // Form Data States
    const [newCustomer, setNewCustomer] = useState({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        address: '',
        branch_id: ''
    });
    const [editingCustomer, setEditingCustomer] = useState(null);

    const generateRandomPassword = () => {
        const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let pass = '';
        for (let i = 0; i < 8; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
    };

    useEffect(() => {
        fetchCustomers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, activeBranchId, selectedBranch]);

    useEffect(() => {
        fetchBranches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantBranches]);

    const fetchBranches = async () => {
        try {
            const data = await branchService.getAll();
            setBranchesList(Array.isArray(data) ? data : (data?.branches || []));
        } catch (err) {
            console.warn('Error al cargar sucursales:', err);
            if (tenantBranches?.length > 0) {
                setBranchesList(tenantBranches);
            }
        }
    };

    const fetchCustomers = async () => {
        setLoading(true);
        setFetchError('');
        try {
            const params = { limit: 100, page };
            if (searchTerm && searchTerm.trim()) params.search = searchTerm.trim();
            if (selectedBranch && selectedBranch !== 'all') {
                params.branch_id = selectedBranch;
            }

            const data = await customerService.getAll(params);
            setCustomers(data.customers || []);
            setTotalPages(data.pagination?.totalPages || 1);
        } catch (error) {
            console.error('Error al cargar clientes:', error);
            setFetchError(error.message || 'Error al conectar con el servidor o cargar clientes.');
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchCustomers();
    };

    const openAddModal = () => {
        setTempPassword('');
        setModalError('');
        setPasswordMode('auto');
        setManualPassword('');
        setShowManualPassword(false);
        const defaultBranch = activeBranchId ? String(activeBranchId) : (branchesList[0]?.id ? String(branchesList[0].id) : '');
        setNewCustomer({
            email: '',
            first_name: '',
            last_name: '',
            phone: '',
            address: '',
            branch_id: defaultBranch
        });
        setShowAddModal(true);
    };

    const handleAddCustomer = async (e) => {
        e.preventDefault();
        setModalLoading(true);
        setModalError('');
        try {
            if (passwordMode === 'manual') {
                if (!manualPassword.trim()) {
                    setModalError('Por favor escribe la contraseña manual o elige el modo automático.');
                    setModalLoading(false);
                    return;
                }
                if (manualPassword.trim().length < 6) {
                    setModalError('La contraseña manual debe tener al menos 6 caracteres.');
                    setModalLoading(false);
                    return;
                }
            }

            const payload = {
                ...newCustomer,
                branch_id: newCustomer.branch_id ? parseInt(newCustomer.branch_id, 10) : undefined,
                password: passwordMode === 'manual' ? manualPassword.trim() : undefined
            };
            const response = await customerService.create(payload);
            setTempPassword(response.customer?.temp_password || (passwordMode === 'manual' ? manualPassword.trim() : ''));
            const defaultBranch = activeBranchId ? String(activeBranchId) : (branchesList[0]?.id ? String(branchesList[0].id) : '');
            setNewCustomer({
                email: '',
                first_name: '',
                last_name: '',
                phone: '',
                address: '',
                branch_id: defaultBranch
            });
            setManualPassword('');
            fetchCustomers();
        } catch (err) {
            setModalError(err.message || 'Error al registrar cliente');
        } finally {
            setModalLoading(false);
        }
    };

    const handleEditCustomer = async (e) => {
        e.preventDefault();
        setModalLoading(true);
        setModalError('');
        try {
            if (editPassword && editPassword.trim().length < 6) {
                setModalError('La nueva contraseña debe tener al menos 6 caracteres.');
                setModalLoading(false);
                return;
            }

            const payload = {
                first_name: editingCustomer.first_name,
                last_name: editingCustomer.last_name,
                phone: editingCustomer.phone,
                address: editingCustomer.address,
                branch_id: editingCustomer.branch_id ? parseInt(editingCustomer.branch_id, 10) : null
            };
            if (editPassword && editPassword.trim()) {
                payload.password = editPassword.trim();
            }

            await customerService.update(editingCustomer.id, payload);
            setShowEditModal(false);
            setEditingCustomer(null);
            setEditPassword('');
            fetchCustomers();
        } catch (err) {
            setModalError(err.message || 'Error al actualizar cliente');
        } finally {
            setModalLoading(false);
        }
    };

    const openEditModal = (customer) => {
        setEditingCustomer({
            id: customer.id,
            email: customer.email,
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone: customer.phone || '',
            address: customer.address || '',
            branch_id: customer.branch_id ? String(customer.branch_id) : ''
        });
        setEditPassword('');
        setShowEditPassword(false);
        setModalError('');
        setShowEditModal(true);
    };

    const handleDeleteCustomer = async (customer) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar o dar de baja al cliente ${customer.first_name} ${customer.last_name}?`)) {
            return;
        }
        try {
            await customerService.delete(customer.id);
            fetchCustomers();
        } catch (err) {
            alert(err.message || 'Error al eliminar cliente');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // Apply Sorting and Filtering locally on customers
    const filteredCustomers = customers
        .filter((customer) => {
            const hasActive = parseInt(customer.active_repairs || 0) > 0;
            if (filterActive === 'active') return hasActive;
            if (filterActive === 'inactive') return !hasActive;

            // Filtro local instantaneo por busqueda al teclear
            if (searchTerm && searchTerm.trim()) {
                const term = searchTerm.trim().toLowerCase();
                const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.toLowerCase();
                const email = (customer.email || '').toLowerCase();
                const phone = (customer.phone || '').toLowerCase();
                if (!fullName.includes(term) && !email.includes(term) && !phone.includes(term)) {
                    return false;
                }
            }

            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'repairs_desc') {
                return (b.total_repairs || 0) - (a.total_repairs || 0);
            }
            if (sortBy === 'name_asc') {
                const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
                const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
                return nameA.localeCompare(nameB);
            }
            // default 'recent'
            return new Date(b.created_at) - new Date(a.created_at);
        });

    const localTotalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Reset local page on search/filter
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterActive, sortBy, selectedBranch]);

    return (
        <div className="admin-customers-container">
            <header className="page-header">
                <div>
                    <h1>Gestión de Clientes</h1>
                    <p className="text-muted">Administra y registra la información de clientes</p>
                </div>
                <div className="header-actions">
                    <button onClick={openAddModal} className="btn btn-primary">
                        <Plus size={16} />
                        <span>Nuevo Cliente</span>
                    </button>
                    <button onClick={fetchCustomers} className="btn btn-secondary">
                        <RefreshCw size={16} />
                        <span className="hide-on-mobile">Actualizar</span>
                    </button>
                </div>
            </header>

            {/* Búsqueda y Filtros */}
            <div className="filters-bar-container">
                <form onSubmit={handleSearch} className="filters-search-row">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, email o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input"
                        />
                    </div>
                    <button type="submit" className="btn btn-secondary">
                        Buscar
                    </button>
                </form>

                <div className="filters-select-row">
                    {branchesList.length > 1 && (
                        <div className="filter-item">
                            <Filter size={14} className="filter-icon" />
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="select select-sm"
                            >
                                <option value="all">Todas las sucursales</option>
                                {branchesList.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.name} {b.is_main ? '(Matriz)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="filter-item">
                        <Filter size={14} className="filter-icon" />
                        <select
                            value={filterActive}
                            onChange={(e) => setFilterActive(e.target.value)}
                            className="select select-sm"
                        >
                            <option value="all">Todas las reparaciones</option>
                            <option value="active">Con reparaciones activas</option>
                            <option value="inactive">Sin reparaciones activas</option>
                        </select>
                    </div>

                    <div className="filter-item">
                        <ArrowUpDown size={14} className="filter-icon" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="select select-sm"
                        >
                            <option value="recent">Más recientes</option>
                            <option value="repairs_desc">Más reparaciones</option>
                            <option value="name_asc">Nombre (A-Z)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Grid de clientes */}
            <div className="customers-container">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Cargando clientes...</p>
                    </div>
                ) : fetchError ? (
                    <div className="empty-state error-state">
                        <div className="empty-icon" style={{ color: '#ef4444', opacity: 0.9 }}>
                            <AlertCircle size={48} />
                        </div>
                        <h3>Error al cargar clientes</h3>
                        <p>{fetchError}</p>
                        <button onClick={fetchCustomers} className="btn btn-secondary" style={{ marginTop: '16px' }}>
                            <RefreshCw size={16} />
                            <span>Reintentar</span>
                        </button>
                    </div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <Users size={48} />
                        </div>
                        <h3>No se encontraron clientes</h3>
                        <p>Intenta cambiar los términos de búsqueda o filtros.</p>
                    </div>
                ) : (
                    <>
                        <div className="customers-grid">
                            {paginatedCustomers.map(customer => (
                                <div key={customer.id} className="customer-card">
                                    <div className="customer-card-header">
                                        <div className="admin-customer-avatar">
                                            {customer.first_name?.charAt(0)}{customer.last_name?.charAt(0)}
                                        </div>
                                        <div className="customer-card-actions">
                                            <button 
                                                onClick={() => openEditModal(customer)} 
                                                className="btn btn-ghost btn-sm icon-btn"
                                                title="Editar cliente"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteCustomer(customer)} 
                                                className="btn btn-ghost btn-sm icon-btn"
                                                title="Eliminar cliente"
                                                style={{ color: '#ef4444' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="customer-info">
                                        <h3>{customer.first_name} {customer.last_name}</h3>
                                        {customer.branch_name && (
                                            <span style={{ fontSize: '11px', background: 'var(--color-bg-secondary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', display: 'inline-block', marginBottom: '6px' }}>
                                                {customer.branch_name}
                                            </span>
                                        )}
                                        <div className="customer-contact">
                                            <span className="contact-item">
                                                <Mail size={14} />
                                                {customer.email}
                                            </span>
                                            {customer.phone && (
                                                <span className="contact-item">
                                                    <Phone size={14} />
                                                    {customer.phone}
                                                </span>
                                            )}
                                        </div>
                                        <div className="customer-stats">
                                            <span className="stat">
                                                <strong>{customer.total_repairs || 0}</strong> reparaciones
                                            </span>
                                            {parseInt(customer.active_repairs || 0) > 0 && (
                                                <span className="badge badge-warning active-badge">
                                                    {customer.active_repairs} activas
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="customer-card-footer">
                                        <span className="member-since text-muted">
                                            Desde {formatDate(customer.created_at)}
                                        </span>
                                        <Link
                                            to={`/admin/clientes/${customer.id}`}
                                            className="btn btn-ghost btn-sm"
                                        >
                                            <Eye size={16} />
                                            Ver Historial
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Paginación */}
                        {localTotalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-4)' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Anterior
                                </button>
                                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                    Página {currentPage} de {localTotalPages}
                                </span>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setCurrentPage(p => Math.min(localTotalPages, p + 1))}
                                    disabled={currentPage === localTotalPages}
                                >
                                    Siguiente
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* MODAL: Registrar Cliente */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <h2>Registrar Nuevo Cliente</h2>
                            <button onClick={() => setShowAddModal(false)} className="close-btn">
                                <X size={20} />
                            </button>
                        </div>

                        {tempPassword ? (
                            <div className="temp-password-alert">
                                <div className="alert-header">
                                    <Check className="success-icon" size={24} />
                                    <h3>¡Cliente Registrado con Éxito!</h3>
                                </div>
                                <p>Se ha generado una contraseña temporal para que el cliente inicie sesión:</p>
                                <div className="password-display">
                                    <code>{tempPassword}</code>
                                    <button 
                                        onClick={() => copyToClipboard(tempPassword)} 
                                        className="btn btn-ghost btn-sm copy-btn"
                                    >
                                        {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                        <span>{copied ? 'Copiado' : 'Copiar'}</span>
                                    </button>
                                </div>
                                <div className="alert-footer">
                                    <p className="note"><AlertCircle size={14} /> Guarda la contraseña ahora. No se volverá a mostrar.</p>
                                    <button onClick={() => { setShowAddModal(false); setTempPassword(''); }} className="btn btn-primary">
                                        Entendido
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleAddCustomer} className="modal-form">
                                {modalError && <div className="error-alert">{modalError}</div>}
                                <div className="form-grid">
                                    <div className="input-group">
                                        <label>Correo Electrónico</label>
                                        <input
                                            type="email"
                                            value={newCustomer.email}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                                            className="input"
                                            placeholder="ejemplo@email.com"
                                            required
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="input-group">
                                            <label>Nombre</label>
                                            <input
                                                type="text"
                                                value={newCustomer.first_name}
                                                onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                                                className="input"
                                                placeholder="Juan"
                                                required
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Apellido</label>
                                            <input
                                                type="text"
                                                value={newCustomer.last_name}
                                                onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                                                className="input"
                                                placeholder="Pérez"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="input-group">
                                        <label>Teléfono</label>
                                        <input
                                            type="tel"
                                            value={newCustomer.phone}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                            className="input"
                                            placeholder="(123) 456-7890"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Dirección</label>
                                        <input
                                            type="text"
                                            value={newCustomer.address}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                            className="input"
                                            placeholder="Calle, Número, Ciudad"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Sucursal Asignada *</label>
                                        <select
                                            value={newCustomer.branch_id}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, branch_id: e.target.value })}
                                            className="input"
                                            required
                                        >
                                            <option value="">Seleccionar Sucursal...</option>
                                            {branchesList.map(b => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name} {b.is_main ? '(Matriz)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Opciones de Contraseña: Crear sola o a mano */}
                                    <div className="input-group" style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>Contraseña de Acceso *</span>
                                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                                Para que el cliente ingrese a su portal
                                            </span>
                                        </label>

                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', marginTop: '4px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setPasswordMode('auto')}
                                                className={`btn btn-sm ${passwordMode === 'auto' ? 'btn-primary' : 'btn-ghost'}`}
                                                style={{ flex: 1, borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                                            >
                                                <Sparkles size={14} /> Crear Sola (Automática)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPasswordMode('manual');
                                                    if (!manualPassword) setManualPassword(generateRandomPassword());
                                                }}
                                                className={`btn btn-sm ${passwordMode === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                                                style={{ flex: 1, borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                                            >
                                                <Key size={14} /> Crear a Mano (Personalizada)
                                            </button>
                                        </div>

                                        {passwordMode === 'manual' ? (
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type={showManualPassword ? 'text' : 'password'}
                                                    value={manualPassword}
                                                    onChange={(e) => setManualPassword(e.target.value)}
                                                    className="input"
                                                    placeholder="Escribe la contraseña (mínimo 6 caracteres)"
                                                    style={{ paddingRight: '72px' }}
                                                    required
                                                />
                                                <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setManualPassword(generateRandomPassword())}
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ padding: '4px 6px', fontSize: '11px', height: '26px' }}
                                                        title="Generar contraseña aleatoria"
                                                    >
                                                        <Sparkles size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowManualPassword(prev => !prev)}
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ padding: '4px 6px', fontSize: '11px', height: '26px' }}
                                                        title={showManualPassword ? 'Ocultar' : 'Mostrar'}
                                                    >
                                                        {showManualPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{
                                                padding: '8px 12px',
                                                background: 'var(--color-bg-secondary)',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                color: 'var(--color-text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}>
                                                <Lock size={14} />
                                                <span>El sistema creará automáticamente una contraseña segura y te la mostrará en pantalla.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="modal-actions">
                                    <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" disabled={modalLoading}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                                        {modalLoading ? 'Registrando...' : 'Registrar Cliente'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL: Editar Cliente */}
            {showEditModal && editingCustomer && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <h2>Editar Cliente</h2>
                            <button onClick={() => setShowEditModal(false)} className="close-btn">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleEditCustomer} className="modal-form">
                            {modalError && <div className="error-alert">{modalError}</div>}
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Correo Electrónico (No modificable)</label>
                                    <input
                                        type="email"
                                        value={editingCustomer.email}
                                        className="input"
                                        disabled
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="input-group">
                                        <label>Nombre</label>
                                        <input
                                            type="text"
                                            value={editingCustomer.first_name}
                                            onChange={(e) => setEditingCustomer({ ...editingCustomer, first_name: e.target.value })}
                                            className="input"
                                            required
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Apellido</label>
                                        <input
                                            type="text"
                                            value={editingCustomer.last_name}
                                            onChange={(e) => setEditingCustomer({ ...editingCustomer, last_name: e.target.value })}
                                            className="input"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>Teléfono</label>
                                    <input
                                        type="tel"
                                        value={editingCustomer.phone}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                                        className="input"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Dirección</label>
                                    <input
                                        type="text"
                                        value={editingCustomer.address}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                                        className="input"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Sucursal Asignada</label>
                                    <select
                                        value={editingCustomer.branch_id || ''}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, branch_id: e.target.value })}
                                        className="input"
                                    >
                                        <option value="">Sin sucursal asignada</option>
                                        {branchesList.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.name} {b.is_main ? '(Matriz)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Cambio de Contraseña Opcional */}
                                <div className="input-group" style={{ gridColumn: '1 / -1', marginTop: '6px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Nueva Contraseña (Opcional)</span>
                                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                            Dejar en blanco para conservar la actual
                                        </span>
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showEditPassword ? 'text' : 'password'}
                                            value={editPassword}
                                            onChange={(e) => setEditPassword(e.target.value)}
                                            className="input"
                                            placeholder="Escribe la nueva contraseña si deseas cambiarla (mín. 6 caracteres)"
                                            style={{ paddingRight: '72px' }}
                                        />
                                        <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setEditPassword(generateRandomPassword())}
                                                className="btn btn-ghost btn-sm"
                                                style={{ padding: '4px 6px', fontSize: '11px', height: '26px' }}
                                                title="Generar contraseña sugerida"
                                            >
                                                <Sparkles size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowEditPassword(prev => !prev)}
                                                className="btn btn-ghost btn-sm"
                                                style={{ padding: '4px 6px', fontSize: '11px', height: '26px' }}
                                                title={showEditPassword ? 'Ocultar' : 'Mostrar'}
                                            >
                                                {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                    {editPassword && (
                                        <small style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '4px', display: 'block' }}>
                                            Al guardar cambios, la contraseña del cliente se actualizará a este valor.
                                        </small>
                                    )}
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary" disabled={modalLoading}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                                    {modalLoading ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
