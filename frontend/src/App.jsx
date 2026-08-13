import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

// SaaS Pages
import Branches from './pages/admin/Branches';
import TransfersPage from './pages/admin/Traslados';
import SubscriptionPage from './pages/admin/Subscription';
import SuperDashboard from './pages/admin/SuperDashboard';

import './index.css';


// Componente para manejar el layout con Sidebar/MobileHeader
function DashboardLayout({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
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

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="app-container">
      <MobileHeader isOpen={isSidebarOpen} toggleMenu={toggleSidebar} />
      <Sidebar isOpen={isSidebarOpen} toggleMenu={toggleSidebar} />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

// Public Route (redirects if logged in)
function PublicRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
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
      <Route path="/dashboard/tienda" element={
        <DashboardLayout>
          <ClientStorePage />
        </DashboardLayout>
      } />
      <Route path="/dashboard/pedidos" element={
        <DashboardLayout>
          <ClientOrdersPage />
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
        <DashboardLayout adminOnly>
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

      {/* SaaS Multi-Branch & Quota Routes */}
      <Route path="/admin/sucursales" element={
        <DashboardLayout adminOnly>
          <Branches />
        </DashboardLayout>
      } />
      <Route path="/admin/traslados" element={
        <DashboardLayout adminOnly>
          <TransfersPage />
        </DashboardLayout>
      } />
      <Route path="/admin/suscripcion" element={
        <DashboardLayout adminOnly>
          <SubscriptionPage />
        </DashboardLayout>
      } />

      {/* SaaS SuperAdmin Routes */}
      <Route path="/superadmin" element={
        <DashboardLayout adminOnly>
          <SuperDashboard />
        </DashboardLayout>
      } />
      <Route path="/superadmin/empresas" element={
        <DashboardLayout adminOnly>
          <SuperDashboard />
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

function App() {
  return (
    <Router>
      <ThemeProvider>
        <TenantProvider>
          <AuthProvider>
            <AppRoutes />
            <AIChatbot />
          </AuthProvider>
        </TenantProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;

