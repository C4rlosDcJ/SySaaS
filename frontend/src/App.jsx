import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './utils/swal';
import { AuthProvider, useAuth } from './context/AuthContext';
import MobileHeader from './components/MobileHeader';
import Sidebar from './components/Sidebar';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TrackRepairPage from './pages/TrackRepairPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PublicStorePage from './pages/PublicStorePage';


// Client Pages
import ClientDashboard from './pages/client/ClientDashboard';
import NewQuoteForm from './pages/client/NewQuoteForm';
import RepairsListPage from './pages/client/RepairsListPage';
import ProfilePage from './pages/client/ProfilePage';
import ClientStorePage from './pages/client/ClientStorePage';
import ClientOrdersPage from './pages/client/ClientOrdersPage';
import ClientPaymentsPage from './pages/client/ClientPaymentsPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRepairs from './pages/admin/AdminRepairs';
import AdminCustomers from './pages/admin/AdminCustomers';
import CustomerDetailPage from './pages/admin/CustomerDetailPage';
import AdminServices from './pages/admin/AdminServices';
import AdminReports from './pages/admin/AdminReports';
import SettingsPage from './pages/admin/SettingsPage';
import NewRepairPage from './pages/admin/NewRepairPage';
import RepairDetailPage from './pages/shared/RepairDetailPage';
import POSPage from './pages/admin/POSPage';
import InventoryPage from './pages/admin/InventoryPage';
import SalesHistoryPage from './pages/admin/SalesHistoryPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminSuppliers from './pages/admin/AdminSuppliers';
import AdminCoupons from './pages/admin/AdminCoupons';

// SaaS Pages
import Branches from './pages/admin/Branches';
import TransfersPage from './pages/admin/Traslados';
import SubscriptionPage from './pages/admin/Subscription';
import TenantUsersPage from './pages/admin/TenantUsersPage';
import SuperDashboard from './pages/admin/SuperDashboard';
import SuperTenantsPage from './pages/admin/SuperTenantsPage';
import SuperPlansPage from './pages/admin/SuperPlansPage';
import SuperAuditLogsPage from './pages/admin/SuperAuditLogsPage';
import SuperBroadcastsPage from './pages/admin/SuperBroadcastsPage';
import SuperUsersPage from './pages/admin/SuperUsersPage';
import SuperSettingsPage from './pages/admin/SuperSettingsPage';
import SuperReportsPage from './pages/admin/SuperReportsPage';

import './index.css';


import { Shield, Clock, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenant } from './context/TenantContext';

