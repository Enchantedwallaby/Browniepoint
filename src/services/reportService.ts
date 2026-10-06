import { supabase } from '@/lib/supabase';
import type { InventoryMovementType, PaymentMethod, ReturnReason, ReturnStatus, TransferStatus } from '@/types/database';

export type BusinessReportType = 'sales' | 'returns' | 'transfers' | 'movements';

export interface ReportFilters {
  fromInclusive: string;
  toExclusive: string;
  branchId: string | null;
}

export interface SalesReportData {
  summary: {
    totalSales: number;
    transactions: number;
    itemsSold: number;
    cashSales: number;
    onlineSales: number;
  };
  transactions: {
    id: string;
    date: string;
    branch: string;
    employee: string;
    employeeId: string | null;
    paymentMethod: PaymentMethod;
    itemsSold: number;
    cash: number;
    online: number;
    total: number;
  }[];
  daily: {
    date: string;
    transactions: number;
    itemsSold: number;
    cash: number;
    online: number;
    totalSales: number;
  }[];
  products: { product: string; quantity: number; totalSales: number }[];
  payments: { paymentMethod: PaymentMethod; total: number; transactions: number }[];
  employees: { employee: string; employeeId: string | null; transactions: number; totalSales: number; itemsSold: number }[];
}

export interface ReturnsReportData {
  summary: { requests: number; approved: number; pending: number; rejected: number; quantityReturned: number };
  rows: {
    id: string;
    date: string;
    product: string;
    batch: string;
    quantity: number;
    branch: string;
    reason: ReturnReason;
    status: ReturnStatus;
    submittedBy: string;
    reviewedBy: string;
    notes: string;
    rejectionReason: string;
  }[];
}

export interface TransfersReportData {
  summary: { transfers: number; itemsSent: number; itemsReceived: number; pending: number };
  rows: {
    transferId: string;
    transferNumber: string;
    date: string;
    product: string;
    batch: string;
    quantitySent: number;
    quantityReceived: number | null;
    fromBranch: string;
    toBranch: string;
    status: TransferStatus;
    sentAt: string;
    receivedAt: string;
    sentInRange: boolean;
    receivedInRange: boolean;
  }[];
}

export interface MovementsReportData {
  rows: {
    id: string;
    date: string;
    product: string;
    batch: string;
    branch: string;
    movementType: InventoryMovementType;
    quantity: number;
    reference: string;
    performedBy: string;
  }[];
}

export type BusinessReportData = SalesReportData | ReturnsReportData | TransfersReportData | MovementsReportData;

const PAGE_SIZE = 1000;

async function fetchAllPages<T>(createQuery: () => any): Promise<T[]> {
  const results: T[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await createQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || 'Could not load report data.');

    const page = (data || []) as T[];
    results.push(...page);
    if (page.length < PAGE_SIZE) return results;
  }
}

function applyBranchFilter(query: any, branchId: string | null) {
  return branchId ? query.eq('branch_id', branchId) : query;
}

function localDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function formatProductDisplayName(productName: string, variantName?: string, showWeightSize?: boolean): string {
  if (!variantName || variantName === 'Standard' || showWeightSize === false) {
    return productName;
  }
  return `${productName} / ${variantName}`;
}

