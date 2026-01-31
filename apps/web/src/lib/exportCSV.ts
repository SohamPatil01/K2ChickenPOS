/**
 * Export data to CSV file
 * Simple, no-dependency CSV export utility
 */

export interface CSVExportOptions {
  filename?: string;
  headers?: string[];
  data: any[];
  dateFormat?: boolean;
}

export function exportToCSV(options: CSVExportOptions) {
  const { filename = 'export.csv', headers, data, dateFormat = true } = options;

  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Extract headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);

  // Convert data to CSV format
  const csvRows = [];
  
  // Add header row
  csvRows.push(csvHeaders.join(','));

  // Add data rows
  for (const row of data) {
    const values = csvHeaders.map(header => {
      let value = row[header];

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Format dates if needed
      if (dateFormat && value instanceof Date) {
        value = value.toLocaleDateString();
      }

      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    });

    csvRows.push(values.join(','));
  }

  // Create CSV content
  const csvContent = csvRows.join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    // Create download link
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Export sales data to CSV
 */
export function exportSalesCSV(sales: any[], filename = 'sales-report.csv') {
  const data = sales.map(sale => ({
    'Sale No': sale.saleNo,
    'Date': new Date(sale.createdAt).toLocaleString(),
    'Customer': sale.customer?.name || 'Walk-in',
    'Items': sale.items?.length || 0,
    'Subtotal': sale.subtotal?.toFixed(2) || '0.00',
    'Discount': sale.discountAmount?.toFixed(2) || '0.00',
    'Tax': sale.taxAmount?.toFixed(2) || '0.00',
    'Total': sale.grandTotal?.toFixed(2) || '0.00',
    'Status': sale.status,
    'Payment Method': sale.payments?.[0]?.method || 'N/A',
  }));

  exportToCSV({ filename, data });
}

/**
 * Export inventory data to CSV
 */
export function exportInventoryCSV(inventory: any[], filename = 'inventory-report.csv') {
  const data = inventory.map(item => ({
    'Product': item.productName || item.product?.name,
    'SKU': item.productSku || item.product?.sku,
    'Category': item.categoryName || item.product?.category?.name,
    'Unit Type': item.unitType || item.product?.unitType,
    'Current Stock (KG)': item.qtyKg?.toFixed(2) || '0.00',
    'Current Stock (PCS)': item.qtyPcs || '0',
    'Last Updated': new Date(item.updatedAt).toLocaleString(),
  }));

  exportToCSV({ filename, data });
}

/**
 * Export product sales data to CSV
 */
export function exportProductSalesCSV(products: any[], filename = 'product-sales-report.csv') {
  const data = products.map(product => ({
    'Product': product.name,
    'SKU': product.sku,
    'Category': product.categoryName,
    'Quantity Sold (KG)': product.qtyKg?.toFixed(2) || '0.00',
    'Quantity Sold (PCS)': product.qtyPcs || '0',
    'Total Sales': product.revenue?.toFixed(2) || '0.00',
    'Number of Orders': product.count || 0,
  }));

  exportToCSV({ filename, data });
}

/**
 * Export daily closing data to CSV
 */
export function exportDailyClosingCSV(closings: any[], filename = 'daily-closing-report.csv') {
  const data = closings.map(closing => ({
    'Date': new Date(closing.date).toLocaleDateString(),
    'Opening Cash': closing.openingCash?.toFixed(2) || '0.00',
    'Cash Sales': closing.cashSales?.toFixed(2) || '0.00',
    'Card Sales': closing.cardSales?.toFixed(2) || '0.00',
    'UPI Sales': closing.upiSales?.toFixed(2) || '0.00',
    'Total Revenue': closing.totalRevenue?.toFixed(2) || '0.00',
    'Closing Cash': closing.closingCash?.toFixed(2) || '0.00',
    'Cash Difference': closing.cashDifference?.toFixed(2) || '0.00',
    'Total Sales': closing.totalSales || 0,
    'Wastage (KG)': closing.totalWastageKg?.toFixed(2) || '0.00',
  }));

  exportToCSV({ filename, data });
}

