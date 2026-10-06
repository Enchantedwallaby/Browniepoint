import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { productService, type ProductWithVariants } from '@/services/productService';
import { inventoryService } from '@/services/inventoryService';
import { branchService } from '@/services/branchService';
import {
  transferService,
  type StockTransferDetailed,
  type CreateTransferItemParam,
} from '@/services/transferService';
import type { Profile, Branch, FEFOInventoryRecord } from '@/types/database';
import {
  ArrowLeftRight,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Search,
  FileText,
  Printer,
  X,
  Package,
  Building2,
  Inbox,
  AlertTriangle,
} from 'lucide-react';

interface TransfersPageProps {
  profile: Profile;
  assignedBranch: Branch | null;
}

interface DispatchCartItem extends CreateTransferItemParam {
  product_id: string;
  product_name: string;
  variant_name: string;
  available_stock: number;
}

export const TransfersPage: React.FC<TransfersPageProps> = ({ profile, assignedBranch }) => {
  const isOwner = profile.role === 'OWNER';
  const isMainEmployee = profile.role === 'MAIN_BRANCH_EMPLOYEE' || isOwner;
  const isBranchEmployee = profile.role === 'BRANCH_EMPLOYEE';

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'transfers' | 'dispatch' | 'receipts'>('transfers');

  // Branch data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [mainBranch, setMainBranch] = useState<Branch | null>(null);

  // Branch Selection: Owner defaults to '' ("All Branches"), Branch Employee defaults to assigned branch ID
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isBranchEmployee && assignedBranch ? assignedBranch.id : ''
  );

  // Dispatch Form State
  const [sourceBranchId, setSourceBranchId] = useState<string>('');
  const [destinationBranchId, setDestinationBranchId] = useState<string>('');
  const [dispatchNotes, setDispatchNotes] = useState<string>('');
  const [dispatchCart, setDispatchCart] = useState<DispatchCartItem[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Available stock at Source Branch for dispatch selection
  const [sourceProducts, setSourceProducts] = useState<ProductWithVariants[]>([]);
  const [sourceFefo, setSourceFefo] = useState<FEFOInventoryRecord[]>([]);
  const [loadingSourceStock, setLoadingSourceStock] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState('');

  // History & Receipts Data
  const [transfers, setTransfers] = useState<StockTransferDetailed[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [transfersError, setTransfersError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedTransferDoc, setSelectedTransferDoc] = useState<StockTransferDetailed | null>(null);
  const [inspectingReceipt, setInspectingReceipt] = useState<StockTransferDetailed | null>(null);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, number>>({});
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');
  const [approvingReceipt, setApprovingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // 1. Load active branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const bList = await branchService.getActiveBranches();
        setBranches(bList);
        const mainB = bList.find((b) => b.branch_type === 'MAIN') || bList[0];
        setMainBranch(mainB || null);

        if (mainB) {
          setSourceBranchId(mainB.id);
          const subBranches = bList.filter((b) => b.id !== mainB.id);
          if (subBranches.length > 0) {
            setDestinationBranchId(subBranches[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading branches:', err);
      }
    }
    loadBranches();
  }, []);

  // 2. Load Stock at Source Branch for Dispatching
  const loadSourceStock = useCallback(async () => {
    if (!sourceBranchId) return;
    setLoadingSourceStock(true);
    try {
      const [prodsData, stockData] = await Promise.all([
        productService.getActiveProducts(),
        inventoryService.getFEFOInventory(sourceBranchId),
      ]);
      setSourceProducts(prodsData);
      setSourceFefo(stockData);
    } catch (err) {
      console.error('Error loading source stock:', err);
    } finally {
      setLoadingSourceStock(false);
    }
  }, [sourceBranchId]);

  useEffect(() => {
    if (activeTab === 'dispatch') {
      loadSourceStock();
    }
  }, [activeTab, loadSourceStock]);

  // 3. Load Transfers List with Proper Error Handling
  const loadTransfersList = useCallback(async () => {
    setLoadingTransfers(true);
    setTransfersError(null);
    try {
      // For Owner: if selectedBranchId is empty (''), pass undefined to fetch ALL transfers.
      // For Branch Employee: pass assignedBranch.id.
      const targetBranchId = isOwner
        ? selectedBranchId || undefined
        : assignedBranch?.id || undefined;

      const list = await transferService.getTransfers({
        branchId: targetBranchId,
        limit: 100,
      });
      setTransfers(list);
    } catch (err: unknown) {
      console.error('Error loading stock transfers:', err);
      setTransfersError(
        err instanceof Error ? err.message : 'Failed to load stock transfers from database.'
      );
    } finally {
      setLoadingTransfers(false);
    }
  }, [isOwner, selectedBranchId, assignedBranch]);

  // Trigger transfers fetch whenever active tab, selected branch, or dependencies change
  useEffect(() => {
    loadTransfersList();
  }, [activeTab, selectedBranchId, loadTransfersList]);

  // Map source stock by variant ID
  const stockByVariant = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of sourceFefo) {
      const cur = map.get(r.product_variant_id) || 0;
      map.set(r.product_variant_id, cur + Number(r.quantity_available || 0));
    }
    return map;
  }, [sourceFefo]);

  // Filtered Catalogue Products for Dispatch selection
  const filteredSourceProducts = useMemo(() => {
    const q = catalogueSearch.toLowerCase().trim();
    return sourceProducts.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.variants.some((v) => v.name.toLowerCase().includes(q))
      );
    });
  }, [sourceProducts, catalogueSearch]);

  // Add Item to Dispatch Cart
  const handleAddToDispatchCart = (
    product: ProductWithVariants,
    variant: ProductWithVariants['variants'][0]
  ) => {
    setDispatchError(null);
    const availableStock = stockByVariant.get(variant.id) || 0;

    if (availableStock <= 0) {
      setDispatchError(`"${product.name} - ${variant.name}" has zero unexpired stock at Source Branch.`);
      return;
    }

    const existingIdx = dispatchCart.findIndex((i) => i.product_variant_id === variant.id);

    if (existingIdx > -1) {
      const item = dispatchCart[existingIdx];
      if (item.quantity + 1 > availableStock) {
        setDispatchError(`Cannot dispatch more than ${availableStock} available units.`);
        return;
      }
      const updated = [...dispatchCart];
      updated[existingIdx] = { ...item, quantity: item.quantity + 1 };
      setDispatchCart(updated);
    } else {
      setDispatchCart([
        ...dispatchCart,
        {
          product_id: product.id,
          product_variant_id: variant.id,
          product_name: product.name,
          variant_name: variant.name,
          quantity: 1,
          available_stock: availableStock,
        },
      ]);
    }
  };

  // Dispatch Action
  const handleDispatchSubmit = async () => {
    setDispatchError(null);

    if (!sourceBranchId || !destinationBranchId) {
      setDispatchError('Please select both source and destination branches.');
      return;
    }

    if (sourceBranchId === destinationBranchId) {
      setDispatchError('Source and destination branch cannot be the same.');
      return;
    }

    if (dispatchCart.length === 0) {
      setDispatchError('Dispatch list cannot be empty.');
      return;
    }

    setDispatching(true);

    try {
      const transferId = await transferService.createTransfer({
        source_branch_id: sourceBranchId,
        destination_branch_id: destinationBranchId,
        notes: dispatchNotes,
        dispatched_by: profile.id,
        items: dispatchCart.map((i) => ({
          product_variant_id: i.product_variant_id,
          quantity: i.quantity,
          product_name: i.product_name,
          variant_name: i.variant_name,
        })),
      });

      setDispatchCart([]);
      setDispatchNotes('');

      // Reload transfers list and open document modal
      await loadTransfersList();
      const newTransfers = await transferService.getTransfers({ limit: 10 });
      const createdDoc = newTransfers.find((t) => t.id === transferId);
      if (createdDoc) {
        setSelectedTransferDoc(createdDoc);
      }

      setActiveTab('transfers');
    } catch (err: unknown) {
      setDispatchError(err instanceof Error ? err.message : 'Failed to dispatch stock transfer.');
    } finally {
      setDispatching(false);
    }
  };

  // Open Receipt Inspection Modal
  const handleOpenReceiptInspection = (trf: StockTransferDetailed) => {
    setInspectingReceipt(trf);
    setReceiptError(null);
    setDiscrepancyNotes('');
    const initialQtyMap: Record<string, number> = {};
    trf.items.forEach((item) => {
      initialQtyMap[item.id] = item.quantity_dispatched;
    });
    setReceiptQuantities(initialQtyMap);
  };

  // Approve Receipt Action
  const handleApproveReceipt = async () => {
    if (!inspectingReceipt) return;
    setReceiptError(null);
    setApprovingReceipt(true);

    try {
      const receivedItems = inspectingReceipt.items.map((item) => ({
        transfer_item_id: item.id,
        quantity_received: Number(receiptQuantities[item.id] ?? item.quantity_dispatched),
      }));

      await transferService.approveTransferReceipt({
        transfer_id: inspectingReceipt.id,
        items: receivedItems,
        discrepancy_notes: discrepancyNotes,
        received_by: profile.id,
      });

      setInspectingReceipt(null);
      await loadTransfersList();
    } catch (err: unknown) {
      setReceiptError(err instanceof Error ? err.message : 'Failed to approve transfer receipt.');
    } finally {
      setApprovingReceipt(false);
    }
  };

  // Filtered Transfers List
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQ =
        !q ||
        t.transfer_number.toLowerCase().includes(q) ||
        (t.source_branch_name && t.source_branch_name.toLowerCase().includes(q)) ||
        (t.destination_branch_name && t.destination_branch_name.toLowerCase().includes(q));
      return matchesStatus && matchesQ;
    });
  }, [transfers, statusFilter, searchQuery]);

  // Pending Receipts Filtering Logic:
  // 1. Must have status = 'IN_TRANSIT'
  // 2. Owner viewing "All Branches" (selectedBranchId === '') -> shows ALL in-transit transfers across all destination branches.
  // 3. Owner or Branch Employee viewing a specific branch -> shows in-transit transfers destined for that specific branch.
  const pendingReceiptsList = useMemo(() => {
    return transfers.filter((t) => {
      if (t.status !== 'IN_TRANSIT') return false;

      // Owner viewing "All Branches"
      if (isOwner && !selectedBranchId) {
        return true;
      }

      // Selected branch filter (Owner or Branch Employee)
      const targetBranchId = selectedBranchId || assignedBranch?.id;
      if (targetBranchId) {
        return t.destination_branch_id === targetBranchId;
      }

      // Default fallback for Owner
      if (isOwner) return true;

      // Default fallback for Branch Employee
      return assignedBranch ? t.destination_branch_id === assignedBranch.id : false;
    });
  }, [transfers, isOwner, selectedBranchId, assignedBranch]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-brand-700" />
            Inter-Branch Stock Transfers
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Main Branch dispatch, in-transit manifests, destination receipt approval, and FEFO inventory movements.
          </p>
        </div>

        {/* Branch Filter for Owner */}
        <div className="flex items-center gap-3">
          {isOwner && branches.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 rounded-lg shadow-sm">
              <Building2 className="w-4 h-4 text-brand-700" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="text-xs font-bold text-brand-900 bg-transparent outline-none cursor-pointer"
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

          {/* Quick New Dispatch button */}
          {isMainEmployee && activeTab !== 'dispatch' && (
            <button
              onClick={() => setActiveTab('dispatch')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              Dispatch New Transfer
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'transfers'
                ? 'border-brand-700 text-brand-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Transfer Logs & Manifests
          </button>

          {isMainEmployee && (
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`flex items-center gap-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'dispatch'
                  ? 'border-brand-700 text-brand-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Send className="w-4 h-4" />
              Dispatch Stock (Main Branch)
              {dispatchCart.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-brand-700 text-white rounded-full font-bold">
                  {dispatchCart.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('receipts')}
            className={`flex items-center gap-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'receipts'
                ? 'border-brand-700 text-brand-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Pending Receipts
            {pendingReceiptsList.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full font-bold">
                {pendingReceiptsList.length}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={loadTransfersList}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors mb-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingTransfers ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB 1: TRANSFER LOGS & MANIFESTS                             */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transfer number or branch..."
                className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Transfers Table & Error Display */}
          {transfersError ? (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Failed to Load Transfers</p>
                <p className="mt-0.5">{transfersError}</p>
              </div>
            </div>
          ) : loadingTransfers ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-brand-700 animate-spin mx-auto" />
              <p className="text-sm text-slate-600 font-medium">Loading stock transfer logs...</p>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <Card className="text-center py-12 px-4 border-dashed border-2 border-slate-200">
              <Inbox className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-slate-800">No Transfer Logs Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Inter-branch stock transfers will appear here once dispatched from Main Branch.
              </p>
            </Card>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Transfer Number</th>
                      <th className="py-3 px-4">Dispatched At</th>
                      <th className="py-3 px-4">Source Branch</th>
                      <th className="py-3 px-4">Destination Branch</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransfers.map((trf) => (
                      <tr key={trf.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-brand-900">
                          {trf.transfer_number}
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {new Date(trf.dispatched_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {trf.source_branch_name}
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {trf.destination_branch_name}
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              trf.status === 'RECEIVED'
                                ? 'success'
                                : trf.status === 'IN_TRANSIT'
                                ? 'warning'
                                : 'secondary'
                            }
                          >
                            {trf.status === 'IN_TRANSIT' ? 'In Transit' : trf.status}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {trf.items.length} items
                        </td>

                        <td className="py-3 px-4 text-center space-x-2">
                          <button
                            onClick={() => setSelectedTransferDoc(trf)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Manifest
                          </button>

                          {trf.status === 'IN_TRANSIT' &&
                            (isOwner ||
                              (assignedBranch && trf.destination_branch_id === assignedBranch.id)) && (
                              <button
                                onClick={() => handleOpenReceiptInspection(trf)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve Receipt
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB 2: DISPATCH STOCK (MAIN BRANCH)                         */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'dispatch' && isMainEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: SOURCE CATALOGUE SELECTOR (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-700" />
                  Source Branch Available FEFO Stock
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {mainBranch?.name || 'Main Branch'}
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  placeholder="Search catalogue to dispatch..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {loadingSourceStock ? (
              <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-brand-700 animate-spin mx-auto" />
                <p className="text-sm text-slate-600 font-medium">Loading Main Branch available stock...</p>
              </div>
            ) : filteredSourceProducts.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                <Package className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredSourceProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {prod.name}
                      </h4>
                      <Badge variant="secondary" className="text-[10px]">
                        {prod.category}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      {prod.variants.map((v) => {
                        const stock = stockByVariant.get(v.id) || 0;
                        const disabled = stock <= 0;

                        return (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs"
                          >
                            <div>
                              <span className="font-semibold text-slate-800">{v.name}</span>
                              <p
                                className={`text-[10px] font-medium ${
                                  stock > 0 ? 'text-emerald-700' : 'text-rose-600 font-bold'
                                }`}
                              >
                                {stock > 0 ? `Stock: ${stock} available` : 'No Stock'}
                              </p>
                            </div>

                            <button
                              onClick={() => handleAddToDispatchCart(prod, v)}
                              disabled={disabled}
                              className="px-2.5 py-1 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              + Dispatch
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: DISPATCH MANIFEST BUILDER (5 Cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-md p-4 space-y-4 sticky top-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-brand-700" />
                <h3 className="font-bold text-slate-900 text-base">Dispatch Manifest</h3>
              </div>
              {dispatchCart.length > 0 && (
                <button
                  onClick={() => setDispatchCart([])}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                >
                  Clear Items
                </button>
              )}
            </div>

            {dispatchError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{dispatchError}</span>
              </div>
            )}

            {/* Destination Branch Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Destination Sub-Branch
              </label>
              <select
                value={destinationBranchId}
                onChange={(e) => setDestinationBranchId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-brand-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {branches
                  .filter((b) => b.id !== sourceBranchId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.branch_code})
                    </option>
                  ))}
              </select>
            </div>

            {/* Dispatched Cart Items List */}
            {dispatchCart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Package className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No items added to dispatch</p>
                <p className="text-xs text-slate-400">Select available products from Main Branch stock on left.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 divide-y divide-slate-100">
                {dispatchCart.map((item) => (
                  <div key={item.product_variant_id} className="pt-2 first:pt-0 space-y-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 leading-tight">
                          {item.product_name}
                        </h5>
                        <span className="text-[11px] text-slate-500">{item.variant_name}</span>
                      </div>

                      <button
                        onClick={() =>
                          setDispatchCart((prev) =>
                            prev.filter((i) => i.product_variant_id !== item.product_variant_id)
                          )
                        }
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500">Dispatch Quantity:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={item.available_stock}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            const clamped = Math.min(item.available_stock, Math.max(1, val));
                            setDispatchCart((prev) =>
                              prev.map((i) =>
                                i.product_variant_id === item.product_variant_id
                                  ? { ...i, quantity: clamped }
                                  : i
                              )
                            );
                          }}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-right font-bold text-slate-900"
                        />
                        <span className="text-[10px] text-slate-400">/ {item.available_stock} avail</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Optional Dispatch Notes */}
            {dispatchCart.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dispatch Notes <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    placeholder="e.g. Morning delivery batch via driver Ramesh"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <button
                  onClick={handleDispatchSubmit}
                  disabled={dispatching || dispatchCart.length === 0}
                  className="w-full py-3 px-4 bg-brand-700 hover:bg-brand-800 text-white font-bold text-sm rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {dispatching ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Dispatching Transfer...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Dispatch Transfer ({dispatchCart.length} items)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB 3: PENDING RECEIPTS (SUB-BRANCH RECEIPT APPROVAL)       */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Inbox className="w-5 h-5 text-amber-600" />
              Pending Incoming Transfers for Receipt Approval
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Destination branch employees must cross-check received stock quantities and approve receipt.
              Source stock is deducted and destination stock is increased ONLY upon receipt approval.
            </p>
          </div>

          {transfersError ? (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Failed to Load Pending Receipts</p>
                <p className="mt-0.5">{transfersError}</p>
              </div>
            </div>
          ) : loadingTransfers ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-brand-700 animate-spin mx-auto" />
              <p className="text-sm text-slate-600 font-medium">Checking for pending incoming transfers...</p>
            </div>
          ) : pendingReceiptsList.length === 0 ? (
            <Card className="text-center py-12 px-4 border-dashed border-2 border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-slate-800">All Transfers Up to Date</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                {selectedBranchId
                  ? 'There are currently no pending in-transit stock transfers awaiting receipt approval for the selected branch.'
                  : 'There are currently no pending in-transit stock transfers awaiting receipt approval across any branch.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingReceiptsList.map((trf) => (
                <div
                  key={trf.id}
                  className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-mono font-bold text-brand-900 text-sm">
                      {trf.transfer_number}
                    </span>
                    <Badge variant="warning">In Transit</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block">From:</span>
                      <span className="font-semibold text-slate-900">{trf.source_branch_name}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">To (Destination):</span>
                      <span className="font-semibold text-slate-900">{trf.destination_branch_name}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Dispatched:</span>
                      <span>
                        {new Date(trf.dispatched_at).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Items Dispatched:</span>
                      <span className="font-bold text-slate-900">{trf.items.length} line items</span>
                    </div>
                  </div>

                  {/* Dispatched Line Items Summary */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                    <span className="font-semibold text-slate-700 block text-[11px] uppercase tracking-wider mb-1">
                      Manifest Contents:
                    </span>
                    {trf.items.map((i) => (
                      <div key={i.id} className="flex justify-between text-slate-800 text-[11px]">
                        <span>
                          {i.product_name} ({i.variant_name})
                        </span>
                        <span className="font-bold">Qty: {i.quantity_dispatched}</span>
                      </div>
                    ))}
                  </div>

                  {trf.notes && (
                    <p className="text-xs text-slate-500 bg-amber-50/60 p-2 rounded border border-amber-200/60">
                      <span className="font-semibold text-amber-900">Dispatch Note:</span> {trf.notes}
                    </p>
                  )}

                  <button
                    onClick={() => handleOpenReceiptInspection(trf)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Inspect & Approve Receipt
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: PRINTABLE TRANSFER MANIFEST DOCUMENT               */}
      {/* ════════════════════════════════════════════════════════════ */}
      {selectedTransferDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-brand-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-300" />
                <div>
                  <h3 className="font-bold text-base">Inter-Branch Transfer Manifest</h3>
                  <p className="text-xs text-brand-300 font-mono">
                    {selectedTransferDoc.transfer_number}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTransferDoc(null)}
                className="text-brand-300 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Content */}
            <div className="p-6 space-y-4 max-h-[550px] overflow-y-auto">
              <div className="text-center pb-3 border-b border-dashed border-slate-200">
                <h4 className="font-black text-slate-900 text-xl tracking-tight">
                  BROWNIE POINT
                </h4>
                <p className="text-xs text-slate-600 font-bold uppercase tracking-wider mt-0.5">
                  Stock Transfer Challan / Dispatch Note
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Dispatch Date:{' '}
                  {new Date(selectedTransferDoc.dispatched_at).toLocaleString('en-IN', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </p>
              </div>

              {/* Header Info */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Source Branch:</span>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {selectedTransferDoc.source_branch_name}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Destination Branch:</span>
                  <p className="font-extrabold text-brand-900 text-sm">
                    {selectedTransferDoc.destination_branch_name}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Dispatched By:</span>
                  <p className="font-semibold text-slate-800">
                    {selectedTransferDoc.dispatched_by_name || 'Main Branch Employee'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Transfer Status:</span>
                  <p className="font-bold text-slate-900">
                    {selectedTransferDoc.status}
                  </p>
                </div>
              </div>

              {/* Dispatched Line Items Table */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Dispatched Items & FEFO Batches
                </h5>

                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="p-2.5">Item Name</th>
                        <th className="p-2.5">Variant</th>
                        <th className="p-2.5">Batch Number</th>
                        <th className="p-2.5 text-right">Dispatched Qty</th>
                        {selectedTransferDoc.status === 'RECEIVED' && (
                          <th className="p-2.5 text-right">Received Qty</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTransferDoc.items.map((item) => (
                        <tr key={item.id}>
                          <td className="p-2.5 font-bold text-slate-900">
                            {item.product_name}
                          </td>
                          <td className="p-2.5 text-slate-600">{item.variant_name}</td>
                          <td className="p-2.5 font-mono text-slate-700">
                            {item.batch_number || 'N/A'}
                          </td>
                          <td className="p-2.5 text-right font-black text-slate-900">
                            {item.quantity_dispatched}
                          </td>
                          {selectedTransferDoc.status === 'RECEIVED' && (
                            <td className="p-2.5 text-right font-black text-emerald-700">
                              {item.quantity_received ?? item.quantity_dispatched}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedTransferDoc.notes && (
                <div className="text-xs bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <span className="font-semibold text-amber-900">Dispatch Notes:</span>{' '}
                  <span className="text-amber-800">{selectedTransferDoc.notes}</span>
                </div>
              )}

              {selectedTransferDoc.discrepancy_notes && (
                <div className="text-xs bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  <span className="font-semibold text-rose-900">Discrepancy Notes:</span>{' '}
                  <span className="text-rose-800">{selectedTransferDoc.discrepancy_notes}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Manifest
              </button>

              <button
                onClick={() => setSelectedTransferDoc(null)}
                className="px-4 py-2 bg-brand-900 hover:bg-brand-950 text-white font-bold text-xs rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: RECEIPT INSPECTION & DISCREPANCY APPROVAL MODAL     */}
      {/* ════════════════════════════════════════════════════════════ */}
      {inspectingReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="bg-emerald-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="font-bold text-base">Approve Stock Transfer Receipt</h3>
                  <p className="text-xs text-emerald-200 font-mono">
                    {inspectingReceipt.transfer_number}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectingReceipt(null)}
                className="text-emerald-200 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[550px] overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Cross-Check Received Quantities
                </p>
                <p className="text-amber-800">
                  Verify the physical count against the dispatched quantity. Upon approval, source stock will decrease and destination stock will increase atomically.
                </p>
              </div>

              {receiptError && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{receiptError}</span>
                </div>
              )}

              {/* Items Verification Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5">Variant</th>
                      <th className="p-2.5">Batch</th>
                      <th className="p-2.5 text-right">Dispatched</th>
                      <th className="p-2.5 text-right">Received Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectingReceipt.items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2.5 font-bold text-slate-900">
                          {item.product_name}
                        </td>
                        <td className="p-2.5 text-slate-600">{item.variant_name}</td>
                        <td className="p-2.5 font-mono text-slate-700">
                          {item.batch_number || 'N/A'}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-slate-900">
                          {item.quantity_dispatched}
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity_dispatched}
                            value={receiptQuantities[item.id] ?? item.quantity_dispatched}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const clamped = Math.min(item.quantity_dispatched, Math.max(0, val));
                              setReceiptQuantities((prev) => ({
                                ...prev,
                                [item.id]: clamped,
                              }));
                            }}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-right font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Discrepancy Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Discrepancy Notes / Shortfall Explanation{' '}
                  <span className="text-slate-400 font-normal">(Required if quantities differ)</span>
                </label>
                <textarea
                  rows={2}
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  placeholder="e.g. 1 box damaged in transport, 9 received intact"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setInspectingReceipt(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleApproveReceipt}
                disabled={approvingReceipt}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {approvingReceipt ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Approving & Updating Inventory...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Receipt & Adjust Stock
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
