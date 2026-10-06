import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { branchService } from '@/services/branchService';
import {
  reportService,
  type BusinessReportData,
  type BusinessReportType,
  type ReportFilters,
  type SalesReportData,
  type ReturnsReportData,
  type TransfersReportData,
  type MovementsReportData,
} from '@/services/reportService';
import type { Branch, Profile, ReturnReason, ReturnStatus, TransferStatus } from '@/types/database';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Inbox,
  RefreshCw,
} from 'lucide-react';

interface ReportsPageProps {
  profile: Profile | null;
}

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';
type ExportScope = 'CURRENT' | 'COMBINED';

interface ExportSection {
  type: BusinessReportType;
  data: BusinessReportData;
}

const reportLabels: Record<BusinessReportType, string> = {
  sales: 'Sales',
  returns: 'Returns',
  transfers: 'Transfers',
  movements: 'Inventory Movements',
};

const reasonLabels: Record<ReturnReason, string> = {
  RETURN_TO_MAIN: 'Return to Moodubidre',
  EXPIRED: 'Expired',
  DAMAGED: 'Damaged',
  ADJUSTMENT: 'Other / Adjustment',
};

const returnStatusVariant: Record<ReturnStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const transferStatusVariant: Record<TransferStatus, 'primary' | 'warning' | 'success' | 'danger' | 'secondary'> = {
  PENDING: 'warning',
  IN_TRANSIT: 'primary',
  RECEIVED: 'success',
  CANCELLED: 'secondary',
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(value);
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', options || { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);

  // Trigger download in next tick to ensure anchor is fully registered in DOM
  setTimeout(() => {
    try {
      anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch {
      anchor.click();
    }

    // Keep the anchor in DOM and delay object URL revocation (60s) so Chrome's
    // download manager has ample time to process the download asynchronously.
    setTimeout(() => {
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
      URL.revokeObjectURL(objectUrl);
    }, 60000);
  }, 0);
}

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateInputBounds(fromDate: string, toDate: string): { fromInclusive: string; toExclusive: string } {
  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
  const from = new Date(fromYear, fromMonth - 1, fromDay);
  const toExclusive = new Date(toYear, toMonth - 1, toDay + 1);
  return { fromInclusive: from.toISOString(), toExclusive: toExclusive.toISOString() };
}

function getPresetDates(preset: DatePreset, now = new Date()): [string, string] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'YESTERDAY') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const value = localDateValue(yesterday);
    return [value, value];
  }
  if (preset === 'LAST_7_DAYS') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return [localDateValue(start), localDateValue(today)];
  }
  if (preset === 'THIS_MONTH') {
    return [localDateValue(new Date(today.getFullYear(), today.getMonth(), 1)), localDateValue(today)];
  }
  if (preset === 'LAST_MONTH') {
    return [
      localDateValue(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      localDateValue(new Date(today.getFullYear(), today.getMonth(), 0)),
    ];
  }
  const value = localDateValue(today);
  return [value, value];
}

interface ReportBundle {
  summary: { metric: string; value: string | number }[];
  details: Record<string, string | number>[];
  extraSheets: { name: string; rows: Record<string, string | number>[] }[];
}

