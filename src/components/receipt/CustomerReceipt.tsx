import React from 'react';
import type { SaleDetailed } from '@/services/salesService';
import '@/styles/receipt-print.css';

interface CustomerReceiptProps {
  sale: SaleDetailed;
  branchNameFallback?: string;
}

/**
 * CustomerReceipt — thermal POS receipt component (72mm width).
 *
 * Rendered inside a hidden container on screen, made visible only during
 * `window.print()` via the `@media print` rules in receipt-print.css.
 *
 * The id `customer-receipt-print-area` is used by the print CSS to isolate
 * this element from the rest of the page.
 */
export const CustomerReceipt: React.FC<CustomerReceiptProps> = ({
  sale,
  branchNameFallback,
}) => {
  const saleDate = new Date(sale.sale_date);
  const dateStr = saleDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = saleDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Short receipt number — last 8 chars of UUID
  const receiptNo = sale.id.slice(-8).toUpperCase();

  const branchName = sale.branch_name || branchNameFallback || 'BROWNIE POINT';

  const isCash = sale.payment_method === 'CASH';
  const isMixed = sale.payment_method === 'MIXED';

  // For CASH payments, cash received = amount_cash (which may be > total for change)
  const cashReceived = sale.amount_cash;
  const change = isCash ? Math.max(0, Math.round((cashReceived - sale.total_amount) * 100) / 100) : 0;
  const subtotal = sale.total_amount + sale.discount_amount;

  return (
    <div id="customer-receipt-print-area">
      <div className="receipt-thermal">
        {/* Store Header */}
        <div className="receipt-header">
          <p className="receipt-store-name">BROWNIE POINT</p>
          <p className="receipt-branch-name">{branchName}</p>
        </div>

        <hr className="receipt-sep" />

        {/* Receipt Meta */}
        <div className="receipt-meta">
          <div className="receipt-meta-row">
            <span className="receipt-meta-label">Receipt No:</span>
            <span>{receiptNo}</span>
          </div>
          <div className="receipt-meta-row">
            <span className="receipt-meta-label">Date:</span>
            <span>{dateStr}</span>
          </div>
          <div className="receipt-meta-row">
            <span className="receipt-meta-label">Time:</span>
            <span>{timeStr}</span>
          </div>
        </div>

        <hr className="receipt-sep" />

        {/* Line Items */}
        <table className="receipt-items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, idx) => {
              const lineTotal = item.line_total || item.quantity * item.unit_price_snapshot;
              const showVariant =
                item.variant_name &&
                item.variant_name !== 'Standard' &&
                item.variant_name !== item.product_name;

              return (
                <tr key={idx}>
                  <td>
                    <span className="receipt-item-name">
                      {item.product_name || 'Item'}
                    </span>
                    {showVariant && (
                      <div className="receipt-item-variant">
                        {item.variant_name}
                      </div>
                    )}
                  </td>
                  <td>{item.quantity}</td>
                  <td>₹{lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <hr className="receipt-sep" />

        {/* Totals */}
        <div className="receipt-totals">
          <div className="receipt-total-row">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div className="receipt-total-row">
              <span>Discount</span>
              <span>-₹{sale.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="receipt-total-row grand-total">
            <span>TOTAL</span>
            <span>₹{sale.total_amount.toFixed(2)}</span>
          </div>
        </div>

        <hr className="receipt-sep" />

        {/* Payment */}
        <div className="receipt-payment">
          <div className="receipt-meta-row">
            <span className="receipt-meta-label">Payment:</span>
            <span>{sale.payment_method}</span>
          </div>

          {isCash && cashReceived > 0 && (
            <>
              <div className="receipt-meta-row">
                <span>Cash Received</span>
                <span>₹{cashReceived.toFixed(2)}</span>
              </div>
              {change > 0 && (
                <div className="receipt-meta-row">
                  <span>Change</span>
                  <span>₹{change.toFixed(2)}</span>
                </div>
              )}
            </>
          )}

          {isMixed && (
            <>
              <div className="receipt-meta-row">
                <span>Cash</span>
                <span>₹{sale.amount_cash.toFixed(2)}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Online</span>
                <span>₹{sale.amount_online.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        <hr className="receipt-sep" />

        {/* Footer */}
        <div className="receipt-footer">
          THANK YOU FOR VISITING
          <br />
          BROWNIE POINT
          <div className="receipt-footer-sub">
            Have a sweet day! 🍫
          </div>
        </div>
      </div>
    </div>
  );
};
