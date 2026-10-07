import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { inventoryService } from '@/services/inventoryService';
import { returnService, type ReturnRequestRecord } from '@/services/returnService';
import type {
  Branch,
  FEFOInventoryRecord,
  MainBranchSpoilageReason,
  MainBranchSpoilageRecord,
  Profile,
  ReturnReason,
  ReturnStatus,
} from '@/types/database';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Inbox,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';

interface ReturnsPageProps {
  profile: Profile | null;
  assignedBranch: Branch | null;
}

type StatusFilter = 'ALL' | ReturnStatus;

const reasonLabels: Record<ReturnReason, string> = {
  RETURN_TO_MAIN: 'Return to Moodubidre',
  EXPIRED: 'Expired',
  DAMAGED: 'Damaged',
  ADJUSTMENT: 'Other / Adjustment',
};

const spoilageReasonLabels: Record<MainBranchSpoilageReason, string> = {
  SPOILED: 'Spoiled',
  DAMAGED: 'Damaged',
  EXPIRED: 'Expired',
  OTHER: 'Other',
};

const statusVariants: Record<ReturnStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const formatQuantity = (quantity: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(Number(quantity));

export const ReturnsPage: React.FC<ReturnsPageProps> = ({ profile, assignedBranch }) => {
  const isBranchEmployee = profile?.role === 'BRANCH_EMPLOYEE';
  const canRecordSpoilage = profile?.role === 'MAIN_BRANCH_EMPLOYEE' && assignedBranch?.branch_type === 'MAIN';
  const canReview = profile?.role === 'OWNER' || profile?.role === 'MAIN_BRANCH_EMPLOYEE';

  const [requests, setRequests] = useState<ReturnRequestRecord[]>([]);
  const [inventoryRecords, setInventoryRecords] = useState<FEFOInventoryRecord[]>([]);
  const [spoilageRecords, setSpoilageRecords] = useState<MainBranchSpoilageRecord[]>([]);
  const [spoilageVariants, setSpoilageVariants] = useState<Awaited<ReturnType<typeof returnService.listActiveSpoilageVariants>>>([]);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [loadedSpoilageScope, setLoadedSpoilageScope] = useState<string | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingSpoilageVariants, setLoadingSpoilageVariants] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [showSpoilageForm, setShowSpoilageForm] = useState(false);
  const [selectedSpoilageVariantId, setSelectedSpoilageVariantId] = useState('');
  const [spoilageQuantity, setSpoilageQuantity] = useState('1');
  const [spoilageReason, setSpoilageReason] = useState<MainBranchSpoilageReason>('SPOILED');
  const [spoilageNotes, setSpoilageNotes] = useState('');
  const [submittingSpoilage, setSubmittingSpoilage] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<ReturnReason>('RETURN_TO_MAIN');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const branchId = assignedBranch?.id;
  const requestScope = `${profile?.role || 'anonymous'}:${branchId || 'unassigned'}`;
  const spoilageScope = `${canRecordSpoilage ? 'main' : 'other'}:${branchId || 'unassigned'}`;
  const loading = loadedScope !== requestScope;
  const loadingSpoilage = canRecordSpoilage && loadedSpoilageScope !== spoilageScope;
  const selectedInventory = inventoryRecords.find((record) => record.inventory_id === selectedInventoryId);

  useEffect(() => {
    let active = true;

    async function loadRequests() {
      try {
        const data = await returnService.listReturnRequests();
        if (active) {
          setRequests(data);
          setPageError(null);
        }
      } catch (error) {
        if (active) setPageError(error instanceof Error ? error.message : 'Could not load return requests.');
      } finally {
        if (active) setLoadedScope(requestScope);
      }
    }

    void loadRequests();
    return () => {
      active = false;
    };
  }, [requestScope]);

  useEffect(() => {
    let active = true;

    if (!isBranchEmployee || !branchId) {
      setInventoryRecords([]);
      return () => {
        active = false;
      };
    }

    async function loadInventory() {
      setLoadingInventory(true);
      try {
        const data = await inventoryService.getFEFOInventory(branchId);
        if (active) {
          setInventoryRecords(data);
          setSelectedInventoryId((current) => current || data[0]?.inventory_id || '');
        }
      } catch (error) {
        if (active) setFormError(error instanceof Error ? error.message : 'Could not load branch inventory.');
      } finally {
        if (active) setLoadingInventory(false);
      }
    }

    void loadInventory();
    return () => {
      active = false;
    };
  }, [isBranchEmployee, branchId]);

  useEffect(() => {
    if (!canRecordSpoilage || !branchId) return;
    let active = true;

    async function loadSpoilageVariants() {
      setLoadingSpoilageVariants(true);
      try {
        const data = await returnService.listActiveSpoilageVariants();
        if (active) {
          setSpoilageVariants(data);
          setSelectedSpoilageVariantId((current) => current || data[0]?.id || '');
        }
      } catch (error) {
        if (active) setFormError(error instanceof Error ? error.message : 'Could not load products for spoilage recording.');
      } finally {
        if (active) setLoadingSpoilageVariants(false);
      }
    }

    void loadSpoilageVariants();
    return () => {
      active = false;
    };
  }, [canRecordSpoilage, branchId]);

  useEffect(() => {
    if (!canRecordSpoilage || !branchId) return;
    const spoilageBranchId = branchId;
    let active = true;

    async function loadSpoilageRecords() {
      try {
        const data = await returnService.listMainBranchSpoilageRecords(spoilageBranchId);
        if (active) {
          setSpoilageRecords(data);
          setPageError(null);
        }
      } catch (error) {
        if (active) setPageError(error instanceof Error ? error.message : 'Could not load Main Branch spoilage records.');
      } finally {
        if (active) setLoadedSpoilageScope(spoilageScope);
      }
    }

    void loadSpoilageRecords();
    return () => {
      active = false;
    };
  }, [canRecordSpoilage, branchId, spoilageScope]);

  const visibleRequests = useMemo(
    () => statusFilter === 'ALL' ? requests : requests.filter((request) => request.status === statusFilter),
    [requests, statusFilter]
  );

  const statusCounts = useMemo(() => ({
    ALL: requests.length,
    PENDING: requests.filter((request) => request.status === 'PENDING').length,
    APPROVED: requests.filter((request) => request.status === 'APPROVED').length,
    REJECTED: requests.filter((request) => request.status === 'REJECTED').length,
  }), [requests]);

  const refreshRequests = async () => {
    const data = await returnService.listReturnRequests();
    setRequests(data);
  };

  const refreshSpoilageRecords = async () => {
    if (!branchId) return;
    const data = await returnService.listMainBranchSpoilageRecords(branchId);
    setSpoilageRecords(data);
  };

  const handleCreateRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedQuantity = Number(quantity);

    if (!selectedInventory) {
      setFormError('Select an available inventory batch.');
      return;
    }
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0 || requestedQuantity > selectedInventory.quantity_available) {
      setFormError(`Enter a quantity greater than zero and no more than ${formatQuantity(selectedInventory.quantity_available)}.`);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setPageError(null);
    setSuccessMessage(null);
    try {
      await returnService.createReturnRequest({
        product_variant_id: selectedInventory.product_variant_id,
        batch_id: selectedInventory.batch_id,
        quantity: requestedQuantity,
        reason,
        notes,
      });
      setShowCreateForm(false);
      setNotes('');
      setQuantity('1');
      setSuccessMessage('Return request submitted. Inventory will remain unchanged until it is approved.');
      try {
        await refreshRequests();
      } catch {
        setPageError('The request was submitted, but the return list could not be refreshed.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not submit the return request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordSpoilage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const recordedQuantity = Number(spoilageQuantity);

    if (!selectedSpoilageVariantId) {
      setFormError('Select a product variant.');
      return;
    }
    if (!Number.isFinite(recordedQuantity) || recordedQuantity <= 0) {
      setFormError('Enter a quantity greater than zero.');
      return;
    }

    setSubmittingSpoilage(true);
    setFormError(null);
    setPageError(null);
    setSuccessMessage(null);
    try {
      await returnService.recordMainBranchSpoilage({
        product_variant_id: selectedSpoilageVariantId,
        quantity: recordedQuantity,
        reason: spoilageReason,
        notes: spoilageNotes,
      });
      setShowSpoilageForm(false);
      setSpoilageNotes('');
      setSpoilageQuantity('1');
      setSuccessMessage('Main Branch production loss recorded.');
      try {
        await refreshSpoilageRecords();
      } catch {
        setPageError('The spoilage record was saved, but its history could not be refreshed.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not record Main Branch spoilage.');
    } finally {
      setSubmittingSpoilage(false);
    }
  };

  const handleReview = async (requestId: string, approve: boolean, rejection?: string) => {
    setProcessingId(requestId);
    setPageError(null);
    setSuccessMessage(null);
    try {
      await returnService.reviewReturnRequest({
        return_id: requestId,
        approve,
        rejection_reason: rejection,
      });
      setRejectingId(null);
      setRejectionReason('');
      setSuccessMessage(approve ? 'Return approved and inventory updated.' : 'Return request rejected.');
      try {
        await refreshRequests();
      } catch {
        setPageError('The review was saved, but the return list could not be refreshed.');
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not review the return request.');
    } finally {
      setProcessingId(null);
    }
  };

  const filters: StatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <RotateCcw className="h-6 w-6 text-brand-700" />
            {canRecordSpoilage ? 'Production Loss & Returns' : 'Returns & Stock Adjustments'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {canRecordSpoilage
              ? 'Record Main Branch production spoilage without changing inventory.'
              : 'Submit branch stock returns and review their processing status.'}
          </p>
        </div>
        {isBranchEmployee ? (
          <Button onClick={() => { setShowCreateForm((open) => !open); setFormError(null); }}>
            {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreateForm ? 'Close form' : 'Create Return'}
          </Button>
        ) : canRecordSpoilage ? (
          <Button onClick={() => { setShowSpoilageForm((open) => !open); setFormError(null); }}>
            {showSpoilageForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showSpoilageForm ? 'Close form' : 'Record Spoilage'}
          </Button>
        ) : null}
      </div>

      {successMessage && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {pageError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      {showCreateForm && isBranchEmployee && (
        <Card className="p-4 sm:p-6">
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-brand-700" />
              <h3 className="text-base font-semibold text-slate-900">New return request</h3>
              {assignedBranch && <span className="text-xs text-slate-500">{assignedBranch.name}</span>}
            </div>

            {formError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Inventory product / batch
                <select
                  required
                  value={selectedInventoryId}
                  disabled={loadingInventory || inventoryRecords.length === 0}
                  onChange={(event) => {
                    const selected = inventoryRecords.find((record) => record.inventory_id === event.target.value);
                    setSelectedInventoryId(event.target.value);
                    if (selected) setQuantity(String(Math.min(1, Number(selected.quantity_available))));
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  {inventoryRecords.length === 0 && <option value="">No available stock at this branch</option>}
                  {inventoryRecords.map((record) => (
                    <option key={record.inventory_id} value={record.inventory_id}>
                      {record.product_name} / {record.variant_name} · Batch {record.batch_number} · Available {formatQuantity(record.quantity_available)} {record.quantity_unit}
                    </option>
                  ))}
                </select>
                {loadingInventory && <span className="mt-1 block text-xs text-slate-500">Loading branch inventory…</span>}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Quantity
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  max={selectedInventory?.quantity_available}
                  step="any"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                {selectedInventory && (
                  <span className="mt-1 block text-xs text-slate-500">
                    Available: {formatQuantity(selectedInventory.quantity_available)} {selectedInventory.quantity_unit}
                  </span>
                )}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Reason
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ReturnReason)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  {Object.entries(reasonLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Notes <span className="font-normal text-slate-500">(optional)</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || loadingInventory || !selectedInventory}>
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Submit request
              </Button>
            </div>
          </form>
        </Card>
      )}

      {showSpoilageForm && canRecordSpoilage && (
        <Card className="p-4 sm:p-6">
          <form onSubmit={handleRecordSpoilage} className="space-y-4">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-brand-700" />
              <h3 className="text-base font-semibold text-slate-900">Record Main Branch production loss</h3>
              {assignedBranch && <span className="text-xs text-slate-500">{assignedBranch.name}</span>}
            </div>

            {formError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Product / Variant
                <select
                  required
                  value={selectedSpoilageVariantId}
                  disabled={loadingSpoilageVariants || spoilageVariants.length === 0}
                  onChange={(event) => setSelectedSpoilageVariantId(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  {spoilageVariants.length === 0 && <option value="">No active product variants</option>}
                  {spoilageVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.product?.name || 'Product'} / {variant.name}
                    </option>
                  ))}
                </select>
                {loadingSpoilageVariants && <span className="mt-1 block text-xs text-slate-500">Loading products…</span>}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Quantity
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  step="any"
                  value={spoilageQuantity}
                  onChange={(event) => setSpoilageQuantity(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Reason
                <select
                  value={spoilageReason}
                  onChange={(event) => setSpoilageReason(event.target.value as MainBranchSpoilageReason)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <option value="SPOILED">Spoiled</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Notes <span className="font-normal text-slate-500">(optional)</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={spoilageNotes}
                  onChange={(event) => setSpoilageNotes(event.target.value)}
                  className="mt-1 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </label>
            </div>

            <p className="text-xs text-slate-500">
              This records production loss only. No Main Branch inventory is checked or changed.
            </p>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowSpoilageForm(false)}>Cancel</Button>
              <Button type="submit" disabled={submittingSpoilage || loadingSpoilageVariants || !selectedSpoilageVariantId}>
                {submittingSpoilage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Record Spoilage
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200" role="tablist" aria-label="Filter return requests">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={statusFilter === filter}
            onClick={() => setStatusFilter(filter)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${statusFilter === filter ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
            <span className="ml-1.5 text-xs text-slate-500">{statusCounts[filter]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading return requests…
        </Card>
      ) : visibleRequests.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200 px-4 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No {statusFilter === 'ALL' ? '' : `${statusFilter.toLowerCase()} `}return records</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            {isBranchEmployee ? 'Create a request to record returned, expired, damaged, or adjusted stock.' : 'Branch return requests will appear here for review.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleRequests.map((request) => {
            const productName = request.product_variant?.product?.name || 'Product';
            const variantName = request.product_variant?.name || 'Variant';
            const busy = processingId === request.id;

            return (
              <Card key={request.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{productName} / {variantName}</h3>
                      <Badge variant={statusVariants[request.status]}>{request.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span>
                        {formatQuantity(request.quantity)}
                        {request.product_variant?.quantity_unit ? ` ${request.product_variant.quantity_unit}` : ''}
                        {request.batch?.batch_number ? ` · Batch ${request.batch.batch_number}` : ''}
                      </span>
                      <span>{reasonLabels[request.reason]}</span>
                      {canReview && request.branch && <span>{request.branch.name}</span>}
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {new Date(request.created_at).toLocaleString()}
                      </span>
                    </div>
                    {request.notes && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{request.notes}</p>}
                    {request.status === 'REJECTED' && request.rejection_reason && (
                      <p className="text-sm text-rose-700"><span className="font-medium">Rejection reason:</span> {request.rejection_reason}</p>
                    )}
                  </div>

                  {canReview && request.status === 'PENDING' && (
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:w-64 lg:flex-col">
                      {rejectingId === request.id ? (
                        <form
                          className="w-full space-y-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (rejectionReason.trim()) void handleReview(request.id, false, rejectionReason);
                          }}
                        >
                          <label className="block text-xs font-medium text-slate-700">
                            Rejection reason
                            <textarea
                              required
                              autoFocus
                              rows={2}
                              value={rejectionReason}
                              onChange={(event) => setRejectionReason(event.target.value)}
                              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                            />
                          </label>
                          <div className="flex gap-2">
                            <Button size="sm" variant="danger" type="submit" disabled={busy || !rejectionReason.trim()}>
                              <XCircle className="h-4 w-4" /> Reject
                            </Button>
                            <Button size="sm" variant="outline" type="button" onClick={() => { setRejectingId(null); setRejectionReason(''); }}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <Button size="sm" disabled={processingId !== null} onClick={() => void handleReview(request.id, true)}>
                            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId !== null}
                            onClick={() => { setRejectingId(request.id); setRejectionReason(''); }}
                          >
                            <X className="h-4 w-4" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {canRecordSpoilage && (
        <section className="space-y-3" aria-labelledby="main-spoilage-history-heading">
          <div>
            <h3 id="main-spoilage-history-heading" className="text-lg font-semibold text-slate-900">
              Main Branch spoilage history
            </h3>
            <p className="text-sm text-slate-500">Production loss records; these do not affect inventory.</p>
          </div>
          {loadingSpoilage ? (
            <Card className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading spoilage history…
            </Card>
          ) : spoilageRecords.length === 0 ? (
            <Card className="border-2 border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No Main Branch spoilage records yet.
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Product / Variant</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {spoilageRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="whitespace-nowrap px-4 py-3">{new Date(record.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {record.product_variant?.product?.name || 'Product'} / {record.product_variant?.name || 'Variant'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatQuantity(record.quantity)}{record.product_variant?.quantity_unit ? ` ${record.product_variant.quantity_unit}` : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{spoilageReasonLabels[record.reason]}</td>
                      <td className="whitespace-nowrap px-4 py-3">{record.recorded_by_name}</td>
                      <td className="max-w-xs whitespace-pre-wrap break-words px-4 py-3">{record.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
