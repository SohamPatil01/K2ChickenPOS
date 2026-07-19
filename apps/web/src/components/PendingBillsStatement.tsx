'use client';

import type { BillStoreInfo } from '@/lib/customerBill';
import type { PendingStatementData } from '@/lib/pendingStatement';

interface PendingBillsStatementProps {
  data: PendingStatementData;
  store?: BillStoreInfo;
}

function formatMoney(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function formatQty(item: PendingStatementData['orders'][0]['items'][0]) {
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

export default function PendingBillsStatement({ data, store }: PendingBillsStatementProps) {
  const storeName = store?.name || 'K2 Chicken';
  const storePhone = store?.phone || '8484978622';
  const orders = [...data.orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const billTotal = orders.reduce((s, o) => s + o.grandTotal, 0);
  const paidTotal = orders.reduce((s, o) => s + o.totalPaid, 0);
  const dueTotal = Math.round(data.totalPending);

  return (
    <div
      className="customer-bill"
      style={{
        width: '210mm',
        maxWidth: '100%',
        margin: '0 auto',
        background: '#fff',
        color: '#111827',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          color: '#fff',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
        }}
      >
        <div>
          <img
            src="/k2-chicken-logo.svg"
            alt="K2 Chicken"
            style={{ height: 44, display: 'block', marginBottom: 8 }}
          />
          <div style={{ fontSize: 13, opacity: 0.85 }}>{storeName}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Tel: {storePhone}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>PENDING STATEMENT</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            {new Date().toLocaleString('en-IN')}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            {orders.length} open bill{orders.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
              Customer
            </div>
            <div style={{ fontWeight: 600 }}>{data.customerName}</div>
            {data.customerPhone && <div style={{ marginTop: 4 }}>Phone: {data.customerPhone}</div>}
            {data.customerArea && <div style={{ marginTop: 2 }}>Area: {data.customerArea}</div>}
          </div>
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9a3412', marginBottom: 4 }}>
              Total Due
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#c2410c' }}>{formatMoney(dueTotal)}</div>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 8 }}>
          Bills Summary
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11 }}>#</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 11 }}>Date</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 11 }}>Bill No</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11 }}>Bill Total</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11 }}>Paid</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11 }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.saleNo} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#6b7280' }}>{i + 1}</td>
                <td style={{ padding: '8px 6px' }}>{formatDate(o.createdAt)}</td>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>{o.saleNo}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatMoney(o.grandTotal)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatMoney(o.totalPaid)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                  {formatMoney(o.pending)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
              <td colSpan={3} style={{ padding: '10px 6px' }}>
                Total
              </td>
              <td style={{ padding: '10px 6px', textAlign: 'right' }}>{formatMoney(billTotal)}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right' }}>{formatMoney(paidTotal)}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', color: '#b45309' }}>
                {formatMoney(dueTotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', margin: '20px 0 4px' }}>
          Bill Details
        </div>
        {orders.map((o) => (
          <div
            key={o.saleNo}
            style={{
              marginTop: 18,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              overflow: 'hidden',
              pageBreakInside: 'avoid',
            }}
          >
            <div
              style={{
                background: '#f9fafb',
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{o.saleNo}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(o.createdAt)}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12 }}>
                <div>
                  Bill: <strong>{formatMoney(o.grandTotal)}</strong>
                </div>
                <div>Paid: {formatMoney(o.totalPaid)}</div>
                <div style={{ color: '#b45309', fontWeight: 700 }}>Due: {formatMoney(o.pending)}</div>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: 6, textAlign: 'left', fontSize: 10, color: '#6b7280' }}>Item</th>
                  <th style={{ padding: 6, textAlign: 'center', fontSize: 10, color: '#6b7280' }}>Qty</th>
                  <th style={{ padding: 6, textAlign: 'right', fontSize: 10, color: '#6b7280' }}>Rate</th>
                  <th style={{ padding: 6, textAlign: 'right', fontSize: 10, color: '#6b7280' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(o.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 8, color: '#9ca3af' }}>
                      No items
                    </td>
                  </tr>
                ) : (
                  o.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '4px 6px' }}>{item.product.name}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{formatQty(item)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatMoney(item.rate)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>
                        {formatMoney(item.lineTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ))}

        <div
          style={{
            marginTop: 20,
            padding: '14px 16px',
            background: '#111827',
            color: '#fff',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600 }}>Amount Payable</span>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(dueTotal)}</span>
        </div>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>Thank you for your business</div>
          <div>Please settle the outstanding balance at your earliest convenience.</div>
        </div>
      </div>
    </div>
  );
}
