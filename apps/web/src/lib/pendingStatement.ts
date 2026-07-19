import type { BillStoreInfo } from '@/lib/customerBill';

export interface PendingStatementOrder {
  saleNo: string;
  createdAt: string;
  grandTotal: number;
  totalPaid: number;
  pending: number;
  items: Array<{
    product: { name: string };
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    lineTotal: number;
  }>;
}

export interface PendingStatementData {
  customerName: string;
  customerPhone: string;
  customerArea?: string | null;
  totalPending: number;
  orders: PendingStatementOrder[];
}

const STORE_PHONE = '8484978622';
const LOGO_PATH = '/k2-chicken-logo.svg';

function formatMoney(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-IN')}`;
}

function formatQty(item: PendingStatementOrder['items'][0]) {
  if (item.qtyKg != null && item.qtyKg > 0) return `${item.qtyKg.toFixed(2)} kg`;
  if (item.qtyPcs != null && item.qtyPcs > 0) return `${item.qtyPcs} pcs`;
  return '-';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function buildPendingStatementHtml(
  data: PendingStatementData,
  store?: BillStoreInfo
): string {
  const storeName = store?.name || 'K2 Chicken';
  const storePhone = store?.phone || STORE_PHONE;
  const logoUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${LOGO_PATH}` : LOGO_PATH;
  const printedAt = new Date().toLocaleString('en-IN');
  const orders = [...data.orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const billTotal = orders.reduce((s, o) => s + o.grandTotal, 0);
  const paidTotal = orders.reduce((s, o) => s + o.totalPaid, 0);
  const dueTotal = Math.round(data.totalPending);

  const summaryRows = orders
    .map(
      (o, i) => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;">${i + 1}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${formatDate(o.createdAt)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;font-weight:600;">${o.saleNo}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(o.grandTotal)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(o.totalPaid)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#b45309;">${formatMoney(o.pending)}</td>
    </tr>`
    )
    .join('');

  const billSections = orders
    .map((o) => {
      const itemRows = (o.items || [])
        .map(
          (item) => `
        <tr>
          <td style="padding:4px 6px;border-bottom:1px solid #f3f4f6;">${item.product.name}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #f3f4f6;text-align:center;">${formatQty(item)}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatMoney(item.rate)}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${formatMoney(item.lineTotal)}</td>
        </tr>`
        )
        .join('');
      return `
      <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;page-break-inside:avoid;">
        <div style="background:#f9fafb;padding:10px 12px;display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e5e7eb;">
          <div>
            <div style="font-weight:700;">${o.saleNo}</div>
            <div style="font-size:12px;color:#6b7280;">${formatDate(o.createdAt)}</div>
          </div>
          <div style="text-align:right;font-size:12px;">
            <div>Bill: <strong>${formatMoney(o.grandTotal)}</strong></div>
            <div>Paid: ${formatMoney(o.totalPaid)}</div>
            <div style="color:#b45309;font-weight:700;">Due: ${formatMoney(o.pending)}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#fff;">
              <th style="padding:6px;text-align:left;font-size:10px;color:#6b7280;">Item</th>
              <th style="padding:6px;text-align:center;font-size:10px;color:#6b7280;">Qty</th>
              <th style="padding:6px;text-align:right;font-size:10px;color:#6b7280;">Rate</th>
              <th style="padding:6px;text-align:right;font-size:10px;color:#6b7280;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows || '<tr><td colspan="4" style="padding:8px;color:#9ca3af;">No items</td></tr>'}</tbody>
        </table>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Pending Statement - ${data.customerName}</title>
  <style>
    @media print {
      @page { size: A4; margin: 12mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      background: #f3f4f6;
      color: #111827;
    }
    .sheet {
      width: 210mm;
      max-width: 100%;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div style="background:linear-gradient(135deg,#111827 0%,#1f2937 100%);color:#fff;padding:20px 24px;display:flex;justify-content:space-between;gap:16px;">
      <div>
        <img src="${logoUrl}" alt="K2 Chicken" style="height:44px;display:block;margin-bottom:8px"/>
        <div style="font-size:13px;opacity:.85;">${storeName}</div>
        <div style="font-size:12px;opacity:.7;">Tel: ${storePhone}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:20px;font-weight:800;">PENDING STATEMENT</div>
        <div style="margin-top:8px;font-size:12px;opacity:.75;">Printed: ${printedAt}</div>
        <div style="margin-top:4px;font-size:12px;opacity:.75;">${orders.length} open bill${orders.length === 1 ? '' : 's'}</div>
      </div>
    </div>

    <div style="padding:20px 24px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
          <div style="font-size:11px;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Customer</div>
          <div style="font-weight:600;">${data.customerName}</div>
          ${data.customerPhone ? `<div style="margin-top:4px;">Phone: ${data.customerPhone}</div>` : ''}
          ${data.customerArea ? `<div style="margin-top:2px;">Area: ${data.customerArea}</div>` : ''}
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;">
          <div style="font-size:11px;text-transform:uppercase;color:#9a3412;margin-bottom:4px;">Total Due</div>
          <div style="font-size:28px;font-weight:800;color:#c2410c;">${formatMoney(dueTotal)}</div>
        </div>
      </div>

      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Bills Summary</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead>
          <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
            <th style="padding:8px 6px;text-align:center;font-size:11px;">#</th>
            <th style="padding:8px 6px;text-align:left;font-size:11px;">Date</th>
            <th style="padding:8px 6px;text-align:left;font-size:11px;">Bill No</th>
            <th style="padding:8px 6px;text-align:right;font-size:11px;">Bill Total</th>
            <th style="padding:8px 6px;text-align:right;font-size:11px;">Paid</th>
            <th style="padding:8px 6px;text-align:right;font-size:11px;">Due</th>
          </tr>
        </thead>
        <tbody>${summaryRows}</tbody>
        <tfoot>
          <tr style="background:#f9fafb;border-top:2px solid #e5e7eb;font-weight:700;">
            <td colspan="3" style="padding:10px 6px;">Total</td>
            <td style="padding:10px 6px;text-align:right;">${formatMoney(billTotal)}</td>
            <td style="padding:10px 6px;text-align:right;">${formatMoney(paidTotal)}</td>
            <td style="padding:10px 6px;text-align:right;color:#b45309;">${formatMoney(dueTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:20px 0 4px;">Bill Details</div>
      ${billSections}

      <div style="margin-top:20px;padding:14px 16px;background:#111827;color:#fff;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:600;">Amount Payable</span>
        <span style="font-size:22px;font-weight:800;">${formatMoney(dueTotal)}</span>
      </div>

      <div style="margin-top:16px;text-align:center;font-size:12px;color:#6b7280;">
        <div style="font-weight:600;color:#374151;margin-bottom:4px;">Thank you for your business</div>
        <div>Please settle the outstanding balance at your earliest convenience.</div>
        <div style="margin-top:8px;font-size:11px;">This is a computer-generated pending statement.</div>
      </div>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:16px;">
    <button onclick="window.print()" style="padding:10px 24px;background:#111827;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Print Statement</button>
  </div>
</body>
</html>`;
}

export function downloadPendingStatement(data: PendingStatementData, store?: BillStoreInfo) {
  const html = buildPendingStatementHtml(data, store);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (data.customerName || 'Customer').replace(/[^\w\-]+/g, '_').slice(0, 40);
  a.download = `K2-Pending-${safeName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
