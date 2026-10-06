import { supabase } from '@/lib/supabase';
import type { FEFOInventoryRecord, InventoryMovementType } from '@/types/database';

export interface InventorySummary {
  totalProducts: number;
  totalAvailableQuantity: number;
  expiringSoon: number;
  expired: number;
  lowStock: number;
}

export const inventoryService = {
  /**
   * FEFO Inventory Lookup:
   * Returns available batches sorted by earliest expiry date for a given branch or all branches.
   */
  async getFEFOInventory(
    branchId?: string,
    category?: string
  ): Promise<FEFOInventoryRecord[]> {
    let query = supabase.from('v_fefo_inventory').select('*');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (category && category !== 'All') {
      query = query.eq('product_category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error querying FEFO inventory:', error);
      throw error;
    }

    return (data as FEFOInventoryRecord[]) || [];
  },

  /**
   * Summary Metrics for Dashboard & Inventory Page
   */
  async getInventorySummary(branchId?: string): Promise<InventorySummary> {
    const records = await this.getFEFOInventory(branchId);

    const uniqueVariants = new Set(records.map((r) => r.product_variant_id));
    let totalQty = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let lowStockCount = 0;

    for (const r of records) {
      totalQty += Number(r.quantity_available || 0);

      if (r.is_expired) {
        expiredCount++;
      } else if (r.days_until_expiry <= 3 && r.days_until_expiry >= 0) {
        expiringSoonCount++;
      }

      if (r.quantity_available < 5) {
        lowStockCount++;
      }
    }

    return {
      totalProducts: uniqueVariants.size,
      totalAvailableQuantity: totalQty,
      expiringSoon: expiringSoonCount,
      expired: expiredCount,
      lowStock: lowStockCount,
    };
  },

  /**
   * Stock Production / Entry Flow:
   * Creates batch, updates inventory, and logs audit movement.
   */
  async recordStockProduction(params: {
    branch_id: string;
    product_variant_id: string;
    batch_number: string;
    production_date: string;
    expiry_date: string;
    quantity: number;
    notes?: string;
    performed_by?: string;
  }): Promise<void> {
    if (params.quantity <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }

    // 1. Create or get Batch
    let batchId: string;
    const { data: existingBatch } = await supabase
      .from('product_batches')
      .select('id')
      .eq('product_variant_id', params.product_variant_id)
      .eq('batch_number', params.batch_number)
      .maybeSingle();

    if (existingBatch) {
      batchId = existingBatch.id;
    } else {
      const { data: newBatch, error: bErr } = await supabase
        .from('product_batches')
        .insert({
          product_variant_id: params.product_variant_id,
          batch_number: params.batch_number,
          production_date: params.production_date,
          expiry_date: params.expiry_date,
          initial_quantity: params.quantity,
        })
        .select('id')
        .single();

      if (bErr) {
        console.error('Error creating product batch:', bErr);
        throw bErr;
      }

      batchId = newBatch.id;
    }

    // 2. Check existing inventory row
    const { data: existingInv } = await supabase
      .from('inventory')
      .select('id, quantity_available')
      .eq('branch_id', params.branch_id)
      .eq('product_variant_id', params.product_variant_id)
      .eq('batch_id', batchId)
      .maybeSingle();

    if (existingInv) {
      const newQty = Number(existingInv.quantity_available) + params.quantity;
      const { error: uErr } = await supabase
        .from('inventory')
        .update({ quantity_available: newQty })
        .eq('id', existingInv.id);

      if (uErr) throw uErr;
    } else {
      const { error: iErr } = await supabase.from('inventory').insert({
        branch_id: params.branch_id,
        product_variant_id: params.product_variant_id,
        batch_id: batchId,
        quantity_available: params.quantity,
        quantity_in_transit: 0,
      });

      if (iErr) throw iErr;
    }

    // 3. Log Immutable Inventory Movement
    await this.recordMovement({
      branch_id: params.branch_id,
      product_variant_id: params.product_variant_id,
      batch_id: batchId,
      movement_type: 'PRODUCTION',
      quantity: params.quantity,
      notes: params.notes || 'New stock batch produced / received',
      performed_by: params.performed_by,
    });
  },

  /**
   * Record Inventory Movement (Auditable History)
   */
  async recordMovement(params: {
    branch_id: string;
    product_variant_id: string;
    batch_id: string;
    movement_type: InventoryMovementType;
    quantity: number;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
    performed_by?: string;
  }): Promise<void> {
    const { error } = await supabase.from('inventory_movements').insert({
      branch_id: params.branch_id,
      product_variant_id: params.product_variant_id,
      batch_id: params.batch_id,
      movement_type: params.movement_type,
      quantity: params.quantity,
      reference_type: params.reference_type || null,
      reference_id: params.reference_id || null,
      notes: params.notes || null,
      performed_by: params.performed_by || null,
    });

    if (error) {
      console.error('Error recording inventory movement:', error);
      throw error;
    }
  },
};
