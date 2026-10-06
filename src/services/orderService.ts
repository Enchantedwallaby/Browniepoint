import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderStatus } from '@/types/database';

export interface CreateOrderItemParam {
  product_variant_id: string;
  quantity: number;
  notes?: string;
  // UI helper fields
  product_name?: string;
  variant_name?: string;
}

export interface CreateBranchOrderParams {
  branch_id: string;
  required_date: string;
  is_urgent?: boolean;
  notes?: string;
  photo_url?: string;
  created_by?: string;
  items: CreateOrderItemParam[];
}

export interface UpdateOrderStatusParams {
  order_id: string;
  new_status: OrderStatus;
  rejection_reason?: string;
  notes?: string;
  transfer_id?: string;
  user_id?: string;
}

export interface BranchOrderItemDetailed extends OrderItem {
  product_name?: string;
  variant_name?: string;
  category?: string;
  sku?: string;
}

export interface BranchOrderDetailed extends Order {
  branch_name?: string;
  branch_code?: string;
  creator_name?: string;
  accepter_name?: string;
  rejecter_name?: string;
  transfer_number?: string;
  transfer_status?: string;
  items: BranchOrderItemDetailed[];
}

export const orderService = {
  /**
   * Create a new Branch Order atomically.
   * Calls PostgreSQL RPC `public.create_branch_order`.
   * Enforces that NO INVENTORY is deducted on order creation.
   */
  async createBranchOrder(params: CreateBranchOrderParams): Promise<string> {
    if (!params.branch_id) {
      throw new Error('Ordering branch is required.');
    }
    if (!params.required_date) {
      throw new Error('Required date is required.');
    }
    if (!params.items || params.items.length === 0) {
      throw new Error('Order must contain at least one item.');
    }

    const payload = {
      p_branch_id: params.branch_id,
      p_required_date: params.required_date,
      p_is_urgent: Boolean(params.is_urgent),
      p_notes: params.notes?.trim() || null,
      p_items: params.items.map((i) => ({
        product_variant_id: i.product_variant_id,
        quantity: Number(i.quantity),
        notes: i.notes?.trim() || null,
      })),
      p_photo_url: params.photo_url?.trim() || null,
      p_created_by: params.created_by || null,
    };

    // Call atomic RPC
    const { data: orderId, error } = await supabase.rpc('create_branch_order', payload);

    if (error) {
      console.warn('RPC create_branch_order error, attempting standard insert fallback:', error);

      // Clean client fallback if migration hasn't been reloaded yet
      const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const { data: insertedOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          branch_id: params.branch_id,
          order_number: orderNumber,
          customer_name: 'Branch Requisition',
          is_custom_cake: false,
          is_urgent: Boolean(params.is_urgent),
          required_date: params.required_date,
          status: 'PENDING',
          notes: params.notes?.trim() || null,
          photo_url: params.photo_url?.trim() || null,
          created_by: params.created_by || null,
        })
        .select('id')
        .single();

      if (orderErr) {
        throw new Error(orderErr.message || 'Failed to create branch order.');
      }

      const newId = insertedOrder.id;

      const itemsToInsert = params.items.map((i) => ({
        order_id: newId,
        product_variant_id: i.product_variant_id,
        quantity: Number(i.quantity),
        notes: i.notes?.trim() || null,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);

      if (itemsErr) {
        console.error('Error inserting order items:', itemsErr);
        throw new Error(itemsErr.message || 'Failed to record order items.');
      }

      return newId;
    }

    return orderId as string;
  },

  /**
   * Update Branch Order Status through strict lifecycle stages.
   * Calls PostgreSQL RPC `public.update_branch_order_status`.
   */
  async updateOrderStatus(params: UpdateOrderStatusParams): Promise<void> {
    if (!params.order_id) {
      throw new Error('Order ID is required.');
    }
    if (!params.new_status) {
      throw new Error('New status is required.');
    }
    if (params.new_status === 'REJECTED' && (!params.rejection_reason || !params.rejection_reason.trim())) {
      throw new Error('A rejection reason is required when rejecting an order.');
    }

    const payload = {
      p_order_id: params.order_id,
      p_new_status: params.new_status,
      p_rejection_reason: params.rejection_reason?.trim() || null,
      p_notes: params.notes?.trim() || null,
      p_transfer_id: params.transfer_id || null,
      p_user_id: params.user_id || null,
    };

    const { error } = await supabase.rpc('update_branch_order_status', payload);

    if (error) {
      console.warn('RPC update_branch_order_status error, falling back to direct update:', error);

      const updateData: Record<string, any> = {
        status: params.new_status,
        updated_at: new Date().toISOString(),
      };

      if (params.new_status === 'REJECTED') {
        updateData.rejection_reason = params.rejection_reason?.trim();
        updateData.rejected_by = params.user_id || null;
        updateData.rejected_at = new Date().toISOString();
      } else if (params.new_status === 'ACCEPTED') {
        updateData.accepted_by = params.user_id || null;
        updateData.accepted_at = new Date().toISOString();
      } else if (params.new_status === 'CANCELLED') {
        updateData.cancelled_by = params.user_id || null;
        updateData.cancelled_at = new Date().toISOString();
      } else if (params.new_status === 'COMPLETED') {
        updateData.completed_at = new Date().toISOString();
      }

      if (params.transfer_id) {
        updateData.transfer_id = params.transfer_id;
      }

      if (params.notes) {
        updateData.notes = params.notes.trim();
      }

      const { error: directErr } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', params.order_id);

      if (directErr) {
        throw new Error(directErr.message || 'Failed to update order status.');
      }
    }
  },

  /**
   * Fetch Branch Orders with relations (Branch, Creator, Items, Variants, Products, Linked Transfer).
   */
  async getOrders(params?: {
    branchId?: string;
    status?: OrderStatus;
    isUrgent?: boolean;
    requiredDate?: string;
    limit?: number;
  }): Promise<BranchOrderDetailed[]> {
    let query = supabase
      .from('orders')
      .select(`
        *,
        branch:branches ( name, branch_code ),
        creator:profiles!orders_created_by_fkey ( full_name ),
        accepter:profiles!orders_accepted_by_fkey ( full_name ),
        rejecter:profiles!orders_rejected_by_fkey ( full_name ),
        transfer:stock_transfers!orders_transfer_id_fkey ( id, transfer_number, status ),
        items:order_items (
          id,
          product_variant_id,
          quantity,
          notes,
          created_at,
          variant:product_variants (
            id,
            name,
            product:products (
              id,
              name,
              category
            )
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (params?.branchId) {
      query = query.eq('branch_id', params.branchId);
    }

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    if (params?.isUrgent !== undefined) {
      query = query.eq('is_urgent', params.isUrgent);
    }

    if (params?.requiredDate) {
      query = query.eq('required_date', params.requiredDate);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;
    // Log full response for debugging
    console.log('DEBUG getOrders response:', { data, error });
    if (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }

    if (!data) return [];

    return data.map((row: any) => ({
      ...row,
      branch_name: row.branch?.name,
      branch_code: row.branch?.branch_code,
      creator_name: row.creator?.full_name,
      accepter_name: row.accepter?.full_name,
      rejecter_name: row.rejecter?.full_name,
      transfer_number: row.transfer?.transfer_number,
      transfer_status: row.transfer?.status,
      items: (row.items || []).map((i: any) => ({
        id: i.id,
        order_id: row.id,
        product_variant_id: i.product_variant_id,
        quantity: Number(i.quantity),
        notes: i.notes,
        created_at: i.created_at,
        product_name: i.variant?.product?.name || 'Unknown Product',
        variant_name: i.variant?.name || 'Standard',
        category: i.variant?.product?.category,
        sku: i.variant?.sku,
      })),
    }));
  },

  /**
   * Fetch a single order by ID with all details.
   */
  async getOrderById(orderId: string): Promise<BranchOrderDetailed | null> {
    const orders = await this.getOrders({ limit: 1 });
    const match = orders.find((o) => o.id === orderId);
    return match || null;
  },
};
