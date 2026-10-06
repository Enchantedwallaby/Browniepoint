import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Search,
  Plus,
  Tag,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  DollarSign,
  Info,
  Pencil,
} from 'lucide-react';
import type {
  Profile,
  ProductCategory,
  QuantityUnit,
  PricingType,
} from '@/types/database';
import { productService, type ProductWithVariants } from '@/services/productService';
import { catalogueSeedService, type ReconciliationReport } from '@/services/catalogueSeedService';

interface CatalogueManagementProps {
  profile: Profile;
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

const QUANTITY_UNITS: { value: QuantityUnit; label: string }[] = [
  { value: 'PIECE', label: 'Piece (Pc)' },
  { value: 'HALF_KG', label: 'Half KG (0.5 KG)' },
  { value: 'KG', label: '1 KG' },
  { value: 'GRAM', label: 'Gram' },
  { value: 'BOX', label: 'Box / Pack' },
  { value: 'OTHER', label: 'Custom / Other' },
];

export const CatalogueManagement: React.FC<CatalogueManagementProps> = ({
  profile,
}) => {
  const isOwner = profile.role === 'OWNER';

  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [seeding, setSeeding] = useState(false);
  const [reconcileReport, setReconcileReport] = useState<ReconciliationReport | null>(null);

  // Modals & Submit State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState<ProductWithVariants | null>(null);
  const [showAddVariant, setShowAddVariant] = useState<ProductWithVariants | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states - Add Product
  const [newProdName, setNewProdName] = useState('');
  const [newProdCat, setNewProdCat] = useState<ProductCategory>('Cakes');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdShowWeight, setNewProdShowWeight] = useState(false);
  const [newProdWeightName, setNewProdWeightName] = useState('');
  const [newProdHasPrice, setNewProdHasPrice] = useState(true);
  const [newProdPrice, setNewProdPrice] = useState('');

