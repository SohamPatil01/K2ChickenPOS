export interface BillSale {
  id: string;
  saleNo: string;
  status: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  deliveryFee?: number;
  grandTotal: number;
  createdAt: string;
  createdBy?: { name: string };
  customer?: {
    name: string;
    phone: string;
    area?: string | null;
  } | null;
  items: Array<{
    product: { name: string; unitType?: 'KG' | 'PCS' };
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    lineTotal: number;
    taxRate?: number;
    taxAmount?: number;
  }>;
  payments?: Array<{ method: string; amount: number }>;
}

export interface BillStoreInfo {
  name?: string;
  phone?: string;
  tagline?: string;
}

const STORE_PHONE = '8484978622';
const LOGO_PATH = '/k2-chicken-logo.svg';

function formatMoney(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-IN')}`;
}

function formatQty(item: BillSale['items'][0]) {
  if (item.qtyKg != null && item.qtyKg > 0) {
    return `${item.qtyKg.toFixed(2)} kg`;
  }
  if (item.qtyPcs != null && item.qtyPcs > 0) {
    return `${item.qtyPcs} pcs`;
  }
  return '-';
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actualPayments(sale: BillSale) {
  return (sale.payments || []).filter((p) => p.method !== 'CREDIT');
}

function paymentSummary(sale: BillSale) {
  const paid = actualPayments(sale).reduce((s, p) => s + p.amount, 0);
  const methods = [...new Set(actualPayments(sale).map((p) => p.method))].join(', ') || 'CASH';
  const balance = Math.max(0, Math.round(sale.grandTotal - paid));
  return { paid, methods, balance };
}

export function buildCustomerBillHtml(sale: BillSale, store?: BillStoreInfo): string {
  const storeName = store?.name || 'K2 Chicken';
  const storePhone = store?.phone || STORE_PHONE;
  const { paid, methods, balance } = paymentSummary(sale);
  const logoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${LOGO_PATH}`
      : LOGO_PATH;

  const itemRows = sale.items
    .map(
      (item, i) => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;">${i + 1}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;font-weight:500;">${item.product.name}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${formatQty(item)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(item.rate)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatMoney(item.lineTotal)}</td>
    </tr>`
    )
    .join('');

  const paymentRows = (sale.payments || [])
    .filter((p) => p.amount > 0)
    .map(
      (p) => `
    <div style="display:flex;justify-content:space-between;font-size:13px;margin:4px 0;">
      <span style="color:#6b7280;">${p.method}</span>
      <span>${formatMoney(p.amount)}</span>
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Bill ${sale.saleNo}</title>
  <style>
    @media print {
      @page { size: A4; margin: 12mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: #111827;
      background: #f3f4f6;
      margin: 0;
      padding: 24px;
    }
    .bill {
      max-width: 720px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
    }
    .bill-header {
      background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
      color: #fff;
      padding: 24px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .bill-body { padding: 24px 28px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .meta-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin-bottom: 4px; }
    .meta-value { font-size: 14px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f9fafb; padding: 10px 6px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    th:first-child { text-align: center; }
    .totals { margin-top: 16px; border-top: 2px solid #111827; padding-top: 12px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
    .grand-total { font-size: 20px; font-weight: 800; color: #111827; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d1d5db; }
    .footer { text-align: center; padding: 20px 28px 28px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: ${sale.status === 'PAID' ? '#dcfce7' : sale.status === 'OPEN' ? '#fef9c3' : '#fee2e2'};
      color: ${sale.status === 'PAID' ? '#166534' : sale.status === 'OPEN' ? '#854d0e' : '#991b1b'};
    }
  </style>
</head>
<body>
  <div class="bill">
    <div class="bill-header">
      <div>
        <img src="${logoUrl}" alt="K2 Chicken" style="height:48px;display:block;margin-bottom:8px;"/>
        <div style="font-size:13px;opacity:.85;">${storeName}</div>
        <div style="font-size:12px;opacity:.7;margin-top:2px;">Tel: ${storePhone}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:22px;font-weight:800;letter-spacing:.02em;">TAX INVOICE</div>
        <div style="margin-top:8px;font-size:13px;opacity:.9;">Bill No: <strong>${sale.saleNo}</strong></div>
        <div style="margin-top:4px;font-size:12px;opacity:.75;">${formatDateTime(sale.createdAt)}</div>
        <div style="margin-top:8px;"><span class="status-badge">${sale.status === 'VOID' ? 'CANCELLED' : sale.status}</span></div>
      </div>
    </div>

    <div class="bill-body">
      <div class="meta-grid">
        <div class="meta-box">
          <div class="meta-label">Bill To</div>
          <div class="meta-value">${sale.customer?.name || 'Walk-in Customer'}</div>
          ${sale.customer?.phone ? `<div style="font-size:13px;margin-top:4px;color:#374151;">Phone: ${sale.customer.phone}</div>` : ''}
          ${sale.customer?.area ? `<div style="font-size:13px;margin-top:2px;color:#374151;">Area: ${sale.customer.area}</div>` : ''}
        </div>
        <div class="meta-box">
          <div class="meta-label">Store Details</div>
          <div class="meta-value">${storeName}</div>
          <div style="font-size:13px;margin-top:4px;color:#374151;">Phone: ${storePhone}</div>
          ${sale.createdBy?.name ? `<div style="font-size:13px;margin-top:2px;color:#374151;">Cashier: ${sale.createdBy.name}</div>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:36px;text-align:center;">#</th>
            <th>Item</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Rate</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <div style="width:280px;">
          <div class="total-row"><span>Subtotal</span><span>${formatMoney(sale.subTotal)}</span></div>
          ${
            sale.discountTotal > 0
              ? `<div class="total-row"><span>Discount</span><span>- ${formatMoney(sale.discountTotal)}</span></div>`
              : ''
          }
          ${
            sale.taxTotal > 0
              ? `<div class="total-row"><span>Tax</span><span>${formatMoney(sale.taxTotal)}</span></div>`
              : ''
          }
          ${
            (sale.deliveryFee ?? 0) > 0
              ? `<div class="total-row"><span>Delivery Fee</span><span>${formatMoney(sale.deliveryFee!)}</span></div>`
              : ''
          }
          <div class="total-row grand-total"><span>Grand Total</span><span>${formatMoney(sale.grandTotal)}</span></div>
        </div>
      </div>

      ${
        (sale.payments || []).length > 0
          ? `<div style="margin-top:20px;padding:14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:8px;">Payment Details</div>
          ${paymentRows}
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:8px;padding-top:8px;border-top:1px dashed #d1d5db;">
            <span style="font-weight:600;">Total Paid (${methods})</span>
            <span style="font-weight:700;">${formatMoney(paid)}</span>
          </div>
          ${
            balance > 0
              ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;color:#b45309;">
            <span>Balance Due</span><span style="font-weight:700;">${formatMoney(balance)}</span>
          </div>`
              : ''
          }
        </div>`
          : ''
      }
    </div>

    <div class="footer">
      <div style="font-weight:600;color:#374151;margin-bottom:4px;">Thank you for shopping with us!</div>
      <div>Fresh chicken & quality products — visit again soon.</div>
      <div style="margin-top:8px;font-size:11px;">Check loyalty points: points.k2chicken.com · Shop site: www.k2chicken.com</div>
      <div style="margin-top:4px;font-size:11px;">Redeem points only at our shop. This is a computer-generated bill.</div>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:16px;">
    <button onclick="window.print()" style="padding:10px 24px;background:#111827;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Print Bill</button>
  </div>
</body>
</html>`;
}

export function printCustomerBill(sale: BillSale, store?: BillStoreInfo) {
  const html = buildCustomerBillHtml(sale, store);
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) {
    alert('Please allow popups to print the bill');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    setTimeout(() => win.print(), 300);
  };
}

export function downloadCustomerBill(sale: BillSale, store?: BillStoreInfo) {
  const html = buildCustomerBillHtml(sale, store);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `K2-Bill-${sale.saleNo}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
