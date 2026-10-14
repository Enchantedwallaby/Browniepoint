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
  source_is_main?: boolean;
  notes?: string;
  dispatched_by?: string;
  dispatched_at?: string;
  is_backdated?: boolean;
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
  unit_price?: number | null;
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
  is_backdated?: boolean;
  items: StockTransferItemDetailed[];
}

/**
 * Parses a date or timestamp string into a millisecond timestamp.
 * Normalizes YYYY-MM-DD date-only strings to either midnight (start of day)
 * or 23:59:59.999 (end of day).
 */
function parseTimestamp(val: string | null | undefined, isEndOfDay = false): number {
  if (!val) return isEndOfDay ? Infinity : -Infinity;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(`${val}T${isEndOfDay ? '23:59:59.999Z' : '00:00:00.000Z'}`).getTime();
  }
  return new Date(val).getTime();
}

/**
 * Resolves the applicable unit price from a variant's pricing rules for a given reference time.
 *
 * Requirements:
 * 1. For historical dispatches, selects the pricing rule whose effective date range covers
 *    the selected dispatch timestamp, even if that rule is now inactive because it was superseded.
 * 2. For current dispatches, strictly preserves the existing current-price behavior (only active rules).
 * 3. Never uses the current price as a historical fallback unless data proves it was valid on the selected date.
 * 4. Never invents a price; returns null ("Unavailable") if valid pricing cannot be established.
 */
export function resolvePricingRuleUnitPrice(
  pricingRules: any[] | undefined,
  refTime: number,
  isHistorical: boolean
): number | null {
  if (!pricingRules || pricingRules.length === 0) {
    return null;
  }

  // Current dispatches: strictly preserve existing current-price behavior (active rules only)
  if (!isHistorical) {
    const activeRules = pricingRules
      .filter((r: any) => {
        if (!r.active || r.base_price === null || r.base_price === undefined) {
          return false;
        }
        if (r.effective_from) {
          const fromTime = new Date(r.effective_from).getTime();
          if (!isNaN(fromTime) && fromTime > refTime) {
            return false;
          }
        }
        if (r.effective_to) {
          const toTime = new Date(r.effective_to).getTime();
          if (!isNaN(toTime) && toTime < refTime) {
            return false;
          }
        }
        return true;
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.effective_from || 0).getTime() - new Date(a.effective_from || 0).getTime()
      );

    return activeRules.length > 0 && !isNaN(Number(activeRules[0].base_price))
      ? Number(activeRules[0].base_price)
      : null;
  }

  // Historical dispatches: resolve rule whose effective date range covered refTime
  const validRules = pricingRules.filter(
    (r: any) =>
      r &&
      r.base_price !== null &&
      r.base_price !== undefined &&
      !isNaN(Number(r.base_price))
  );

  if (validRules.length === 0) {
    return null;
  }

  // Sort chronologically (oldest first) to establish temporal succession
  const sortedRules = [...validRules].sort((a: any, b: any) => {
    const timeA = new Date(a.effective_from || a.created_at || 0).getTime();
    const timeB = new Date(b.effective_from || b.created_at || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const createdA = new Date(a.created_at || 0).getTime();
    const createdB = new Date(b.created_at || 0).getTime();
    if (createdA !== createdB) return createdA - createdB;
    if (a.active !== b.active) return a.active ? 1 : -1;
    return 0;
  });

  let matchedHistoricalRule: any = null;

  for (let i = 0; i < sortedRules.length; i++) {
    const rule = sortedRules[i];
    const fromTime = parseTimestamp(rule.effective_from || rule.created_at, false);
    if (isNaN(fromTime) || fromTime > refTime) {
      // Started after refTime; could not have covered refTime
      continue;
    }

    let effectiveUntil = Infinity;

    // Explicit end date takes precedence if set
    if (rule.effective_to) {
      const toTime = parseTimestamp(rule.effective_to, true);
      if (!isNaN(toTime)) {
        effectiveUntil = Math.min(effectiveUntil, toTime);
      }
    }

    // If superseded by a later rule, this rule was effective until the successor took effect
    if (i + 1 < sortedRules.length) {
      const nextRule = sortedRules[i + 1];
      const nextFromTime = parseTimestamp(nextRule.effective_from || nextRule.created_at, false);
      if (!isNaN(nextFromTime)) {
        effectiveUntil = Math.min(effectiveUntil, nextFromTime);
      }
    } else if (!rule.active) {
      // Inactive rule with no successor was deactivated at updated_at
      const deactivatedAt = rule.updated_at ? parseTimestamp(rule.updated_at, true) : NaN;
      if (!isNaN(deactivatedAt)) {
        effectiveUntil = Math.min(effectiveUntil, deactivatedAt);
      }
    }

    // refTime must fall within the rule's active window
    if (refTime >= fromTime && refTime <= effectiveUntil) {
      matchedHistoricalRule = rule;
    }
  }

  return matchedHistoricalRule && !isNaN(Number(matchedHistoricalRule.base_price))
    ? Number(matchedHistoricalRule.base_price)
    : null;
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
      p_dispatched_at: params.dispatched_at || null,
    };

    const rpcName = params.source_is_main
      ? 'create_main_branch_stock_transfer'
      : 'create_stock_transfer';
    const { data: transferId, error } = await supabase.rpc(rpcName, payload);

    if (error) {
      console.error(`RPC ${rpcName} error:`, error);
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
            id,
            name,
            product:products ( name ),
            pricing_rules ( id, pricing_type, base_price, active, effective_from, effective_to, created_at, updated_at )
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

    return data.map((row: any) => {
      const refTime = row.dispatched_at && !isNaN(new Date(row.dispatched_at).getTime())
        ? new Date(row.dispatched_at).getTime()
        : (row.created_at && !isNaN(new Date(row.created_at).getTime())
          ? new Date(row.created_at).getTime()
          : Date.now());

      const isBackdated = (row.dispatched_at && row.created_at
        ? new Date(row.dispatched_at).toISOString().split('T')[0] <
          new Date(row.created_at).toISOString().split('T')[0]
        : false) || (typeof row.notes === 'string' && row.notes.includes('[BACKDATED'));

      const isHistorical = isBackdated || (
        Boolean(row.dispatched_at) &&
        !isNaN(new Date(row.dispatched_at).getTime()) &&
        new Date(row.dispatched_at).toISOString().split('T')[0] < new Date().toISOString().split('T')[0]
      );

      return {
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
        is_backdated: isBackdated,
        items: (row.stock_transfer_items || []).map((sti: any) => {
          const unitPrice = resolvePricingRuleUnitPrice(
            sti.variant?.pricing_rules,
            refTime,
            isHistorical
          );

          return {
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
            unit_price: unitPrice,
          };
        }),
      };
    });
  },
};
