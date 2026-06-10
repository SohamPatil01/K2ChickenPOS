'use client';

import type { BillSale, BillStoreInfo } from '@/lib/customerBill';

interface CustomerBillProps {
  sale: BillSale;
  store?: BillStoreInfo;
}

function formatMoney(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function formatQty(item: BillSale['items'][0]) {
  if (item.qtyKg != null && item.qtyKg > 0) return `${item.qtyKg.toFixed(2)} kg`;
  if (item.qtyPcs != null && item.qtyPcs > 0) return `${item.qtyPcs} pcs`;
  return '-';
}

export default function CustomerBill({ sale, store }: CustomerBillProps) {
  const storeName = store?.name || 'K2 Chicken';
  const storePhone = store?.phone || '8484978622';
  const paid = (sale.payments || [])
    .filter((p) => p.method !== 'CREDIT')
    .reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, Math.round(sale.grandTotal - paid));

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
          <div style={{ fontSize: 20, fontWeight: 800 }}>TAX INVOICE</div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            Bill No: <strong>{sale.saleNo}</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            {new Date(sale.createdAt).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>Bill To</div>
            <div style={{ fontWeight: 600 }}>{sale.customer?.name || 'Walk-in Customer'}</div>
            {sale.customer?.phone && <div style={{ marginTop: 4 }}>Phone: {sale.customer.phone}</div>}
            {sale.customer?.area && <div style={{ marginTop: 2 }}>Area: {sale.customer.area}</div>}
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>Store</div>
            <div style={{ fontWeight: 600 }}>{storeName}</div>
            {sale.createdBy?.name && <div style={{ marginTop: 4 }}>Cashier: {sale.createdBy.name}</div>}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: 32, fontSize: 11 }}>#</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 11 }}>Item</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11 }}>Qty</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11 }}>Rate</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#6b7280' }}>{i + 1}</td>
                <td style={{ padding: '8px 6px', fontWeight: 500 }}>{item.product.name}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center' }}>{formatQty(item)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatMoney(item.rate)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <div style={{ width: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>Subtotal</span>
              <span>{formatMoney(sale.subTotal)}</span>
            </div>
            {sale.discountTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>Discount</span>
                <span>- {formatMoney(sale.discountTotal)}</span>
              </div>
            )}
            {sale.taxTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>Tax</span>
                <span>{formatMoney(sale.taxTotal)}</span>
              </div>
            )}
            {(sale.deliveryFee ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>Delivery Fee</span>
                <span>{formatMoney(sale.deliveryFee!)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0 0',
                marginTop: 8,
                borderTop: '2px solid #111827',
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              <span>Grand Total</span>
              <span>{formatMoney(sale.grandTotal)}</span>
            </div>
            {paid > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: 8, fontSize: 13 }}>
                  <span>Paid</span>
                  <span>{formatMoney(paid)}</span>
                </div>
                {balance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#b45309', fontWeight: 600 }}>
                    <span>Balance Due</span>
                    <span>{formatMoney(balance)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '16px 24px 24px',
          borderTop: '1px solid #e5e7eb',
          color: '#6b7280',
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>Thank you for shopping with us!</div>
        <div>Fresh chicken & quality products — visit again soon.</div>
      </div>
    </div>
  );
}
