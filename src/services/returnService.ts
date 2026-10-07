import { supabase } from '@/lib/supabase';
import type {
  MainBranchSpoilageReason,
  MainBranchSpoilageRecord,
  ProductVariant,
  ReturnReason,
  ReturnRequest,
} from '@/types/database';

export interface ReturnRequestRecord extends ReturnRequest {
  branch?: { name: string; branch_code: string } | null;
  product_variant?: {
    name: string;
    quantity_unit?: string;
    product?: { name: string } | null;
  } | null;
  batch?: { batch_number: string; expiry_date: string } | null;
}

export interface MainBranchSpoilageVariant extends Pick<ProductVariant, 'id' | 'name' | 'quantity_unit'> {
  product: { name: string; active: boolean } | null;
}

export const returnService = {
  async listReturnRequests(): Promise<ReturnRequestRecord[]> {
    const { data, error } = await supabase
      .from('return_requests')
      .select(`
        *,
        branch:branches!return_requests_branch_id_fkey(name, branch_code),
        product_variant:product_variants!return_requests_product_variant_id_fkey(
          name,
          quantity_unit,
          product:products!product_variants_product_id_fkey(name)
        ),
        batch:product_batches!return_requests_batch_id_fkey(batch_number, expiry_date)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as ReturnRequestRecord[]) || [];
  },

  async createReturnRequest(params: {
    product_variant_id: string;
    batch_id: string;
    quantity: number;
    reason: ReturnReason;
    notes?: string;
  }): Promise<string> {
    const { data, error } = await supabase.rpc('create_return_request', {
      p_product_variant_id: params.product_variant_id,
      p_batch_id: params.batch_id,
      p_quantity: params.quantity,
      p_reason: params.reason,
      p_notes: params.notes?.trim() || null,
    });

    if (error) throw error;
    return data as string;
  },

  async reviewReturnRequest(params: {
    return_id: string;
    approve: boolean;
    rejection_reason?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('review_return_request', {
      p_return_id: params.return_id,
      p_approve: params.approve,
      p_rejection_reason: params.rejection_reason?.trim() || null,
    });

    if (error) throw error;
  },

  async listActiveSpoilageVariants(): Promise<MainBranchSpoilageVariant[]> {
    const { data, error } = await supabase
      .from('product_variants')
      .select(`
        id,
        name,
        quantity_unit,
        product:products!product_variants_product_id_fkey(name, active)
      `)
      .eq('active', true)
      .order('name');

    if (error) throw error;
    return ((data as unknown as MainBranchSpoilageVariant[]) || [])
      .filter((variant) => variant.product?.active);
  },

  async listMainBranchSpoilageRecords(branchId: string): Promise<MainBranchSpoilageRecord[]> {
    const { data, error } = await supabase
      .from('main_branch_spoilage_records')
      .select(`
        *,
        product_variant:product_variants!main_branch_spoilage_records_product_variant_id_fkey(
          name,
          quantity_unit,
          product:products!product_variants_product_id_fkey(name)
        )
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as MainBranchSpoilageRecord[]) || [];
  },

  async recordMainBranchSpoilage(params: {
    product_variant_id: string;
    quantity: number;
    reason: MainBranchSpoilageReason;
    notes?: string;
  }): Promise<string> {
    const { data, error } = await supabase.rpc('record_main_branch_spoilage', {
      p_product_variant_id: params.product_variant_id,
      p_quantity: params.quantity,
      p_reason: params.reason,
      p_notes: params.notes?.trim() || null,
    });

    if (error) throw error;
    return data as string;
  },
};
