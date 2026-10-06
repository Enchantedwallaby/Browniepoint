import { supabase } from '@/lib/supabase';
import type { TransferStatus } from '@/types/database';

export interface CreateTransferItemParam {
  product_variant_id: string;
  quantity: number;
  notes?: string;
  product_name?: string;
  variant_name?: string;
}

export interface CreateTransferParams {
  source_branch_id: string;
  destination_branch_id: string;
  notes?: string;
  dispatched_by?: string;
  items: CreateTransferItemParam[];
}

export interface ReceiveTransferItemParam {
  transfer_item_id: string;
  quantity_received: number;
}

export interface ProcessReceiptParams {
  transfer_id: string;
  discrepancy_notes?: string;
  received_by?: string;
  items: ReceiveTransferItemParam[];
}

export interface StockTransferItemDetailed {
  id: string;
  transfer_id: string;
  product_variant_id: string;
  batch_id: string;
  quantity_dispatched: number;
  quantity_received: number | null;
  notes: string | null;
  created_at: string;
  product_name?: string;
  variant_name?: string;
  batch_number?: string;
  expiry_date?: string;
}

export interface StockTransferDetailed {
  id: string;
  transfer_number: string;
  source_branch_id: string;
  destination_branch_id: string;
  status: TransferStatus;
  dispatched_by: string | null;
  dispatched_at: string;
  received_by: string | null;
  received_at: string | null;
  notes: string | null;
  discrepancy_notes: string | null;
  created_at: string;
  updated_at: string;
  source_branch_name?: string;
  destination_branch_name?: string;
  dispatched_by_name?: string;
  received_by_name?: string;
  items: StockTransferItemDetailed[];
}

export const transferService = {
  /**
   * Dispatch a Stock Transfer strictly via atomic PostgreSQL RPC (`public.create_stock_transfer`).
   * No client-side fallbacks — enforces 100% database transaction atomicity.
   */
  async createTransfer(params: CreateTransferParams): Promise<string> {
    if (!params.source_branch_id || !params.destination_branch_id) {
      throw new Error('Source and destination branches are required.');
    }

    if (params.source_branch_id === params.destination_branch_id) {
      throw new Error('Source and destination branches must be different.');
    }

    if (!params.items || params.items.length === 0) {
      throw new Error('Cannot create a transfer with no items.');
    }

    const payload = {
      p_source_branch_id: params.source_branch_id,
      p_destination_branch_id: params.destination_branch_id,
      p_notes: params.notes?.trim() || null,
      p_dispatched_by: params.dispatched_by || null,
      p_items: params.items.map((i) => ({
        product_variant_id: i.product_variant_id,
        quantity: i.quantity,
        notes: i.notes || null,
      })),
    };

    const { data: transferId, error } = await supabase.rpc('create_stock_transfer', payload);

    if (error) {
      console.error('RPC create_stock_transfer error:', error);
      throw new Error(
        error.message || 'Failed to dispatch stock transfer via atomic PostgreSQL RPC.'
      );
    }

    return transferId as string;
  },

  /**
   * Approve and Process Transfer Receipt strictly via atomic PostgreSQL RPC (`public.process_stock_transfer_receipt`).
   * No client-side fallbacks — enforces 100% database transaction atomicity.
   */
  async approveTransferReceipt(params: ProcessReceiptParams): Promise<void> {
    if (!params.transfer_id) {
      throw new Error('Transfer ID is required.');
    }

    const payload = {
      p_transfer_id: params.transfer_id,
      p_received_items: params.items.map((i) => ({
        transfer_item_id: i.transfer_item_id,
        quantity_received: i.quantity_received,
      })),
      p_discrepancy_notes: params.discrepancy_notes?.trim() || null,
      p_received_by: params.received_by || null,
    };

    const { error } = await supabase.rpc('process_stock_transfer_receipt', payload);

    if (error) {
      console.error('RPC process_stock_transfer_receipt error:', error);
      throw new Error(
        error.message || 'Failed to approve transfer receipt via atomic PostgreSQL RPC.'
      );
    }
  },

  /**
   * Fetch Stock Transfers History & In-Transit Records
   */
  async getTransfers(params?: {
    branchId?: string;
    status?: TransferStatus;
    limit?: number;
  }): Promise<StockTransferDetailed[]> {
    let query = supabase
      .from('stock_transfers')
      .select(`
        *,
        source_branch:branches!stock_transfers_source_branch_id_fkey ( name ),
        destination_branch:branches!stock_transfers_destination_branch_id_fkey ( name ),
        dispatcher:profiles!stock_transfers_dispatched_by_fkey ( full_name ),
        receiver:profiles!stock_transfers_received_by_fkey ( full_name ),
        stock_transfer_items (
          *,
          variant:product_variants (
            name,
            product:products ( name )
          ),
          batch:product_batches ( batch_number, expiry_date )
        )
      `)
      .order('created_at', { ascending: false });

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    if (params?.branchId) {
      query = query.or(`source_branch_id.eq.${params.branchId},destination_branch_id.eq.${params.branchId}`);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching stock transfers:', error);
      throw error;
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      transfer_number: row.transfer_number,
      source_branch_id: row.source_branch_id,
      destination_branch_id: row.destination_branch_id,
      status: row.status,
      dispatched_by: row.dispatched_by,
      dispatched_at: row.dispatched_at,
      received_by: row.received_by,
      received_at: row.received_at,
      notes: row.notes,
      discrepancy_notes: row.discrepancy_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      source_branch_name: row.source_branch?.name,
      destination_branch_name: row.destination_branch?.name,
      dispatched_by_name: row.dispatcher?.full_name,
      received_by_name: row.receiver?.full_name,
      items: (row.stock_transfer_items || []).map((sti: any) => ({
        id: sti.id,
        transfer_id: sti.transfer_id,
        product_variant_id: sti.product_variant_id,
        batch_id: sti.batch_id,
        quantity_dispatched: Number(sti.quantity_dispatched),
        quantity_received: sti.quantity_received !== null ? Number(sti.quantity_received) : null,
        notes: sti.notes,
        created_at: sti.created_at,
        product_name: sti.variant?.product?.name || 'Unknown Product',
        variant_name: sti.variant?.name || 'Standard',
        batch_number: sti.batch?.batch_number,
        expiry_date: sti.batch?.expiry_date,
      })),
    }));
  },
};
