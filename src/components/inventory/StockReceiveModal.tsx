import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Package, Calendar, Tag, Store, Plus, AlertCircle } from 'lucide-react';
import type { Profile, Branch } from '@/types/database';
import { productService, type ProductWithVariants } from '@/services/productService';
import { branchService } from '@/services/branchService';
import { inventoryService } from '@/services/inventoryService';

interface StockReceiveModalProps {
  profile: Profile;
  assignedBranch: Branch | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const StockReceiveModal: React.FC<StockReceiveModalProps> = ({
  profile,
  assignedBranch,
  onClose,
  onSuccess,
}) => {
  const isOwner = profile.role === 'OWNER';

  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Form Fields
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    assignedBranch?.id || ''
  );
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [productionDate, setProductionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('10');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // Load active products
    productService
      .getActiveProducts()
      .then((data) => {
        if (active) setProducts(data);
      })
      .catch((err) => console.error('Error loading products for stock entry:', err))
      .finally(() => {
        if (active) setLoadingProducts(false);
      });

    // Load active branches
    branchService
      .getActiveBranches()
      .then((data) => {
        if (active) {
          setBranches(data);
          if (!selectedBranchId && data.length > 0) {
            setSelectedBranchId(data[0].id);
          }
        }
      })
      .catch((err) => console.error('Error loading branches for stock entry:', err));

    return () => {
      active = false;
    };
  }, []);

  // When product changes, auto-select first variant
  useEffect(() => {
    if (selectedProductId) {
      const p = products.find((prod) => prod.id === selectedProductId);
      if (p && p.variants.length > 0) {
        setSelectedVariantId(p.variants[0].id);

        // Auto generate batch number format
        const code = p.name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        setBatchNumber(`${code}-${dateStr}-01`);

        // Default expiry date: 3 days for cakes/pastries, 30 days for cookies/tea-time
        const exp = new Date();
        if (['Cookies', 'Tea-Time Cakes', 'Packaging', 'Utensils'].includes(p.category)) {
          exp.setDate(exp.getDate() + 30);
        } else {
          exp.setDate(exp.getDate() + 3);
        }
        setExpiryDate(exp.toISOString().split('T')[0]);
      }
    }
  }, [selectedProductId, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = Number(quantity);
    if (!selectedBranchId) {
      setError('Please select a branch.');
      return;
    }
    if (!selectedVariantId) {
      setError('Please select a product variant.');
      return;
    }
    if (!batchNumber.trim()) {
      setError('Please enter a batch number.');
      return;
    }
    if (!expiryDate) {
      setError('Please select an expiry date.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (new Date(expiryDate) < new Date(productionDate)) {
      setError('Expiry date cannot be earlier than production date.');
      return;
    }

    setSubmitting(true);
    try {
      await inventoryService.recordStockProduction({
        branch_id: selectedBranchId,
        product_variant_id: selectedVariantId,
        batch_number: batchNumber.trim(),
        production_date: productionDate,
        expiry_date: expiryDate,
        quantity: qty,
        notes: notes.trim() || 'New stock received',
        performed_by: profile.id,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error adding stock batch:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to record stock entry. Check database permissions.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-brand-700" />
              Receive / Record Stock Batch
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add new production or received inventory with mandatory batch and expiry tracking.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">
            ×
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Destination Branch */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-brand-700" />
              Destination Branch
            </label>
            {isOwner ? (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.branch_code})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value={assignedBranch ? `${assignedBranch.name} (${assignedBranch.branch_code})` : 'Assigned Branch'}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-lg text-sm text-slate-700 font-medium"
              />
            )}
          </div>

          {/* Product & Variant */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-brand-700" />
                Select Product
              </label>
              {loadingProducts ? (
                <div className="text-xs text-slate-400 py-2">Loading products...</div>
              ) : (
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.category}] {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-brand-700" />
                Select Variant
              </label>
              <select
                required
                disabled={!selectedProduct}
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
              >
                {!selectedProduct && <option value="">Select product first</option>}
                {selectedProduct?.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Batch Number & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batch Number
              </label>
              <input
                type="text"
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g. BF-011026-01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Dates: Production & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Production Date
              </label>
              <input
                type="date"
                required
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                Expiry Date
              </label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-rose-800"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes / Production Reference
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Fresh morning production batch"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Recording Stock...' : 'Confirm Stock Batch'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
