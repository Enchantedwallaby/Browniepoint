import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CustomerReceipt } from '@/components/receipt/CustomerReceipt';
import { thermalPrintService, type PrinterStatusState } from '@/services/thermalPrintService';
import { productService, type ProductWithVariants } from '@/services/productService';
import { inventoryService } from '@/services/inventoryService';
import { branchService } from '@/services/branchService';
import { salesService, type SaleDetailed, type CreateSaleItemParam } from '@/services/salesService';
import type { Profile, Branch, PaymentMethod, FEFOInventoryRecord } from '@/types/database';
import {
  CreditCard,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Receipt,
  RefreshCw,
  Eye,
  Package,
  X,
  DollarSign,
  Printer,
  FileText,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface SalesPageProps {
  profile: Profile;
  assignedBranch: Branch | null;
}

interface CartItem extends CreateSaleItemParam {
  product_id: string;
  product_name: string;
  variant_name: string;
  available_stock: number;
  is_custom_cake_product: boolean;
}

export const SalesPage: React.FC<SalesPageProps> = ({ profile, assignedBranch }) => {
  const isOwner = profile.role === 'OWNER';
  const isBranchEmployee = profile.role === 'BRANCH_EMPLOYEE';

  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');

  // Branch Selection
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isBranchEmployee && assignedBranch ? assignedBranch.id : assignedBranch?.id || ''
  );

  // Products & Inventory state
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [fefoRecords, setFefoRecords] = useState<FEFOInventoryRecord[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);

  // POS State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [discountInput, setDiscountInput] = useState('0');
  const [amountCash, setAmountCash] = useState<string>('');
  const [amountOnline, setAmountOnline] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [recentCompletedSale, setRecentCompletedSale] = useState<SaleDetailed | null>(null);

  // History State
  const [salesHistory, setSalesHistory] = useState<SaleDetailed[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilterPayment, setHistoryFilterPayment] = useState<string>('ALL');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleDetailed | null>(null);

  // QZ Thermal Printer State
  const [printerStatus, setPrinterStatus] = useState<PrinterStatusState>(thermalPrintService.getStatus());
  const [printingThermal, setPrintingThermal] = useState(false);
  const [printNotice, setPrintNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Initialize QZ Tray WebSocket Connection
  useEffect(() => {
    const unsubscribe = thermalPrintService.subscribe((status) => {
      setPrinterStatus(status);
    });
    thermalPrintService.initConnection();
    return () => {
      unsubscribe();
    };
  }, []);

  // Direct ESC/POS Thermal Print Action via QZ Tray
  const handleDirectThermalPrint = async (saleToPrint?: SaleDetailed | null) => {
    const targetSale = saleToPrint || recentCompletedSale || selectedSaleDetail;
    if (!targetSale) return;

    setPrintingThermal(true);
    setPrintNotice(null);

    const res = await thermalPrintService.printReceipt(targetSale, selectedBranchName);
    setPrintingThermal(false);

    if (res.success) {
      setPrintNotice({ type: 'success', message: 'Receipt printed directly to POS-80C!' });
    } else {
      setPrintNotice({ type: 'error', message: res.error || 'Failed to print receipt.' });
    }
  };

  // 1. Fetch Branches for Owner selector
  useEffect(() => {
    async function loadBranches() {
      try {
        const bList = await branchService.getActiveBranches();
        setBranches(bList);
        if (!selectedBranchId && bList.length > 0) {
          const defaultBranch = bList.find((b) => b.branch_type === 'MAIN') || bList[0];
          setSelectedBranchId(defaultBranch.id);
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      }
    }
    loadBranches();
  }, []);

  // 2. Fetch Products & Inventory Stock when selectedBranchId changes
  const loadCatalogueAndStock = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoadingCatalogue(true);
    try {
      const [prodsData, stockData] = await Promise.all([
        productService.getActiveProducts(),
        inventoryService.getFEFOInventory(selectedBranchId),
      ]);
      setProducts(prodsData);
      setFefoRecords(stockData);
    } catch (err) {
      console.error('Failed to load catalogue or stock:', err);
    } finally {
      setLoadingCatalogue(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    loadCatalogueAndStock();
  }, [loadCatalogueAndStock]);

  // 3. Load Sales History
  const loadSalesHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const history = await salesService.getSalesHistory({
        branchId: isOwner ? (selectedBranchId || undefined) : selectedBranchId,
        limit: 100,
      });
      setSalesHistory(history);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedBranchId, isOwner]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadSalesHistory();
    }
  }, [activeTab, loadSalesHistory]);

  // Map available stock by product_variant_id
  const stockByVariant = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of fefoRecords) {
      const current = map.get(r.product_variant_id) || 0;
      map.set(r.product_variant_id, current + Number(r.quantity_available || 0));
    }
    return map;
  }, [fefoRecords]);

  // Product categories list
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => cats.add(p.category));
    return ['All', ...Array.from(cats).sort()];
  }, [products]);

  // Filtered Products for POS
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.variants.some((v) => v.name.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Add Item to Cart
  const handleAddToCart = (product: ProductWithVariants, variant: ProductWithVariants['variants'][0]) => {
    setCheckoutError(null);
    const existingIndex = cart.findIndex((i) => i.product_variant_id === variant.id);
    const availableStock = stockByVariant.get(variant.id) || 0;

    // Determine default pricing
    const activeRule = (variant.pricing_rules || []).find((r) => r.active);
    const isCustom = activeRule?.pricing_type === 'CUSTOM' || product.name === 'Custom Cake';
    const hasPrice = activeRule?.base_price != null;

    if (!isCustom && !hasPrice) {
      setCheckoutError(`"${product.name} - ${variant.name}" has no selling price configured.`);
      return;
    }

    const basePrice = activeRule?.base_price ?? (isCustom ? 0 : 0);

    if (existingIndex > -1) {
      // Increase quantity if stock permits
      const item = cart[existingIndex];
      if (!isCustom && item.quantity + 1 > availableStock) {
        setCheckoutError(`Cannot add more. Only ${availableStock} units available in stock.`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex] = {
        ...item,
        quantity: item.quantity + 1,
      };
      setCart(updated);
    } else {
      // Check initial stock availability for standard items
      if (!isCustom && availableStock <= 0) {
        setCheckoutError(`"${product.name} - ${variant.name}" is currently out of stock.`);
        return;
      }

      setCart([
        ...cart,
        {
          product_id: product.id,
          product_variant_id: variant.id,
          product_name: product.name,
          variant_name: variant.name,
          quantity: 1,
          unit_price: basePrice,
          is_custom_price: isCustom,
          available_stock: availableStock,
          is_custom_cake_product: product.name === 'Custom Cake',
        },
      ]);
    }
  };

  // Update Item Quantity in Cart
  const handleUpdateQuantity = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_variant_id === variantId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (!item.is_custom_price && newQty > item.available_stock) {
              setCheckoutError(`Stock limit reached (${item.available_stock} units available).`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Update Custom Price for custom items
  const handleUpdateCustomPrice = (variantId: string, priceStr: string) => {
    const val = parseFloat(priceStr);
    const numPrice = isNaN(val) || val < 0 ? 0 : val;
    setCart((prev) =>
      prev.map((item) =>
        item.product_variant_id === variantId
          ? { ...item, unit_price: numPrice }
          : item
      )
    );
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.product_variant_id !== variantId));
  };

  // Cart Calculations
  const grandTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [cart]);
  const discountAmount = Math.min(
    grandTotal,
    Math.max(0, Math.round((Number(discountInput) || 0) * 100) / 100)
  );
  const finalTotal = Math.max(0, Math.round((grandTotal - discountAmount) * 100) / 100);

  // Mixed Payment Live Balance calculation
  const mixedCashVal = parseFloat(amountCash) || 0;
  const mixedOnlineVal = parseFloat(amountOnline) || 0;
  const mixedTotalEntered = Math.round((mixedCashVal + mixedOnlineVal) * 100) / 100;
  const mixedDiff = Math.round((finalTotal - mixedTotalEntered) * 100) / 100;
  const cashTendered = cashReceived.trim() ? Number(cashReceived) || 0 : finalTotal;
  const cashChange = Math.max(0, Math.round((cashTendered - finalTotal) * 100) / 100);

  // Checkout Action
  const handleCheckout = async () => {
    setCheckoutError(null);

    if (!selectedBranchId) {
      setCheckoutError('Please select a branch before completing the sale.');
      return;
    }

    if (cart.length === 0) {
      setCheckoutError('Your cart is empty.');
      return;
    }

    // Validate prices
    for (const item of cart) {
      if (!item.is_custom_price && (item.unit_price === null || item.unit_price === undefined || item.unit_price <= 0)) {
        setCheckoutError(`"${item.product_name} - ${item.variant_name}" has no selling price configured.`);
        return;
      }
    }

    // Validate Mixed Payment
    if (paymentMethod === 'MIXED') {
      if (Math.abs(mixedDiff) > 0.01) {
        setCheckoutError(
          `Mixed payment amounts do not equal total. Total required: ₹${finalTotal}, Current sum: ₹${mixedTotalEntered} (${mixedDiff > 0 ? `₹${mixedDiff} remaining` : `₹${Math.abs(mixedDiff)} over`}).`
        );
        return;
      }
    }

    if (paymentMethod === 'CASH' && cashTendered < finalTotal) {
      setCheckoutError(`Cash received must be at least ₹${finalTotal.toFixed(2)}.`);
      return;
    }

    setProcessingCheckout(true);

    try {
      const completed = await salesService.createSale({
        branch_id: selectedBranchId,
        payment_method: paymentMethod,
        discount_amount: discountAmount,
        amount_cash: paymentMethod === 'CASH' ? finalTotal : paymentMethod === 'MIXED' ? mixedCashVal : 0,
        amount_online:
          paymentMethod === 'MIXED'
            ? mixedOnlineVal
            : paymentMethod === 'CASH'
            ? 0
            : finalTotal,
        customer_name: customerName,
        notes: saleNotes,
        performed_by: profile.id,
        items: cart.map((i) => ({
          product_variant_id: i.product_variant_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          is_custom_price: i.is_custom_price,
          product_name: i.product_name,
          variant_name: i.variant_name,
        })),
      });

      // Show receipt modal & clear state
      setRecentCompletedSale(completed);
      setCart([]);
      setDiscountInput('0');
      setAmountCash('');
      setAmountOnline('');
      setCashReceived('');
      setCustomerName('');
      setSaleNotes('');

      // Auto direct thermal print via QZ Tray if POS-80C is ready
      if (thermalPrintService.getStatus().printerFound) {
        handleDirectThermalPrint(completed);
      }

      // Reload inventory stock to update available counts
      loadCatalogueAndStock();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCheckoutError(err.message);
      } else {
        setCheckoutError('Failed to process sale. Please check stock and try again.');
      }
    } finally {
      setProcessingCheckout(false);
    }
  };

  // Filtered Sales History List
  const filteredHistory = useMemo(() => {
    return salesHistory.filter((s) => {
      const matchesPayment =
        historyFilterPayment === 'ALL' || s.payment_method === historyFilterPayment;
      const matchesStatus = historyFilterStatus === 'ALL' || s.status === historyFilterStatus;
      const q = historySearchQuery.toLowerCase().trim();
      const matchesQ =
        !q ||
        s.id.toLowerCase().includes(q) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.branch_name && s.branch_name.toLowerCase().includes(q)) ||
        (s.performed_by_name && s.performed_by_name.toLowerCase().includes(q));
      return matchesPayment && matchesStatus && matchesQ;
    });
  }, [salesHistory, historyFilterPayment, historyFilterStatus, historySearchQuery]);

  // History Statistics
  const historyStats = useMemo(() => {
    let revenue = 0;
    let cash = 0;
    let online = 0;
    for (const s of filteredHistory) {
      if (s.status === 'COMPLETED') {
        revenue += s.total_amount;
        cash += s.amount_cash;
        online += s.amount_online;
      }
    }
    return { revenue, cash, online, count: filteredHistory.length };
  }, [filteredHistory]);

  const selectedBranchName =
    branches.find((b) => b.id === selectedBranchId)?.name || 'Assigned Branch';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-brand-700" />
            POS Terminal & Sales Operations
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Point of Sale checkout, FEFO inventory stock reduction, custom cake pricing, and receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* QZ Thermal Printer Status Badge */}
          <div
            className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-slate-300 rounded-lg shadow-sm"
            title={printerStatus.lastError ?? printerStatus.statusMessage}
          >
            {printerStatus.printerFound ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                POS-80C Ready
              </span>
            ) : printerStatus.qzConnected ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Wifi className="w-3.5 h-3.5 text-amber-600" />
                QZ Connected (POS-80C Not Found)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                QZ Offline
              </span>
            )}
            <button
              onClick={() => thermalPrintService.initConnection()}
              className="p-1 text-slate-400 hover:text-brand-900 rounded transition-colors ml-1"
              title="Refresh / Reconnect QZ Tray Printer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Branch Scoping Selector */}
          {isOwner && branches.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 rounded-lg shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="text-sm font-semibold text-brand-900 bg-transparent outline-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.branch_code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'pos'
                ? 'border-brand-700 text-brand-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            POS Checkout Terminal
            {cart.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-brand-700 text-white rounded-full font-bold">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-brand-700 text-brand-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Sales History & Receipts
          </button>
        </div>

        <button
          onClick={() => (activeTab === 'pos' ? loadCatalogueAndStock() : loadSalesHistory())}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors mb-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB 1: POS CHECKOUT TERMINAL                                */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: PRODUCT CATALOGUE GRID (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Category Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search product name, variant, category..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-brand-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            {loadingCatalogue ? (
              <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-brand-700 animate-spin mx-auto" />
                <p className="text-sm text-slate-600 font-medium">Loading products and FEFO inventory...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                <Package className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">No products found</p>
                <p className="text-xs text-slate-500">Try adjusting your category filter or search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[650px] overflow-y-auto pr-1">
                {filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-white border border-slate-200 hover:border-brand-300 rounded-xl p-3.5 flex flex-col justify-between shadow-sm transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          {prod.name}
                        </h4>
                        <Badge variant="secondary" className="text-[10px] shrink-0 py-0.5 px-1.5">
                          {prod.category}
                        </Badge>
                      </div>

                      {prod.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {prod.description}
                        </p>
                      )}
                    </div>

                    {/* Variants Action List */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      {prod.variants.map((v) => {
                        const stockAvailable = stockByVariant.get(v.id) || 0;
                        const activeRule = (v.pricing_rules || []).find((r) => r.active);
                        const isCustom = activeRule?.pricing_type === 'CUSTOM' || prod.name === 'Custom Cake';
                        const price = activeRule?.base_price;
                        const hasPrice = price != null;
                        const isNoSellingPrice = !isCustom && !hasPrice;
                        const isOutOfStock = !isCustom && stockAvailable <= 0;

                        return (
                          <div
                            key={v.id}
                            className="flex items-center justify-between gap-2 bg-slate-50 hover:bg-brand-50/50 p-2 rounded-lg text-xs transition-colors"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800">{v.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-bold text-brand-900">
                                  {isCustom ? (
                                    <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium text-[10px]">
                                      Custom Price
                                    </span>
                                  ) : hasPrice ? (
                                    `₹${price}`
                                  ) : (
                                    <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-medium text-[10px]">
                                      No Selling Price
                                    </span>
                                  )}
                                </span>
                                {!isCustom && (
                                  <span
                                    className={`text-[10px] font-medium ${
                                      stockAvailable > 5
                                        ? 'text-emerald-700'
                                        : stockAvailable > 0
                                        ? 'text-amber-700 font-semibold'
                                        : 'text-rose-600 font-bold'
                                    }`}
                                  >
                                    {stockAvailable > 0 ? `Stock: ${stockAvailable}` : 'Out of Stock'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => handleAddToCart(prod, v)}
                              disabled={isOutOfStock || isNoSellingPrice}
                              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                isOutOfStock || isNoSellingPrice
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-brand-700 hover:bg-brand-800 text-white shadow-sm'
                              }`}
                              title={isNoSellingPrice ? 'This item has no selling price configured.' : isOutOfStock ? 'Out of stock' : 'Add to cart'}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add
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

          {/* RIGHT: CART & CHECKOUT PANEL (5 Cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-md p-4 space-y-4 sticky top-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-brand-700" />
                <h3 className="font-bold text-slate-900 text-base">Current Cart</h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Error Banner */}
            {checkoutError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShoppingCart className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Your cart is empty</p>
                <p className="text-xs text-slate-400">Select items from the catalogue on the left to start sale.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.product_variant_id} className="pt-2.5 first:pt-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 leading-tight">
                          {item.product_name}
                        </h5>
                        <p className="text-[11px] text-slate-500">{item.variant_name}</p>
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(item.product_variant_id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50">
                        <button
                          onClick={() => handleUpdateQuantity(item.product_variant_id, -1)}
                          className="px-2 py-1 text-slate-600 hover:text-brand-900"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 py-0.5 text-xs font-bold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.product_variant_id, 1)}
                          className="px-2 py-1 text-slate-600 hover:text-brand-900"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Price Input or Display */}
                      <div className="text-right">
                        {item.is_custom_price ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500 font-semibold">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="10"
                              value={item.unit_price || ''}
                              onChange={(e) =>
                                handleUpdateCustomPrice(item.product_variant_id, e.target.value)
                              }
                              placeholder="Price"
                              className="w-20 px-2 py-1 border border-amber-400 bg-amber-50 rounded text-xs font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-600">
                            {item.quantity} × ₹{item.unit_price}
                          </span>
                        )}
                        <p className="text-xs font-bold text-brand-900 mt-0.5">
                          ₹{(item.quantity * item.unit_price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PAYMENT & CHECKOUT SECTION */}
            {cart.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div>
                  <label htmlFor="sale-discount" className="block text-xs font-bold text-slate-700 mb-1">
                    Discount (₹)
                  </label>
                  <input
                    id="sale-discount"
                    type="number"
                    min="0"
                    max={grandTotal}
                    step="0.01"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    onBlur={() => setDiscountInput(discountAmount.toFixed(2))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span>Subtotal</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span>Discount</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-brand-200">
                    <span className="text-sm font-bold text-brand-950">TOTAL</span>
                    <span className="text-xl font-black text-brand-900">₹{finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Method Tabs */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['CASH', 'UPI', 'CARD', 'MIXED'] as PaymentMethod[]).map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setPaymentMethod(pm)}
                        className={`py-2 px-1 text-center text-xs font-bold rounded-lg border transition-all ${
                          paymentMethod === pm
                            ? 'bg-brand-900 text-white border-brand-900 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {pm}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'CASH' && (
                  <div className="space-y-1.5">
                    <label htmlFor="cash-received" className="block text-xs font-bold text-slate-700">
                      Cash Received (₹)
                    </label>
                    <input
                      id="cash-received"
                      type="number"
                      min={finalTotal}
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder={finalTotal.toFixed(2)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="text-xs text-slate-600">Change: ₹{cashChange.toFixed(2)}</p>
                  </div>
                )}

                {/* Mixed Payment Split Inputs */}
                {paymentMethod === 'MIXED' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-amber-900 flex items-center justify-between">
                      <span>Mixed Payment Split</span>
                      <span className="text-[11px] font-normal text-amber-800">Must equal ₹{finalTotal.toFixed(2)}</span>
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          Cash Portion (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={amountCash}
                          onChange={(e) => setAmountCash(e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          Online / UPI Portion (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={amountOnline}
                          onChange={(e) => setAmountOnline(e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200/60 font-medium">
                      <span className="text-amber-800">Total Split Entered: ₹{mixedTotalEntered}</span>
                      <span
                        className={
                          Math.abs(mixedDiff) <= 0.01
                            ? 'text-emerald-700 font-bold'
                            : 'text-rose-700 font-bold'
                        }
                      >
                        {Math.abs(mixedDiff) <= 0.01
                          ? '✓ Balanced'
                          : mixedDiff > 0
                          ? `₹${mixedDiff.toFixed(2)} left`
                          : `₹${Math.abs(mixedDiff).toFixed(2)} over`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Optional Customer Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Customer Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Complete Sale Button */}
                <button
                  onClick={handleCheckout}
                  disabled={processingCheckout || cart.length === 0}
                  className="w-full py-3 px-4 bg-brand-700 hover:bg-brand-800 text-white font-bold text-sm rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processingCheckout ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing Sale & Deducting Stock...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Sale (₹{finalTotal.toFixed(2)})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SALES HISTORY & RECEIPTS                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Total Sales Revenue</p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                    ₹{historyStats.revenue.toFixed(2)}
                  </h3>
                </div>
                <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Cash Received</p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                    ₹{historyStats.cash.toFixed(2)}
                  </h3>
                </div>
                <div className="p-2.5 bg-blue-100 rounded-xl text-blue-700">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Online / UPI Received</p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                    ₹{historyStats.online.toFixed(2)}
                  </h3>
                </div>
                <div className="p-2.5 bg-purple-100 rounded-xl text-purple-700">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Completed Transactions</p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                    {historyStats.count}
                  </h3>
                </div>
                <div className="p-2.5 bg-brand-100 rounded-xl text-brand-800">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </div>

          {/* History Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Search Receipt ID or customer..."
                className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
              <span className="text-xs font-semibold text-slate-500">Payment:</span>
              <select
                value={historyFilterPayment}
                onChange={(e) => setHistoryFilterPayment(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 bg-white"
              >
                <option value="ALL">All Payments</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="ONLINE">Online</option>
                <option value="MIXED">Mixed</option>
              </select>

              <span className="text-xs font-semibold text-slate-500 ml-2">Status:</span>
              <select
                value={historyFilterStatus}
                onChange={(e) => setHistoryFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="RETURNED">Returned</option>
                <option value="VOIDED">Voided</option>
              </select>
            </div>
          </div>

          {/* History Transactions Table */}
          {loadingHistory ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-brand-700 animate-spin mx-auto" />
              <p className="text-sm text-slate-600 font-medium">Loading sales history log...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <Card className="text-center py-12 px-4 border-dashed border-2 border-slate-200">
              <Receipt className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-slate-800">No Sales Records Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Completed POS sales for {selectedBranchName} will be recorded here.
              </p>
            </Card>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Receipt ID</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Branch</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Payment Breakdown</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-brand-900">
                          #{sale.id.slice(0, 8)}
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {new Date(sale.sale_date).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        <td className="py-3 px-4 font-medium text-slate-800">
                          {sale.branch_name || selectedBranchName}
                        </td>

                        <td className="py-3 px-4 text-slate-700">
                          {sale.customer_name ? (
                            <span className="font-semibold text-slate-900">{sale.customer_name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Walk-in</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={
                                sale.payment_method === 'CASH'
                                  ? 'success'
                                  : sale.payment_method === 'MIXED'
                                  ? 'warning'
                                  : 'primary'
                              }
                            >
                              {sale.payment_method}
                            </Badge>
                            {sale.payment_method === 'MIXED' && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                (Cash: ₹{sale.amount_cash} | Online: ₹{sale.amount_online})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          ₹{sale.total_amount.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedSaleDetail(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-800 rounded-lg font-semibold transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Receipt
                          </button>
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
      {/* RECEIPT DETAILS MODAL                                        */}
      {/* ════════════════════════════════════════════════════════════ */}
      {(recentCompletedSale || selectedSaleDetail) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-brand-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand-300" />
                <div>
                  <h3 className="font-bold text-base">Sales Receipt</h3>
                  <p className="text-xs text-brand-300 font-mono">
                    #{((recentCompletedSale || selectedSaleDetail)!).id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setRecentCompletedSale(null);
                  setSelectedSaleDetail(null);
                }}
                className="text-brand-300 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div className="text-center pb-3 border-b border-dashed border-slate-200">
                <h4 className="font-extrabold text-slate-900 text-lg tracking-tight">
                  BROWNIE POINT
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {((recentCompletedSale || selectedSaleDetail)!).branch_name || selectedBranchName}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {new Date(
                    ((recentCompletedSale || selectedSaleDetail)!).sale_date
                  ).toLocaleString('en-IN', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </p>
              </div>

              {/* Customer & Payment Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500">Customer:</span>
                  <p className="font-bold text-slate-900">
                    {((recentCompletedSale || selectedSaleDetail)!).customer_name || 'Walk-in Customer'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Payment Method:</span>
                  <p className="font-bold text-brand-900">
                    {((recentCompletedSale || selectedSaleDetail)!).payment_method}
                  </p>
                </div>

                {((recentCompletedSale || selectedSaleDetail)!).payment_method === 'MIXED' && (
                  <>
                    <div>
                      <span className="text-slate-500">Cash Paid:</span>
                      <p className="font-semibold text-slate-800">
                        ₹{((recentCompletedSale || selectedSaleDetail)!).amount_cash}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500">Online Paid:</span>
                      <p className="font-semibold text-slate-800">
                        ₹{((recentCompletedSale || selectedSaleDetail)!).amount_online}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Purchased Items
                </h5>

                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="p-2">Item</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Price</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {((recentCompletedSale || selectedSaleDetail)!).items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <span className="font-bold text-slate-900">{item.product_name}</span>
                            <div className="text-[10px] text-slate-500">
                              {item.variant_name}
                              {item.batch_number && (
                                <span className="ml-1 text-slate-400">({item.batch_number})</span>
                              )}
                            </div>
                            {item.is_custom_price && (
                              <span className="inline-block mt-0.5 text-[9px] bg-amber-100 text-amber-900 font-semibold px-1 rounded">
                                Custom Price {item.entered_by_name ? `by ${item.entered_by_name}` : ''}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center font-semibold">{item.quantity}</td>
                          <td className="p-2 text-right">₹{item.unit_price_snapshot}</td>
                          <td className="p-2 text-right font-bold text-slate-900">
                            ₹{(item.line_total || item.quantity * item.unit_price_snapshot).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Print Status Notice Alert */}
              {printNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
                    printNotice.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : printNotice.type === 'error'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {printNotice.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{printNotice.message}</span>
                  </div>
                  <button onClick={() => setPrintNotice(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Total Summary */}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="font-bold text-slate-900 text-sm">Total Paid</span>
                <span className="font-black text-brand-900 text-lg">
                  ₹{((recentCompletedSale || selectedSaleDetail)!).total_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Direct QZ Thermal Print Button */}
                <button
                  onClick={() => handleDirectThermalPrint()}
                  disabled={printingThermal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  title="Send receipt directly to USB POS-80C printer via QZ Tray without print dialog"
                >
                  <Printer className="w-4 h-4" />
                  {printingThermal ? 'Printing to POS-80C...' : 'Print Receipt (POS-80C)'}
                </button>

                {/* Optional Browser Print Fallback */}
                <button
                  onClick={() => window.print()}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1"
                  title="Fallback Browser Print"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Browser Print
                </button>
              </div>

              <button
                onClick={() => {
                  setRecentCompletedSale(null);
                  setSelectedSaleDetail(null);
                  setPrintNotice(null);
                }}
                className="px-4 py-2 bg-brand-900 hover:bg-brand-950 text-white font-bold text-xs rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Container — hidden on screen, visible only during window.print() */}
      {(recentCompletedSale || selectedSaleDetail) && (
        <div className="receipt-print-wrapper">
          <CustomerReceipt
            sale={(recentCompletedSale || selectedSaleDetail)!}
            branchNameFallback={selectedBranchName}
          />
        </div>
      )}
    </div>
  );
};
