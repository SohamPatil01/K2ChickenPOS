export interface ReceiptData {
  saleNo: string;
  date: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    quantity: string;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
}

export function printReceipt(data: ReceiptData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print receipts');
    return;
  }

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt - ${data.saleNo}</title>
      <style>
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
        
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          max-width: 80mm;
          margin: 0 auto;
          padding: 10mm;
          background: white;
        }
        
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        
        .header h1 {
          margin: 0 0 5px 0;
          font-size: 18px;
          font-weight: bold;
        }
        
        .header p {
          margin: 2px 0;
          font-size: 11px;
        }
        
        .receipt-info {
          margin-bottom: 10px;
          font-size: 11px;
        }
        
        .receipt-info div {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        
        .items {
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 10px 0;
          margin: 10px 0;
        }
        
        .item {
          margin-bottom: 8px;
        }
        
        .item-name {
          font-weight: bold;
          margin-bottom: 2px;
        }
        
        .item-details {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
        }
        
        .totals {
          margin-top: 10px;
        }
        
        .totals div {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        
        .totals .grand-total {
          font-weight: bold;
          font-size: 14px;
          border-top: 2px solid #000;
          padding-top: 5px;
          margin-top: 5px;
        }
        
        .payment {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed #000;
        }
        
        .payment div {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        
        .footer {
          text-align: center;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 2px dashed #000;
          font-size: 11px;
        }
        
        .footer p {
          margin: 3px 0;
        }
        
        .thank-you {
          font-weight: bold;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.storeName || 'K2 Chicken POS'}</h1>
        ${data.storeAddress ? `<p>${data.storeAddress}</p>` : ''}
        ${data.storePhone ? `<p>Phone: ${data.storePhone}</p>` : ''}
      </div>
      
      <div class="receipt-info">
        <div>
          <span>Receipt #:</span>
          <span>${data.saleNo}</span>
        </div>
        <div>
          <span>Date:</span>
          <span>${data.date}</span>
        </div>
        ${data.customerName ? `
        <div>
          <span>Customer:</span>
          <span>${data.customerName}</span>
        </div>
        ` : ''}
        ${data.customerPhone ? `
        <div>
          <span>Phone:</span>
          <span>${data.customerPhone}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="items">
        ${data.items.map(item => `
          <div class="item">
            <div class="item-name">${item.name}</div>
            <div class="item-details">
              <span>${item.quantity} × ₹${item.unitPrice.toFixed(2)}</span>
              <span>₹${item.total.toFixed(2)}</span>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="totals">
        <div>
          <span>Subtotal:</span>
          <span>₹${data.subtotal.toFixed(2)}</span>
        </div>
        ${data.discount > 0 ? `
        <div>
          <span>Discount:</span>
          <span>-₹${data.discount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${data.tax > 0 ? `
        <div>
          <span>Tax:</span>
          <span>₹${data.tax.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="grand-total">
          <span>TOTAL:</span>
          <span>₹${data.grandTotal.toFixed(2)}</span>
        </div>
      </div>
      
      <div class="payment">
        <div>
          <span>Payment Method:</span>
          <span>${data.paymentMethod}</span>
        </div>
        <div>
          <span>Amount Paid:</span>
          <span>₹${data.amountPaid.toFixed(2)}</span>
        </div>
        ${data.change > 0 ? `
        <div>
          <span>Change:</span>
          <span>₹${data.change.toFixed(2)}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="footer">
        <p class="thank-you">Thank You for Your Purchase!</p>
        <p>Please visit again</p>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
          // Close window after printing (optional)
          setTimeout(function() {
            window.close();
          }, 100);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(receiptHTML);
  printWindow.document.close();
}

export function generateReceiptData(sale: any, store?: any): ReceiptData {
  const items = sale.items?.map((item: any) => ({
    name: item.productName || item.product?.name || 'Unknown Product',
    quantity: item.unitType === 'KG' 
      ? `${item.qtyKg?.toFixed(2) || 0} kg`
      : `${item.qtyPcs || 0} pcs`,
    unitPrice: item.pricePerUnit || 0,
    total: item.total || 0,
  })) || [];

  return {
    saleNo: sale.saleNo || 'N/A',
    date: new Date(sale.createdAt || Date.now()).toLocaleString(),
    storeName: store?.name,
    storeAddress: store?.address,
    storePhone: store?.phone,
    customerName: sale.customer?.name || sale.customerName,
    customerPhone: sale.customer?.phone || sale.customerPhone,
    items,
    subtotal: sale.subtotal || 0,
    discount: sale.discountAmount || 0,
    tax: sale.taxAmount || 0,
    grandTotal: sale.grandTotal || 0,
    amountPaid: sale.payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || sale.grandTotal || 0,
    change: 0, // Calculate if needed
    paymentMethod: sale.payments?.[0]?.method || 'CASH',
  };
}

