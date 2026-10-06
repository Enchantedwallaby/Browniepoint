import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/Badge';
import { productService, type ProductWithVariants } from '@/services/productService';
import { branchService } from '@/services/branchService';
import {
  orderService,
  type BranchOrderDetailed,
  type CreateOrderItemParam,
} from '@/services/orderService';
import type { Profile, Branch, OrderStatus } from '@/types/database';
import {
  ShoppingBag,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Package,
  Trash2,
  Eye,
  FileText,
  Truck,
  Flame,
  X,
  Send,
} from 'lucide-react';

interface OrdersPageProps {
  profile?: Profile | null;
  assignedBranch?: Branch | null;
  onNavigate?: (tab: any) => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  profile,
  assignedBranch,
  onNavigate,
}) => {
  const isOwner = profile?.role === 'OWNER';
  const isMainBranchEmployee = profile?.role === 'MAIN_BRANCH_EMPLOYEE';
  const isMainBranchOrOwner = isOwner || isMainBranchEmployee;

  // Branch Selection & Scoping
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isMainBranchOrOwner ? '' : assignedBranch?.id || ''
  );

  // Orders State
  const [orders, setOrders] = useState<BranchOrderDetailed[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Tab & Filters
  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [urgentOnlyFilter, setUrgentOnlyFilter] = useState(false);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<BranchOrderDetailed | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<BranchOrderDetailed | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Create Order Form State
  const [orderTargetBranchId, setOrderTargetBranchId] = useState<string>(
    assignedBranch?.id || ''
  );
  const [orderRequiredDate, setOrderRequiredDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [orderIsUrgent, setOrderIsUrgent] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderCart, setOrderCart] = useState<CreateOrderItemParam[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [createOrderError, setCreateOrderError] = useState<string | null>(null);

  // Catalogue for Item Selection
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState('');

  // 1. Load Branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const data = await branchService.getActiveBranches();
        setBranches(data);
        if (!isMainBranchOrOwner && assignedBranch) {
          setSelectedBranchId(assignedBranch.id);
          setOrderTargetBranchId(assignedBranch.id);
        } else if (isMainBranchOrOwner && data.length > 0) {
          // Default target branch for new order if owner creates one
          const nonMain = data.find((b) => (b as any).branch_type !== 'MAIN') || data[0];
          setOrderTargetBranchId(nonMain.id);
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      }
    }
    loadBranches();
  }, [isMainBranchOrOwner, assignedBranch]);

  // 2. Load Catalogue for Order Creation
  useEffect(() => {
    async function loadCatalogue() {
      try {
        const prods = await productService.getActiveProducts();
        setProducts(prods);
        if (prods.length > 0) {
          setSelectedProductId(prods[0].id);
          if (prods[0].variants.length > 0) {
            setSelectedVariantId(prods[0].variants[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    }
    loadCatalogue();
  }, []);

  // Update selected variant when selected product changes
  useEffect(() => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod && prod.variants.length > 0) {
      setSelectedVariantId(prod.variants[0].id);
    }
  }, [selectedProductId, products]);

  // 3. Load Orders List
  const loadOrdersList = useCallback(async () => {
    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const data = await orderService.getOrders({
        branchId: isMainBranchOrOwner ? (selectedBranchId || undefined) : assignedBranch?.id,
        limit: 100,
      });
      setOrders(data);
    } catch (err: unknown) {
      console.error('Failed to load branch orders:', err);
      if (err instanceof Error) {
        setOrdersError(err.message);
      } else {
        setOrdersError('Failed to load branch orders.');
      }
    } finally {
      setLoadingOrders(false);
    }
  }, [isMainBranchOrOwner, selectedBranchId, assignedBranch]);

  useEffect(() => {
    loadOrdersList();
  }, [loadOrdersList]);

  // Handle Action Messages Timeout
  useEffect(() => {
    if (actionSuccessMessage) {
      const timer = setTimeout(() => setActionSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessMessage]);

  // 4. Cart Item Add/Remove
  const handleAddItemToCart = () => {
    if (!selectedProductId || !selectedVariantId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    const variant = prod?.variants.find((v) => v.id === selectedVariantId);
    if (!prod || !variant) return;

    if (itemQuantity <= 0) {
      setCreateOrderError('Item quantity must be greater than zero.');
      return;
    }

    setCreateOrderError(null);

    // Check if variant already in order cart
    const existingIndex = orderCart.findIndex((i) => i.product_variant_id === variant.id);
    if (existingIndex > -1) {
      const updated = [...orderCart];
      updated[existingIndex].quantity += itemQuantity;
      if (itemNotes.trim()) {
        updated[existingIndex].notes = itemNotes.trim();
      }
      setOrderCart(updated);
    } else {
      setOrderCart([
        ...orderCart,
        {
          product_variant_id: variant.id,
          quantity: itemQuantity,
          product_name: prod.name,
          variant_name: variant.name,
          notes: itemNotes.trim() || undefined,
        },
      ]);
    }

    // Reset inputs
    setItemQuantity(1);
    setItemNotes('');
  };

  const handleRemoveCartItem = (variantId: string) => {
    setOrderCart((prev) => prev.filter((i) => i.product_variant_id !== variantId));
  };

  // 5. Submit New Order
  const handleSubmitOrder = async () => {
    if (!orderTargetBranchId) {
      setCreateOrderError('Please select an ordering branch.');
      return;
    }
    if (!orderRequiredDate) {
      setCreateOrderError('Please specify the required delivery date.');
      return;
    }
    if (orderCart.length === 0) {
      setCreateOrderError('Please add at least one product item to the order.');
      return;
    }

    setSubmittingOrder(true);
    setCreateOrderError(null);

    try {
      await orderService.createBranchOrder({
        branch_id: orderTargetBranchId,
        required_date: orderRequiredDate,
        is_urgent: orderIsUrgent,
        notes: orderNotes.trim() || undefined,
        created_by: profile?.id,
        items: orderCart,
      });

      // Clear form & close
      setShowCreateModal(false);
      setOrderCart([]);
      setOrderNotes('');
      setOrderIsUrgent(false);
      setActionSuccessMessage('Branch Order submitted successfully! Status: PENDING');
      loadOrdersList();
    } catch (err: unknown) {
      console.error('Failed to submit order:', err);
      if (err instanceof Error) {
        setCreateOrderError(err.message);
      } else {
        setCreateOrderError('Failed to submit order. Please try again.');
      }
    } finally {
      setSubmittingOrder(false);
    }
  };

  // 6. Status Action Handler
  const handleUpdateStatus = async (
    order: BranchOrderDetailed,
    newStatus: OrderStatus,
    rejectionReasonText?: string
  ) => {
    setProcessingAction(true);
    try {
      await orderService.updateOrderStatus({
        order_id: order.id,
        new_status: newStatus,
        rejection_reason: rejectionReasonText,
        user_id: profile?.id,
      });

      setActionSuccessMessage(`Order #${order.order_number} marked as ${newStatus}.`);
      if (rejectingOrder) setRejectingOrder(null);
      if (selectedOrderDetails) {
        setSelectedOrderDetails((prev) =>
          prev ? { ...prev, status: newStatus, rejection_reason: rejectionReasonText || prev.rejection_reason } : null
        );
      }
      loadOrdersList();
    } catch (err: unknown) {
      console.error('Error updating order status:', err);
      alert(err instanceof Error ? err.message : 'Failed to update order status.');
    } finally {
      setProcessingAction(false);
    }
  };

  // 7. Filtered Orders Computation
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status Tab filter
      if (statusTab === 'URGENT' && !o.is_urgent) return false;
      if (statusTab === 'PENDING' && o.status !== 'PENDING') return false;
      if (statusTab === 'IN_PRODUCTION' && o.status !== 'ACCEPTED' && o.status !== 'PREPARING') return false;
      if (statusTab === 'READY' && o.status !== 'READY') return false;
      if (statusTab === 'DISPATCHED_COMPLETED' && o.status !== 'DISPATCHED' && o.status !== 'COMPLETED') return false;
      if (statusTab === 'REJECTED_CANCELLED' && o.status !== 'REJECTED' && o.status !== 'CANCELLED') return false;

      // Urgent checkbox filter
      if (urgentOnlyFilter && !o.is_urgent) return false;

      // Date filter
      if (dateFilter && o.required_date !== dateFilter) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesNum = o.order_number.toLowerCase().includes(q);
        const matchesBranch = (o.branch_name || '').toLowerCase().includes(q);
        const matchesItem = o.items.some(
          (i) =>
            (i.product_name || '').toLowerCase().includes(q) ||
            (i.variant_name || '').toLowerCase().includes(q)
        );
        if (!matchesNum && !matchesBranch && !matchesItem) return false;
      }

      return true;
    });
  }, [orders, statusTab, urgentOnlyFilter, dateFilter, searchQuery]);

  // Order Counts
  const counts = useMemo(() => {
    return {
      all: orders.length,
      urgent: orders.filter((o) => o.is_urgent).length,
      pending: orders.filter((o) => o.status === 'PENDING').length,
      inProduction: orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING').length,
      ready: orders.filter((o) => o.status === 'READY').length,
      dispatchedCompleted: orders.filter((o) => o.status === 'DISPATCHED' || o.status === 'COMPLETED').length,
      rejectedCancelled: orders.filter((o) => o.status === 'REJECTED' || o.status === 'CANCELLED').length,
    };
  }, [orders]);

  // Helper for Status Badges
  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">PENDING</Badge>;
      case 'ACCEPTED':
        return <Badge variant="primary">ACCEPTED</Badge>;
      case 'PREPARING':
        return <Badge variant="primary">PREPARING</Badge>;
      case 'READY':
        return <Badge variant="primary">READY FOR DISPATCH</Badge>;
      case 'DISPATCHED':
        return <Badge variant="primary">DISPATCHED</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">REJECTED</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary">CANCELLED</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-brand-700" />
            {isMainBranchOrOwner ? 'Main Branch Order Fulfillment' : 'Branch Procurement Orders'}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {isMainBranchOrOwner
              ? 'Receive, process, prepare, and dispatch next-day stock orders from sub-branches.'
              : `Order cakes and products from Main Branch for next-day fulfillment (${assignedBranch?.name || 'Branch'}).`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Branch Filter for Owner */}
          {isOwner && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 rounded-lg shadow-sm">
              <Building2 className="w-4 h-4 text-slate-500" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="text-xs font-semibold text-brand-900 bg-transparent outline-none cursor-pointer"
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

          {/* Create Order Button */}
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreateOrderError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Branch Order
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {actionSuccessMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold shadow-sm animate-scaleUp">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {ordersError && (
        <div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{ordersError}</span>
          </div>
          <button
            onClick={loadOrdersList}
            className="px-3 py-1 bg-white border border-rose-300 rounded-lg font-bold text-xs hover:bg-rose-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Quick Status Tabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 overflow-x-auto pb-1 scrollbar-none gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusTab('ALL')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              statusTab === 'ALL'
                ? 'border-brand-700 text-brand-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All Orders ({counts.all})
          </button>

          <button
            onClick={() => setStatusTab('URGENT')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              statusTab === 'URGENT'
                ? 'border-amber-600 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Urgent ({counts.urgent})
          </button>

          <button
            onClick={() => setStatusTab('PENDING')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              statusTab === 'PENDING'
                ? 'border-amber-600 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending ({counts.pending})
          </button>

          <button
            onClick={() => setStatusTab('IN_PRODUCTION')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              statusTab === 'IN_PRODUCTION'
                ? 'border-blue-600 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            In Production ({counts.inProduction})
          </button>

          <button
            onClick={() => setStatusTab('READY')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              statusTab === 'READY'
                ? 'border-indigo-600 text-indigo-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Ready ({counts.ready})
          </button>

          <button
            onClick={() => setStatusTab('DISPATCHED_COMPLETED')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              statusTab === 'DISPATCHED_COMPLETED'
                ? 'border-emerald-600 text-emerald-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Dispatched / Done ({counts.dispatchedCompleted})
          </button>

          <button
            onClick={() => setStatusTab('REJECTED_CANCELLED')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              statusTab === 'REJECTED_CANCELLED'
                ? 'border-rose-600 text-rose-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Rejected ({counts.rejectedCancelled})
          </button>
        </div>

        <button
          onClick={loadOrdersList}
          className="flex items-center gap-1.5 px-3 py-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors mb-1 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter / Search Controls Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 items-center gap-3 w-full">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, branch name, or product name..."
              className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Required Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-300 rounded-lg shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-600">Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs text-slate-800 bg-transparent outline-none cursor-pointer"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Urgent Only Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 shrink-0">
          <input
            type="checkbox"
            checked={urgentOnlyFilter}
            onChange={(e) => setUrgentOnlyFilter(e.target.checked)}
            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
          />
          <span className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Urgent Orders Only
          </span>
        </label>
      </div>

      {/* Orders List / Cards Grid */}
      {loadingOrders ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-brand-700 animate-spin mx-auto" />
          <p className="text-sm text-slate-600 font-medium">Loading branch orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
          <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No matching orders found</p>
          <p className="text-xs text-slate-500">
            {urgentOnlyFilter || searchQuery || dateFilter || statusTab !== 'ALL'
              ? 'Try adjusting your filters or search terms.'
              : 'Click "Create Branch Order" to submit a stock requisition to Main Branch.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

            return (
              <div
                key={order.id}
                className={`bg-white border rounded-xl p-4 shadow-sm transition-all hover:border-slate-300 ${
                  order.is_urgent ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Order Info */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-brand-950">
                        #{order.order_number}
                      </span>

                      {renderStatusBadge(order.status)}

                      {order.is_urgent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider">
                          <Flame className="w-3 h-3 text-amber-600" />
                          URGENT
                        </span>
                      )}

                      <span className="text-xs text-slate-500">
                        from <strong className="text-slate-800">{order.branch_name || 'Branch'}</strong>
                      </span>
                    </div>

                    {/* Meta: Dates & Created By */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Required:{' '}
                          <strong className="text-slate-900 font-bold">
                            {new Date(order.required_date || order.delivery_date || '').toLocaleDateString('en-IN', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Ordered: {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {order.creator_name ? ` by ${order.creator_name}` : ''}
                        </span>
                      </div>

                      {order.transfer_number && (
                        <div className="flex items-center gap-1 text-brand-800 font-semibold bg-brand-50 px-2 py-0.5 rounded">
                          <Truck className="w-3.5 h-3.5" />
                          <span>Transfer #{order.transfer_number}</span>
                        </div>
                      )}
                    </div>

                    {/* Items Snippet */}
                    <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-2 flex-wrap">
                      <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-900">{totalQty} units total:</span>
                      {order.items.map((item, idx) => (
                        <span key={item.id} className="text-slate-600">
                          <strong>{item.quantity}×</strong> {item.product_name} ({item.variant_name})
                          {idx < order.items.length - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>

                    {/* Order Notes / Rejection Reason */}
                    {order.notes && (
                      <p className="text-xs text-slate-600 italic">
                        Notes: "{order.notes}"
                      </p>
                    )}

                    {order.rejection_reason && (
                      <p className="text-xs font-medium text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                        Rejection Reason: {order.rejection_reason}
                      </p>
                    )}
                  </div>

                  {/* Right: Lifecycle Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {/* View Details Button */}
                    <button
                      onClick={() => setSelectedOrderDetails(order)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Details
                    </button>

                    {/* Main Branch Status Progressions */}
                    {isMainBranchOrOwner && (
                      <>
                        {order.status === 'PENDING' && (
                          <>
                            <button
                              disabled={processingAction}
                              onClick={() => handleUpdateStatus(order, 'ACCEPTED')}
                              className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Accept
                            </button>

                            <button
                              disabled={processingAction}
                              onClick={() => {
                                setRejectingOrder(order);
                                setRejectionReason('');
                              }}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </>
                        )}

                        {order.status === 'ACCEPTED' && (
                          <button
                            disabled={processingAction}
                            onClick={() => handleUpdateStatus(order, 'PREPARING')}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                          >
                            <Package className="w-3.5 h-3.5" />
                            Start Preparing
                          </button>
                        )}

                        {order.status === 'PREPARING' && (
                          <button
                            disabled={processingAction}
                            onClick={() => handleUpdateStatus(order, 'READY')}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Ready
                          </button>
                        )}

                        {order.status === 'READY' && (
                          <div className="flex items-center gap-1.5">
                            {onNavigate && (
                              <button
                                onClick={() => onNavigate('transfers')}
                                className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                Go to Transfers
                              </button>
                            )}

                            <button
                              disabled={processingAction}
                              onClick={() => handleUpdateStatus(order, 'DISPATCHED')}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Mark Dispatched
                            </button>
                          </div>
                        )}

                        {order.status === 'DISPATCHED' && (
                          <button
                            disabled={processingAction}
                            onClick={() => handleUpdateStatus(order, 'COMPLETED')}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Completed
                          </button>
                        )}
                      </>
                    )}

                    {/* Branch Employee Cancel Option for Pending/Accepted */}
                    {!isMainBranchOrOwner && (order.status === 'PENDING' || order.status === 'ACCEPTED') && (
                      <button
                        disabled={processingAction}
                        onClick={() => {
                          if (confirm(`Are you sure you want to cancel order #${order.order_number}?`)) {
                            handleUpdateStatus(order, 'CANCELLED');
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: CREATE BRANCH ORDER MODAL                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-scaleUp max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-brand-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-brand-300" />
                <div>
                  <h4 className="font-bold text-base">Create Branch Procurement Order</h4>
                  <p className="text-xs text-brand-300">
                    Requisition next-day cakes and bakery items from Main Branch.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-brand-300 hover:text-white hover:bg-brand-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {createOrderError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{createOrderError}</span>
                </div>
              )}

              {/* Order Metadata Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Branch */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ordering Branch
                  </label>
                  {isOwner ? (
                    <select
                      value={orderTargetBranchId}
                      onChange={(e) => setOrderTargetBranchId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.branch_code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                      {assignedBranch?.name || 'Assigned Branch'}
                    </div>
                  )}
                </div>

                {/* Required Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Required Delivery Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={orderRequiredDate}
                    onChange={(e) => setOrderRequiredDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Urgent Checkbox */}
                <div className="flex items-center pt-5">
                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer select-none w-full transition-colors ${
                      orderIsUrgent
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={orderIsUrgent}
                      onChange={(e) => setOrderIsUrgent(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span className="text-xs">Mark as URGENT</span>
                  </label>
                </div>
              </div>

              {/* Item Adder Section */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-brand-700" />
                  Add Products to Order
                </h5>

                {/* Product & Variant Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Product */}
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Product
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Variant */}
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Variant / Size
                    </label>
                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {(products.find((p) => p.id === selectedProductId)?.variants || []).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {/* Optional Item Note & Add Button */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Optional item note (e.g. eggless, message: Happy Birthday)..."
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddItemToCart}
                    className="px-4 py-1.5 bg-brand-900 hover:bg-brand-950 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>
              </div>

              {/* Order Cart Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Order Lines ({orderCart.length} items, {orderCart.reduce((s, i) => s + i.quantity, 0)} units)
                  </h5>
                </div>

                {orderCart.length === 0 ? (
                  <div className="p-6 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500">
                    No items added yet. Select a product and click "Add Item" above.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 font-bold text-slate-700">
                        <tr>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5">Variant</th>
                          <th className="p-2.5 text-center">Qty</th>
                          <th className="p-2.5">Notes</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orderCart.map((item) => (
                          <tr key={item.product_variant_id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">{item.product_name}</td>
                            <td className="p-2.5 text-slate-600">{item.variant_name}</td>
                            <td className="p-2.5 text-center font-bold text-brand-900 bg-brand-50/50">
                              {item.quantity}
                            </td>
                            <td className="p-2.5 text-slate-500 italic">{item.notes || '—'}</td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => handleRemoveCartItem(item.product_variant_id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Order Level Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  General Order Notes / Special Instructions
                </label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Please pack in extra refrigerated boxes for morning transit..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Note: Creating this order does <strong>not</strong> deduct Main Branch stock until dispatched.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingOrder || orderCart.length === 0}
                  onClick={handleSubmitOrder}
                  className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingOrder ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Submitting Order...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Submit Order ({orderCart.reduce((s, i) => s + i.quantity, 0)} units)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: REJECT ORDER MODAL (MANDATORY REASON)              */}
      {/* ════════════════════════════════════════════════════════════ */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="bg-rose-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-300" />
                <h4 className="font-bold text-base">Reject Order #{rejectingOrder.order_number}</h4>
              </div>
              <button
                onClick={() => setRejectingOrder(null)}
                className="text-rose-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                You are rejecting the order from <strong>{rejectingOrder.branch_name}</strong>. A clear rejection reason is mandatory so the branch employee understands why the order cannot be fulfilled.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rejection Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Raw materials unavailable; Main Branch kitchen at full capacity for tomorrow..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setRejectingOrder(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={processingAction || !rejectionReason.trim()}
                onClick={() => handleUpdateStatus(rejectingOrder, 'REJECTED', rejectionReason)}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors"
              >
                {processingAction ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: ORDER DETAILS / MANIFEST MODAL                     */}
      {/* ════════════════════════════════════════════════════════════ */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-scaleUp max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-brand-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-300" />
                <div>
                  <h4 className="font-bold text-base">Order #{selectedOrderDetails.order_number}</h4>
                  <p className="text-xs text-brand-300">
                    Ordered by {selectedOrderDetails.branch_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="text-brand-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Status Header */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500">Current Status:</span>
                  <div className="mt-1">{renderStatusBadge(selectedOrderDetails.status)}</div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500">Required Date:</span>
                  <p className="font-bold text-slate-900 text-sm">
                    {new Date(
                      selectedOrderDetails.required_date || selectedOrderDetails.delivery_date || ''
                    ).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Urgency Highlight */}
              {selectedOrderDetails.is_urgent && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-600" />
                  <span>HIGH PRIORITY / URGENT REQUISITION</span>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-1.5">
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Requisition Items ({selectedOrderDetails.items.length} lines)
                </h5>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5">Variant</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrderDetails.items.map((item) => (
                        <tr key={item.id}>
                          <td className="p-2.5 font-bold text-slate-900">{item.product_name}</td>
                          <td className="p-2.5 text-slate-600">{item.variant_name}</td>
                          <td className="p-2.5 text-center font-bold text-brand-900 bg-brand-50/50">
                            {item.quantity}
                          </td>
                          <td className="p-2.5 text-slate-500 italic">{item.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes & Audit History */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400">Created:</span>
                  <p className="font-semibold text-slate-800">
                    {new Date(selectedOrderDetails.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Created By:</span>
                  <p className="font-semibold text-slate-800">
                    {selectedOrderDetails.creator_name || 'Branch Employee'}
                  </p>
                </div>

                {selectedOrderDetails.accepted_by && (
                  <div>
                    <span className="text-slate-400">Accepted By:</span>
                    <p className="font-semibold text-slate-800">
                      {selectedOrderDetails.accepter_name || 'Main Branch'}
                    </p>
                  </div>
                )}

                {selectedOrderDetails.transfer_number && (
                  <div>
                    <span className="text-slate-400">Linked Stock Transfer:</span>
                    <p className="font-bold text-brand-900">
                      #{selectedOrderDetails.transfer_number} ({selectedOrderDetails.transfer_status})
                    </p>
                  </div>
                )}
              </div>

              {selectedOrderDetails.notes && (
                <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-semibold">Order Notes:</span>
                  <p className="text-slate-800 mt-0.5">{selectedOrderDetails.notes}</p>
                </div>
              )}

              {selectedOrderDetails.rejection_reason && (
                <div className="text-xs bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-900">
                  <span className="font-bold text-rose-800">Rejection Reason:</span>
                  <p className="mt-0.5">{selectedOrderDetails.rejection_reason}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
