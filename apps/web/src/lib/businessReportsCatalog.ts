/** Curated business reports — essentials only (not every legacy page). */

export type ReportSection =
  | 'overview'
  | 'sales'
  | 'financial'
  | 'profitability'
  | 'inventory'
  | 'purchasing'
  | 'customers'
  | 'loyalty'
  | 'staff';

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
  apiKey?: string;
}

export const REPORT_SECTIONS: { id: ReportSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales' },
  { id: 'financial', label: 'Financial' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'purchasing', label: 'Purchasing' },
  { id: 'customers', label: 'Customers' },
  { id: 'loyalty', label: 'Loyalty & Referral' },
  { id: 'staff', label: 'Staff' },
];

/** Essential reports for day-to-day store operations (~20). */
export const BUSINESS_REPORT_CATALOG: BusinessReportItem[] = [
  // Overview
  {
    id: 'insights',
    label: 'Insights & Alerts',
    description: 'Sales trends, stockouts, and period comparisons',
    path: '/store/business-reports/view/insights',
    section: 'overview',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'insights',
    legacyPaths: ['/store/analytics/advanced'],
  },

  // Sales — core CA registers
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
    id: 'daily-product-transaction',
    label: 'Daily Sales Summary',
    description: 'Day-by-day sales totals',
    path: '/reports/daily-product-transaction',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'product-wise-sale',
    label: 'Product Wise Sale',
    description: 'Revenue and quantity sold per product',
    path: '/reports/product-wise-sale',
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
    label: 'Void / Cancelled Bills',
    description: 'Voided and cancelled sales',
    path: '/reports/bill-wise-sale-cancel',
    section: 'sales',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },

  // Financial
  {
    id: 'cash-flow',
    label: 'Cash Flow',
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
    id: 'financial-summary',
    label: 'Financial Summary',
    description: 'Revenue, expenses, purchases, and net profit',
    path: '/store/business-reports/view/financial-summary',
    section: 'financial',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'financial/summary',
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
    id: 'expense-entry',
    label: 'Record Expense',
    description: 'Add a store expense',
    path: '/store/business-reports/manage/expenses',
    section: 'financial',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
  },
  {
    id: 'budget-management',
    label: 'Manage Budgets',
    description: 'Create and edit budgets',
    path: '/store/business-reports/manage/budgets',
    section: 'financial',
    roles: ['OWNER'],
    status: 'new',
  },

  // Profitability
  {
    id: 'gross-profit-margin',
    label: 'Gross Profit & Margin',
    description: 'Product-level margin from purchase costs',
    path: '/store/business-reports/view/gross-profit-margin',
    section: 'profitability',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'profitability/gross-margin',
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
    id: 'wastage',
    label: 'Wastage',
    description: 'Wastage by product and period',
    path: '/store/business-reports/view/wastage',
    section: 'inventory',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'inventory/wastage',
  },

  // Purchasing
  {
    id: 'po-report',
    label: 'PO Report',
    description: 'Purchase orders and GRN status',
    path: '/reports/po-report',
    section: 'purchasing',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },
  {
    id: 'pending-report',
    label: 'Pending (PO / Delivery / Credit)',
    description: 'Open POs, deliveries, and credit sales',
    path: '/reports/pending',
    section: 'purchasing',
    roles: ['OWNER', 'MANAGER'],
    status: 'live',
  },

  // Customers & loyalty
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
    id: 'loyalty-summary',
    label: 'Loyalty Points',
    description: 'Points earned, redeemed, and balance',
    path: '/store/business-reports/view/loyalty-summary',
    section: 'loyalty',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'loyalty/summary',
  },
  {
    id: 'referral-performance',
    label: 'Referral Performance',
    description: 'Referrals and conversion',
    path: '/store/business-reports/view/referral-performance',
    section: 'loyalty',
    roles: ['OWNER', 'MANAGER'],
    status: 'new',
    apiKey: 'referrals/performance',
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
    id: 'cashier-reconciliation',
    label: 'Cashier Reconciliation',
    description: 'Shift cash vs expected',
    path: '/store/business-reports/view/cashier-reconciliation',
    section: 'staff',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
    status: 'new',
    apiKey: 'staff/reconciliation',
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
