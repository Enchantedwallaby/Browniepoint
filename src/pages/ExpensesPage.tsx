import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Wallet,
  PlusCircle,
  Trash2,
  CalendarDays,
  CreditCard,
  Banknote,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { branchService } from '@/services/branchService';
import {
  expenseService,
  EXPENSE_CATEGORIES,
  type ExpenseFilters,
  type ExpenseSummary,
} from '@/services/expenseService';
import type { Branch, Profile, Expense, ExpensePaymentMethod } from '@/types/database';

interface ExpensesPageProps {
  profile: Profile;
  assignedBranch: Branch | null;
}

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'ALL_TIME' | 'CUSTOM';

function getLocalDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPresetDates(preset: DatePreset): { start?: string; end?: string } {
  const today = new Date();
  const todayStr = getLocalDateString(today);

  if (preset === 'TODAY') {
    return { start: todayStr, end: todayStr };
  }
  if (preset === 'YESTERDAY') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const yStr = getLocalDateString(y);
    return { start: yStr, end: yStr };
  }
  if (preset === 'LAST_7_DAYS') {
    const s = new Date(today);
    s.setDate(s.getDate() - 6);
    return { start: getLocalDateString(s), end: todayStr };
  }
  if (preset === 'THIS_MONTH') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: getLocalDateString(s), end: todayStr };
  }
  if (preset === 'ALL_TIME') {
    return {};
  }
  return { start: todayStr, end: todayStr };
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ profile, assignedBranch }) => {
  const isOwner = profile.role === 'OWNER';

  // Branches
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Form State
  const [formBranchId, setFormBranchId] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formReason, setFormReason] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<ExpensePaymentMethod>('CASH');
  const [formDate, setFormDate] = useState<string>(getLocalDateString());
  const [formNotes, setFormNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>('THIS_MONTH');
  const [filterStartDate, setFilterStartDate] = useState<string>(getPresetDates('THIS_MONTH').start || '');
  const [filterEndDate, setFilterEndDate] = useState<string>(getPresetDates('THIS_MONTH').end || '');
  const [filterBranchId, setFilterBranchId] = useState<string>(isOwner ? 'ALL' : assignedBranch?.id || '');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<ExpensePaymentMethod | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Expenses List State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);

  // Delete Action State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load branches
  useEffect(() => {
    let active = true;
    const fetchBranches = async () => {
      setBranchesLoading(true);
      try {
        const list = await branchService.getActiveBranches();
        if (active) {
          setBranches(list);
          if (list.length > 0) {
            if (isOwner && !formBranchId) {
              setFormBranchId(list[0].id);
            } else if (assignedBranch?.id) {
              setFormBranchId(assignedBranch.id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      } finally {
        if (active) setBranchesLoading(false);
      }
    };
    void fetchBranches();
    return () => {
      active = false;
    };
  }, [isOwner, assignedBranch]);

  // Set default form branch
  useEffect(() => {
    if (!isOwner && assignedBranch?.id) {
      setFormBranchId(assignedBranch.id);
      setFilterBranchId(assignedBranch.id);
    }
  }, [isOwner, assignedBranch]);

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const filters: ExpenseFilters = {
        branchId: filterBranchId === 'ALL' || !filterBranchId ? null : filterBranchId,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        paymentMethod: filterPaymentMethod,
        category: filterCategory,
      };
      const data = await expenseService.getExpenses(filters);
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
      setListError(err instanceof Error ? err.message : 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [filterBranchId, filterStartDate, filterEndDate, filterPaymentMethod, filterCategory]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  // Handle Preset Change
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const bounds = getPresetDates(preset);
    setFilterStartDate(bounds.start || '');
    setFilterEndDate(bounds.end || '');
  };

  // Handle Expense Submission
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const amountNum = parseFloat(formAmount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      setFormError('Please enter a valid expense amount greater than ₹0.');
      return;
    }

    const trimmedReason = formReason.trim();
    if (!trimmedReason) {
      setFormError('Please enter a reason or description for the expense.');
      return;
    }

    const targetBranchId = isOwner ? formBranchId : (assignedBranch?.id || formBranchId);
    if (!targetBranchId) {
      setFormError('Please select a branch.');
      return;
    }

    setSubmitting(true);
    try {
      await expenseService.recordExpense({
        branch_id: targetBranchId,
        amount: amountNum,
        reason: trimmedReason,
        category: formCategory,
        payment_method: formPaymentMethod,
        expense_date: formDate,
        notes: formNotes.trim() || undefined,
      });

      setFormSuccess(`Expense of ₹${amountNum.toFixed(2)} recorded successfully.`);
      setFormAmount('');
      setFormReason('');
      setFormNotes('');
      // Refresh list
      void fetchExpenses();
    } catch (err) {
      console.error('Error saving expense:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteExpense = async (id: string) => {
    if (!isOwner) return;
    setDeletingId(id);
    try {
      await expenseService.deleteExpense(id);
      setDeleteConfirmId(null);
      void fetchExpenses();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete expense.');
    } finally {
      setDeletingId(null);
    }
  };

  // Summaries
  const summary: ExpenseSummary = useMemo(() => {
    return expenseService.calculateSummary(expenses);
  }, [expenses]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-brand-700" />
            Daily Expenses
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Record and track daily operational expenses (milk, cleaning supplies, packaging, maintenance, etc.)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-white">
            <Building2 className="w-3.5 h-3.5 mr-1 text-slate-500" />
            {isOwner ? 'All Branches' : assignedBranch?.name || 'Assigned Branch'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void fetchExpenses()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Grid: Recording Form & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Record Expense Form Card */}
        <div className="lg:col-span-1">
          <Card title="Record Daily Expense" subtitle="Quick operational expense entry">
            <form onSubmit={handleSubmitExpense} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Branch Selector (Owner only, fixed for branch employees) */}
              {isOwner ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Branch *
                  </label>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    required
                    disabled={branchesLoading}
                    className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.branch_code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Branch
                  </label>
                  <div className="w-full text-sm rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 font-medium">
                    {assignedBranch?.name || 'Assigned Branch'}
                  </div>
                </div>
              )}

              {/* Expense Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm font-semibold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    className="w-full text-sm rounded-lg border border-slate-300 pl-8 pr-3 py-2 bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Reason / Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason / Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 packets milk, mop & detergent, auto fare"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormPaymentMethod('CASH')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                      formPaymentMethod === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    CASH
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormPaymentMethod('ONLINE')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                      formPaymentMethod === 'ONLINE'
                        ? 'bg-brand-700 text-white border-brand-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    ONLINE (UPI)
                  </button>
                </div>
              </div>

              {/* Expense Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Expense Date *
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Additional details or vendor info"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Submit Button */}
              <Button type="submit" variant="primary" className="w-full mt-2" disabled={submitting}>
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    Record Expense
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* Metric Cards & Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 border-l-4 border-l-rose-500">
              <span className="text-xs font-medium text-slate-500">Total Expenses</span>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                ₹{summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">In selected period</span>
            </Card>

            <Card className="p-4 border-l-4 border-l-emerald-500">
              <span className="text-xs font-medium text-slate-500">Cash Paid</span>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                ₹{summary.cashAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">Cash out of drawer</span>
            </Card>

            <Card className="p-4 border-l-4 border-l-brand-600">
              <span className="text-xs font-medium text-slate-500">Online Paid</span>
              <p className="mt-1 text-2xl font-bold text-brand-800">
                ₹{summary.onlineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">UPI / Bank / Card</span>
            </Card>

            <Card className="p-4 border-l-4 border-l-slate-400">
              <span className="text-xs font-medium text-slate-500">Entries</span>
              <p className="mt-1 text-2xl font-bold text-slate-800">{summary.count}</p>
              <span className="text-[11px] text-slate-400 mt-1 block">Transactions recorded</span>
            </Card>
          </div>

          {/* Filter Bar Card */}
          <Card className="p-4">
            <div className="flex flex-col gap-3">
              {/* Preset buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Presets:
                </span>
                {(
                  [
                    { id: 'TODAY', label: 'Today' },
                    { id: 'YESTERDAY', label: 'Yesterday' },
                    { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
                    { id: 'THIS_MONTH', label: 'This Month' },
                    { id: 'ALL_TIME', label: 'All Time' },
                  ] as { id: DatePreset; label: string }[]
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetChange(p.id)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                      datePreset === p.id
                        ? 'bg-brand-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Detailed Filter Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* From Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => {
                      setFilterStartDate(e.target.value);
                      setDatePreset('CUSTOM');
                    }}
                    className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                {/* To Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => {
                      setFilterEndDate(e.target.value);
                      setDatePreset('CUSTOM');
                    }}
                    className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                {/* Branch (Owner only) */}
                {isOwner && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Branch</label>
                    <select
                      value={filterBranchId}
                      onChange={(e) => setFilterBranchId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="ALL">All Branches</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Payment Method */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment</label>
                  <select
                    value={filterPaymentMethod}
                    onChange={(e) => setFilterPaymentMethod(e.target.value as ExpensePaymentMethod | 'ALL')}
                    className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="ALL">All Methods</option>
                    <option value="CASH">Cash</option>
                    <option value="ONLINE">Online (UPI)</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="ALL">All Categories</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Expenses Table */}
          <Card title="Expenses History" subtitle={`${expenses.length} records found`}>
            {listError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{listError}</span>
              </div>
            )}

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading expenses...
              </div>
            ) : expenses.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No expense records match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Branch</th>
                      <th className="px-4 py-3 text-left">Reason / Description</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Payment</th>
                      <th className="px-4 py-3 text-left">Recorded By</th>
                      <th className="px-4 py-3 text-right">Amount (₹)</th>
                      {isOwner && <th className="px-4 py-3 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {expenses.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-slate-900">
                          {item.expense_date}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                          {item.branch_name || 'Branch'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="font-semibold text-slate-900 block">{item.reason}</span>
                          {item.notes && (
                            <span className="text-[11px] text-slate-400 italic block">{item.notes}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                          <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                            {item.category || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {item.payment_method === 'CASH' ? (
                            <Badge variant="success" className="gap-1">
                              <Banknote className="w-3 h-3" />
                              CASH
                            </Badge>
                          ) : (
                            <Badge variant="primary" className="gap-1">
                              <CreditCard className="w-3 h-3" />
                              ONLINE
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                          {item.recorded_by_name || 'Staff'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-bold text-slate-900">
                          ₹{Number(item.amount).toFixed(2)}
                        </td>
                        {isOwner && (
                          <td className="px-4 py-3 whitespace-nowrap text-center text-xs">
                            {deleteConfirmId === item.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteExpense(item.id)}
                                  disabled={deletingId === item.id}
                                  className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded hover:bg-rose-700 font-semibold"
                                >
                                  {deletingId === item.id ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(item.id)}
                                title="Delete expense"
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
