'use client';

import { Fragment } from 'react';
import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import StatCardGlass from '@/components/StatCardGlass';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Wallet,
  Receipt,
  Users,
  Percent,
  TrendingUp,
  ChevronDown,
  CreditCard,
  Package,
} from 'lucide-react';
import {
  downloadStyledReportBundle,
  formatCurrency,
} from '@/lib/reportExport';
import { dur, ease, useMotionSafe } from '@/lib/motion';
import api from '@/lib/api';

interface ProductStat {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
}

interface PaymentStat {
  method: string;
  count: number;
  total: number;
}

interface DayStat {
  date: string;
  totalSales: number;
  totalRevenue: number;
}

interface MonthRow {
  month: string;
  label: string;
  totalSales: number;
  totalRevenue: number;
  discountTotal: number;
  taxTotal: number;
  netRevenue: number;
  avgBillSize: number;
  distinctCustomers: number;
  distinctProducts: number;
  products: ProductStat[];
  topProducts: ProductStat[];
  paymentMethods: PaymentStat[];
  dailyBreakdown: DayStat[];
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** Reads the glass design system's CSS vars so recharts (which needs literal
 * color strings, not Tailwind classes) stays correct across light/dark. */
function useChartColors() {
  const [colors, setColors] = useState({ grid: '#e5e7eb', axis: '#6b7280' });
  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      const grid = style.getPropertyValue('--border-subtle').trim() || '#e5e7eb';
      const axis = style.getPropertyValue('--text-secondary').trim() || '#6b7280';
      setColors({ grid, axis });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-ink-muted">—</span>;
  const up = value >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function MonthlySalesReportPage() {
  const motionSafe = useMotionSafe();
  const chartColors = useChartColors();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [monthsCount, setMonthsCount] = useState(6);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData(monthsCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsCount]);

  const loadData = async (count: number) => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/reports/monthly-sales', {
        params: { months: count },
      });
      setMonths(response.data.months || []);
    } catch (error) {
      console.error('Failed to load monthly sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMonth = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const latest = months[months.length - 1];
  const previous = months.length > 1 ? months[months.length - 2] : null;

  const handleExport = () => {
    if (!months.length) return;
    downloadStyledReportBundle({
      title: 'Monthly Sales Comparison',
      filename: `monthly-sales-comparison-last-${monthsCount}-months`,
      period: `Last ${monthsCount} months`,
      summary: latest
        ? [
            { label: 'Latest Month', value: latest.label },
            { label: 'Revenue', value: formatCurrency(latest.totalRevenue) },
            { label: 'Net Revenue', value: formatCurrency(latest.netRevenue) },
            { label: 'Avg Bill Size', value: formatCurrency(latest.avgBillSize) },
            { label: 'Customers', value: String(latest.distinctCustomers) },
          ]
        : [],
      tables: [
        {
          title: 'Monthly Sales',
          headers: ['Month', 'Orders', 'Revenue', 'Discount', 'Tax', 'Net Revenue', 'Avg Bill', 'Customers', 'Top Product'],
          columnAlign: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'left'],
          rows: months.map((m) => ({
            kind: 'data' as const,
            cells: [
              m.label,
              m.totalSales,
              formatCurrency(m.totalRevenue),
              formatCurrency(m.discountTotal),
              formatCurrency(m.taxTotal),
              formatCurrency(m.netRevenue),
              formatCurrency(m.avgBillSize),
              m.distinctCustomers,
              m.topProducts[0]?.name || '—',
            ],
          })),
        },
        {
          title: 'Payment Methods',
          headers: ['Month', 'Method', 'Count', 'Total'],
          columnAlign: ['left', 'left', 'right', 'right'],
          rows: months.flatMap((m) =>
            m.paymentMethods.map((pm) => ({
              kind: 'data' as const,
              cells: [m.label, pm.method, pm.count, formatCurrency(pm.total)],
            }))
          ),
        },
        {
          title: 'Product Breakdown',
          headers: ['Month', 'Product', 'Qty', 'Revenue'],
          columnAlign: ['left', 'left', 'right', 'right'],
          rows: months.flatMap((m) =>
            m.products.map((p) => ({
              kind: 'data' as const,
              cells: [m.label, p.name, p.qty, formatCurrency(p.revenue)],
            }))
          ),
        },
      ],
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Monthly Sales Comparison"
        dateRange={false}
        exportable={true}
        onExport={handleExport}
      >
        <div className="mb-6 flex items-center gap-2">
          <label className="text-sm text-ink-secondary">Months:</label>
          <select
            value={monthsCount}
            onChange={(e) => setMonthsCount(Number(e.target.value))}
            className="input-glass px-3 py-2 rounded-md text-sm"
          >
            <option value={3}>3</option>
            <option value={6}>6</option>
            <option value={12}>12</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-ink-muted">Loading data...</div>
        ) : months.length === 0 ? (
          <div className="text-center py-8 text-ink-muted">No data available.</div>
        ) : (
          <>
            {/* Latest vs previous month comparison */}
            {latest && (
              <motion.div
                className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3"
                variants={motionSafe ? { hidden: {}, show: { transition: { staggerChildren: 0.05 } } } : undefined}
                initial={motionSafe ? 'hidden' : false}
                animate="show"
              >
                {[
                  {
                    title: `Revenue (${latest.label})`,
                    value: formatCurrency(latest.totalRevenue),
                    icon: <Wallet className="h-5 w-5" />,
                    tone: 'blue' as const,
                    change: previous ? pctChange(latest.totalRevenue, previous.totalRevenue) : null,
                  },
                  {
                    title: 'Net Revenue',
                    value: formatCurrency(latest.netRevenue),
                    icon: <TrendingUp className="h-5 w-5" />,
                    tone: 'green' as const,
                    change: previous ? pctChange(latest.netRevenue, previous.netRevenue) : null,
                  },
                  {
                    title: 'Avg Bill Size',
                    value: formatCurrency(latest.avgBillSize),
                    icon: <Receipt className="h-5 w-5" />,
                    tone: 'brand' as const,
                    change: previous ? pctChange(latest.avgBillSize, previous.avgBillSize) : null,
                  },
                  {
                    title: 'Customers',
                    value: latest.distinctCustomers,
                    icon: <Users className="h-5 w-5" />,
                    tone: 'purple' as const,
                    change: previous ? pctChange(latest.distinctCustomers, previous.distinctCustomers) : null,
                  },
                  {
                    title: 'Discount Given',
                    value: formatCurrency(latest.discountTotal),
                    icon: <Percent className="h-5 w-5" />,
                    tone: 'orange' as const,
                    change: previous ? pctChange(latest.discountTotal, previous.discountTotal) : null,
                  },
                ].map((card) => (
                  <motion.div key={card.title} variants={motionSafe ? { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } } : undefined}>
                    <StatCardGlass
                      title={card.title}
                      value={card.value}
                      icon={card.icon}
                      tone={card.tone}
                      comparison={
                        card.change !== null
                          ? { label: 'vs previous month', value: previous ? previous.totalRevenue : 0, change: card.change }
                          : undefined
                      }
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Revenue by month */}
            <div className="mb-6 glass-panel rounded-2xl p-4 sm:p-6">
              <h2 className="text-lg font-bold mb-4 text-ink">Revenue by Month</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={months}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="label" stroke={chartColors.axis} />
                  <YAxis stroke={chartColors.axis} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Bar
                    dataKey="totalRevenue"
                    fill="#f97316"
                    name="Revenue"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly table */}
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4 text-ink">Month-by-Month Breakdown</h2>
              <p className="text-xs text-ink-muted mb-3">Click a month to see the full product, payment and daily breakdown.</p>
              <div className="overflow-x-auto glass-panel-strong rounded-2xl">
                <table className="table-glass min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-surface-2">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted uppercase w-8"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted uppercase">Month</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-muted uppercase">Orders</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-muted uppercase">Revenue</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-muted uppercase">Avg Bill</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-muted uppercase">Customers</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted uppercase">Top Product</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {months.map((m) => {
                      const isOpen = expanded.has(m.month);
                      return (
                        <Fragment key={m.month}>
                          <tr
                            onClick={() => toggleMonth(m.month)}
                            className="cursor-pointer hover:bg-surface-2/60 transition-colors"
                          >
                            <td className="px-4 py-4">
                              <ChevronDown
                                className={`h-4 w-4 text-ink-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </td>
                            <td className="px-4 py-4 text-sm font-medium text-ink">{m.label}</td>
                            <td className="px-4 py-4 text-sm text-right text-ink-secondary">{m.totalSales}</td>
                            <td className="px-4 py-4 text-sm text-right font-medium text-ink">
                              {formatCurrency(m.totalRevenue)}
                            </td>
                            <td className="px-4 py-4 text-sm text-right text-ink-secondary">
                              {formatCurrency(m.avgBillSize)}
                            </td>
                            <td className="px-4 py-4 text-sm text-right text-ink-secondary">
                              {m.distinctCustomers}
                            </td>
                            <td className="px-4 py-4 text-sm text-ink-secondary">
                              {m.topProducts[0]?.name || '—'}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={7} className="p-0 border-0">
                              <AnimatePresence initial={false}>
                                {isOpen && (
                                  <motion.div
                                    initial={motionSafe ? { opacity: 0, height: 0 } : false}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={motionSafe ? { opacity: 0, height: 0 } : undefined}
                                    transition={{ duration: dur.slow, ease }}
                                    className="overflow-hidden"
                                  >
                                    <MonthDetail month={m} />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </ReportLayout>
    </Layout>
  );
}

function MonthDetail({ month }: { month: MonthRow }) {
  const chartColors = useChartColors();
  return (
    <div className="bg-surface-2/40 px-4 sm:px-6 py-5 space-y-5">
      {/* Financials */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel rounded-xl p-3">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">Discount</p>
          <p className="text-lg font-bold text-ink">{formatCurrency(month.discountTotal)}</p>
        </div>
        <div className="glass-panel rounded-xl p-3">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">Tax</p>
          <p className="text-lg font-bold text-ink">{formatCurrency(month.taxTotal)}</p>
        </div>
        <div className="glass-panel rounded-xl p-3">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">Net Revenue</p>
          <p className="text-lg font-bold text-ink">{formatCurrency(month.netRevenue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Full product breakdown */}
        <div>
          <h3 className="text-sm font-bold text-ink mb-2 flex items-center gap-1.5">
            <Package className="h-4 w-4" /> Products ({month.distinctProducts})
          </h3>
          <div className="max-h-72 overflow-y-auto glass-panel rounded-xl">
            <table className="table-glass w-full text-sm">
              <thead className="bg-surface-2 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Product</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-ink-muted uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-ink-muted uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {month.products.map((p) => (
                  <tr key={p.productId}>
                    <td className="px-3 py-2 text-ink">{p.name}</td>
                    <td className="px-3 py-2 text-right text-ink-secondary">{p.qty}</td>
                    <td className="px-3 py-2 text-right font-medium text-ink">{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment methods + daily trend */}
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-bold text-ink mb-2 flex items-center gap-1.5">
              <CreditCard className="h-4 w-4" /> Payment Methods
            </h3>
            <div className="glass-panel rounded-xl overflow-hidden">
              <table className="table-glass w-full text-sm">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Method</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-ink-muted uppercase">Count</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-ink-muted uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {month.paymentMethods.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-3 text-center text-ink-muted">No payments recorded.</td>
                    </tr>
                  ) : (
                    month.paymentMethods.map((pm) => (
                      <tr key={pm.method}>
                        <td className="px-3 py-2 text-ink">{pm.method}</td>
                        <td className="px-3 py-2 text-right text-ink-secondary">{pm.count}</td>
                        <td className="px-3 py-2 text-right font-medium text-ink">{formatCurrency(pm.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-ink mb-2">Daily Trend</h3>
            <div className="glass-panel rounded-xl p-2">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={month.dailyBreakdown}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(8, 10)}
                    stroke={chartColors.axis}
                    fontSize={10}
                  />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} labelFormatter={(v) => v} />
                  <Bar dataKey="totalRevenue" fill="#f97316" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
