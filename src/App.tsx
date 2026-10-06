import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { BranchesPage } from '@/pages/BranchesPage';
import { CatalogueManagement } from '@/components/catalogue/CatalogueManagement';
import { InventoryPage } from '@/pages/InventoryPage';
import { TransfersPage } from '@/pages/TransfersPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { SalesPage } from '@/pages/SalesPage';
import { ReturnsPage } from '@/pages/ReturnsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { StatusPage } from '@/pages/StatusPage';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';
import { AuditPage } from '@/pages/AuditPage';
import type { RouteId } from '@/types/navigation';
import { PERMITTED_ROUTES_BY_ROLE } from '@/types/navigation';

export default function App() {
  const { profile, assignedBranch, loading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<RouteId>('dashboard');

  // Handle Hash-based Navigation if present
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as RouteId;
      if (hash && PERMITTED_ROUTES_BY_ROLE.OWNER.includes(hash)) {
        // Keep the requested route so unauthorized roles see Access Denied
        // instead of silently staying on dashboard.
        setCurrentRoute(hash);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (route: RouteId) => {
    setCurrentRoute(route);
    window.location.hash = route;
  };

  // 1. Loading session
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-950 flex flex-col items-center justify-center gap-4">
        <div className="p-4 bg-brand-700 rounded-2xl animate-pulse">
          <img
            src="/brownie-point-logo.png"
            alt="Brownie Point logo"
            className="w-10 h-10 object-contain"
          />
        </div>
        <p className="text-brand-300 text-sm">Loading…</p>
      </div>
    );
  }

  // 2. Unauthenticated -> show Login
  if (!profile) {
    return <LoginPage />;
  }

  // 3. Deactivated profile -> show Deactivated screen
  if (!profile.active) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Account Deactivated</h2>
          <p className="text-sm text-slate-600">
            Your account has been deactivated. Please contact the Owner or Administrator.
          </p>
        </div>
      </div>
    );
  }

  // 4. Role Authorization Check
  const permittedRoutes = PERMITTED_ROUTES_BY_ROLE[profile.role] || [];
  const isAuthorized = permittedRoutes.includes(currentRoute);

  // Render module component based on route
  const renderModuleContent = () => {
    if (!isAuthorized) {
      return (
        <AccessDeniedPage
          attemptedRoute={currentRoute}
          onNavigate={handleNavigate}
        />
      );
    }

    switch (currentRoute) {
      case 'dashboard':
        return (
          <DashboardPage
            profile={profile}
            assignedBranch={assignedBranch}
            onNavigate={handleNavigate}
          />
        );
      case 'branches':
        return <BranchesPage profile={profile} />;
      case 'catalogue':
        return <CatalogueManagement profile={profile} />;
      case 'inventory':
        return (
          <InventoryPage
            profile={profile}
            assignedBranch={assignedBranch}
          />
        );
      case 'transfers':
        return (
          <TransfersPage
            profile={profile}
            assignedBranch={assignedBranch}
          />
        );
      case 'orders':
        return (
          <OrdersPage
            profile={profile}
            assignedBranch={assignedBranch}
            onNavigate={handleNavigate}
          />
        );
      case 'sales':
        return (
          <SalesPage
            profile={profile}
            assignedBranch={assignedBranch}
          />
        );
      case 'returns':
        return <ReturnsPage profile={profile} assignedBranch={assignedBranch} />;
      case 'reports':
        return <ReportsPage profile={profile} />;
      case 'status':
        return <StatusPage />;
      case 'audit':
        return <AuditPage />;
      default:
        return (
          <DashboardPage
            profile={profile}
            assignedBranch={assignedBranch}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <AppLayout
      profile={profile}
      assignedBranch={assignedBranch}
      activeRoute={currentRoute}
      onNavigate={handleNavigate}
    >
      {renderModuleContent()}
    </AppLayout>
  );
}