function exportBundle(type: BusinessReportType, data: BusinessReportData): ReportBundle {
  if (type === 'sales') {
    const sales = data as SalesReportData;
    return {
      summary: [
        { metric: 'Total Sales Amount (INR)', value: sales.summary.totalSales },
        { metric: 'Transactions', value: sales.summary.transactions },
        { metric: 'Items Sold', value: sales.summary.itemsSold },
        { metric: 'Cash Sales (INR)', value: sales.summary.cashSales },
        { metric: 'Online / UPI Sales (INR)', value: sales.summary.onlineSales },
      ],
      details: sales.transactions.map((row) => ({
        Date: row.date,
        Branch: row.branch,
        Employee: row.employee,
        'Employee ID': row.employeeId || '',
        'Payment Method': row.paymentMethod,
        'Items Sold': row.itemsSold,
        Cash: row.cash,
        Online: row.online,
        'Total Sales': row.total,
        'Sale ID': row.id,
      })),
      extraSheets: [
        { name: 'Daily', rows: sales.daily.map((row) => ({ Date: row.date, Transactions: row.transactions, 'Items Sold': row.itemsSold, Cash: row.cash, Online: row.online, 'Total Sales': row.totalSales })) },
        { name: 'Products', rows: sales.products.map((row) => ({ Product: row.product, 'Quantity Sold': row.quantity, 'Total Sales': row.totalSales })) },
        { name: 'Payment Methods', rows: sales.payments.map((row) => ({ 'Payment Method': row.paymentMethod, Transactions: row.transactions, 'Total Sales': row.total })) },
        { name: 'Employees', rows: sales.employees.map((row) => ({ Employee: row.employee, 'Employee ID': row.employeeId || '', Transactions: row.transactions, 'Items Sold': row.itemsSold, 'Total Sales': row.totalSales })) },
      ],
    };
  }

  if (type === 'returns') {
    const returns = data as ReturnsReportData;
    return {
      summary: [
        { metric: 'Total Return Requests', value: returns.summary.requests },
        { metric: 'Approved Returns', value: returns.summary.approved },
        { metric: 'Pending Returns', value: returns.summary.pending },
        { metric: 'Rejected Returns', value: returns.summary.rejected },
        { metric: 'Approved Quantity Returned', value: returns.summary.quantityReturned },
      ],
      details: returns.rows.map((row) => ({ Date: row.date, Product: row.product, Batch: row.batch, Quantity: row.quantity, Branch: row.branch, Reason: reasonLabels[row.reason], Status: row.status, 'Submitted By': row.submittedBy, 'Reviewed By': row.reviewedBy, Notes: row.notes, 'Rejection Reason': row.rejectionReason })),
      extraSheets: [],
    };
  }

  if (type === 'transfers') {
    const transfers = data as TransfersReportData;
    return {
      summary: [
        { metric: 'Total Transfers', value: transfers.summary.transfers },
        { metric: 'Items Sent', value: transfers.summary.itemsSent },
        { metric: 'Items Received', value: transfers.summary.itemsReceived },
        { metric: 'Pending Transfers', value: transfers.summary.pending },
      ],
      details: transfers.rows.map((row) => ({ Date: row.date, Product: row.product, Batch: row.batch, 'Quantity Sent': row.quantitySent, 'Quantity Received': row.quantityReceived ?? '', 'From Branch': row.fromBranch, 'To Branch': row.toBranch, Status: row.status, 'Sent At': row.sentAt, 'Received At': row.receivedAt, 'Transfer Number': row.transferNumber })),
      extraSheets: [],
    };
  }

  const movements = data as MovementsReportData;
  return {
    summary: [{ metric: 'Inventory Movements', value: movements.rows.length }],
    details: movements.rows.map((row) => ({ 'Date / Time': row.date, Product: row.product, Batch: row.batch, Branch: row.branch, 'Movement Type': row.movementType, Quantity: row.quantity, Reference: row.reference, 'Performed By': row.performedBy })),
    extraSheets: [],
  };
}

function reportHasData(type: BusinessReportType, data: BusinessReportData): boolean {
  if (type === 'sales') return (data as SalesReportData).transactions.length > 0;
  if (type === 'returns') return (data as ReturnsReportData).rows.length > 0;
  if (type === 'transfers') return (data as TransfersReportData).summary.transfers > 0;
  return (data as MovementsReportData).rows.length > 0;
}

