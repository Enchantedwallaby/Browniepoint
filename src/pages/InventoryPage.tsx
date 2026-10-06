import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Package,
  Plus,
  Search,
  Filter,
  Layers,
  Clock,
  AlertTriangle,
  RefreshCw,
  Store,
  Tag,
  Boxes,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import type { Profile, Branch, FEFOInventoryRecord, ProductCategory } from '@/types/database';
import { inventoryService, type InventorySummary } from '@/services/inventoryService';
import { branchService } from '@/services/branchService';
import { CatalogueManagement } from '@/components/catalogue/CatalogueManagement';
import { StockReceiveModal } from '@/components/inventory/StockReceiveModal';

interface InventoryPageProps {
  profile: Profile;
  assignedBranch: Branch | null;
}

const CATEGORIES: ProductCategory[] = [
  'Cakes',
  'Pastries',
  'Brownies',
  'Macarons',
  'Cup Cakes',
  'Desserts',
  'Cheese Cakes',
  'Sugar Free Cakes',
  'Tea-Time Cakes',
  'Cookies',
  'Savouries',
  'Packaging',
  'Utensils',
  'Consumables',
  'Other',
];

export const InventoryPage: React.FC<InventoryPageProps> = ({
  profile,
  assignedBranch,
}) => {
  const isOwner = profile.role === 'OWNER';
  const isBranchEmployee = profile.role === 'BRANCH_EMPLOYEE';
  const isMainBranchEmployee = profile.role === 'MAIN_BRANCH_EMPLOYEE';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'inventory' | 'catalogue'>('inventory');

  // Branch Selection
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    (isBranchEmployee || isMainBranchEmployee) && assignedBranch ? assignedBranch.id : ''
  );

  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<FEFOInventoryRecord[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalProducts: 0,
    totalAvailableQuantity: 0,
    expiringSoon: 0,
    expired: 0,
    lowStock: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');

  // Stock Receive Modal State
  const [showStockModal, setShowStockModal] = useState(false);
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
  const mainBranchInventory =
    isOwner
      ? selectedBranch?.branch_type === 'MAIN' ? selectedBranch : null
      : assignedBranch?.branch_type === 'MAIN' ? assignedBranch : null;

  // Fetch Branches for Owner filter
  useEffect(() => {
    if (isOwner) {
      branchService.getActiveBranches().then(setBranches).catch(console.error);
    }
  }, [isOwner]);

  // Load Inventory data
  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const effectiveBranchId =
        (isBranchEmployee || isMainBranchEmployee) && assignedBranch
          ? assignedBranch.id
          : selectedBranchId || undefined;
      const data = await inventoryService.getFEFOInventory(effectiveBranchId, selectedCategory);
      const summ = await inventoryService.getInventorySummary(effectiveBranchId);

      setInventory(data);
      setSummary(summ);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'inventory' && !mainBranchInventory) {
      fetchInventoryData();
    }
  }, [activeTab, selectedBranchId, selectedCategory, mainBranchInventory]);

  // Filtered inventory list
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.product_name.toLowerCase().includes(search.toLowerCase()) ||
      item.variant_name.toLowerCase().includes(search.toLowerCase()) ||
      item.batch_number.toLowerCase().includes(search.toLowerCase());

    let matchesExpiry = true;
    if (expiryFilter === 'ACTIVE') {
      matchesExpiry = !item.is_expired && item.days_until_expiry > 3;
    } else if (expiryFilter === 'EXPIRING_SOON') {
      matchesExpiry = !item.is_expired && item.days_until_expiry <= 3 && item.days_until_expiry >= 0;
    } else if (expiryFilter === 'EXPIRED') {
      matchesExpiry = item.is_expired;
    }

    return matchesSearch && matchesExpiry;
  });

  const pageTitle = mainBranchInventory
    ? 'Inventory'
    : isBranchEmployee ? 'My Inventory' : 'Inventory Management';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-700" />
            {pageTitle}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {mainBranchInventory
              ? `Inventory balances are not tracked for ${mainBranchInventory.name} (${mainBranchInventory.branch_code}).`
              : isBranchEmployee && assignedBranch
              ? `Stock & Expiry Tracking for ${assignedBranch.name} (${assignedBranch.branch_code})`
              : 'Sub-branch batch inventory with FEFO expiry tracking and product catalogue management.'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center space-x-1 bg-slate-200/80 p-1 rounded-xl shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'inventory'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {mainBranchInventory ? 'Stock not tracked' : 'Stock & Inventory'}
          </button>
          <button
            onClick={() => setActiveTab('catalogue')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'catalogue'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Product Catalogue
          </button>
        </div>
      </div>

      {/* CATALOGUE TAB */}
      {activeTab === 'catalogue' && <CatalogueManagement profile={profile} />}

      {/* INVENTORY TAB */}
      {activeTab === 'inventory' && mainBranchInventory ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Main Branch sales do not require an on-hand stock balance. Sub-branch inventory,
          expiry tracking, and FEFO remain unchanged.
        </div>
      ) : activeTab === 'inventory' && (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4 flex items-center space-x-3">
              <div className="p-3 bg-brand-100 text-brand-800 rounded-xl">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Products in Stock</p>
                <p className="text-xl font-bold text-slate-900">{summary.totalProducts}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center space-x-3">
              <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Available Quantity</p>
                <p className="text-xl font-bold text-slate-900">{summary.totalAvailableQuantity}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center space-x-3">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Expiring Soon (≤3d)</p>
                <p className="text-xl font-bold font-mono text-amber-700">{summary.expiringSoon}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center space-x-3">
              <div className="p-3 bg-rose-100 text-rose-800 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Expired Items</p>
                <p className="text-xl font-bold font-mono text-rose-700">{summary.expired}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center space-x-3">
              <div className="p-3 bg-purple-100 text-purple-800 rounded-xl">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Low Stock (&lt;5)</p>
                <p className="text-xl font-bold text-slate-900">{summary.lowStock}</p>
              </div>
            </Card>
          </div>

          {/* Controls & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sub-branch stock by product, variant, or batch..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Branch Filter (Owner Only) */}
            {isOwner && (
              <div className="flex items-center space-x-2">
                <Store className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.branch_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Expiry Status Filter */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setExpiryFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  expiryFilter === 'ALL' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setExpiryFilter('EXPIRING_SOON')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  expiryFilter === 'EXPIRING_SOON' ? 'bg-amber-500 text-white font-bold' : 'text-amber-700'
                }`}
              >
                Soon (≤3d)
              </button>
              <button
                onClick={() => setExpiryFilter('EXPIRED')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  expiryFilter === 'EXPIRED' ? 'bg-rose-600 text-white font-bold' : 'text-rose-700'
                }`}
              >
                Expired
              </button>
            </div>

            {/* Receive Stock Button & Refresh */}
            <div className="flex items-center space-x-2 shrink-0">
              <Button variant="primary" size="sm" onClick={() => setShowStockModal(true)}>
                <Plus className="w-4 h-4" />
                <span>Receive / Add Sub-Branch Stock</span>
              </Button>

              <button
                onClick={fetchInventoryData}
                className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                title="Refresh inventory"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* FEFO Information Badge */}
          <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl flex items-center justify-between text-xs text-brand-900">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-brand-700 shrink-0" />
              <span>
                <strong className="font-bold">FEFO Prioritization:</strong> Sub-branch batches are ordered by earliest expiry date (<code className="font-mono">v_fefo_inventory</code>). Sub-branch dispatch and sale operations consume earliest-expiring stock first.
              </span>
            </div>
            <span className="font-mono text-[10px] text-brand-700 bg-brand-100 px-2 py-0.5 rounded font-bold shrink-0">
              FIRST EXPIRY, FIRST OUT
            </span>
          </div>

          {/* Inventory Table */}
          <Card className="overflow-hidden p-0">
            {loading ? (
              <div className="p-12 text-center text-sm text-slate-500">
                Loading FEFO inventory records...
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-semibold text-slate-800">No Inventory Records Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  {inventory.length === 0
                    ? 'No stock batches have been recorded yet. Click "Receive / Add Stock" to record your first inventory batch.'
                    : 'No inventory items match the applied search or expiry filters.'}
                </p>
                {inventory.length === 0 && (
                  <Button variant="primary" size="sm" onClick={() => setShowStockModal(true)}>
                    <Plus className="w-4 h-4" />
                    <span>Receive First Stock Batch</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold font-mono">
                      <th className="py-3 px-4">PRODUCT NAME</th>
                      <th className="py-3 px-4">VARIANT</th>
                      <th className="py-3 px-4">BRANCH</th>
                      <th className="py-3 px-4">BATCH NUMBER</th>
                      <th className="py-3 px-4">PRODUCTION DATE</th>
                      <th className="py-3 px-4">EXPIRY DATE</th>
                      <th className="py-3 px-4 text-right">AVAILABLE STOCK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInventory.map((item) => (
                      <tr key={item.inventory_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block text-sm">{item.product_name}</span>
                          <span className="text-[10px] text-brand-700 uppercase font-mono">{item.product_category}</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                            <Tag className="w-3 h-3 text-slate-400" />
                            {item.variant_name}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-medium text-slate-700">
                          {item.branch_name}
                        </td>

                        <td className="py-3 px-4">
                          <code className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {item.batch_number}
                          </code>
                        </td>

                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {item.production_date}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono font-medium text-slate-800">{item.expiry_date}</span>
                            {item.is_expired ? (
                              <Badge variant="danger" className="text-[10px] py-0 px-1.5 font-bold">
                                EXPIRED
                              </Badge>
                            ) : item.days_until_expiry <= 3 ? (
                              <Badge variant="warning" className="text-[10px] py-0 px-1.5 font-bold">
                                SOON ({item.days_until_expiry}d)
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px] py-0 px-1.5">
                                ACTIVE
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-sm text-slate-900 font-mono">
                            {item.quantity_available}
                          </span>
                          <span className="text-[10px] text-slate-500 block">units</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* STOCK RECEIVE MODAL */}
      {showStockModal && !mainBranchInventory && (
        <StockReceiveModal
          profile={profile}
          assignedBranch={assignedBranch}
          onClose={() => setShowStockModal(false)}
          onSuccess={() => {
            fetchInventoryData();
          }}
        />
      )}
    </div>
  );
};
