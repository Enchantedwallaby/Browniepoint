import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  LayoutDashboard,
  GitBranch,
  ArrowLeftRight,
  ShoppingBag,
  AlertTriangle,
  Clock,
  Store,
  DollarSign,
  PackageCheck,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import type { Profile, Branch } from '@/types/database';
import { branchService } from '@/services/branchService';
import { inventoryService, type InventorySummary } from '@/services/inventoryService';
import type { RouteId } from '@/types/navigation';

interface DashboardPageProps {
  profile: Profile;
  assignedBranch: Branch | null;
  onNavigate: (route: RouteId) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  profile,
  assignedBranch,
  onNavigate,
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState<boolean>(true);
  const [invSummary, setInvSummary] = useState<InventorySummary>({
    totalProducts: 0,
    totalAvailableQuantity: 0,
    expiringSoon: 0,
    expired: 0,
    lowStock: 0,
  });

  useEffect(() => {
    let active = true;
    const branchId = profile.role === 'BRANCH_EMPLOYEE' && assignedBranch ? assignedBranch.id : undefined;

    branchService.getActiveBranches()
      .then((data) => {
        if (active) setBranches(data);
      })
      .catch((err) => console.error('Error loading branches on dashboard:', err))
      .finally(() => {
        if (active) setBranchesLoading(false);
      });

    if (profile.role !== 'MAIN_BRANCH_EMPLOYEE') {
      inventoryService.getInventorySummary(branchId)
        .then((summ) => {
          if (active) setInvSummary(summ);
        })
        .catch((err) => console.error('Error loading inventory summary on dashboard:', err));
    }

    return () => {
      active = false;
    };
  }, [profile, assignedBranch]);

