import type { StockTransferDetailed } from '@/services/transferService';

/**
 * Parses and computes quantity and weight breakdown to ensure incompatible units are not added incorrectly.
 */
interface TransferTotalsSummary {
  totalLines: number;
  totalDispatchedQty: number;
  totalReceivedQty: number | null;
  hasCakesWithWeight: boolean;
  totalWeightKg: number;
  unitSummaryText: string;
}

function computeTransferTotals(transfer: StockTransferDetailed): TransferTotalsSummary {
  const totalLines = transfer.items.length;
  let totalDispatchedQty = 0;
  let totalReceivedQty = transfer.status === 'RECEIVED' ? 0 : null;
  let totalWeightKg = 0;
  let hasCakesWithWeight = false;

  for (const item of transfer.items) {
    const dQty = Number(item.quantity_dispatched) || 0;
    const rQty = item.quantity_received !== null && item.quantity_received !== undefined
      ? Number(item.quantity_received)
      : dQty;

    totalDispatchedQty += dQty;
    if (totalReceivedQty !== null) {
      totalReceivedQty += rQty;
    }

    // Detect weight variants (e.g., "0.5 kg", "1 kg", "1.5 kg", "2 kg", "500g")
    const variantStr = (item.variant_name || '').toLowerCase().trim();
    const weightMatch = variantStr.match(/([\d.]+)\s*(kg|kilo|g|gram)/);
    if (weightMatch) {
      hasCakesWithWeight = true;
      const num = parseFloat(weightMatch[1]);
      const unit = weightMatch[2];
      if (!isNaN(num)) {
        if (unit.startsWith('g')) {
          totalWeightKg += (num / 1000) * dQty;
        } else {
          totalWeightKg += num * dQty;
        }
      }
    }
  }

  // Format unit summary text
  let unitSummaryText = `${totalDispatchedQty} Units / Pieces`;
  if (hasCakesWithWeight && totalWeightKg > 0) {
    unitSummaryText = `${totalDispatchedQty} Total Units (Specified-weight products: ${totalWeightKg.toFixed(2)} kg)`;
  }

  return {
    totalLines,
    totalDispatchedQty,
    totalReceivedQty,
    hasCakesWithWeight,
    totalWeightKg,
    unitSummaryText,
  };
}

/**
 * Generates an executive-ready, professional A4 delivery challan HTML document.
 * Suitable for commercial delivery presentation to bulk customers, colleges, and retail branches.
 */
