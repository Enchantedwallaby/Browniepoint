import { supabase } from '@/lib/supabase';
import type { Sale, SaleItem, PaymentMethod, SaleStatus } from '@/types/database';

export interface CreateSaleItemParam {
  product_variant_id: string;
  quantity: number;
  unit_price: number;
  is_custom_price: boolean;
  notes?: string;
  // UI helper fields
  product_name?: string;
  variant_name?: string;
}

export interface CreateSaleParams {
  branch_id: string;
  payment_method: PaymentMethod;
  amount_cash?: number;
  amount_online?: number;
  customer_name?: string;
  notes?: string;
  performed_by?: string;
  order_id?: string;
  items: CreateSaleItemParam[];
}

export interface SaleItemDetailed extends SaleItem {
  product_name?: string;
  variant_name?: string;
  batch_number?: string;
  entered_by_name?: string;
}

export interface SaleDetailed extends Sale {
  branch_name?: string;
  performed_by_name?: string;
  items: SaleItemDetailed[];
}

export const salesService = {
  /**
   * Complete a POS Sale Transaction atomically via PostgreSQL RPC (`public.process_pos_sale`):
   * 1. Validates branch authorization, input payloads, & payment method split.
   * 2. Allocates stock across FEFO batches (earliest expiry date first).
   * 3. Inserts `sales` record.
   * 4. Inserts `sale_items` with unit price snapshots & custom price audit fields.
   * 5. Deducts `inventory` stock per batch.
   * 6. Logs immutable `inventory_movements` (movement_type = 'SALE').
   * 7. Executes within a SINGLE PostgreSQL transaction block — if any error occurs (e.g. stock shortfall),
   *    PostgreSQL automatically ROLLBACKS all changes.
   */
  async createSale(params: CreateSaleParams): Promise<SaleDetailed> {
    if (!params.branch_id) {
      throw new Error('Branch ID is required to record a sale.');
    }

    if (!params.items || params.items.length === 0) {
      throw new Error('Cannot complete a sale with an empty cart.');
    }

    const branchId = params.branch_id;
    const paymentMethod = params.payment_method;
    const amountCash = Number(params.amount_cash || 0);
    const amountOnline = Number(params.amount_online || 0);
    const customerName = params.customer_name?.trim() || null;
    const notes = params.notes?.trim() || null;
    const userId = params.performed_by || null;
    const orderId = params.order_id || null;
    const items = params.items.map((i) => ({
      product_variant_id: i.product_variant_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      is_custom_price: Boolean(i.is_custom_price),
      notes: i.notes || null,
    }));

    // 2. Call Atomic Database RPC
    const { data: saleId, error: rpcErr } = await supabase.rpc('process_pos_sale', {
      p_branch_id: branchId,
      p_payment_method: paymentMethod,
      p_amount_cash: amountCash,
      p_amount_online: amountOnline,
      p_customer_name: customerName || null,
      p_notes: notes || null,
      p_performed_by: userId,
      p_order_id: orderId || null,
      p_items: items,
    });

    if (rpcErr) {
      console.error('Error in atomic RPC process_pos_sale:', rpcErr);
      throw new Error(rpcErr.message || 'Failed to process POS sale transaction.');
    }

    const createdSaleId = saleId as string;

    // 3. Fetch the complete created sale record for receipt rendering
    const recentSales = await this.getSalesHistory({ branchId: params.branch_id, limit: 10 });
    const fullSale = recentSales.find((s) => s.id === createdSaleId);

    if (fullSale) {
      return fullSale;
    }

    // Fallback object construct if query delay occurs
    const calculatedTotal = params.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    return {
      id: createdSaleId,
      branch_id: params.branch_id,
      sale_date: new Date().toISOString(),
      total_amount: calculatedTotal,
      payment_method: params.payment_method,
      amount_cash: params.payment_method === 'CASH' ? calculatedTotal : Number(params.amount_cash || 0),
      amount_online: params.payment_method === 'CASH' ? 0 : Number(params.amount_online || 0),
      customer_name: params.customer_name || null,
      notes: params.notes || null,
      status: 'COMPLETED',
      performed_by: params.performed_by || null,
      order_id: params.order_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: params.items.map((i) => ({
        id: `item-${Math.random()}`,
        sale_id: createdSaleId,
        product_variant_id: i.product_variant_id,
        batch_id: null,
        quantity: i.quantity,
        unit_price_snapshot: i.unit_price,
        line_total: i.quantity * i.unit_price,
        is_custom_price: i.is_custom_price,
        custom_price_entered_by: i.is_custom_price ? params.performed_by || null : null,
        custom_price_entered_at: i.is_custom_price ? new Date().toISOString() : null,
        notes: i.notes || null,
        created_at: new Date().toISOString(),
        product_name: i.product_name,
        variant_name: i.variant_name,
      })),
    };
  },

  /**
   * Fetch Sales History:
   * Supports filtering by branch_id, date range, status, and payment method.
   */
  async getSalesHistory(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    status?: SaleStatus;
    paymentMethod?: PaymentMethod;
    limit?: number;
  }): Promise<SaleDetailed[]> {
    let query = supabase
      .from('sales')
      .select(`
        *,
        branch:branches ( name ),
        performer:profiles!sales_performed_by_fkey ( full_name ),
        sale_items (
          *,
          variant:product_variants (
            name,
            product:products ( name )
          ),
          batch:product_batches ( batch_number ),
          custom_enterer:profiles!sale_items_custom_price_entered_by_fkey ( full_name )
        )
      `)
      .order('sale_date', { ascending: false });

    if (params?.branchId) {
      query = query.eq('branch_id', params.branchId);
    }

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    if (params?.paymentMethod) {
      query = query.eq('payment_method', params.paymentMethod);
    }

    if (params?.startDate) {
      query = query.gte('sale_date', params.startDate);
    }

    if (params?.endDate) {
      query = query.lte('sale_date', params.endDate);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sales history:', error);
      throw error;
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      branch_id: row.branch_id,
      sale_date: row.sale_date,
      total_amount: Number(row.total_amount),
      payment_method: row.payment_method,
      amount_cash: Number(row.amount_cash),
      amount_online: Number(row.amount_online),
      customer_name: row.customer_name,
      notes: row.notes,
      status: row.status,
      performed_by: row.performed_by,
      order_id: row.order_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      branch_name: row.branch?.name,
      performed_by_name: row.performer?.full_name,
      items: (row.sale_items || []).map((si: any) => ({
        id: si.id,
        sale_id: si.sale_id,
        product_variant_id: si.product_variant_id,
        batch_id: si.batch_id,
        quantity: Number(si.quantity),
        unit_price_snapshot: Number(si.unit_price_snapshot),
        line_total: Number(si.line_total || si.quantity * si.unit_price_snapshot),
        is_custom_price: si.is_custom_price,
        custom_price_entered_by: si.custom_price_entered_by,
        custom_price_entered_at: si.custom_price_entered_at,
        notes: si.notes,
        created_at: si.created_at,
        product_name: si.variant?.product?.name || 'Unknown Product',
        variant_name: si.variant?.name || 'Standard',
        batch_number: si.batch?.batch_number,
        entered_by_name: si.custom_enterer?.full_name,
      })),
    }));
  },
};