  const isOwner = profile.role === 'OWNER';
  const isMainEmployee = profile.role === 'MAIN_BRANCH_EMPLOYEE';
  const isBranchEmployee = profile.role === 'BRANCH_EMPLOYEE';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 gap-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-brand-700" />
            {isOwner ? 'Owner Dashboard' : isMainEmployee ? 'Moodubidre Dashboard' : 'Branch Dashboard'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {isOwner && 'System-wide operational summary across all Brownie Point branches.'}
            {isMainEmployee && 'Main Branch sales and sub-branch order oversight.'}
            {isBranchEmployee && (assignedBranch ? `Operational control center for ${assignedBranch.name} (${assignedBranch.branch_code}).` : 'Branch sales and stock management console.')}
          </p>
        </div>

        <Badge variant={isOwner ? 'success' : 'primary'} className="self-start sm:self-auto py-1 px-3 text-xs">
          {isOwner ? 'Full Owner Access' : isMainEmployee ? 'Moodubidre Operations' : assignedBranch ? assignedBranch.name : 'Branch Employee'}
        </Badge>
      </div>

      {/* OWNER METRICS */}
      {isOwner && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card className="p-4 flex items-center space-x-3 cursor-pointer hover:border-brand-400" onClick={() => onNavigate('branches')}>
              <div className="p-3 bg-brand-100 text-brand-800 rounded-xl">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Branches</p>
                <p className="text-xl font-bold text-slate-900">
                  {branchesLoading ? '…' : branches.length}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center space-x-3 cursor-pointer hover:border-brand-400" onClick={() => onNavigate('inventory')}>
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Stock Qty</p>
                <p className="text-xl font-bold text-slate-900">{invSummary.totalAvailableQuantity}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center space-x-3 cursor-pointer hover:border-brand-400" onClick={() => onNavigate('transfers')}>
              <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Pending Transfers</p>
                <p className="text-xl font-bold text-slate-900">0</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center space-x-3 cursor-pointer hover:border-brand-400" onClick={() => onNavigate('orders')}>
              <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Pending Orders</p>
                <p className="text-xl font-bold text-slate-900">0</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center space-x-3 cursor-pointer hover:border-brand-400" onClick={() => onNavigate('inventory')}>
              <div className="p-3 bg-rose-100 text-rose-800 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Low Stock (&lt;5)</p>
                <p className="text-xl font-bold text-slate-900">{invSummary.lowStock}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center space-x-3 cursor-pointer hover:border-brand-400" onClick={() => onNavigate('inventory')}>
              <div className="p-3 bg-purple-100 text-purple-800 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Expiring Soon (≤3d)</p>
                <p className="text-xl font-bold text-slate-900">{invSummary.expiringSoon}</p>
              </div>
            </Card>
          </div>

          {/* Branch Overview Section for Owner */}
          <Card title="Active Branch Network" subtitle="Live branch records configured in PostgreSQL database">
            {branchesLoading ? (
              <p className="text-xs text-slate-500 py-4 text-center">Loading branch network...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {branches.map((b) => (
                  <div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Store className="w-4 h-4 text-brand-700" />
                      <div>
                        <span className="text-sm font-semibold text-slate-800 block">{b.name}</span>
                        <span className="text-xs font-mono text-slate-500">{b.branch_code}</span>
                      </div>
                    </div>
                    <Badge variant={b.branch_type === 'MAIN' ? 'primary' : 'secondary'} className="text-[10px]">
                      {b.branch_type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* MAIN BRANCH EMPLOYEE METRICS */}
      {isMainEmployee && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-brand-100 text-brand-800 rounded-xl">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Branches Supported</p>
              <p className="text-xl font-bold text-slate-900">{branches.length || 4}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Pending Branch Orders</p>
              <p className="text-xl font-bold text-slate-900">0</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Pending Transfers</p>
              <p className="text-xl font-bold text-slate-900">0</p>
            </div>
          </Card>

        </div>
      )}

      {/* BRANCH EMPLOYEE METRICS */}
      {isBranchEmployee && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-brand-100 text-brand-800 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Assigned Branch</p>
              <p className="text-sm font-bold text-slate-900">
                {assignedBranch ? assignedBranch.name : 'Branch Employee'}
              </p>
            </div>
          </Card>

          <Card className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Today's Sales</p>
              <p className="text-xl font-bold text-slate-900">₹0</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Current Stock Qty</p>
              <p className="text-xl font-bold text-slate-900">{invSummary.totalAvailableQuantity}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Pending Deliveries</p>
              <p className="text-xl font-bold text-slate-900">0</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-purple-100 text-purple-800 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Expiring Products (≤3d)</p>
              <p className="text-xl font-bold text-slate-900">{invSummary.expiringSoon}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Action Navigation Shortcuts */}
      <Card title="Module Quick Navigation" subtitle="Direct links to permitted operations modules">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {isOwner && (
            <button
              onClick={() => onNavigate('branches')}
              className="p-3 bg-white border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-slate-50 text-left transition-colors flex items-center space-x-3"
            >
              <GitBranch className="w-4 h-4 text-brand-700 shrink-0" />
              <span className="text-sm font-medium text-slate-800">Branches</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('inventory')}
            className="p-3 bg-white border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-slate-50 text-left transition-colors flex items-center space-x-3"
          >
            <PackageCheck className="w-4 h-4 text-brand-700 shrink-0" />
            <span className="text-sm font-medium text-slate-800">
            {isBranchEmployee ? 'My Inventory' : 'Inventory'}
            </span>
          </button>

          {(isOwner || isMainEmployee) && (
            <button
              onClick={() => onNavigate('transfers')}
              className="p-3 bg-white border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-slate-50 text-left transition-colors flex items-center space-x-3"
            >
              <ArrowLeftRight className="w-4 h-4 text-brand-700 shrink-0" />
              <span className="text-sm font-medium text-slate-800">Transfers</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('orders')}
            className="p-3 bg-white border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-slate-50 text-left transition-colors flex items-center space-x-3"
          >
            <ShoppingBag className="w-4 h-4 text-brand-700 shrink-0" />
            <span className="text-sm font-medium text-slate-800">Orders</span>
          </button>

          <button
            onClick={() => onNavigate('sales')}
            className="p-3 bg-white border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-slate-50 text-left transition-colors flex items-center space-x-3"
          >
            <DollarSign className="w-4 h-4 text-brand-700 shrink-0" />
            <span className="text-sm font-medium text-slate-800">Sales</span>
          </button>

          <button
            onClick={() => onNavigate('returns')}
            className="p-3 bg-white border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-slate-50 text-left transition-colors flex items-center space-x-3"
          >
            <AlertTriangle className="w-4 h-4 text-brand-700 shrink-0" />
            <span className="text-sm font-medium text-slate-800">Returns</span>
          </button>

          {isOwner && (
            <button
              onClick={() => onNavigate('reports')}
              className="p-3 bg-white border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-slate-50 text-left transition-colors flex items-center space-x-3"
            >
              <CheckCircle2 className="w-4 h-4 text-brand-700 shrink-0" />
              <span className="text-sm font-medium text-slate-800">Reports</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('status')}
            className="p-3 bg-white border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-slate-50 text-left transition-colors flex items-center space-x-3"
          >
            <CheckCircle2 className="w-4 h-4 text-brand-700 shrink-0" />
            <span className="text-sm font-medium text-slate-800">System Status</span>
          </button>
        </div>
      </Card>
    </div>
  );
};