export function generateDispatchHtml(transfer: StockTransferDetailed): string {
  const dispatchDate = new Date(transfer.dispatched_at);
  const formattedDateTime = Number.isNaN(dispatchDate.getTime())
    ? transfer.dispatched_at
    : dispatchDate.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

  const formattedDateOnly = Number.isNaN(dispatchDate.getTime())
    ? transfer.dispatched_at.split('T')[0]
    : dispatchDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  const receivedDate = transfer.received_at ? new Date(transfer.received_at) : null;
  const formattedReceivedDateOnly = receivedDate && !Number.isNaN(receivedDate.getTime())
    ? receivedDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const totals = computeTransferTotals(transfer);
  const isReceived = transfer.status === 'RECEIVED';
  const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/brownie-point-logo.png` : '/brownie-point-logo.png';

  const rowsHtml = transfer.items
    .map((item, index) => {
      const receivedCol = isReceived
        ? `<td class="text-right font-bold text-emerald">${item.quantity_received ?? item.quantity_dispatched}</td>`
        : '';

      const variantDisplay = item.variant_name && item.variant_name !== 'Standard'
        ? escapeHtml(item.variant_name)
        : '<span class="text-muted">Standard</span>';

      return `
        <tr>
          <td class="text-center font-mono text-muted">${index + 1}</td>
          <td class="font-bold text-dark">${escapeHtml(item.product_name || 'Item')}</td>
          <td>${variantDisplay}</td>
          <td class="font-mono text-center text-batch">${escapeHtml(item.batch_number || 'N/A')}</td>
          <td class="text-right font-bold text-dark">${item.quantity_dispatched}</td>
          ${receivedCol}
        </tr>
      `;
    })
    .join('');

  const receivedHeader = isReceived ? '<th class="text-right" style="width: 75px;">Received Qty</th>' : '';
  const receivedFooter = isReceived
    ? `<td class="text-right font-bold text-emerald">${totals.totalReceivedQty}</td>`
    : '';

  const notesSection = transfer.notes
    ? `
      <div class="note-card">
        <span class="note-label">DISPATCH NOTES:</span>
        <span class="note-content">${escapeHtml(transfer.notes)}</span>
      </div>
    `
    : '';

  const discrepancySection = transfer.discrepancy_notes
    ? `
      <div class="note-card discrepancy-card">
        <span class="note-label text-danger">DISCREPANCY NOTES:</span>
        <span class="note-content">${escapeHtml(transfer.discrepancy_notes)}</span>
      </div>
    `
    : '';

  const statusLabel = transfer.status === 'RECEIVED'
    ? 'RECEIVED & VERIFIED'
    : transfer.status === 'IN_TRANSIT'
    ? 'IN TRANSIT'
    : transfer.status;

  const statusClass = transfer.status === 'RECEIVED'
    ? 'status-received'
    : transfer.status === 'IN_TRANSIT'
    ? 'status-transit'
    : 'status-pending';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Stock Delivery Challan - ${escapeHtml(transfer.transfer_number)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      width: 100%;
      min-width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.35;
    }

    .challan-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }

    /* ══════════════════════════════════════════════════════
       HEADER SECTION
       ══════════════════════════════════════════════════════ */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 2.5px solid #5b1f2d;
    }

    .brand-cell {
      vertical-align: middle;
      text-align: left;
    }

    .brand-wrapper {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .shop-logo {
      height: 52px;
      width: auto;
      max-width: 140px;
      object-fit: contain;
      display: block;
    }

    .brand-title {
      font-size: 18pt;
      font-weight: 900;
      color: #5b1f2d;
      letter-spacing: 0.8px;
      line-height: 1.1;
      text-transform: uppercase;
    }

    .doc-main-title {
      font-size: 11pt;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-top: 3px;
    }

    .doc-subtitle {
      font-size: 8pt;
      color: #64748b;
      font-style: italic;
      font-weight: 500;
      margin-top: 2px;
    }

    .meta-box-cell {
      vertical-align: middle;
      text-align: right;
      width: 250px;
    }

    .challan-ref-box {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      padding: 8px 14px;
      display: inline-block;
      text-align: right;
      min-width: 215px;
    }

    .ref-label {
      font-size: 7pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .ref-number {
      font-family: "Courier New", Courier, monospace;
      font-size: 11.5pt;
      font-weight: 900;
      color: #5b1f2d;
      white-space: nowrap;
      letter-spacing: 0.5px;
      margin-top: 1px;
    }

    .ref-date {
      font-size: 7.5pt;
      color: #475569;
      font-weight: 600;
      margin-top: 3px;
      white-space: nowrap;
    }

    /* ══════════════════════════════════════════════════════
       ROUTING / MOVEMENT BLOCK (DISPATCHED FROM & DELIVERED TO)
       ══════════════════════════════════════════════════════ */
    .routing-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }

    .routing-card {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      background: #fafaf9;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 80px;
    }

    .routing-card-header {
      font-size: 7pt;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }

    .routing-branch-name {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 6px;
    }

    .routing-card.destination .routing-branch-name {
      color: #5b1f2d;
    }

    .routing-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      font-size: 8pt;
      color: #475569;
    }

    .status-badge {
      display: inline-block;
      font-size: 7pt;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .status-transit {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }

    .status-received {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }

    .status-pending {
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    /* ══════════════════════════════════════════════════════
       PRODUCT LINE ITEMS TABLE
       ══════════════════════════════════════════════════════ */
    .table-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .table-heading {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #334155;
    }

    .items-count {
      font-size: 8pt;
      font-weight: 600;
      color: #64748b;
    }

    table.items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin-bottom: 10px;
    }

    table.items-table thead {
      display: table-header-group;
    }

    table.items-table th {
      background: #5b1f2d;
      color: #ffffff;
      font-weight: 700;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 9px;
      text-align: left;
      border: 1px solid #5b1f2d;
    }

    table.items-table td {
      padding: 6.5px 9px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
      color: #1e293b;
      line-height: 1.3;
    }

    table.items-table tbody tr:nth-child(even) td {
      background: #f8fafc;
    }

    table.items-table tfoot tr td {
      background: #f1f5f9;
      font-weight: 800;
      border-top: 2.5px solid #5b1f2d;
      padding: 7.5px 9px;
      font-size: 9.5pt;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: "Courier New", Courier, monospace; }
    .font-bold { font-weight: 700; }
    .text-muted { color: #64748b; }
    .text-dark { color: #0f172a; }
    .text-emerald { color: #047857; }
    .text-danger { color: #991b1b; }
    .text-batch {
      white-space: nowrap;
      font-size: 9pt;
      font-family: "Courier New", Courier, monospace;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    /* ══════════════════════════════════════════════════════
       TOTALS & QUANTITY BREAKDOWN CARD
       ══════════════════════════════════════════════════════ */
    .totals-card {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 16px;
      margin: 10px 0 12px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
      gap: 14px;
    }

    .totals-metric {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .totals-metric-label {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }

    .totals-metric-value {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0f172a;
    }

    .totals-metric-value.highlight {
      color: #5b1f2d;
    }

    .totals-metric-value.emerald {
      color: #047857;
    }

    .totals-unit-pill {
      font-size: 8.5pt;
      font-weight: 600;
      color: #334155;
      background: #edf2f7;
      padding: 3px 10px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      display: inline-block;
    }

    /* ══════════════════════════════════════════════════════
       NOTES & DISCREPANCIES
       ══════════════════════════════════════════════════════ */
    .note-card {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 7px 10px;
      margin-bottom: 10px;
      font-size: 8pt;
      line-height: 1.35;
      page-break-inside: avoid;
    }

    .discrepancy-card {
      background: #fef2f2;
      border-color: #fecaca;
    }

    .note-label {
      font-weight: 800;
      color: #92400e;
      margin-right: 4px;
    }

    .note-content {
      color: #78350f;
    }

    .discrepancy-card .note-content {
      color: #7f1d1d;
    }

    /* ══════════════════════════════════════════════════════
       SIGNATURE & ACKNOWLEDGEMENT SECTION
       ══════════════════════════════════════════════════════ */
    .acknowledgement-section {
      margin-top: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      page-break-inside: avoid;
    }

    .ack-box {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 16px 14px 16px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 145px;
    }

    .ack-header {
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 5px;
      margin-bottom: 8px;
    }

    .ack-title {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #5b1f2d;
    }

    .ack-branch-prominent {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
      line-height: 1.25;
    }

    .ack-fields {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
    }

    .ack-row {
      display: flex;
      align-items: baseline;
      font-size: 8.5pt;
    }

    .ack-label {
      width: 90px;
      font-weight: 700;
      color: #475569;
    }

    .ack-value {
      flex: 1;
      color: #0f172a;
      font-weight: 600;
      min-height: 1.2em;
    }

    .ack-sig-row {
      margin-top: 8px;
      align-items: flex-end;
    }

    .ack-sig-box {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .ack-sig-line {
      width: 100%;
      border-bottom: 1.5px dashed #475569;
      height: 48px;
      margin-bottom: 3px;
    }

    .ack-sig-hint {
      font-size: 6.5pt;
      color: #94a3b8;
      text-align: right;
      font-style: italic;
    }

    /* ══════════════════════════════════════════════════════
       DOCUMENT FOOTER
       ══════════════════════════════════════════════════════ */
    .challan-footer {
      margin-top: 12px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 7pt;
      color: #94a3b8;
      page-break-inside: avoid;
    }

    tr {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="challan-container">
    <!-- Header Block -->
    <table class="header-table">
      <tr>
        <td class="brand-cell">
          <div class="brand-wrapper">
            <img id="challan-logo" class="shop-logo" src="${escapeHtml(logoUrl)}" alt="Brownie Point Logo" />
            <div>
              <div class="brand-title">BROWNIE POINT</div>
              <div class="doc-main-title">STOCK DELIVERY CHALLAN</div>
              <div class="doc-subtitle">Cake &amp; Bakery Products</div>
            </div>
          </div>
        </td>
        <td class="meta-box-cell">
          <div class="challan-ref-box">
            <div class="ref-label">Challan Ref No.</div>
            <div class="ref-number">${escapeHtml(transfer.transfer_number)}</div>
            <div class="ref-date">${escapeHtml(formattedDateTime)}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Routing Details Block (From & To) -->
    <div class="routing-grid">
      <div class="routing-card">
        <div class="routing-card-header">DISPATCHED FROM (SOURCE BRANCH)</div>
        <div class="routing-branch-name">${escapeHtml(transfer.source_branch_name || 'Main Branch')}</div>
        <div class="routing-meta-row">
          <span>Dispatched: <strong>${escapeHtml(formattedDateTime)}</strong></span>
          <span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
        </div>
      </div>

      <div class="routing-card destination">
        <div class="routing-card-header">DELIVERED TO (DESTINATION / CUSTOMER)</div>
        <div class="routing-branch-name">${escapeHtml(transfer.destination_branch_name || 'Destination Branch')}</div>
        <div class="routing-meta-row">
          <span>${isReceived && transfer.received_by_name && !transfer.received_by_name.includes('@') ? `Received By: <strong>${escapeHtml(transfer.received_by_name)}</strong>` : `Delivery Status: <strong>${escapeHtml(statusLabel)}</strong>`}</span>
          <span>${isReceived && formattedReceivedDateOnly ? `Date: ${formattedReceivedDateOnly}` : ''}</span>
        </div>
      </div>
    </div>

    <!-- Line Items Table -->
    <div class="table-title-bar">
      <span class="table-heading">DISPATCHED PRODUCTS &amp; FEFO BATCHES</span>
      <span class="items-count">Line Items: <strong>${totals.totalLines}</strong></span>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="text-center" style="width: 38px;">Sl.</th>
          <th>Product Name</th>
          <th style="width: 140px;">Flavour / Variant</th>
          <th class="text-center" style="width: 115px; white-space: nowrap;">Batch Number</th>
          <th class="text-right" style="width: 90px;">Dispatched Qty</th>
          ${receivedHeader}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="text-right font-bold">TOTAL DISPATCHED QUANTITY:</td>
          <td class="text-right font-bold font-mono" style="font-size: 10pt;">${totals.totalDispatchedQty}</td>
          ${receivedFooter}
        </tr>
      </tfoot>
    </table>

    <!-- Totals & Units Breakdown Card -->
    <div class="totals-card">
      <div class="totals-metric">
        <span class="totals-metric-label">Total Product Lines</span>
        <span class="totals-metric-value font-mono">${totals.totalLines} Lines</span>
      </div>
      <div class="totals-metric">
        <span class="totals-metric-label">Total Dispatched Qty</span>
        <span class="totals-metric-value highlight font-mono">${totals.totalDispatchedQty} Units</span>
      </div>
      <div class="totals-metric">
        <span class="totals-metric-label">Quantity &amp; Unit Breakdown</span>
        <span class="totals-unit-pill">${escapeHtml(totals.unitSummaryText)}</span>
      </div>
      ${isReceived && totals.totalReceivedQty !== null ? `
      <div class="totals-metric">
        <span class="totals-metric-label">Verified Received Qty</span>
        <span class="totals-metric-value emerald font-mono">${totals.totalReceivedQty} Units</span>
      </div>
      ` : ''}
    </div>

    ${notesSection}
    ${discrepancySection}

    <!-- Dual Signature & Acknowledgement Section -->
    <div class="acknowledgement-section">
      <!-- Left: Source Branch -->
      <div class="ack-box">
        <div class="ack-header">
          <div class="ack-title">DISPATCHED / HANDED OVER BY</div>
          <div class="ack-branch-prominent">${escapeHtml(transfer.source_branch_name || 'Central Kitchen / Main Branch')}</div>
        </div>
        <div class="ack-fields">
          <div class="ack-row">
            <span class="ack-label">Dispatch Date:</span>
            <span class="ack-value">${escapeHtml(formattedDateOnly)}</span>
          </div>
          <div class="ack-row ack-sig-row">
            <span class="ack-label">Signature:</span>
            <div class="ack-sig-box">
              <div class="ack-sig-line"></div>
              <div class="ack-sig-hint">Authorized Signatory / Stamp</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Destination Branch / Customer -->
      <div class="ack-box">
        <div class="ack-header">
          <div class="ack-title">RECEIVED / ACKNOWLEDGED BY</div>
          <div class="ack-branch-prominent">${escapeHtml(transfer.destination_branch_name || 'Destination Branch / Bulk Customer')}</div>
        </div>
        <div class="ack-fields">
          <div class="ack-row">
            <span class="ack-label">Received By:</span>
            <span class="ack-value">${isReceived && transfer.received_by_name && !transfer.received_by_name.includes('@') && transfer.received_by_name !== transfer.dispatched_by_name ? escapeHtml(transfer.received_by_name) : ''}</span>
          </div>
          <div class="ack-row">
            <span class="ack-label">Receipt Date:</span>
            <span class="ack-value">${isReceived && formattedReceivedDateOnly ? formattedReceivedDateOnly : ''}</span>
          </div>
          <div class="ack-row ack-sig-row">
            <span class="ack-label">Signature:</span>
            <div class="ack-sig-box">
              <div class="ack-sig-line"></div>
              <div class="ack-sig-hint">Receiver Signature / Stamp</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Professional Footer -->
    <div class="challan-footer">
      Brownie Point Bakery Management &bull; Stock Delivery Challan &bull; Printed: ${escapeHtml(
        new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      )}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Triggers printing of the stock delivery challan using the standard browser print dialog.
 * Uses an isolated offscreen iframe configured for standard office printers (e.g. Epson L3250) on A4 paper.
 * Ensures the logo image is fully decoded before opening the print dialog.
 */
export function printDispatchDocument(transfer: StockTransferDetailed): void {
  // Mark body with printing-dispatch so any active styles recognise an A4 dispatch print
  document.body.classList.add('printing-dispatch');

  // 1. Remove previous print iframe if still present
  const existingFrame = document.getElementById('bp-dispatch-print-frame');
  if (existingFrame) {
    existingFrame.remove();
  }

  // 2. Create an isolated offscreen iframe with standard A4 dimensions
  const iframe = document.createElement('iframe');
  iframe.id = 'bp-dispatch-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '-9999px';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-dispatch');
    }, 1000);
    return;
  }

  // 3. Write complete standalone A4 delivery challan document
  const htmlContent = generateDispatchHtml(transfer);
  doc.open();
  doc.write(htmlContent);
  doc.close();

  // 4. Ensure the Brownie Point logo is fully loaded before triggering print dialog
  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Failed to trigger iframe print, falling back to window.print():', err);
      window.print();
    } finally {
      // Clean up after print dialog finishes or is dismissed
      setTimeout(() => {
        try {
          iframe.remove();
        } catch {
          // Ignore removal error
        }
        document.body.classList.remove('printing-dispatch');
      }, 60000);
    }
  };

  // Check if logo needs decoding
  const logoImg = doc.getElementById('challan-logo') as HTMLImageElement | null;
  if (logoImg && !logoImg.complete) {
    logoImg.onload = () => setTimeout(triggerPrint, 50);
    logoImg.onerror = () => setTimeout(triggerPrint, 50);
  } else if (logoImg && 'decode' in logoImg) {
    logoImg.decode().then(() => setTimeout(triggerPrint, 30)).catch(() => setTimeout(triggerPrint, 30));
  } else {
    setTimeout(triggerPrint, 150);
  }
}
