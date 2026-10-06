import qz from 'qz-tray';
import type { SaleDetailed } from './salesService';

export interface PrinterStatusState {
  qzConnected: boolean;
  printerFound: boolean;
  printerName: string | null;
  statusMessage: string;
  lastError: string | null;
}

type StatusListener = (status: PrinterStatusState) => void;

async function fetchQzSecurityText(url: string, init?: RequestInit): Promise<string> {
  console.info(`[QZ security] Requesting ${url}.`);
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) {
    const error = text || `QZ Tray security request failed (${response.status}).`;
    console.error(`[QZ security] ${url} failed with HTTP ${response.status}: ${error}`);
    throw new Error(error);
  }
  console.info(`[QZ security] ${url} completed (${text.length} response characters).`);
  return text;
}

class ThermalPrintService {
  private targetPrinterName = 'POS-80C';
  private listeners: Set<StatusListener> = new Set();
  private connectionAttempt: Promise<boolean> | null = null;

  private currentState: PrinterStatusState = {
    qzConnected: false,
    printerFound: false,
    printerName: null,
    statusMessage: 'Initializing QZ Tray connection...',
    lastError: null,
  };

  constructor() {
    this.setupQZSecurity();
  }

  /** Load the public development certificate and sign QZ requests via Vite's local server. */
  private setupQZSecurity() {
    try {
      qz.security.setCertificatePromise(
        (resolve: (cert: string) => void, reject: (error: Error) => void) => {
          fetchQzSecurityText('/__qz/security/certificate').then(resolve, reject);
        },
        { rejectOnFailure: true }
      );
      qz.security.setSignatureAlgorithm('SHA512');
      qz.security.setSignaturePromise(
        (toSign: string) =>
          (resolve: (signature: string) => void, reject: (error: Error) => void) => {
            console.info(`[QZ security] Signing QZ request (${toSign.length} characters).`);
            fetchQzSecurityText('/__qz/security/signature', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: toSign,
            }).then(resolve, reject);
          }
      );
      console.info('[QZ security] Certificate and SHA-512 signature handlers configured.');
    } catch (error: unknown) {
      console.error('[QZ security] Failed to configure QZ security handlers:', error);
      throw error;
    }
  }

  /**
   * Subscribe to status updates for UI badges.
   */
  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(newState: Partial<PrinterStatusState>) {
    this.currentState = { ...this.currentState, ...newState };
    this.listeners.forEach((listener) => listener(this.currentState));
  }

  public getStatus(): PrinterStatusState {
    return this.currentState;
  }

  /**
   * Connect to QZ Tray WebSocket and search for POS-80C printer.
   */
  public initConnection(): Promise<boolean> {
    if (!this.connectionAttempt) {
      const attempt = this.connectAndFindPrinter();
      this.connectionAttempt = attempt.finally(() => {
        this.connectionAttempt = null;
      });
    }
    return this.connectionAttempt;
  }

  private async connectAndFindPrinter(): Promise<boolean> {
    try {
      console.info('[QZ security] Starting QZ connection after security handlers are configured.');
      this.updateState({
        statusMessage: 'Connecting to QZ Tray...',
        lastError: null,
      });

      if (!qz.websocket.isActive()) {
        await qz.websocket.connect({ retries: 2, delay: 1 });
      }

      this.updateState({
        qzConnected: true,
        statusMessage: 'QZ Tray Connected. Searching for printer...',
      });

      // Search for POS-80C printer
      const printer = await this.findPrinter();
      if (printer) {
        this.updateState({
          printerFound: true,
          printerName: printer,
          statusMessage: `Printer "${printer}" Ready`,
          lastError: null,
        });
        return true;
      } else {
        this.updateState({
          printerFound: false,
          printerName: null,
          statusMessage: `Printer "${this.targetPrinterName}" not found.`,
          lastError: `POS-80C printer not found. Please check the USB connection.`,
        });
        return false;
      }
    } catch (err: unknown) {
      console.error('QZ Tray connection error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.updateState({
        qzConnected: false,
        printerFound: false,
        printerName: null,
        statusMessage: 'QZ Tray connection failed.',
        lastError: `Unable to connect securely to QZ Tray. Confirm QZ Tray is running and the local signing certificate/key are configured. ${errorMessage}`,
      });
      return false;
    }
  }

  /**
   * Search available system printers for "POS-80C" or similar POS thermal printer.
   */
  private async findPrinter(): Promise<string | null> {
    try {
      const match = await qz.printers.find(this.targetPrinterName).catch(() => null);
      if (match) {
        return typeof match === 'string'
          ? match
          : Array.isArray(match) && match.length > 0
          ? match[0]
          : this.targetPrinterName;
      }

      const allPrinters: string[] = await qz.printers.find().catch(() => []);
      if (Array.isArray(allPrinters)) {
        const found = allPrinters.find(
          (p) =>
            p.toLowerCase().includes('pos-80c') ||
            p.toLowerCase().includes('pos-80') ||
            p.toLowerCase().includes('pos80') ||
            p.toLowerCase().includes('pos')
        );
        if (found) return found;
      }
    } catch (e) {
      console.warn('Error discovering printers:', e);
    }
    return null;
  }

  /**
   * Format line items into 48-character wide thermal text.
   */
  private formatLineItem(name: string, qty: number, amount: number, variant?: string): string {
    const qtyStr = String(qty);
    const amountStr = `Rs.${amount.toFixed(2)}`;
    const colQtyWidth = 4;
    const colAmountWidth = 10;
    const colNameWidth = 48 - colQtyWidth - colAmountWidth - 2; // 32 chars

    let displayName = name;
    if (variant && variant !== 'Standard' && variant !== name) {
      displayName += ` (${variant})`;
    }

    // Wrap item name into chunks of 32 chars
    const nameLines: string[] = [];
    let remaining = displayName;
    while (remaining.length > colNameWidth) {
      let cutIdx = remaining.lastIndexOf(' ', colNameWidth);
      if (cutIdx <= 0) cutIdx = colNameWidth;
      nameLines.push(remaining.substring(0, cutIdx).trim());
      remaining = remaining.substring(cutIdx).trim();
    }
    if (remaining.length > 0) {
      nameLines.push(remaining);
    }

    const line1Name = (nameLines[0] || name).padEnd(colNameWidth, ' ');
    const line1Qty = qtyStr.padStart(colQtyWidth, ' ');
    const line1Amount = amountStr.padStart(colAmountWidth, ' ');

    let result = `${line1Name}  ${line1Qty}${line1Amount}\n`;

    for (let i = 1; i < nameLines.length; i++) {
      result += `${nameLines[i]}\n`;
    }

    return result;
  }

  /**
   * Build complete ASCII ESC/POS text command buffer for a completed sale.
   */
  private buildEscPosTextReceipt(sale: SaleDetailed, branchNameFallback?: string): string {
    const ESC = '\x1B';
    const GS = '\x1D';

    const INIT = `${ESC}@`;
    const CENTER = `${ESC}a\x01`;
    const LEFT = `${ESC}a\x00`;
    const BOLD_ON = `${ESC}E\x01`;
    const BOLD_OFF = `${ESC}E\x00`;
    const DOUBLE_SIZE = `${GS}!\x11`;
    const NORMAL_SIZE = `${GS}!\x00`;
    const CUT_PAPER = `${ESC}d\x03${GS}VB\x00`; // Feed 3 lines & cut

    const lineSep = '------------------------------------------------\n';

    const saleDate = new Date(sale.sale_date);
    const dateStr = saleDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = saleDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const receiptNo = sale.id.slice(-8).toUpperCase();
    const branchName = sale.branch_name || branchNameFallback || 'BROWNIE POINT';

    const isCash = sale.payment_method === 'CASH';
    const isMixed = sale.payment_method === 'MIXED';
    const cashReceived = sale.amount_cash;
    const change = isCash ? Math.max(0, Math.round((cashReceived - sale.total_amount) * 100) / 100) : 0;
    const subtotal = sale.total_amount + sale.discount_amount;

    let out = `${INIT}`;

    // Store Header
    out += `${CENTER}`;
    out += `${BOLD_ON}${DOUBLE_SIZE}BROWNIE POINT\n${NORMAL_SIZE}`;
    out += `${branchName.toUpperCase()}\n${BOLD_OFF}`;
    out += lineSep;

    // Receipt Meta
    out += `${LEFT}`;
    out += `Receipt No: ${receiptNo}\n`;
    out += `Date: ${dateStr}\n`;
    out += `Time: ${timeStr}\n`;
    out += lineSep;

    // Column Headers
    out += `${BOLD_ON}ITEM                              QTY    AMOUNT\n${BOLD_OFF}`;
    out += lineSep;

    // Items List
    sale.items.forEach((item) => {
      const lineTotal = item.line_total || item.quantity * item.unit_price_snapshot;
      out += this.formatLineItem(
        item.product_name || 'Item',
        item.quantity,
        lineTotal,
        item.variant_name
      );
    });

    out += lineSep;

    // Subtotal, discount, and final total
    const subLabel = 'Subtotal'.padEnd(38, ' ');
    const subVal = `Rs.${subtotal.toFixed(2)}`.padStart(10, ' ');
    out += `${subLabel}${subVal}\n`;

    if (sale.discount_amount > 0) {
      const discountLabel = 'Discount'.padEnd(38, ' ');
      const discountVal = `-Rs.${sale.discount_amount.toFixed(2)}`.padStart(10, ' ');
      out += `${discountLabel}${discountVal}\n`;
    }

    const totLabel = 'TOTAL'.padEnd(38, ' ');
    const totVal = `Rs.${sale.total_amount.toFixed(2)}`.padStart(10, ' ');
    out += `${BOLD_ON}${totLabel}${totVal}\n${BOLD_OFF}`;
    out += lineSep;

    // Payment Section
    out += `Payment: ${sale.payment_method}\n`;
    if (isCash && cashReceived > 0) {
      const cashLabel = 'Cash Received'.padEnd(38, ' ');
      const cashVal = `Rs.${cashReceived.toFixed(2)}`.padStart(10, ' ');
      out += `${cashLabel}${cashVal}\n`;

      if (change > 0) {
        const changeLabel = 'Change'.padEnd(38, ' ');
        const changeVal = `Rs.${change.toFixed(2)}`.padStart(10, ' ');
        out += `${changeLabel}${changeVal}\n`;
      }
    } else if (isMixed) {
      const mCashLabel = 'Cash Paid'.padEnd(38, ' ');
      const mCashVal = `Rs.${sale.amount_cash.toFixed(2)}`.padStart(10, ' ');
      out += `${mCashLabel}${mCashVal}\n`;

      const mOnlineLabel = 'Online Paid'.padEnd(38, ' ');
      const mOnlineVal = `Rs.${sale.amount_online.toFixed(2)}`.padStart(10, ' ');
      out += `${mOnlineLabel}${mOnlineVal}\n`;
    }

    out += lineSep;

    // Footer
    out += `${CENTER}`;
    out += `${BOLD_ON}THANK YOU FOR VISITING\nBROWNIE POINT\n${BOLD_OFF}`;
    out += `Have a sweet day!\n`;
    out += lineSep;

    // Paper Cut
    out += CUT_PAPER;

    return out;
  }

  /**
   * Main function to print customer receipt via QZ Tray direct USB thermal printing.
   */
  public async printReceipt(
    sale: SaleDetailed,
    branchNameFallback?: string
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Ensure QZ Connection & Printer Detection
    const isReady = await this.initConnection();
    if (!isReady || !this.currentState.printerName) {
      return {
        success: false,
        error: this.currentState.lastError || 'POS-80C printer not found. Please check the USB connection.',
      };
    }

    try {
      // 2. Build ASCII ESC/POS text receipt payload
      const escposTextData = this.buildEscPosTextReceipt(sale, branchNameFallback);

      // 3. Create QZ print config with ISO-8859-1 encoding for POS-80C thermal printer
      const config = qz.configs.create(this.currentState.printerName, {
        encoding: 'ISO-8859-1',
      });

      // 4. Send text-only ESC/POS commands directly to the printer
      const printPayload = [{
        type: 'raw',
        format: 'command',
        flavor: 'plain',
        data: escposTextData,
      }];

      // 5. Send payload directly to POS-80C via QZ Tray
      await qz.print(config, printPayload);

      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('QZ Tray direct print error:', err);
      return {
        success: false,
        error: `Thermal print failed: ${errMsg}`,
      };
    }
  }
}

export const thermalPrintService = new ThermalPrintService();
