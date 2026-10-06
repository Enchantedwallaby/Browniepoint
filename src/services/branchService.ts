import { supabase } from '@/lib/supabase';
import type { Branch } from '@/types/database';

export const branchService = {
  async getActiveBranches(): Promise<Branch[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching active branches:', error);
      throw error;
    }

    return data || [];
  },

  async getBranchByCode(branchCode: string): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('branch_code', branchCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Row not found
      console.error('Error fetching branch by code:', error);
      throw error;
    }

    return data;
  },

  async getBranchById(branchId: string): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching branch by ID:', error);
      throw error;
    }

    return data;
  },
};
