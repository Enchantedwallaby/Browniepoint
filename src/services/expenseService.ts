import { supabase } from '@/lib/supabase';
import type { Expense, ExpensePaymentMethod } from '@/types/database';

export interface RecordExpenseParams {
  branch_id: string;
  amount: number;
  reason: string;
  category?: string;
  payment_method: ExpensePaymentMethod;
  expense_date?: string;
  notes?: string;
}

export interface ExpenseFilters {
  branchId?: string | null;
  startDate?: string;
  endDate?: string;
  paymentMethod?: ExpensePaymentMethod | 'ALL';
  category?: string | 'ALL';
  limit?: number;
}

export interface ExpenseSummary {
  totalAmount: number;
  cashAmount: number;
  onlineAmount: number;
  count: number;
}

export const EXPENSE_CATEGORIES = [
  'Raw Materials / Ingredients',
  'Packaging & Boxes',
  'Transport & Delivery',
  'Utilities & Cleaning',
  'Maintenance & Repairs',
  'Staff & Refreshments',
  'Marketing & Promotions',
  'Other / Miscellaneous',
] as const;

export const expenseService = {
  /**
   * Record a daily expense atomically via PostgreSQL RPC (`public.record_expense`)
   * Enforces server-side validation of active profile, branch access, positive amount, and reason.
   */
  async recordExpense(params: RecordExpenseParams): Promise<string> {
    const amount = Number(params.amount);
    if (!amount || amount <= 0 || isNaN(amount)) {
      throw new Error('Expense amount must be a valid positive number greater than ₹0.');
    }

    const reason = params.reason?.trim();
    if (!reason) {
      throw new Error('Expense reason / description is required.');
    }

    if (!params.branch_id) {
      throw new Error('Branch ID is required to record an expense.');
    }

    const { data, error } = await supabase.rpc('record_expense', {
      p_branch_id: params.branch_id,
      p_amount: Math.round(amount * 100) / 100,
      p_reason: reason,
      p_category: params.category?.trim() || null,
      p_payment_method: params.payment_method,
      p_expense_date: params.expense_date || new Date().toISOString().split('T')[0],
      p_notes: params.notes?.trim() || null,
    });

    if (error) {
      console.error('Error recording expense:', error);
      throw new Error(error.message || 'Failed to record expense.');
    }

    return data as string;
  },

  /**
   * Fetch expenses list with joined branch & employee profile names
   */
  async getExpenses(filters?: ExpenseFilters): Promise<Expense[]> {
    let query = supabase
      .from('expenses')
      .select(`
        *,
        branch:branches ( name ),
        recorder:profiles!expenses_recorded_by_fkey ( full_name )
      `)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    if (filters?.startDate) {
      query = query.gte('expense_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('expense_date', filters.endDate);
    }

    if (filters?.paymentMethod && filters.paymentMethod !== 'ALL') {
      query = query.eq('payment_method', filters.paymentMethod);
    }

    if (filters?.category && filters.category !== 'ALL') {
      query = query.eq('category', filters.category);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching expenses:', error);
      throw new Error(error.message || 'Failed to fetch expenses.');
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      branch_id: row.branch_id,
      recorded_by: row.recorded_by,
      amount: Number(row.amount),
      reason: row.reason,
      category: row.category,
      payment_method: row.payment_method as ExpensePaymentMethod,
      expense_date: row.expense_date,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      branch_name: row.branch?.name || 'Branch',
      recorded_by_name: row.recorder?.full_name || 'Staff',
    }));
  },

  /**
   * Delete an expense record (Owner only)
   */
  async deleteExpense(id: string): Promise<boolean> {
    const { error } = await supabase.rpc('delete_expense', {
      p_expense_id: id,
    });

    if (error) {
      console.error('Error deleting expense:', error);
      throw new Error(error.message || 'Failed to delete expense.');
    }

    return true;
  },

  /**
   * Calculate summary totals from an expenses array
   */
  calculateSummary(expenses: Expense[]): ExpenseSummary {
    let totalAmount = 0;
    let cashAmount = 0;
    let onlineAmount = 0;

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      totalAmount += amt;
      if (exp.payment_method === 'CASH') {
        cashAmount += amt;
      } else {
        onlineAmount += amt;
      }
    }

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      cashAmount: Math.round(cashAmount * 100) / 100,
      onlineAmount: Math.round(onlineAmount * 100) / 100,
      count: expenses.length,
    };
  },
};