// Componente para manejar el layout con Sidebar/MobileHeader
function DashboardLayout({ children, adminOnly = false, superAdminOnly = false, tenantAdminOnly = false }) {
  const { isAuthenticated, isAdmin, isSuperAdmin, isTenantAdmin, isImpersonating, exitImpersonation, loading } = useAuth();
  const { tenant } = useTenant();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Cerrar sidebar al cambiar de ruta en móvil
  useEffect(() => {
    // Using a timeout to defer the state update, avoiding synchronous setState in effect
    const timer = setTimeout(() => setIsSidebarOpen(false), 0);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (tenantAdminOnly && !isTenantAdmin && !isImpersonating && !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="app-container">
      <MobileHeader isOpen={isSidebarOpen} toggleMenu={toggleSidebar} />
      <Sidebar isOpen={isSidebarOpen} toggleMenu={toggleSidebar} />
      <div className="main-content">
        {isImpersonating && (
          <div style={{
            background: 'linear-gradient(90deg, #1e40af, #3b82f6)',
            color: '#ffffff',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            marginBottom: '16px',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={18} />
              <span>Modo Soporte Asistido: Visualizando empresa <strong>{tenant?.company_name || 'Empresa Cliente'}</strong></span>
            </div>
            <button 
              onClick={exitImpersonation}
              style={{
                background: '#ffffff',
                color: '#1e40af',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Volver a SuperAdmin
            </button>
          </div>
        )}
        {/* Banner de prueba activa */}
        {!isSuperAdmin && !isImpersonating && tenant?.subscription_status === 'trial' && (() => {
          const trialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
          const expired = trialEnd && trialEnd < new Date();
          const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24))) : null;
          return (
            <div style={{
              background: expired ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.09)',
              border: `1px solid ${expired ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.25)'}`,
              borderRadius: 'var(--radius-md)', padding: '10px 18px', marginBottom: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {expired ? <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} /> : <Clock size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />}
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {expired
                    ? 'Tu periodo de prueba ha expirado. Activa tu suscripcion para continuar.'
                    : `Periodo de prueba activo: ${daysLeft !== null ? `${daysLeft} dias restantes de 30` : 'limitado'}`}
                </span>
              </div>
              <Link to="/admin/suscripcion" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                {expired ? 'Activar ahora' : 'Ver planes'}
              </Link>
            </div>
          );
        })()}

        {/* Banner de pago vencido */}
        {!isSuperAdmin && !isImpersonating && tenant?.subscription_status === 'past_due' && (
          <div style={{
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 'var(--radius-md)', padding: '10px 18px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                Tienes un pago pendiente. Solo puedes consultar informacion hasta regularizar tu cuenta.
              </span>
            </div>
            <Link to="/admin/suscripcion" className="btn btn-sm" style={{ background: '#f59e0b', color: '#000', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Regularizar pago
            </Link>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

// Public Route (redirects if logged in)
function PublicRoute({ children }) {
  const { isAuthenticated, isAdmin, isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    const defaultPath = isSuperAdmin ? '/superadmin' : (isAdmin ? '/admin' : '/dashboard');
    return <Navigate to={defaultPath} replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/rastrear" element={<TrackRepairPage />} />
      <Route path="/tienda" element={<PublicStorePage />} />
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <RegisterPage />
        </PublicRoute>
      } />
      <Route path="/forgot-password" element={
        <PublicRoute>
          <ForgotPasswordPage />
        </PublicRoute>
      } />
      <Route path="/reset-password" element={
        <PublicRoute>
          <ResetPasswordPage />
        </PublicRoute>
      } />

      {/* Client Routes */}
      <Route path="/dashboard" element={
        <DashboardLayout>
          <ClientDashboard />
        </DashboardLayout>
      } />
      <Route path="/dashboard/nueva-cotizacion" element={
        <DashboardLayout>
          <NewQuoteForm />
        </DashboardLayout>
      } />
      <Route path="/dashboard/reparaciones" element={
        <DashboardLayout>
          <RepairsListPage />
        </DashboardLayout>
      } />
      <Route path="/dashboard/reparaciones/:id" element={
        <DashboardLayout>
          <RepairDetailPage />
        </DashboardLayout>
      } />
      <Route path="/dashboard/perfil" element={
        <DashboardLayout>
          <ProfilePage />
        </DashboardLayout>
      } />
      <Route path="/dashboard/pagos" element={
        <DashboardLayout>
          <ClientPaymentsPage />
        </DashboardLayout>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <DashboardLayout adminOnly>
          <AdminDashboard />
        </DashboardLayout>
      } />
      <Route path="/admin/reparaciones" element={
        <DashboardLayout adminOnly>
          <AdminRepairs />
        </DashboardLayout>
      } />
      <Route path="/admin/reparaciones/:id" element={
        <DashboardLayout adminOnly>
          <RepairDetailPage />
        </DashboardLayout>
      } />
      <Route path="/admin/clientes" element={
        <DashboardLayout adminOnly>
          <AdminCustomers />
        </DashboardLayout>
      } />
      <Route path="/admin/clientes/:id" element={
        <DashboardLayout adminOnly>
          <CustomerDetailPage />
        </DashboardLayout>
      } />
      <Route path="/admin/servicios" element={
        <DashboardLayout adminOnly>
          <AdminServices />
        </DashboardLayout>
      } />
      <Route path="/admin/configuracion" element={
        <DashboardLayout tenantAdminOnly>
          <SettingsPage />
        </DashboardLayout>
      } />
      <Route path="/admin/reportes" element={
        <DashboardLayout adminOnly>
          <AdminReports />
        </DashboardLayout>
      } />
      <Route path="/admin/nueva-reparacion" element={
        <DashboardLayout adminOnly>
          <NewRepairPage />
        </DashboardLayout>
      } />
      <Route path="/admin/pos" element={
        <DashboardLayout adminOnly>
          <POSPage />
        </DashboardLayout>
      } />
      <Route path="/admin/inventario" element={
        <DashboardLayout adminOnly>
          <InventoryPage />
        </DashboardLayout>
      } />
      <Route path="/admin/ventas" element={
        <DashboardLayout adminOnly>
          <SalesHistoryPage />
        </DashboardLayout>
      } />
      <Route path="/admin/pedidos" element={
        <DashboardLayout adminOnly>
          <AdminOrdersPage />
        </DashboardLayout>
      } />
      <Route path="/admin/proveedores" element={
        <DashboardLayout tenantAdminOnly>
          <AdminSuppliers />
        </DashboardLayout>
      } />
      <Route path="/admin/cupones" element={
        <DashboardLayout tenantAdminOnly>
          <AdminCoupons />
        </DashboardLayout>
      } />

      {/* SaaS Multi-Branch & Quota Routes */}
      <Route path="/admin/sucursales" element={
        <DashboardLayout tenantAdminOnly>
          <Branches />
        </DashboardLayout>
      } />
      <Route path="/admin/traslados" element={
        <DashboardLayout adminOnly>
          <TransfersPage />
        </DashboardLayout>
      } />
      <Route path="/admin/usuarios" element={
        <DashboardLayout adminOnly>
          <TenantUsersPage />
        </DashboardLayout>
      } />
      <Route path="/admin/suscripcion" element={
        <DashboardLayout tenantAdminOnly>
          <SubscriptionPage />
        </DashboardLayout>
      } />

      {/* SaaS SuperAdmin Routes */}
      <Route path="/superadmin" element={
        <DashboardLayout superAdminOnly>
          <SuperDashboard />
        </DashboardLayout>
      } />
      <Route path="/superadmin/reportes" element={
        <DashboardLayout superAdminOnly>
          <SuperReportsPage />
        </DashboardLayout>
      } />
      <Route path="/superadmin/empresas" element={
        <DashboardLayout superAdminOnly>
          <SuperTenantsPage />
        </DashboardLayout>
      } />
      <Route path="/superadmin/usuarios" element={
        <DashboardLayout superAdminOnly>
          <SuperUsersPage />
        </DashboardLayout>
      } />
      <Route path="/superadmin/planes" element={
        <DashboardLayout superAdminOnly>
          <SuperPlansPage />
        </DashboardLayout>
      } />
      <Route path="/superadmin/anuncios" element={
        <DashboardLayout superAdminOnly>
          <SuperBroadcastsPage />
        </DashboardLayout>
      } />
      <Route path="/superadmin/auditoria" element={
        <DashboardLayout superAdminOnly>
          <SuperAuditLogsPage />
        </DashboardLayout>
      } />
      <Route path="/superadmin/configuracion" element={
        <DashboardLayout superAdminOnly>
          <SuperSettingsPage />
        </DashboardLayout>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>

  );
}

import { ThemeProvider } from './context/ThemeContext';
import { TenantProvider } from './context/TenantContext';
import AIChatbot from './components/AIChatbot';
import DocumentMetaSync from './components/common/DocumentMetaSync';

import { AlertProvider } from './context/AlertContext';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <TenantProvider>
          <AuthProvider>
            <AlertProvider>
              <DocumentMetaSync />
              <AppRoutes />
              <AIChatbot />
            </AlertProvider>
          </AuthProvider>
        </TenantProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;

