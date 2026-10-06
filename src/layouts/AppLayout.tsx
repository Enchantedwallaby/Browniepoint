import React, { useState } from 'react';
import {
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  GitBranch,
  Tag,
  Package,
  ArrowLeftRight,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  BarChart3,
  MapPin,
  Menu,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { Profile, Branch } from '@/types/database';
import { authService } from '@/services/authService';
import type { RouteId } from '@/types/navigation';
import { PERMITTED_ROUTES_BY_ROLE } from '@/types/navigation';

interface AppLayoutProps {
  children: React.ReactNode;
  profile: Profile;
  assignedBranch: Branch | null;
  activeRoute: RouteId;
  onNavigate: (route: RouteId) => void;
}

const ROLE_LABEL: Record<Profile['role'], string> = {
  OWNER: 'Owner',
  MAIN_BRANCH_EMPLOYEE: 'Main Branch Employee',
  BRANCH_EMPLOYEE: 'Branch Employee',
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  profile,
  assignedBranch,
  activeRoute,
  onNavigate,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await authService.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const permittedRoutes = PERMITTED_ROUTES_BY_ROLE[profile.role] || [];

  const navItemsConfig: { id: RouteId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'branches', label: 'Branches', icon: GitBranch },
    { id: 'catalogue', label: 'Catalogue', icon: Tag },
    {
      id: 'inventory',
      label: profile.role === 'BRANCH_EMPLOYEE' ? 'My Inventory' : 'Inventory',
      icon: Package,
    },
    { id: 'transfers', label: profile.role === 'BRANCH_EMPLOYEE' ? 'Incoming Transfers' : 'Transfers', icon: ArrowLeftRight },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'sales', label: 'Sales', icon: CreditCard },
    { id: 'returns', label: 'Returns', icon: RotateCcw },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'status', label: 'System Status', icon: ShieldCheck },
  ];

  const filteredNavItems = navItemsConfig.filter((item) =>
    permittedRoutes.includes(item.id)
  );

  // Determine branch context string for header
  const branchContextLabel =
    profile.role === 'OWNER'
      ? 'All Branches'
      : assignedBranch
      ? `${assignedBranch.name} (${assignedBranch.branch_code})`
      : profile.role === 'MAIN_BRANCH_EMPLOYEE'
      ? 'Moodubidre'
      : 'Unassigned Branch';

  const handleNavClick = (routeId: RouteId) => {
    onNavigate(routeId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* System Header */}
      <header className="bg-brand-900 text-white shadow-md border-b border-brand-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <img
              src="/brownie-point-logo.png"
              alt="Brownie Point logo"
              className="h-9 w-14 object-contain shrink-0"
            />
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                BROWNIE POINT
              </h1>
              <p className="text-[10px] sm:text-xs text-brand-300">Operations System</p>
            </div>
          </div>

          {/* Right Header Info: User Profile, Role Badge, Branch Context, Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Branch Context Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-brand-950/60 rounded-full border border-brand-700/50 text-xs text-brand-200">
              <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="font-medium truncate max-w-[150px]">{branchContextLabel}</span>
            </div>

            {/* User Name & Role */}
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-xs font-semibold text-white leading-tight">
                {profile.full_name || profile.email}
              </span>
              <span className="text-[10px] text-brand-300">{profile.email}</span>
            </div>

            <Badge
              variant={profile.role === 'OWNER' ? 'success' : 'secondary'}
              className="text-[11px] py-0.5 px-2 font-medium flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>{ROLE_LABEL[profile.role]}</span>
            </Badge>

            {/* Logout Button */}
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-2 rounded-lg text-brand-300 hover:text-white hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-brand-300 hover:text-white hover:bg-brand-700 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Bar */}
        <div className="hidden md:block bg-brand-950/80 border-t border-brand-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 py-1.5 overflow-x-auto">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-brand-700 text-white font-semibold shadow-sm'
                        : 'text-brand-300 hover:text-white hover:bg-brand-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-brand-950 border-t border-brand-800 px-4 py-3 space-y-2">
            <div className="px-2 pb-2 mb-2 border-b border-brand-800 flex items-center justify-between text-xs text-brand-300">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-brand-400" />
                {branchContextLabel}
              </span>
              <span className="font-semibold text-white">{profile.full_name || profile.email}</span>
            </div>

            <nav className="space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-700 text-white font-semibold'
                        : 'text-brand-200 hover:bg-brand-800/60 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Brownie Point Operations System &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
