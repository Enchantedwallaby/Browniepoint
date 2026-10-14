import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Scale,
  Cake,
} from 'lucide-react';

interface SalesPageProps {
  profile: Profile;
  assignedBranch: Branch | null;
}

interface CartItem extends CreateSaleItemParam {
  cart_item_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  available_stock: number;
  is_custom_cake_product: boolean;
  weight_kg?: number;
  per_kg_rate?: number;
  custom_item_name?: string;
  deduct_qty?: number;
  raw_quantity?: string;
}

export type DiscountType = 'FIXED' | 'PERCENT';

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
  const effectiveBranchId = isOwner ? selectedBranchId : assignedBranch?.id ?? '';
  const activeSaleBranch =
    assignedBranch?.id === effectiveBranchId
      ? assignedBranch
      : branches.find((branch) => branch.id === effectiveBranchId) ?? null;
  const isSaleBranchResolved = Boolean(effectiveBranchId && activeSaleBranch);
  const isMainBranchSale =
    isSaleBranchResolved && activeSaleBranch?.branch_type === 'MAIN';
  const catalogueScope = `${profile.id}:${effectiveBranchId}`;

  // Products & Inventory state
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [fefoRecords, setFefoRecords] = useState<FEFOInventoryRecord[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [loadedCatalogueScope, setLoadedCatalogueScope] = useState<string | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [catalogueErrorScope, setCatalogueErrorScope] = useState<string | null>(null);
  const catalogueRequestId = useRef(0);

  // POS State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [discountType, setDiscountType] = useState<DiscountType>('FIXED');
  const [discountInput, setDiscountInput] = useState('0');
  const [amountCash, setAmountCash] = useState<string>('');
  const [amountOnline, setAmountOnline] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [recentCompletedSale, setRecentCompletedSale] = useState<SaleDetailed | null>(null);

  // Custom Weight Modal State
  const [weightModalProduct, setWeightModalProduct] = useState<ProductWithVariants | null>(null);
  const [customWeightInput, setCustomWeightInput] = useState<string>('1');
  const [weightCakeQty, setWeightCakeQty] = useState<number>(1);
  const [weightModalError, setWeightModalError] = useState<string | null>(null);

  // Custom Cake Modal State
  const [showCustomCakeModal, setShowCustomCakeModal] = useState(false);
  const [customCakeDescription, setCustomCakeDescription] = useState('');
  const [customCakeWeight, setCustomCakeWeight] = useState('');
  const [customCakePrice, setCustomCakePrice] = useState('');
  const [customCakeQty, setCustomCakeQty] = useState<number>(1);
  const [customCakeCustomerName, setCustomCakeCustomerName] = useState('');
  const [customCakeCustomerPhone, setCustomCakeCustomerPhone] = useState('');
  const [customCakeInstructions, setCustomCakeInstructions] = useState('');
  const [customCakeError, setCustomCakeError] = useState<string | null>(null);

  // History State
  const [salesHistory, setSalesHistory] = useState<SaleDetailed[]>([]);
  const salesHistoryRequestId = useRef(0);
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

  useEffect(() => {
    setSelectedBranchId(assignedBranch?.id ?? '');
  }, [profile.id, assignedBranch?.id]);

  useEffect(() => {
    setProducts([]);
    setFefoRecords([]);
    setLoadedCatalogueScope(null);
    setCatalogueError(null);
    setCatalogueErrorScope(null);
    setSalesHistory([]);
    setSelectedSaleDetail(null);
    setRecentCompletedSale(null);
    setCart([]);
    setDiscountType('FIXED');
    setDiscountInput('0');
    setAmountCash('');
    setAmountOnline('');
    setCashReceived('');
    setCustomerName('');
    setCustomerPhone('');
    setSaleNotes('');
    setCheckoutError(null);
    setPrintNotice(null);
    setWeightModalProduct(null);
    setShowCustomCakeModal(false);
  }, [profile.id, effectiveBranchId]);

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

  // 2. Fetch Products & Inventory Stock for the confirmed user/branch scope
  const loadCatalogueAndStock = useCallback(async () => {
    const requestId = ++catalogueRequestId.current;
    setProducts([]);
    setFefoRecords([]);
    setLoadedCatalogueScope(null);
    setCatalogueError(null);
    setCatalogueErrorScope(null);
    if (!effectiveBranchId || !isSaleBranchResolved) {
      setLoadingCatalogue(false);
      return;
    }

    setLoadingCatalogue(true);
    try {
      const [prodsData, stockData] = await Promise.all([
        productService.getActiveProducts(),
        isMainBranchSale
          ? Promise.resolve([])
          : inventoryService.getFEFOInventory(effectiveBranchId),
      ]);
      if (requestId !== catalogueRequestId.current) return;
      setProducts(prodsData);
      setFefoRecords(stockData);
      setLoadedCatalogueScope(catalogueScope);
    } catch (err) {
      console.error('Failed to load catalogue or stock:', err);
      if (requestId === catalogueRequestId.current) {
        setCatalogueError(
          err instanceof Error ? err.message : 'Failed to load products and inventory.'
        );
        setCatalogueErrorScope(catalogueScope);
      }
    } finally {
      if (requestId === catalogueRequestId.current) {
        setLoadingCatalogue(false);
      }
    }
  }, [
    effectiveBranchId,
    isSaleBranchResolved,
    isMainBranchSale,
    catalogueScope,
  ]);

  useEffect(() => {
    void loadCatalogueAndStock();
    return () => {
      catalogueRequestId.current += 1;
    };
  }, [loadCatalogueAndStock]);

  // 3. Load Sales History
  const loadSalesHistory = useCallback(async () => {
    const requestId = ++salesHistoryRequestId.current;
    setLoadingHistory(true);
    try {
      const history = await salesService.getSalesHistory({
        branchId: isOwner ? (effectiveBranchId || undefined) : effectiveBranchId,
        limit: 100,
      });
      if (requestId !== salesHistoryRequestId.current) return;
      setSalesHistory(history);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      if (requestId === salesHistoryRequestId.current) {
        setLoadingHistory(false);
      }
    }
  }, [effectiveBranchId, isOwner]);

  useEffect(() => {
    if (activeTab === 'history') {
      void loadSalesHistory();
      return () => {
        salesHistoryRequestId.current += 1;
      };
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
  const catalogueReady =
    isSaleBranchResolved && loadedCatalogueScope === catalogueScope;

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

  // Helper: determine if a product supports custom weight sales
  const supportsVariableWeight = (product: ProductWithVariants): boolean => {
    if (product.name === 'Custom Cake') return false;
    const cat = product.category.toLowerCase();
    if (cat.includes('cake')) return true;
    return product.variants.some((v) => {
      const n = v.name.toLowerCase();
      return n.includes('kg') || v.quantity_unit === 'KG' || v.quantity_unit === 'HALF_KG';
    });
  };

  // Helper: determine rate per kg from existing pricing rules
  const getPerKgRate = (product: ProductWithVariants): { rate: number; referenceVariant: ProductWithVariants['variants'][0] | null } => {
    // 1. Look for 1 KG variant
    const oneKgVariant =
      product.variants.find((v) => {
        const n = v.name.toLowerCase();
        return (n.includes('1 kg') || n.includes('1kg')) && !n.includes('0.5');
      }) ||
      product.variants.find((v) => v.quantity_unit === 'KG' && Number(v.quantity_value) === 1);

    if (oneKgVariant) {
      const rule = (oneKgVariant.pricing_rules || []).find((r) => r.active && r.base_price != null);
      if (rule?.base_price != null) {
        return { rate: Number(rule.base_price), referenceVariant: oneKgVariant };
      }
    }

    // 2. Look for PER_KG pricing rule
    for (const v of product.variants) {
      const rule = (v.pricing_rules || []).find((r) => r.active && r.pricing_type === 'PER_KG' && r.base_price != null);
      if (rule?.base_price != null) {
        return { rate: Number(rule.base_price), referenceVariant: v };
      }
    }

    // 3. Look for 0.5 KG variant (rate = base_price * 2)
    const halfKgVariant = product.variants.find((v) => {
      const n = v.name.toLowerCase();
      return n.includes('0.5 kg') || n.includes('half kg') || v.quantity_unit === 'HALF_KG';
    });

    if (halfKgVariant) {
      const rule = (halfKgVariant.pricing_rules || []).find((r) => r.active && r.base_price != null);
      if (rule?.base_price != null) {
        return { rate: Number(rule.base_price) * 2, referenceVariant: halfKgVariant };
      }
    }

    // 4. Fallback to any active priced variant
    for (const v of product.variants) {
      const rule = (v.pricing_rules || []).find((r) => r.active && r.base_price != null);
      if (rule?.base_price != null) {
        return { rate: Number(rule.base_price), referenceVariant: v };
      }
    }

    return { rate: 0, referenceVariant: null };
  };

  // Open Custom Weight Modal for Cake
  const handleOpenWeightModal = (product: ProductWithVariants) => {
    setWeightModalProduct(product);
    setCustomWeightInput('1');
    setWeightCakeQty(1);
    setWeightModalError(null);
  };

  // Add Item to Cart (Standard Predefined Variant)
  const handleAddToCart = (product: ProductWithVariants, variant: ProductWithVariants['variants'][0]) => {
    setCheckoutError(null);
    const cartItemId = `${variant.id}-std`;
    const existingIndex = cart.findIndex((i) => i.cart_item_id === cartItemId);
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
      if (!isMainBranchSale && !isCustom && item.quantity + 1 > availableStock) {
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
      if (!isMainBranchSale && !isCustom && availableStock <= 0) {
        setCheckoutError(`"${product.name} - ${variant.name}" is currently out of stock.`);
        return;
      }

      setCart([
        ...cart,
        {
          cart_item_id: cartItemId,
          product_id: product.id,
          product_variant_id: variant.id,
          product_name: product.name,
          variant_name: variant.name,
          quantity: 1,
          unit_price: basePrice,
          is_custom_price: isCustom,
          available_stock: isMainBranchSale ? Number.POSITIVE_INFINITY : availableStock,
          is_custom_cake_product: product.name === 'Custom Cake',
        },
      ]);
    }
  };

  // Add Custom Weight Cake to Cart
  const handleAddCustomWeightToCart = (product: ProductWithVariants, weight: number, qty: number) => {
    setCheckoutError(null);
    const { rate, referenceVariant } = getPerKgRate(product);

    if (!referenceVariant || rate <= 0) {
      setWeightModalError(`No per-kg rate found for "${product.name}".`);
      return;
    }

    if (!weight || weight <= 0) {
      setWeightModalError('Please enter a valid cake weight greater than 0 kg.');
      return;
    }

    if (!qty || qty <= 0) {
      setWeightModalError('Quantity must be at least 1.');
      return;
    }

    // Precise rupee calculation: weight * rate
    const calculatedUnitPrice = Math.round(weight * rate * 100) / 100;
    const totalWeightToDeduct = Math.round(weight * qty * 1000) / 1000;
    const availableStock = stockByVariant.get(referenceVariant.id) || 0;

    // Check stock for sub-branches (Main Branch does not require inventory balance)
    if (!isMainBranchSale && totalWeightToDeduct > availableStock) {
      setWeightModalError(
        `Insufficient stock for "${product.name}". Requested total ${totalWeightToDeduct} kg (across ${qty} cake${qty > 1 ? 's' : ''}), but available stock is ${availableStock} kg.`
      );
      return;
    }

    const cartItemId = `${referenceVariant.id}-wt-${weight}-${Date.now()}`;
    const weightLabel = `${weight} kg`;

    setCart((prev) => [
      ...prev,
      {
        cart_item_id: cartItemId,
        product_id: product.id,
        product_variant_id: referenceVariant.id,
        product_name: product.name,
        variant_name: weightLabel,
        quantity: qty,
        unit_price: calculatedUnitPrice,
        weight_kg: weight,
        per_kg_rate: rate,
        deduct_qty: totalWeightToDeduct,
        is_custom_price: false,
        notes: `Weight: ${weight} kg (@ ₹${rate}/kg)`,
        available_stock: isMainBranchSale ? Number.POSITIVE_INFINITY : availableStock,
        is_custom_cake_product: false,
      },
    ]);

    setWeightModalProduct(null);
  };

  // Add Custom Cake to Cart
  const handleAddCustomCakeToCart = () => {
    setCustomCakeError(null);
    const desc = customCakeDescription.trim();
    if (!desc) {
      setCustomCakeError('Please enter a cake name or description.');
      return;
    }

    const price = parseFloat(customCakePrice);
    if (isNaN(price) || price <= 0) {
      setCustomCakeError('Please enter a valid price greater than ₹0.');
      return;
    }

    const qty = customCakeQty > 0 ? customCakeQty : 1;
    const weightVal = parseFloat(customCakeWeight);
    const weightNum = !isNaN(weightVal) && weightVal > 0 ? weightVal : undefined;

    // Find Custom Cake variant in catalogue
    const customCakeProd = products.find((p) => p.name === 'Custom Cake');
    const customCakeVariant =
      customCakeProd?.variants?.[0] || {
        id: '64bf7bb8-64f7-4edf-a2f6-d0bb786381c2',
        name: 'Custom Order',
      };

    const cartItemId = `custom-cake-${Date.now()}`;
    const instructions = customCakeInstructions.trim();
    let itemNotes = instructions || '';
    if (customCakeCustomerPhone.trim()) {
      itemNotes = itemNotes ? `${itemNotes} | Phone: ${customCakeCustomerPhone.trim()}` : `Phone: ${customCakeCustomerPhone.trim()}`;
    }

    setCart((prev) => [
      ...prev,
      {
        cart_item_id: cartItemId,
        product_id: customCakeProd?.id || '452d989a-0131-43c0-bd5f-c0fc35b967a8',
        product_variant_id: customCakeVariant.id,
        product_name: 'Custom Cake',
        custom_item_name: desc,
        variant_name: weightNum ? `${weightNum} kg` : 'Custom Order',
        quantity: qty,
        unit_price: Math.round(price * 100) / 100,
        weight_kg: weightNum,
        is_custom_price: true,
        notes: itemNotes || undefined,
        available_stock: Number.POSITIVE_INFINITY,
        is_custom_cake_product: true,
      },
    ]);

    // Pre-populate checkout customer details if entered
    if (customCakeCustomerName.trim() && !customerName) {
      setCustomerName(customCakeCustomerName.trim());
    }
    if (customCakeCustomerPhone.trim() && !customerPhone) {
      setCustomerPhone(customCakeCustomerPhone.trim());
    }

    // Reset modal state
    setShowCustomCakeModal(false);
    setCustomCakeDescription('');
    setCustomCakeWeight('');
    setCustomCakePrice('');
    setCustomCakeQty(1);
    setCustomCakeCustomerName('');
    setCustomCakeCustomerPhone('');
    setCustomCakeInstructions('');
    setCustomCakeError(null);
  };

  // Update Item Quantity in Cart by cart_item_id (+ / - buttons)
  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    setCheckoutError(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cart_item_id === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (!isMainBranchSale && !item.is_custom_price && !item.weight_kg && newQty > item.available_stock) {
              setCheckoutError(`Stock limit reached (${item.available_stock} units available).`);
              return item;
            }
            if (!isMainBranchSale && item.weight_kg && (item.weight_kg * newQty) > item.available_stock) {
              setCheckoutError(`Stock limit reached (${item.available_stock} kg available).`);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              raw_quantity: undefined,
              deduct_qty: item.weight_kg ? Math.round(item.weight_kg * newQty * 1000) / 1000 : newQty,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Direct typing of quantity in cart item input
  const handleDirectQuantityChange = (cartItemId: string, rawVal: string) => {
    setCheckoutError(null);
    setCart((prev) =>
      prev.map((item) => {
        if (item.cart_item_id !== cartItemId) return item;

        // If user clears the input completely while typing, store raw string but keep last valid quantity
        if (rawVal.trim() === '') {
          return {
            ...item,
            raw_quantity: '',
          };
        }

        const parsed = parseInt(rawVal, 10);
        // Only accept positive whole numbers
        if (isNaN(parsed) || parsed <= 0) {
          return {
            ...item,
            raw_quantity: rawVal,
          };
        }

        // Validate stock for standard products at sub-branches
        if (!isMainBranchSale && !item.is_custom_price && !item.weight_kg && parsed > item.available_stock) {
          setCheckoutError(`Stock limit reached for "${item.product_name}". Only ${item.available_stock} units available.`);
          return {
            ...item,
            raw_quantity: rawVal,
          };
        }

        // Validate stock for variable weight items at sub-branches
        if (!isMainBranchSale && item.weight_kg && (item.weight_kg * parsed) > item.available_stock) {
          const maxUnits = Math.floor(item.available_stock / item.weight_kg);
          setCheckoutError(`Stock limit reached for "${item.product_name}". ${item.available_stock} kg available (max ${maxUnits} cake${maxUnits === 1 ? '' : 's'} of ${item.weight_kg} kg).`);
          return {
            ...item,
            raw_quantity: rawVal,
          };
        }

        return {
          ...item,
          quantity: parsed,
          raw_quantity: String(parsed),
          deduct_qty: item.weight_kg ? Math.round(item.weight_kg * parsed * 1000) / 1000 : parsed,
        };
      })
    );
  };

  // Blur handler to ensure input resets to valid quantity if left empty or invalid
  const handleDirectQuantityBlur = (cartItemId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.cart_item_id !== cartItemId) return item;
        const parsed = parseInt(item.raw_quantity || '', 10);
        const finalQty = !isNaN(parsed) && parsed > 0 ? parsed : (item.quantity > 0 ? item.quantity : 1);
        return {
          ...item,
          quantity: finalQty,
          raw_quantity: undefined,
          deduct_qty: item.weight_kg ? Math.round(item.weight_kg * finalQty * 1000) / 1000 : finalQty,
        };
      })
    );
  };

  // Update Custom Price for custom items by cart_item_id
  const handleUpdateCustomPrice = (cartItemId: string, priceStr: string) => {
    const val = parseFloat(priceStr);
    const numPrice = isNaN(val) || val < 0 ? 0 : val;
    setCart((prev) =>
      prev.map((item) =>
        item.cart_item_id === cartItemId
          ? { ...item, unit_price: numPrice }
          : item
      )
    );
  };

  // Remove Item from Cart by cart_item_id
  const handleRemoveFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((i) => i.cart_item_id !== cartItemId));
  };

  // Cart Calculations
  const grandTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const rawVal = parseFloat(discountInput) || 0;
    if (rawVal <= 0 || grandTotal <= 0) return 0;

    if (discountType === 'PERCENT') {
      const pct = Math.min(100, Math.max(0, rawVal));
      const calculated = (grandTotal * pct) / 100;
      return Math.min(grandTotal, Math.round(calculated * 100) / 100);
    }

    // FIXED (Rupees)
    return Math.min(grandTotal, Math.round(rawVal * 100) / 100);
  }, [grandTotal, discountInput, discountType]);

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

    if (!effectiveBranchId || !isSaleBranchResolved || !catalogueReady) {
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
        branch_id: effectiveBranchId,
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
        customer_phone: customerPhone,
        notes: saleNotes,
        performed_by: profile.id,
        items: cart.map((i) => ({
          product_variant_id: i.product_variant_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          is_custom_price: i.is_custom_price,
          product_name: i.product_name,
          variant_name: i.variant_name,
          weight_kg: i.weight_kg,
          custom_item_name: i.custom_item_name,
          deduct_qty: i.deduct_qty,
          notes: i.notes,
        })),
      });

      // Show receipt modal & clear state
      setRecentCompletedSale(completed);
      setCart([]);
      setDiscountType('FIXED');
      setDiscountInput('0');
      setAmountCash('');
      setAmountOnline('');
      setCashReceived('');
      setCustomerName('');
      setCustomerPhone('');
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
    activeSaleBranch?.name || 'Assigned Branch';
  const currentCatalogueError =
    catalogueErrorScope === catalogueScope ? catalogueError : null;

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
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCustomCakeError(null);
                    setShowCustomCakeModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold rounded-lg shadow-sm transition-all shrink-0 cursor-pointer"
                  title="Record a custom cake order with manual pricing"
                >
                  <Cake className="w-4 h-4 text-amber-300" />
                  Custom Cake
                </button>
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
            {loadingCatalogue || !isSaleBranchResolved || (!catalogueReady && !currentCatalogueError) ? (
              <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-brand-700 animate-spin mx-auto" />
                <p className="text-sm text-slate-600 font-medium">Loading products and FEFO inventory...</p>
              </div>
            ) : currentCatalogueError ? (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-sm text-rose-800">
                Failed to load products and inventory: {currentCatalogueError}
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
                        const isOutOfStock = !isMainBranchSale && !isCustom && stockAvailable <= 0;

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
                                {isMainBranchSale ? (
                                  <span className="text-[10px] font-medium text-emerald-700">
                                    No stock balance required
                                  </span>
                                ) : !isCustom && (
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

                      {supportsVariableWeight(prod) && (
                        <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <Scale className="w-3.5 h-3.5 text-brand-700" />
                            Sell by Weight:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenWeightModal(prod)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors cursor-pointer"
                            title="Enter exact cake weight (e.g. 0.75 kg, 1.5 kg, 2 kg)"
                          >
                            Custom Weight
                          </button>
                        </div>
                      )}
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
                  <div key={item.cart_item_id} className="pt-2.5 first:pt-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 leading-tight">
                          {item.custom_item_name || item.product_name}
                        </h5>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {item.weight_kg ? (
                            <span className="text-[10px] font-bold text-brand-800 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                              Weight: {item.weight_kg} kg {item.per_kg_rate ? `(@ ₹${item.per_kg_rate}/kg)` : ''}
                            </span>
                          ) : (
                            <p className="text-[11px] text-slate-500">{item.variant_name}</p>
                          )}
                          {item.is_custom_cake_product && (
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                              Custom Cake
                            </span>
                          )}
                        </div>
                        {item.notes && !item.notes.startsWith('Weight:') && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5">{item.notes}</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(item.cart_item_id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {/* Quantity Controls: - button, direct input, + button */}
                      <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cart_item_id, -1)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-brand-900 cursor-pointer transition-colors"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.raw_quantity !== undefined ? item.raw_quantity : item.quantity}
                          onChange={(e) => handleDirectQuantityChange(item.cart_item_id, e.target.value)}
                          onBlur={() => handleDirectQuantityBlur(item.cart_item_id)}
                          className="w-12 text-center text-xs font-bold text-slate-900 bg-white py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title="Click to type quantity directly"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cart_item_id, 1)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-brand-900 cursor-pointer transition-colors"
                          title="Increase quantity"
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
                                handleUpdateCustomPrice(item.cart_item_id, e.target.value)
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="sale-discount" className="text-xs font-bold text-slate-700">
                      Discount
                    </label>
                    <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType('FIXED');
                          setDiscountInput('0');
                        }}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                          discountType === 'FIXED'
                            ? 'bg-brand-700 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ₹ Fixed
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType('PERCENT');
                          setDiscountInput('0');
                        }}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                          discountType === 'PERCENT'
                            ? 'bg-brand-700 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        % Percent
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-slate-500">
                      {discountType === 'FIXED' ? '₹' : '%'}
                    </span>
                    <input
                      id="sale-discount"
                      type="number"
                      min="0"
                      max={discountType === 'PERCENT' ? 100 : grandTotal}
                      step={discountType === 'PERCENT' ? '1' : '0.01'}
                      placeholder={discountType === 'PERCENT' ? 'e.g. 10' : '0.00'}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      onBlur={() => {
                        if (discountType === 'FIXED') {
                          setDiscountInput(discountAmount.toFixed(2));
                        }
                      }}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  {discountType === 'PERCENT' && Number(discountInput) > 0 && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      {discountInput}% of ₹{grandTotal.toFixed(2)} = ₹{discountAmount.toFixed(2)} discount
                    </p>
                  )}
                </div>

                <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span>Subtotal</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span>
                      Discount {discountType === 'PERCENT' && Number(discountInput) > 0 ? `(${discountInput}%)` : ''}
                    </span>
                    <span className="font-semibold text-rose-700">-₹{discountAmount.toFixed(2)}</span>
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

                {/* Optional Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
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
      {/* MODAL: CUSTOM WEIGHT SELECTION                               */}
      {/* ════════════════════════════════════════════════════════════ */}
      {weightModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="bg-brand-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-base">Select Cake Weight</h3>
                  <p className="text-xs text-brand-300">{weightModalProduct.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWeightModalProduct(null)}
                className="text-brand-300 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {(() => {
                const { rate, referenceVariant } = getPerKgRate(weightModalProduct);
                const parsedWeight = parseFloat(customWeightInput) || 0;
                const calcUnitPrice = Math.round(parsedWeight * rate * 100) / 100;
                const calcLineTotal = Math.round(calcUnitPrice * (weightCakeQty || 1) * 100) / 100;
                const availableStock = referenceVariant ? (stockByVariant.get(referenceVariant.id) || 0) : 0;
                const weightOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

                return (
                  <>
                    <div className="flex items-center justify-between p-3 bg-brand-50 border border-brand-200 rounded-xl">
                      <div>
                        <span className="text-xs text-slate-600">Configured Rate</span>
                        <p className="text-lg font-black text-brand-900">₹{rate} / kg</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-600">Stock Available</span>
                        <p className="text-xs font-bold text-slate-800">
                          {isMainBranchSale ? 'Fresh Production' : `${availableStock} kg`}
                        </p>
                      </div>
                    </div>

                    {weightModalError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{weightModalError}</span>
                      </div>
                    )}

                    {/* Quick Weight Chips */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Quick Weight Presets
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {weightOptions.map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => {
                              setCustomWeightInput(String(w));
                              setWeightModalError(null);
                            }}
                            className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              parseFloat(customWeightInput) === w
                                ? 'bg-brand-900 text-white border-brand-900 shadow-sm'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {w} kg
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual Weight Input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Exact Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        value={customWeightInput}
                        onChange={(e) => {
                          setCustomWeightInput(e.target.value);
                          setWeightModalError(null);
                        }}
                        placeholder="e.g. 1.75"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    {/* Quantity of Cakes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Number of Cakes (Quantity)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWeightCakeQty((q) => Math.max(1, q - 1))}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-sm cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-4 py-1.5 font-bold text-sm text-slate-900 border border-slate-200 rounded-lg">
                          {weightCakeQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWeightCakeQty((q) => q + 1)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Calculated Price Summary */}
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs text-amber-900 font-medium">
                          {parsedWeight > 0 ? `${parsedWeight} kg @ ₹${rate}/kg` : 'Enter weight'}
                          {weightCakeQty > 1 ? ` × ${weightCakeQty} cakes` : ''}
                        </span>
                        <p className="text-xs text-amber-700">Calculated Price</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-brand-950">₹{calcLineTotal.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setWeightModalProduct(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddCustomWeightToCart(weightModalProduct, parsedWeight, weightCakeQty)}
                        disabled={parsedWeight <= 0}
                        className="px-5 py-2 text-xs font-bold bg-brand-700 hover:bg-brand-800 text-white rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        Add to Cart (₹{calcLineTotal.toFixed(2)})
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL: CUSTOM CAKE ORDER FORM                                */}
      {/* ════════════════════════════════════════════════════════════ */}
      {showCustomCakeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="bg-brand-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cake className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-base">Custom Cake Order</h3>
                  <p className="text-xs text-brand-300">Enter custom cake details and manual pricing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomCakeModal(false)}
                className="text-brand-300 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5">
              {customCakeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{customCakeError}</span>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cake Name or Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customCakeDescription}
                  onChange={(e) => setCustomCakeDescription(e.target.value)}
                  placeholder="e.g. Custom Birthday Cake, 3D Car Theme Cake"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Weight & Price Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Weight in kg <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={customCakeWeight}
                    onChange={(e) => setCustomCakeWeight(e.target.value)}
                    placeholder="e.g. 2.5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custom Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="10"
                    value={customCakePrice}
                    onChange={(e) => setCustomCakePrice(e.target.value)}
                    placeholder="e.g. 1800"
                    className="w-full px-3 py-2 border border-amber-400 bg-amber-50/50 rounded-lg text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomCakeQty((q) => Math.max(1, q - 1))}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-4 py-1.5 font-bold text-sm text-slate-900 border border-slate-200 rounded-lg">
                    {customCakeQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomCakeQty((q) => q + 1)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-sm cursor-pointer"
                  >
                    +
                  </button>
                  {Number(customCakePrice) > 0 && (
                    <span className="ml-auto text-sm font-extrabold text-brand-900">
                      Total: ₹{(Number(customCakePrice) * customCakeQty).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Optional Customer Name & Phone */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Customer Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customCakeCustomerName}
                    onChange={(e) => setCustomCakeCustomerName(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Customer Phone <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={customCakeCustomerPhone}
                    onChange={(e) => setCustomCakeCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Design Details / Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={customCakeInstructions}
                  onChange={(e) => setCustomCakeInstructions(e.target.value)}
                  placeholder="e.g. Chocolate cake with customised birthday message."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustomCakeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomCakeToCart}
                  className="px-5 py-2 text-xs font-bold bg-brand-700 hover:bg-brand-800 text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Add Custom Cake to Cart
                </button>
              </div>
            </div>
          </div>
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
                  {((recentCompletedSale || selectedSaleDetail)!).customer_phone && (
                    <p className="text-[11px] text-slate-500">
                      Phone: {((recentCompletedSale || selectedSaleDetail)!).customer_phone}
                    </p>
                  )}
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
                            <span className="font-bold text-slate-900">
                              {item.custom_item_name || item.product_name}
                            </span>
                            <div className="text-[10px] text-slate-500">
                              {item.weight_kg ? (
                                <span className="font-semibold text-brand-800">
                                  {item.weight_kg} kg
                                </span>
                              ) : (
                                item.variant_name
                              )}
                              {item.batch_number && (
                                <span className="ml-1 text-slate-400">({item.batch_number})</span>
                              )}
                            </div>
                            {item.notes && !item.notes.startsWith('Weight:') && (
                              <div className="text-[10px] text-slate-500 italic">
                                {item.notes}
                              </div>
                            )}
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
                  onClick={() => {
                    document.body.classList.add('printing-receipt');
                    window.print();
                    setTimeout(() => {
                      document.body.classList.remove('printing-receipt');
                    }, 1000);
                  }}
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