  // Form states - Edit Product
  const [editProdName, setEditProdName] = useState('');
  const [editProdCat, setEditProdCat] = useState<ProductCategory>('Cakes');
  const [editProdDesc, setEditProdDesc] = useState('');
  const [editProdShowWeight, setEditProdShowWeight] = useState(false);
  const [editProdWeightName, setEditProdWeightName] = useState('');
  const [editProdHasPrice, setEditProdHasPrice] = useState(true);
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdActive, setEditProdActive] = useState(true);

  // Form states - Variant
  const [varName, setVarName] = useState('');
  const [varQtyVal, setVarQtyVal] = useState<number>(0.5);
  const [varQtyUnit, setVarQtyUnit] = useState<QuantityUnit>('HALF_KG');
  const [varPricingType, setVarPricingType] = useState<PricingType>('WEIGHT_VARIANT');
  const [varPrice, setVarPrice] = useState<string>('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = isOwner
        ? await productService.getAllProducts()
        : await productService.getActiveProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error loading catalogue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSeedMenu = async () => {
    if (!isOwner) return;
    setSeeding(true);
    setReconcileReport(null);
    try {
      const report = await catalogueSeedService.seedOfficialMenu();
      setReconcileReport(report);
      fetchProducts();
    } catch (err) {
      console.error('Seeding error:', err);
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!newProdName.trim() || !isOwner) return;

    setSubmitting(true);
    try {
      await productService.createProduct({
        name: newProdName.trim(),
        category: newProdCat,
        description: newProdDesc.trim(),
        show_weight_size: newProdShowWeight,
        has_price: newProdHasPrice,
        price: newProdHasPrice && newProdPrice !== '' ? Number(newProdPrice) : null,
        variant_name: newProdShowWeight ? (newProdWeightName.trim() || '1 Piece') : 'Standard',
      });
      setShowAddProduct(false);
      setNewProdName('');
      setNewProdDesc('');
      setNewProdShowWeight(false);
      setNewProdWeightName('');
      setNewProdHasPrice(true);
      setNewProdPrice('');
      fetchProducts();
    } catch (err: unknown) {
      console.error('Error adding product:', err);
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to create product.';
      setModalError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (p: ProductWithVariants) => {
    const mainVariant = p.variants[0];
    const activeRule = mainVariant?.pricing_rules?.find((r) => r.active);
    const hasPrice = activeRule?.base_price != null && activeRule?.pricing_type !== 'CUSTOM';

    setModalError(null);
    setShowEditProduct(p);
    setEditProdName(p.name);
    setEditProdCat(p.category);
    setEditProdDesc(p.description || '');
    setEditProdShowWeight(p.show_weight_size ?? true);
    setEditProdWeightName(mainVariant?.name || '');
    setEditProdHasPrice(hasPrice);
    setEditProdPrice(activeRule?.base_price != null ? String(activeRule.base_price) : '');
    setEditProdActive(p.active);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!showEditProduct || !editProdName.trim() || !isOwner) return;

    const mainVariant = showEditProduct.variants[0];

    setSubmitting(true);
    try {
      await productService.updateProduct(showEditProduct.id, {
        name: editProdName.trim(),
        category: editProdCat,
        description: editProdDesc.trim(),
        show_weight_size: editProdShowWeight,
        active: editProdActive,
        variant_id: mainVariant?.id,
        variant_name: editProdShowWeight ? (editProdWeightName.trim() || '1 Piece') : 'Standard',
        has_price: editProdHasPrice,
        base_price: editProdHasPrice && editProdPrice !== '' ? Number(editProdPrice) : null,
      });
      setShowEditProduct(null);
      fetchProducts();
    } catch (err: unknown) {
      console.error('Error updating product:', err);
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to update product.';
      setModalError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddVariant || !varName.trim() || !isOwner) return;

    try {
      await productService.createVariant({
        product_id: showAddVariant.id,
        name: varName.trim(),
        quantity_value: Number(varQtyVal) || 1,
        quantity_unit: varQtyUnit,
        pricing_type: varPricingType,
        base_price: varPricingType === 'CUSTOM' ? null : Number(varPrice) || 0,
      });
      setShowAddVariant(null);
      setVarName('');
      setVarPrice('');
      fetchProducts();
    } catch (err) {
      console.error('Error adding variant:', err);
    }
  };

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    if (!isOwner) return;
    try {
      await productService.toggleProductActive(productId, !currentStatus);
      fetchProducts();
    } catch (err) {
      console.error('Error toggling product status:', err);
    }
  };

  // Filtering
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.variants.some((v) => v.name.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'All' || p.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, category, or variant..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center space-x-2 overflow-x-auto">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="All">All Categories ({products.length})</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {isOwner && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedMenu}
                disabled={seeding}
                title="Sync/Import Complete Official Brownie Point Menu Catalogue"
              >
                <Sparkles className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
                <span>{seeding ? 'Syncing...' : 'Sync Menu Catalogue'}</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddProduct(true)}
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </Button>
            </>
          )}

          <button
            onClick={fetchProducts}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Refresh catalogue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sync Reconciliation Banner */}
      {reconcileReport && (
        <div className="p-4 bg-brand-50 border border-brand-200 rounded-xl space-y-2 text-xs text-brand-900">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm flex items-center gap-1 text-brand-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Official Menu Catalogue Sync Complete
            </span>
            <button onClick={() => setReconcileReport(null)} className="text-brand-600 font-bold text-base">×</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-brand-200/60 font-mono">
            <div>
              <span className="text-brand-600 block text-[10px]">TOTAL MENU ITEMS</span>
              <span className="font-bold text-slate-900">{reconcileReport.menuProductsCount} products ({reconcileReport.menuVariantsCount} variants)</span>
            </div>
            <div>
              <span className="text-brand-600 block text-[10px]">ADDED PRODUCTS / VARIANTS</span>
              <span className="font-bold text-emerald-700">+{reconcileReport.insertedProducts} prods / +{reconcileReport.insertedVariants} vars</span>
            </div>
            <div>
              <span className="text-brand-600 block text-[10px]">CORRECTED PRICES</span>
              <span className="font-bold text-blue-700">{reconcileReport.correctedPrices} prices updated</span>
            </div>
            <div>
              <span className="text-brand-600 block text-[10px]">CUSTOM PRICED PRODUCTS</span>
              <span className="font-bold text-purple-700">{reconcileReport.customProductsCount} custom cake entries</span>
            </div>
          </div>
        </div>
      )}

      {/* Custom Cake Notice */}
      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-xs text-amber-800">
        <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <span className="font-bold">Pricing Rule Reminder:</span> Standard menu items derive their price automatically from configured pricing rules. Custom cakes carry a <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">CUSTOM</code> pricing designation — employees manually type the final selling price at order/sale time.
        </div>
      </div>

      {/* Catalogue Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500">Loading product catalogue...</div>
      ) : filteredProducts.length === 0 ? (
        <Card className="text-center py-12 px-4 border-dashed border-2">
          <Tag className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-slate-800">No Products Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            No products match the selected criteria. Owner can click "Add Product" or "Sync Menu Catalogue" to populate official Brownie Point menu items.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const showWeight = p.show_weight_size ?? true;
            return (
              <Card
                key={p.id}
                className={`flex flex-col justify-between transition-all ${
                  !p.active ? 'opacity-60 bg-slate-50' : 'hover:border-brand-300'
                }`}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 font-mono">
                        {p.category}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">
                        {p.name}
                      </h3>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <Badge variant={p.active ? 'success' : 'secondary'} className="text-[10px]">
                        {p.active ? 'Active' : 'Inactive'}
                      </Badge>

                      {isOwner && (
                        <>
                          <button
                            onClick={() => openEditModal(p)}
                            title="Edit Product"
                            className="p-1 text-slate-400 hover:text-brand-700"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(p.id, p.active)}
                            title={p.active ? 'Deactivate Product' : 'Activate Product'}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            {p.active ? (
                              <XCircle className="w-4 h-4 text-rose-500" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {p.description && (
                    <p className="text-xs text-slate-500 mb-3 italic">{p.description}</p>
                  )}

                  {/* Variants List */}
                  <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold font-mono">
                      <span>{showWeight ? 'VARIANT / SIZE' : 'PRICING'}</span>
                      <span>MENU PRICE</span>
                    </div>

                    {p.variants.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No pricing configured yet.</p>
                    ) : (
                      p.variants.map((v) => {
                        const activeRule = v.pricing_rules?.find((r) => r.active);
                        const isCustom = activeRule?.pricing_type === 'CUSTOM';
                        const displayVarName = !showWeight || v.name === 'Standard' ? 'Standard Price' : v.name;

                        return (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs border border-slate-200/60"
                          >
                            <div className="flex items-center space-x-2">
                              <Tag className="w-3 h-3 text-brand-700 shrink-0" />
                              <span className="font-medium text-slate-800">{displayVarName}</span>
                            </div>

                            {isCustom ? (
                              <span className="font-bold text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                CUSTOM PRICE (SALE TIME)
                              </span>
                            ) : activeRule?.base_price != null ? (
                              <span className="font-bold text-slate-900 font-mono">
                                ₹{activeRule.base_price}
                              </span>
                            ) : (
                              <span className="font-medium text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                No Selling Price
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                {isOwner && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => openEditModal(p)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3 text-slate-500" />
                      <span>Edit Product</span>
                    </button>
                    <button
                      onClick={() => setShowAddVariant(p)}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Variant</span>
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD PRODUCT (Owner Only) */}
      {showAddProduct && isOwner && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add New Product</h3>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
                <span>{modalError}</span>
                <button type="button" onClick={() => setModalError(null)} className="font-bold text-slate-400 hover:text-slate-600">×</button>
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. Pineapple Cups"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={newProdCat}
                  onChange={(e) => setNewProdCat(e.target.value as ProductCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Toggle & Input */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProdHasPrice}
                    onChange={(e) => setNewProdHasPrice(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                  />
                  <span>Product has a selling price</span>
                </label>

                {newProdHasPrice && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Selling Price (₹)</label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        step="1"
                        min="1"
                        required={newProdHasPrice}
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Weight/Size Toggle */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProdShowWeight}
                    onChange={(e) => setNewProdShowWeight(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                  />
                  <span>Show Weight / Size</span>
                </label>

                {newProdShowWeight && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Weight / Size Value</label>
                    <input
                      type="text"
                      value={newProdWeightName}
                      onChange={(e) => setNewProdWeightName(e.target.value)}
                      placeholder="e.g. 500 g, 1 kg, Small, Large"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  placeholder="Product notes..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowAddProduct(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PRODUCT (Owner Only) */}
      {showEditProduct && isOwner && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Edit Product: {showEditProduct.name}</h3>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
                <span>{modalError}</span>
                <button type="button" onClick={() => setModalError(null)} className="font-bold text-slate-400 hover:text-slate-600">×</button>
              </div>
            )}

            <form onSubmit={handleUpdateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={editProdName}
                  onChange={(e) => setEditProdName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={editProdCat}
                  onChange={(e) => setEditProdCat(e.target.value as ProductCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Toggle & Input */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editProdHasPrice}
                    onChange={(e) => setEditProdHasPrice(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                  />
                  <span>Product has a selling price</span>
                </label>

                {editProdHasPrice && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Selling Price (₹)</label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        step="1"
                        min="1"
                        required={editProdHasPrice}
                        value={editProdPrice}
                        onChange={(e) => setEditProdPrice(e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Weight/Size Toggle */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editProdShowWeight}
                    onChange={(e) => setEditProdShowWeight(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                  />
                  <span>Show Weight / Size</span>
                </label>

                {editProdShowWeight && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Weight / Size Value</label>
                    <input
                      type="text"
                      value={editProdWeightName}
                      onChange={(e) => setEditProdWeightName(e.target.value)}
                      placeholder="e.g. 500 g, 1 kg, Small, Large"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-medium text-slate-700">Product Status</span>
                <button
                  type="button"
                  onClick={() => setEditProdActive(!editProdActive)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                    editProdActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                >
                  {editProdActive ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={editProdDesc}
                  onChange={(e) => setEditProdDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowEditProduct(null)} disabled={submitting}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD VARIANT (Owner Only) */}
      {showAddVariant && isOwner && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Add Variant for {showAddVariant.name}</h3>
              <p className="text-xs text-slate-500">Configure size, unit, and standard menu pricing.</p>
            </div>

            <form onSubmit={handleCreateVariant} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Variant Name</label>
                <input
                  type="text"
                  required
                  value={varName}
                  onChange={(e) => setVarName(e.target.value)}
                  placeholder="e.g. 0.5 KG, 1 KG, 1 Piece"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Quantity Value</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.01"
                    required
                    value={varQtyVal}
                    onChange={(e) => setVarQtyVal(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
                  <select
                    value={varQtyUnit}
                    onChange={(e) => setVarQtyUnit(e.target.value as QuantityUnit)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {QUANTITY_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Pricing Mode</label>
                <select
                  value={varPricingType}
                  onChange={(e) => setVarPricingType(e.target.value as PricingType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="WEIGHT_VARIANT">Weight Variant (0.5 KG / 1 KG)</option>
                  <option value="FIXED_PER_UNIT">Fixed Per Unit Price</option>
                  <option value="PER_KG">Per KG Rate</option>
                  <option value="CUSTOM">Custom Price (Manually entered at Sale/Order)</option>
                </select>
              </div>

              {varPricingType !== 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Standard Menu Price (₹)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={varPrice}
                      onChange={(e) => setVarPrice(e.target.value)}
                      placeholder="e.g. 490"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowAddVariant(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Variant
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