export const reportService = {
  async getSalesReport(filters: ReportFilters): Promise<SalesReportData> {
    const sales = await fetchAllPages<any>(() => {
      let query = supabase
        .from('sales')
        .select(`
          id, sale_date, branch_id, total_amount, payment_method, amount_cash, amount_online, performed_by,
          branch:branches!sales_branch_id_fkey(name),
          performer:profiles!sales_performed_by_fkey(full_name),
          sale_items(
            id, quantity, unit_price_snapshot, line_total,
            variant:product_variants!sale_items_product_variant_id_fkey(
              name,
              product:products!product_variants_product_id_fkey(name, show_weight_size)
            )
          )
        `)
        .eq('status', 'COMPLETED')
        .gte('sale_date', filters.fromInclusive)
        .lt('sale_date', filters.toExclusive)
        .order('sale_date', { ascending: true });

      query = applyBranchFilter(query, filters.branchId);
      return query;
    });

    const dailyMap = new Map<string, SalesReportData['daily'][number]>();
    const productMap = new Map<string, SalesReportData['products'][number]>();
    const paymentMap = new Map<PaymentMethod, SalesReportData['payments'][number]>();
    const employeeMap = new Map<string, SalesReportData['employees'][number]>();
    let totalSales = 0;
    let cashSales = 0;
    let onlineSales = 0;
    let itemsSold = 0;

    const transactions = sales.map((sale) => {
      const saleItems = (sale.sale_items || []) as any[];
      const transactionItems = saleItems.reduce((sum, item) => sum + numberValue(item.quantity), 0);
      const transactionTotal = numberValue(sale.total_amount);
      const cash = numberValue(sale.amount_cash);
      const online = numberValue(sale.amount_online);
      const method = sale.payment_method as PaymentMethod;
      const employeeId = (sale.performed_by as string | null) || null;
      const employeeName = sale.performer?.full_name || employeeId || 'Not recorded';
      const date = localDateKey(sale.sale_date);

      totalSales += transactionTotal;
      cashSales += cash;
      onlineSales += online;
      itemsSold += transactionItems;

      const daily = dailyMap.get(date) || {
        date,
        transactions: 0,
        itemsSold: 0,
        cash: 0,
        online: 0,
        totalSales: 0,
      };
      daily.transactions += 1;
      daily.itemsSold += transactionItems;
      daily.cash += cash;
      daily.online += online;
      daily.totalSales += transactionTotal;
      dailyMap.set(date, daily);

      const payment = paymentMap.get(method) || { paymentMethod: method, total: 0, transactions: 0 };
      payment.total += transactionTotal;
      payment.transactions += 1;
      paymentMap.set(method, payment);

      const employeeKey = employeeId || 'not-recorded';
      const employee = employeeMap.get(employeeKey) || {
        employee: employeeName,
        employeeId,
        transactions: 0,
        totalSales: 0,
        itemsSold: 0,
      };
      employee.transactions += 1;
      employee.totalSales += transactionTotal;
      employee.itemsSold += transactionItems;
      employeeMap.set(employeeKey, employee);

      for (const item of saleItems) {
        const productName = item.variant?.product?.name || 'Unknown Product';
        const variantName = item.variant?.name || 'Standard';
        const showWeight = item.variant?.product?.show_weight_size ?? true;
        const displayName = formatProductDisplayName(productName, variantName, showWeight);
        const productKey = `${productName}\u0000${variantName}`;
        const product = productMap.get(productKey) || { product: displayName, quantity: 0, totalSales: 0 };
        product.quantity += numberValue(item.quantity);
        product.totalSales += numberValue(item.line_total) || numberValue(item.quantity) * numberValue(item.unit_price_snapshot);
        productMap.set(productKey, product);
      }

      return {
        id: sale.id,
        date: sale.sale_date,
        branch: sale.branch?.name || sale.branch_id,
        employee: employeeName,
        employeeId,
        paymentMethod: method,
        itemsSold: transactionItems,
        cash,
        online,
        total: transactionTotal,
      };
    });

    return {
      summary: { totalSales, transactions: sales.length, itemsSold, cashSales, onlineSales },
      transactions,
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      products: [...productMap.values()].sort((a, b) => b.totalSales - a.totalSales),
      payments: [...paymentMap.values()].sort((a, b) => b.total - a.total),
      employees: [...employeeMap.values()].sort((a, b) => b.totalSales - a.totalSales),
    };
  },

  async getReturnsReport(filters: ReportFilters): Promise<ReturnsReportData> {
    const requests = await fetchAllPages<any>(() => {
      let query = supabase
        .from('return_requests')
        .select(`
          id, branch_id, created_by, product_variant_id, batch_id, quantity, reason, notes,
          status, rejection_reason, reviewed_by, reviewed_at, created_at,
          branch:branches!return_requests_branch_id_fkey(name),
          submitter:profiles!return_requests_created_by_fkey(full_name),
          reviewer:profiles!return_requests_reviewed_by_fkey(full_name),
          product_variant:product_variants!return_requests_product_variant_id_fkey(
            name,
            product:products!product_variants_product_id_fkey(name, show_weight_size)
          ),
          batch:product_batches!return_requests_batch_id_fkey(batch_number)
        `)
        .gte('created_at', filters.fromInclusive)
        .lt('created_at', filters.toExclusive)
        .order('created_at', { ascending: false });

      query = applyBranchFilter(query, filters.branchId);
      return query;
    });

    const rows = requests.map((request) => {
      const productName = request.product_variant?.product?.name || 'Unknown Product';
      const variantName = request.product_variant?.name || 'Standard';
      const showWeight = request.product_variant?.product?.show_weight_size ?? true;
      return {
        id: request.id as string,
        date: request.created_at as string,
        product: formatProductDisplayName(productName, variantName, showWeight),
        batch: request.batch?.batch_number || request.batch_id,
        quantity: numberValue(request.quantity),
        branch: request.branch?.name || request.branch_id,
        reason: request.reason as ReturnReason,
        status: request.status as ReturnStatus,
        submittedBy: request.submitter?.full_name || request.created_by,
        reviewedBy: request.reviewer?.full_name || request.reviewed_by || '',
        notes: request.notes || '',
        rejectionReason: request.rejection_reason || '',
      };
    });

    return {
      summary: {
        requests: rows.length,
        approved: rows.filter((row) => row.status === 'APPROVED').length,
        pending: rows.filter((row) => row.status === 'PENDING').length,
        rejected: rows.filter((row) => row.status === 'REJECTED').length,
        quantityReturned: rows.filter((row) => row.status === 'APPROVED').reduce((sum, row) => sum + row.quantity, 0),
      },
      rows,
    };
  },

  async getTransfersReport(filters: ReportFilters): Promise<TransfersReportData> {
    const createQuery = () => {
      let query = supabase
        .from('stock_transfers')
        .select(`
          id, transfer_number, source_branch_id, destination_branch_id, status,
          dispatched_at, received_at,
          source_branch:branches!stock_transfers_source_branch_id_fkey(name),
          destination_branch:branches!stock_transfers_destination_branch_id_fkey(name),
          stock_transfer_items(
            id, product_variant_id, batch_id, quantity_dispatched, quantity_received,
            variant:product_variants!stock_transfer_items_product_variant_id_fkey(
              name,
              product:products!product_variants_product_id_fkey(name, show_weight_size)
            ),
            batch:product_batches!stock_transfer_items_batch_id_fkey(batch_number)
          )
        `);

      if (filters.branchId) {
        query = query.or(`source_branch_id.eq.${filters.branchId},destination_branch_id.eq.${filters.branchId}`);
      }
      return query;
    };

    const [sentTransfers, receivedTransfers] = await Promise.all([
      fetchAllPages<any>(() => createQuery()
        .gte('dispatched_at', filters.fromInclusive)
        .lt('dispatched_at', filters.toExclusive)
        .order('dispatched_at', { ascending: false })),
      fetchAllPages<any>(() => createQuery()
        .gte('received_at', filters.fromInclusive)
        .lt('received_at', filters.toExclusive)
        .order('received_at', { ascending: false })),
    ]);

    const sentIds = new Set(sentTransfers.map((transfer) => transfer.id as string));
    const receivedIds = new Set(receivedTransfers.map((transfer) => transfer.id as string));
    const transferMap = new Map<string, any>();
    for (const transfer of [...sentTransfers, ...receivedTransfers]) transferMap.set(transfer.id, transfer);

    const rows = [...transferMap.values()].flatMap((transfer) =>
      (transfer.stock_transfer_items || []).map((item: any) => {
        const productName = item.variant?.product?.name || 'Unknown Product';
        const variantName = item.variant?.name || 'Standard';
        const showWeight = item.variant?.product?.show_weight_size ?? true;
        return {
          transferId: transfer.id as string,
          transferNumber: transfer.transfer_number as string,
          date: sentIds.has(transfer.id) ? transfer.dispatched_at as string : transfer.received_at as string,
          product: formatProductDisplayName(productName, variantName, showWeight),
          batch: item.batch?.batch_number || item.batch_id,
          quantitySent: numberValue(item.quantity_dispatched),
          quantityReceived: item.quantity_received === null ? null : numberValue(item.quantity_received),
          fromBranch: transfer.source_branch?.name || transfer.source_branch_id,
          toBranch: transfer.destination_branch?.name || transfer.destination_branch_id,
          status: transfer.status as TransferStatus,
          sentAt: transfer.dispatched_at as string,
          receivedAt: (transfer.received_at as string | null) || '',
          sentInRange: sentIds.has(transfer.id),
          receivedInRange: receivedIds.has(transfer.id),
        };
      })
    );

    return {
      summary: {
        transfers: transferMap.size,
        itemsSent: rows.filter((row) => row.sentInRange).reduce((sum, row) => sum + row.quantitySent, 0),
        itemsReceived: rows.filter((row) => row.receivedInRange).reduce((sum, row) => sum + (row.quantityReceived || 0), 0),
        pending: [...transferMap.values()].filter((transfer) => ['PENDING', 'IN_TRANSIT'].includes(transfer.status)).length,
      },
      rows: rows.sort((a, b) => b.date.localeCompare(a.date)),
    };
  },

  async getMovementsReport(filters: ReportFilters): Promise<MovementsReportData> {
    const movements = await fetchAllPages<any>(() => {
      let query = supabase
        .from('inventory_movements')
        .select(`
          id, branch_id, product_variant_id, batch_id, movement_type, quantity,
          reference_type, reference_id, performed_by, created_at,
          branch:branches!inventory_movements_branch_id_fkey(name),
          performer:profiles!inventory_movements_performed_by_fkey(full_name),
          product_variant:product_variants!inventory_movements_product_variant_id_fkey(
            name,
            product:products!product_variants_product_id_fkey(name, show_weight_size)
          ),
          batch:product_batches!inventory_movements_batch_id_fkey(batch_number)
        `)
        .gte('created_at', filters.fromInclusive)
        .lt('created_at', filters.toExclusive)
        .order('created_at', { ascending: false });

      query = applyBranchFilter(query, filters.branchId);
      return query;
    });

    return {
      rows: movements.map((movement) => {
        const productName = movement.product_variant?.product?.name || 'Unknown Product';
        const variantName = movement.product_variant?.name || 'Standard';
        const showWeight = movement.product_variant?.product?.show_weight_size ?? true;
        return {
          id: movement.id as string,
          date: movement.created_at as string,
          product: formatProductDisplayName(productName, variantName, showWeight),
          batch: movement.batch?.batch_number || movement.batch_id,
          branch: movement.branch?.name || movement.branch_id,
          movementType: movement.movement_type as InventoryMovementType,
          quantity: numberValue(movement.quantity),
          reference: [movement.reference_type, movement.reference_id].filter(Boolean).join(' · ') || '—',
          performedBy: movement.performer?.full_name || movement.performed_by || 'Not recorded',
        };
      }),
    };
  },
};
