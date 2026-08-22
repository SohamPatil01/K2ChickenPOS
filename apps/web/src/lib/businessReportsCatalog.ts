/** Unified catalog for all business reports — existing + new BI reports. */

export type ReportSection =
  | 'overview'
  | 'sales'
  | 'financial'
  | 'profitability'
  | 'inventory'
  | 'purchasing'
  | 'customers'
  | 'loyalty-referral'
  | 'staff'
  | 'insights'
  | 'settings';

export type ReportStatus = 'live' | 'new';

export interface BusinessReportItem {
  id: string;
  label: string;
  description: string;
  path: string;
  section: ReportSection;
  roles: string[];
  status: ReportStatus;
  legacyPaths?: string[];
  /** New BI reports use API endpoint key */
  apiKey?: string;
  rollup?: boolean;
}

export const REPORT_SECTIONS: { id: ReportSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales & Revenue' },
  { id: 'financial', label: 'Financial' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'purchasing', label: 'Purchasing' },
  { id: 'customers', label: 'Customers' },
  { id: 'loyalty-referral', label: 'Loyalty & Referral' },
  { id: 'staff', label: 'Staff' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' },
];

export const BUSINESS_REPORT_CATALOG: BusinessReportItem[] = [
  // Overview
  {
    id: 'business-summary',
    label: 'Business Summary Dashboard',
    description: 'KPI overview: sales, profit, expenses, orders',
    path: '/store/business-reports',
    section: 'overview',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'overview',
  },
  {
    id: 'summary-report',
    label: 'Summary Report',
    description: 'Executive summary: sales, inventory, customers, payments',
    path: '/reports/summary-report',
    section: 'overview',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
    legacyPaths: ['/reports/summary-report'],
  },
  {
    id: 'insights',
    label: 'Insights & Alerts',
    description: 'Rule-based alerts and period-over-period deltas',
    path: '/store/business-reports/view/insights',
    section: 'overview',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'insights',
    legacyPaths: ['/store/analytics/advanced'],
  },
  // Sales
  {
    id: 'bill-wise-sale',
    label: 'Bill Wise Sale (Sales Register)',
    description: 'Every bill in the period, one row per sale',
    path: '/reports/bill-wise-sale',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'sales-register-summary',
    label: 'Sales Register Summary',
    description: 'Totals, discounts, tax and payment split',
    path: '/reports/sales-register-summary',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'sales-sub-register',
    label: 'Sales Sub Register',
    description: 'Chronological sale-level register',
    path: '/reports/sales-sub-register',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'daily-product-transaction',
    label: 'Daily Sales Summary',
    description: 'Day-by-day sales summary',
    path: '/reports/daily-product-transaction',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'product-wise-sale',
    label: 'Product Wise Sale',
    description: 'Revenue and quantity sold, per product',
    path: '/reports/product-wise-sale',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'article-wise-sale',
    label: 'Article Wise Sale',
    description: 'Product-wise sales (alias)',
    path: '/reports/article-wise-sale',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'sku-wise-sales',
    label: 'SKU Wise Sales',
    description: 'Sales aggregated by SKU',
    path: '/reports/sku-wise-sales',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'monthly-sales',
    label: 'Monthly Sales Comparison',
    description: 'Month-over-month revenue comparison',
    path: '/reports/monthly-sales',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'bill-wise-sale-cancel',
    label: 'Bill Wise Sale (Cancel/Void)',
    description: 'Voided and cancelled bills',
    path: '/reports/bill-wise-sale-cancel',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'revenue-trend',
    label: 'Revenue Trend',
    description: 'Daily revenue charts and trends',
    path: '/store/analytics',
    section: 'sales',
    roles: ['OWNER'],
    status: 'live',
    legacyPaths: ['/analytics'],
  },
  // Financial
  {
    id: 'cash-flow',
    label: 'Cash Flow Summary',
    description: 'Daily cash reconciliation from closings',
    path: '/store/reports/cash-flow',
    section: 'financial',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
    apiKey: 'financial/cash-flow',
  },
  {
    id: 'itr-tax',
    label: 'ITR / Tax Summary',
    description: 'Tax calculator and presumptive income',
    path: '/store/itr',
    section: 'financial',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'revenue-summary',
    label: 'Revenue Summary',
    description: 'Net sales, payment mix, AOV',
    path: '/store/business-reports/view/revenue-summary',
    section: 'financial',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'financial/revenue',
  },
  {
    id: 'expense-report',
    label: 'Expense Report',
    description: 'Expenses by category and date',
    path: '/store/business-reports/view/expense-report',
    section: 'financial',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'financial/expenses',
  },
  {
    id: 'budget-vs-actual',
    label: 'Budget vs Actual',
    description: 'Budget variance by category',
    path: '/store/business-reports/view/budget-vs-actual',
    section: 'financial',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'financial/budget-vs-actual',
  },
  {
    id: 'financial-summary',
    label: 'Financial Summary',
    description: 'Revenue, expenses, purchases, net profit',
    path: '/store/business-reports/view/financial-summary',
    section: 'financial',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'financial/summary',
  },
  // Profitability
  {
    id: 'gross-profit-margin',
    label: 'Gross Profit & Margin',
    description: 'Product-level gross margin from PO avg cost',
    path: '/store/business-reports/view/gross-profit-margin',
    section: 'profitability',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'profitability/gross-margin',
    legacyPaths: ['/store/analytics/advanced'],
  },
  {
    id: 'product-profitability',
    label: 'Product Profitability',
    description: 'Revenue, COGS, gross profit per product',
    path: '/store/business-reports/view/product-profitability',
    section: 'profitability',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'profitability/products',
  },
  {
    id: 'category-profitability',
    label: 'Category Profitability',
    description: 'Gross profit by product category',
    path: '/store/business-reports/view/category-profitability',
    section: 'profitability',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'profitability/categories',
  },
  {
    id: 'contribution-analysis',
    label: 'Contribution Analysis',
    description: 'Revenue and profit share by product',
    path: '/store/business-reports/view/contribution-analysis',
    section: 'profitability',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'profitability/contribution',
  },
  // Inventory
  {
    id: 'stock-report',
    label: 'Stock Report',
    description: 'Current stock levels and value',
    path: '/reports/stock',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
    status: 'live',
    apiKey: 'inventory/stock',
  },
  {
    id: 'mrn-balance',
    label: 'MRN Balance',
    description: 'GRN list and product balance',
    path: '/reports/mrn-balance',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'range-master',
    label: 'Range Master',
    description: 'Price ranges by category',
    path: '/reports/range-master',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'stock-movement',
    label: 'Stock Movement',
    description: 'Ledger movements by date range',
    path: '/store/business-reports/view/stock-movement',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'inventory/movement',
  },
  {
    id: 'stock-valuation',
    label: 'Stock Valuation',
    description: 'Qty × avg PO cost',
    path: '/store/business-reports/view/stock-valuation',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'inventory/valuation',
  },
  {
    id: 'low-stock',
    label: 'Low Stock',
    description: 'Products below reorder threshold',
    path: '/store/business-reports/view/low-stock',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
    status: 'new',
    apiKey: 'inventory/low-stock',
  },
  {
    id: 'wastage-report',
    label: 'Wastage',
    description: 'Wastage by product and daily closing',
    path: '/store/business-reports/view/wastage',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'inventory/wastage',
  },
  {
    id: 'inventory-variance',
    label: 'Inventory Variance',
    description: 'Ledger vs daily closing snapshot',
    path: '/store/business-reports/view/inventory-variance',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'inventory/variance',
  },
  {
    id: 'inventory-turnover',
    label: 'Inventory Turnover',
    description: 'COGS / average inventory value',
    path: '/store/business-reports/view/inventory-turnover',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'inventory/turnover',
  },
  // Purchasing
  {
    id: 'po-report',
    label: 'PO Report',
    description: 'Purchase orders with dispatch/GRN status',
    path: '/reports/po-report',
    section: 'purchasing',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'pending-report',
    label: 'Pending (PO/Delivery/Credit)',
    description: 'Open POs, deliveries, and credit sales',
    path: '/reports/pending',
    section: 'purchasing',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'purchase-summary',
    label: 'Purchase Summary',
    description: 'PO totals by status and product',
    path: '/store/business-reports/view/purchase-summary',
    section: 'purchasing',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'purchasing/summary',
  },
  {
    id: 'supplier-performance',
    label: 'Supplier Performance',
    description: 'Lead time and fulfillment rates',
    path: '/store/business-reports/view/supplier-performance',
    section: 'purchasing',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'purchasing/supplier-performance',
  },
  {
    id: 'purchase-price-trends',
    label: 'Purchase Price Trends',
    description: 'PO line rate time series',
    path: '/store/business-reports/view/purchase-price-trends',
    section: 'purchasing',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'purchasing/price-trends',
  },
  {
    id: 'outstanding-payments',
    label: 'Outstanding Supplier Payments',
    description: 'Open PO value estimate',
    path: '/store/business-reports/view/outstanding-payments',
    section: 'purchasing',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'purchasing/outstanding',
  },
  // Customers
  {
    id: 'customer-overview',
    label: 'Customer Overview',
    description: 'Active, new, and returning customers',
    path: '/store/business-reports/view/customer-overview',
    section: 'customers',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'customers/overview',
  },
  {
    id: 'customer-ltv',
    label: 'Customer Lifetime Value',
    description: 'LTV ranking by total spent',
    path: '/store/business-reports/view/customer-ltv',
    section: 'customers',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'customers/ltv',
  },
  {
    id: 'retention-segments',
    label: 'Retention & Segments',
    description: 'Returning vs new, at-risk customers',
    path: '/store/business-reports/view/retention-segments',
    section: 'customers',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'customers/retention',
  },
  {
    id: 'purchase-frequency',
    label: 'Purchase Frequency',
    description: 'Order frequency distribution',
    path: '/store/business-reports/view/purchase-frequency',
    section: 'customers',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'customers/frequency',
  },
  // Loyalty & Referral
  {
    id: 'loyalty-summary',
    label: 'Loyalty Points Summary',
    description: 'Earned, redeemed, balance',
    path: '/store/business-reports/view/loyalty-summary',
    section: 'loyalty-referral',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'loyalty/summary',
  },
  {
    id: 'loyalty-redemption',
    label: 'Loyalty Redemption',
    description: 'Redemption transactions',
    path: '/store/business-reports/view/loyalty-redemption',
    section: 'loyalty-referral',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'loyalty/redemption',
  },
  {
    id: 'referral-performance',
    label: 'Referral Performance',
    description: 'Referrals, conversion, revenue',
    path: '/store/business-reports/view/referral-performance',
    section: 'loyalty-referral',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'referrals/performance',
  },
  {
    id: 'top-referrers',
    label: 'Top Referrers',
    description: 'Ranking by referral count and revenue',
    path: '/store/business-reports/view/top-referrers',
    section: 'loyalty-referral',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'referrals/top',
  },
  // Staff
  {
    id: 'employee-sales',
    label: 'Employee Sales',
    description: 'Revenue and orders by cashier',
    path: '/store/business-reports/view/employee-sales',
    section: 'staff',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
    status: 'new',
    apiKey: 'staff/sales',
  },
  {
    id: 'discount-report',
    label: 'Discount Report',
    description: 'Discounts given and override approvals',
    path: '/store/business-reports/view/discount-report',
    section: 'staff',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'staff/discounts',
  },
  {
    id: 'refund-report',
    label: 'Refund Report',
    description: 'Voided and refunded sales',
    path: '/store/business-reports/view/refund-report',
    section: 'staff',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'staff/refunds',
  },
  {
    id: 'cashier-reconciliation',
    label: 'Cashier Reconciliation',
    description: 'Shift cash vs expected',
    path: '/store/business-reports/view/cashier-reconciliation',
    section: 'staff',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
    status: 'new',
    apiKey: 'staff/reconciliation',
  },
  {
    id: 'staff-activity',
    label: 'Staff Activity / Audit',
    description: 'Audit log entries by staff',
    path: '/store/business-reports/view/staff-activity',
    section: 'staff',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'staff/activity',
  },
  // Settings
  {
    id: 'report-preferences',
    label: 'Report Preferences',
    description: 'Default date range and export format',
    path: '/reports/settings',
    section: 'settings',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'budget-management',
    label: 'Budget Management',
    description: 'Create and manage budgets',
    path: '/store/business-reports/view/budget-management',
    section: 'settings',
    roles: ['OWNER'],
    status: 'new',
  },
  {
    id: 'expense-entry',
    label: 'Expense Entry',
    description: 'Record store expenses',
    path: '/store/business-reports/view/expense-entry',
    section: 'settings',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
  },
];

export function getReportsForRole(role: string, section?: ReportSection): BusinessReportItem[] {
  return BUSINESS_REPORT_CATALOG.filter(
    (r) => r.roles.includes(role) && (!section || r.section === section)
  );
}

export function getReportById(id: string): BusinessReportItem | undefined {
  return BUSINESS_REPORT_CATALOG.find((r) => r.id === id);
}

export function searchReports(query: string, role: string): BusinessReportItem[] {
  const q = query.toLowerCase().trim();
  const base = getReportsForRole(role);
  if (!q) return base;
  return base.filter(
    (r) =>
      r.label.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.id.includes(q)
  );
}