function tableData(rows: Record<string, string | number>[]): { headers: string[]; body: string[][] } {
  const headers = rows.length ? Object.keys(rows[0]) : ['Result'];
  const body = rows.length
    ? rows.map((row) => headers.map((header) => String(row[header] ?? '')))
    : [['No data found for the selected date range.']];
  return { headers, body };
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>{headers.map((header) => <th key={header} scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-600">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-slate-50/70">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-xs break-words px-3 py-2.5 align-top text-slate-700">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCards({ values }: { values: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {values.map((metric) => (
        <Card key={metric.label}>
          <p className="text-xs font-medium text-slate-500">{metric.label}</p>
          <p className="mt-2 break-words text-xl font-bold text-slate-900">{metric.value}</p>
        </Card>
      ))}
    </div>
  );
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ profile }) => {
  const canAccessReports = profile?.role === 'OWNER' || profile?.role === 'MAIN_BRANCH_EMPLOYEE';
  const initialRange = getPresetDates('TODAY');
  const [reportType, setReportType] = useState<BusinessReportType>('sales');
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [fromDate, setFromDate] = useState(initialRange[0]);
  const [toDate, setToDate] = useState(initialRange[1]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [branchError, setBranchError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<BusinessReportData | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [loadedReportKey, setLoadedReportKey] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportScope, setExportScope] = useState<ExportScope>('CURRENT');

  const isDateRangeValid = Boolean(fromDate && toDate && fromDate <= toDate);
  const branchId = branchFilter === 'ALL' ? null : branchFilter;
  const reportKey = `${reportType}|${fromDate}|${toDate}|${branchFilter}`;
  const isReportCurrent = loadedReportKey === reportKey;
  const isLoading = isDateRangeValid && !isReportCurrent;
  const filters = useMemo<ReportFilters | null>(() => {
    if (!isDateRangeValid) return null;
    return { ...dateInputBounds(fromDate, toDate), branchId };
  }, [fromDate, toDate, branchId, isDateRangeValid]);

  useEffect(() => {
    if (!canAccessReports) return;
    let active = true;
    branchService.getActiveBranches()
      .then((data) => { if (active) setBranches(data); })
      .catch((error) => { if (active) setBranchError(error instanceof Error ? error.message : 'Could not load branches.'); });
    return () => { active = false; };
  }, [canAccessReports]);

  useEffect(() => {
    if (!canAccessReports || !filters) return;
    let active = true;

    async function loadReport() {
      try {
        let data: BusinessReportData;
        if (reportType === 'sales') data = await reportService.getSalesReport(filters!);
        else if (reportType === 'returns') data = await reportService.getReturnsReport(filters!);
        else if (reportType === 'transfers') data = await reportService.getTransfersReport(filters!);
        else data = await reportService.getMovementsReport(filters!);

        if (active) {
          setReportData(data);
          setReportError(null);
          setLoadedReportKey(reportKey);
          setGeneratedAt(new Date().toLocaleString('en-IN'));
        }
      } catch (error) {
        if (active) {
          setReportData(null);
          setReportError(error instanceof Error ? error.message : 'Could not load this report.');
          setLoadedReportKey(reportKey);
        }
      }
    }

    void loadReport();
    return () => { active = false; };
  }, [canAccessReports, filters, reportKey, reportType]);

  const selectedBranchName = branchFilter === 'ALL'
    ? 'All Branches'
    : branches.find((branch) => branch.id === branchFilter)?.name || 'Selected Branch';
  const reportIsEmpty = useMemo(() => {
    if (!reportData || !isReportCurrent) return false;
    if (reportType === 'sales') return (reportData as SalesReportData).transactions.length === 0;
    if (reportType === 'returns') return (reportData as ReturnsReportData).rows.length === 0;
    if (reportType === 'transfers') return (reportData as TransfersReportData).summary.transfers === 0;
    return (reportData as MovementsReportData).rows.length === 0;
  }, [reportData, reportType, isReportCurrent]);

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'CUSTOM') return;
    const [start, end] = getPresetDates(preset);
    setFromDate(start);
    setToDate(end);
  };

  const dateRangeLabel = `${formatDate(`${fromDate}T12:00:00`)} - ${formatDate(`${toDate}T12:00:00`)}`;
  const reportFileName = reportLabels[reportType].replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const fileReportName = exportScope === 'COMBINED' ? 'Combined_Business' : reportFileName;
  const fileBase = `BrowniePoint_${fileReportName}_${fromDate}_to_${toDate}`;

  const getExportSections = async (): Promise<ExportSection[]> => {
    if (exportScope === 'CURRENT') {
      if (!reportData) throw new Error('No data found for the selected date range.');
      if (reportIsEmpty) throw new Error('No data found for the selected date range.');
      return [{ type: reportType, data: reportData }];
    }

    if (!filters) throw new Error('Select a valid date range before exporting.');

    const [sales, returns, transfers, movements] = await Promise.all([
      reportService.getSalesReport(filters),
      reportService.getReturnsReport(filters),
      reportService.getTransfersReport(filters),
      reportService.getMovementsReport(filters),
    ]);
    const sections: ExportSection[] = [
      { type: 'sales', data: sales },
      { type: 'returns', data: returns },
      { type: 'transfers', data: transfers },
      { type: 'movements', data: movements },
    ];

    if (!sections.some((section) => reportHasData(section.type, section.data))) {
      throw new Error('No data found for the selected date range.');
    }
    return sections;
  };

  const downloadExcel = async () => {
    if (!reportData || loadedReportKey !== reportKey) return;
    setExporting('excel');
    setExportError(null);
    try {
      const XLSX = await import('@stackline/xlsx');
      const sections = await getExportSections();
      const workbook = XLSX.utils.book_new();
      const summaryRows = [
        { metric: 'Brownie Point', value: `${fileReportName.replace(/_/g, ' ')} Report` },
        { metric: 'Report Type', value: exportScope === 'COMBINED' ? 'Combined Business' : reportLabels[reportType] },
        { metric: 'Date Range', value: dateRangeLabel },
        { metric: 'Branch', value: selectedBranchName },
        { metric: 'Generated At', value: new Date().toLocaleString() },
        ...sections.flatMap((section) => exportBundle(section.type, section.data).summary.map((row) => ({
          metric: sections.length > 1 ? `${reportLabels[section.type]} · ${row.metric}` : row.metric,
          value: row.value,
        }))),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

      sections.forEach((section) => {
        const bundle = exportBundle(section.type, section.data);
        const prefix = sections.length > 1 ? `${reportLabels[section.type]} ` : '';
        if (sections.length > 1) {
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(bundle.summary), `${reportLabels[section.type]} Summary`);
        }
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(bundle.details.length ? bundle.details : [{ Message: 'No data found for the selected date range.' }]),
          `${prefix}Details`
        );
        bundle.extraSheets.forEach((sheet) => {
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ Message: 'No records' }]), `${prefix}${sheet.name}`);
        });
      });
      const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
      const workbookBlob = new Blob([workbookBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      triggerBlobDownload(workbookBlob, `${fileBase}.xlsx`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Excel export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const downloadPdf = async () => {
    if (!reportData || loadedReportKey !== reportKey) return;
    setExporting('pdf');
    setExportError(null);
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const sections = await getExportSections();
      const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      document.setFont('helvetica', 'bold');
      document.setFontSize(18);
      document.text('BROWNIE POINT', 14, 15);
      document.setFont('helvetica', 'normal');
      document.setFontSize(11);
      document.text(`${exportScope === 'COMBINED' ? 'Combined Business' : reportLabels[reportType]} Report`, 14, 23);
      document.setFontSize(9);
      document.text(`Date Range: ${dateRangeLabel}`, 14, 30);
      document.text(`Branch: ${selectedBranchName}`, 14, 36);
      document.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

      for (const [sectionIndex, section] of sections.entries()) {
        if (sectionIndex > 0) document.addPage();
        let startY = sectionIndex === 0 ? 48 : 18;
        const bundle = exportBundle(section.type, section.data);
        if (sections.length > 1) {
          document.setFont('helvetica', 'bold');
          document.setFontSize(12);
          document.text(reportLabels[section.type], 14, startY);
          startY += 5;
        }

        autoTable(document, {
          startY,
          head: [['Summary', 'Value']],
          body: bundle.summary.map((row) => [row.metric, typeof row.value === 'number' ? String(row.value) : row.value]),
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [91, 31, 45] },
        });

        let pdfState = document as typeof document & { lastAutoTable?: { finalY: number } };
        let nextY = (pdfState.lastAutoTable?.finalY || startY) + 7;
        const details = tableData(bundle.details);
        autoTable(document, {
          startY: nextY,
          head: [details.headers],
          body: details.body,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak' },
          headStyles: { fillColor: [91, 31, 45] },
          horizontalPageBreak: true,
          horizontalPageBreakRepeat: 0,
        });

        pdfState = document as typeof document & { lastAutoTable?: { finalY: number } };
        nextY = (pdfState.lastAutoTable?.finalY || nextY) + 7;
        for (const extraSheet of bundle.extraSheets) {
          const extra = tableData(extraSheet.rows);
          if (nextY > document.internal.pageSize.getHeight() - 15) {
            document.addPage();
            nextY = 18;
          }
          document.setFont('helvetica', 'bold');
          document.setFontSize(9);
          document.text(extraSheet.name, 14, nextY);
          autoTable(document, {
            startY: nextY + 2,
            head: [extra.headers],
            body: extra.body,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak' },
            headStyles: { fillColor: [91, 31, 45] },
            horizontalPageBreak: true,
            horizontalPageBreakRepeat: 0,
          });
          pdfState = document as typeof document & { lastAutoTable?: { finalY: number } };
          nextY = (pdfState.lastAutoTable?.finalY || nextY) + 7;
        }
      }

      const pdfBlob = document.output('blob');
      triggerBlobDownload(pdfBlob, `${fileBase}.pdf`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'PDF export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  if (!canAccessReports) {
    return <Card className="mx-auto max-w-2xl p-8 text-center text-sm text-slate-600">Reports are available to Owner and Main Branch users only.</Card>;
  }

  const salesData = reportType === 'sales' && reportData ? reportData as SalesReportData : null;
  const returnsData = reportType === 'returns' && reportData ? reportData as ReturnsReportData : null;
  const transfersData = reportType === 'transfers' && reportData ? reportData as TransfersReportData : null;
  const movementsData = reportType === 'movements' && reportData ? reportData as MovementsReportData : null;
  const presetOptions: { value: DatePreset; label: string }[] = [
    { value: 'TODAY', label: 'Today' },
    { value: 'YESTERDAY', label: 'Yesterday' },
    { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'LAST_MONTH', label: 'Last Month' },
    { value: 'CUSTOM', label: 'Custom' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <BarChart3 className="h-6 w-6 text-brand-700" />
            Business Reports &amp; Analytics
          </h2>
          <p className="mt-1 text-sm text-slate-600">Operational and financial reports from recorded transactions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="report-export-scope">Export contents</label>
          <select
            id="report-export-scope"
            value={exportScope}
            onChange={(event) => setExportScope(event.target.value as ExportScope)}
            disabled={exporting !== null}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="CURRENT">Current report</option>
            <option value="COMBINED">Combined business</option>
          </select>
          <Button variant="outline" onClick={() => void downloadExcel()} disabled={!reportData || !isReportCurrent || !isDateRangeValid || exporting !== null}>
            {exporting === 'excel' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            {exporting === 'excel' ? 'Generating Excel…' : 'Download Excel'}
          </Button>
          <Button variant="outline" onClick={() => void downloadPdf()} disabled={!reportData || !isReportCurrent || !isDateRangeValid || exporting !== null}>
            {exporting === 'pdf' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {exporting === 'pdf' ? 'Generating PDF…' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {exportError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="block text-sm font-medium text-slate-700">
            Report
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value as BusinessReportType)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              {(Object.entries(reportLabels) as [BusinessReportType, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Branch
            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="ALL">All Branches</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            From Date
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => { setFromDate(event.target.value); setDatePreset('CUSTOM'); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            To Date
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(event) => { setToDate(event.target.value); setDatePreset('CUSTOM'); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><CalendarDays className="h-4 w-4" /> Presets</span>
          {presetOptions.map((preset) => (
            <button
              key={preset.value}
              type="button"
              aria-pressed={datePreset === preset.value}
              onClick={() => applyPreset(preset.value)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${datePreset === preset.value ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {branchError && <p role="alert" className="mt-3 text-xs text-rose-700">Branch list unavailable: {branchError}</p>}
        {!isDateRangeValid && <p role="alert" className="mt-3 text-sm text-rose-700">From Date must be on or before To Date.</p>}
      </Card>

      {reportError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{reportError}</span>
        </div>
      )}

      {isLoading ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading {reportLabels[reportType].toLowerCase()} report…
        </Card>
      ) : isReportCurrent && !reportError && reportIsEmpty ? (
        <Card className="border-2 border-dashed border-slate-200 p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Inbox className="h-6 w-6" /></div>
          <h3 className="text-base font-semibold text-slate-800">No data found for the selected date range.</h3>
        </Card>
      ) : null}

      {!isLoading && isReportCurrent && !reportError && !reportIsEmpty && salesData && (
        <div className="space-y-6">
          <MetricCards values={[
            { label: 'Total Sales Amount', value: formatCurrency(salesData.summary.totalSales) },
            { label: 'Number of Transactions', value: salesData.summary.transactions.toLocaleString('en-IN') },
            { label: 'Total Items Sold', value: formatQuantity(salesData.summary.itemsSold) },
            { label: 'Cash Sales', value: formatCurrency(salesData.summary.cashSales) },
            { label: 'Online / UPI Sales', value: formatCurrency(salesData.summary.onlineSales) },
          ]} />

          <Card title="Daily Sales Breakdown" subtitle="Sales grouped by local calendar date">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {salesData.daily.map((day) => (
                <div key={day.date} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="font-semibold text-slate-900">{formatDate(`${day.date}T12:00:00`, { month: 'long', day: 'numeric' })}</h3>
                  <p className="mt-2 text-lg font-bold text-brand-800">{formatCurrency(day.totalSales)}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                    <dt>Transactions</dt><dd className="text-right font-medium text-slate-800">{day.transactions}</dd>
                    <dt>Items Sold</dt><dd className="text-right font-medium text-slate-800">{formatQuantity(day.itemsSold)}</dd>
                    <dt>Cash</dt><dd className="text-right font-medium text-slate-800">{formatCurrency(day.cash)}</dd>
                    <dt>Online</dt><dd className="text-right font-medium text-slate-800">{formatCurrency(day.online)}</dd>
                  </dl>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Product Breakdown">
            <Table headers={['Product', 'Quantity Sold', 'Total Sales']} rows={salesData.products.map((row) => [row.product, formatQuantity(row.quantity), formatCurrency(row.totalSales)])} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Payment Method Totals">
              <Table headers={['Payment Method', 'Transactions', 'Total Sales']} rows={salesData.payments.map((row) => [row.paymentMethod, row.transactions, formatCurrency(row.total)])} />
            </Card>
            <Card title="Employee Breakdown" subtitle="Names shown where permitted by profile access policies">
              <Table headers={['Employee / User', 'Transactions', 'Items Sold', 'Total Sales']} rows={salesData.employees.map((row) => [row.employee, row.transactions, formatQuantity(row.itemsSold), formatCurrency(row.totalSales)])} />
            </Card>
          </div>

          <Card title="Sales Transactions" subtitle={`${dateRangeLabel} · ${selectedBranchName}`}>
            <Table
              headers={['Date / Time', 'Branch', 'Employee', 'Payment', 'Items', 'Cash', 'Online', 'Total']}
              rows={salesData.transactions.map((row) => [formatDate(row.date, { dateStyle: 'medium', timeStyle: 'short' }), row.branch, row.employee, row.paymentMethod, formatQuantity(row.itemsSold), formatCurrency(row.cash), formatCurrency(row.online), formatCurrency(row.total)])}
            />
          </Card>
        </div>
      )}

      {!isLoading && isReportCurrent && !reportError && !reportIsEmpty && returnsData && (
        <div className="space-y-6">
          <MetricCards values={[
            { label: 'Total Return Requests', value: String(returnsData.summary.requests) },
            { label: 'Approved Returns', value: String(returnsData.summary.approved) },
            { label: 'Pending Returns', value: String(returnsData.summary.pending) },
            { label: 'Rejected Returns', value: String(returnsData.summary.rejected) },
            { label: 'Quantity Returned', value: formatQuantity(returnsData.summary.quantityReturned) },
          ]} />
          <Card title="Return Requests" subtitle={`${dateRangeLabel} · ${selectedBranchName}`}>
            <Table
              headers={['Date', 'Product', 'Batch', 'Quantity', 'Branch', 'Reason', 'Status', 'Submitted By', 'Reviewed By', 'Notes']}
              rows={returnsData.rows.map((row) => [formatDate(row.date, { dateStyle: 'medium', timeStyle: 'short' }), row.product, row.batch, formatQuantity(row.quantity), row.branch, reasonLabels[row.reason], <Badge key={row.id} variant={returnStatusVariant[row.status]}>{row.status}</Badge>, row.submittedBy, row.reviewedBy || '—', [row.notes, row.rejectionReason && `Rejection: ${row.rejectionReason}`].filter(Boolean).join(' · ') || '—'])}
            />
          </Card>
        </div>
      )}

      {!isLoading && isReportCurrent && !reportError && !reportIsEmpty && transfersData && (
        <div className="space-y-6">
          <MetricCards values={[
            { label: 'Total Transfers', value: String(transfersData.summary.transfers) },
            { label: 'Items Sent', value: formatQuantity(transfersData.summary.itemsSent) },
            { label: 'Items Received', value: formatQuantity(transfersData.summary.itemsReceived) },
            { label: 'Pending Transfers', value: String(transfersData.summary.pending) },
          ]} />
          <Card title="Stock Transfers" subtitle="Date range includes dispatch or receipt events">
            <Table
              headers={['Date', 'Product', 'Batch', 'Qty Sent', 'Qty Received', 'From Branch', 'To Branch', 'Status', 'Sent / Received']}
              rows={transfersData.rows.map((row, index) => [formatDate(row.date, { dateStyle: 'medium', timeStyle: 'short' }), row.product, row.batch, formatQuantity(row.quantitySent), row.quantityReceived === null ? '—' : formatQuantity(row.quantityReceived), row.fromBranch, row.toBranch, <Badge key={`${row.transferId}-${index}`} variant={transferStatusVariant[row.status]}>{row.status}</Badge>, `Sent: ${formatDate(row.sentAt, { dateStyle: 'short', timeStyle: 'short' })}${row.receivedAt ? ` · Received: ${formatDate(row.receivedAt, { dateStyle: 'short', timeStyle: 'short' })}` : ''}`])}
            />
          </Card>
        </div>
      )}

      {!isLoading && isReportCurrent && !reportError && !reportIsEmpty && movementsData && (
        <Card title="Inventory Movements" subtitle={`${dateRangeLabel} · ${selectedBranchName}`}>
          <Table
            headers={['Date / Time', 'Product', 'Batch', 'Branch', 'Movement Type', 'Quantity', 'Reference']}
            rows={movementsData.rows.map((row) => [formatDate(row.date, { dateStyle: 'medium', timeStyle: 'short' }), row.product, row.batch, row.branch, row.movementType, formatQuantity(row.quantity), row.reference])}
          />
        </Card>
      )}

      {!isLoading && isReportCurrent && !reportError && reportData && (
        <p className="text-right text-xs text-slate-500">Generated {generatedAt}</p>
      )}
    </div>
  );
};
