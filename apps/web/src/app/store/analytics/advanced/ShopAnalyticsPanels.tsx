"use client";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function inr(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function deltaClass(pct: number | null | undefined) {
  if (pct == null) return "text-ink-muted";
  if (pct > 0) return "text-emerald-700 dark:text-emerald-400";
  if (pct < 0) return "text-red-600 dark:text-red-400";
  return "text-ink-muted";
}

function deltaLabel(pct: number | null | undefined) {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs prior`;
}

function lightStyles(status: "ok" | "warn" | "bad") {
  if (status === "bad")
    return "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40";
  if (status === "warn")
    return "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40";
  return "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30";
}

export type ShopPulse = {
  period: {
    start: string;
    end: string;
    priorStart?: string;
    priorEnd?: string;
    daySpan?: number;
  };
  kpis: {
    revenue: { value: number; prior: number; deltaPct: number | null };
    orders: { value: number; prior: number; deltaPct: number | null };
    aov: { value: number; prior: number; deltaPct: number | null };
    openCredit: { value: number; orders: number; customers: number };
    namedOrderPct: { value: number };
    stockouts: number;
    lowStock: number;
  };
  lights: Array<{
    key: string;
    label: string;
    status: "ok" | "warn" | "bad";
    detail: string;
  }>;
  takeaways: Array<{
    severity: "low" | "medium" | "high";
    title: string;
    detail: string;
    action?: string;
    href?: string;
  }>;
  peakHour: { hour: number; count: number; timezone?: string } | null;
  topProducts: Array<{ name: string; revenue: number }>;
  callListPreview: Array<{
    id: string;
    name: string;
    phone: string;
    segment: string;
    daysSinceLastVisit: number | null;
  }>;
  vipPreview: Array<{ id: string; name: string; phone: string; lifetimeSpent: number }>;
  topDebtors: Array<{ name: string; phone: string; amount: number; orders: number }>;
  deliverySummary: {
    total: number;
    delivery: number;
    pickup: number;
    pending: number;
    failed: number;
  };
  staffTop: Array<{ name: string; orders: number; revenue: number; avgBill: number }>;
  paymentMix: Array<{ name: string; value: number }>;
  segmentCounts: Record<string, number>;
};

export type MoneyHealth = {
  period: { start: string; end: string };
  paymentMix: Array<{ name: string; value: number }>;
  paidRevenue: number;
  discounts: { total: number; pctOfRevenue: number; overrideCount: number };
  voids: { count: number; amount: number };
  refunds: { count: number; amount: number };
  openCredit: { amount: number; orders: number; customers: number };
  topDebtors: Array<{
    customerId: string;
    name: string;
    phone: string;
    amount: number;
    orders: number;
  }>;
};

export type DeliveryOps = {
  period: { start: string; end: string };
  total: number;
  delivery: number;
  pickup: number;
  delivered: number;
  pending: number;
  failed: number;
  returned: number;
  deliveryFeeTotal: number;
  deliveryRevenue: number;
  pickupRevenue: number;
  failRate: number;
  byArea: Array<{ area: string; orders: number; revenue: number; failed: number }>;
  typeMix: Array<{ name: string; value: number }>;
  byStatus: Array<{ name: string; value: number }>;
};

export type CustomerSegments = {
  asOf: string;
  counts: Record<string, number>;
  totalCustomers: number;
  callList: Array<{
    id: string;
    name: string;
    phone: string;
    area: string | null;
    segment: string;
    visits: number;
    lifetimeSpent: number;
    daysSinceLastVisit: number | null;
    openCredit: number;
  }>;
  vips: Array<{
    id: string;
    name: string;
    phone: string;
    lifetimeSpent: number;
    visits: number;
  }>;
  customers: Array<{
    id: string;
    name: string;
    phone: string;
    area: string | null;
    segment: string;
    visits: number;
    lifetimeSpent: number;
    daysSinceLastVisit: number | null;
    openCredit: number;
    loyaltyTier: string;
  }>;
  segmentLabels: Record<string, string>;
};

export type StaffProductivity = {
  period: { start: string; end: string };
  staff: Array<{
    userId: string;
    name: string;
    role: string;
    orders: number;
    revenue: number;
    avgBill: number;
  }>;
  totalOrders: number;
  totalRevenue: number;
};

export function ShopPulsePanel({
  pulse,
  onNavigate,
}: {
  pulse: ShopPulse;
  onNavigate: (tab: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-subtle bg-surface p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Shop pulse
        </p>
        <h2 className="mt-1 text-xl sm:text-2xl font-bold text-ink">
          How is the whole shop doing?
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          {pulse.period.start} → {pulse.period.end}
          {pulse.period.priorStart
            ? ` · vs ${pulse.period.priorStart} → ${pulse.period.priorEnd}`
            : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Revenue", value: inr(pulse.kpis.revenue.value), delta: pulse.kpis.revenue.deltaPct },
          {
            label: "Orders",
            value: String(pulse.kpis.orders.value),
            delta: pulse.kpis.orders.deltaPct,
          },
          { label: "Avg bill", value: inr(pulse.kpis.aov.value), delta: pulse.kpis.aov.deltaPct },
          {
            label: "Open credit",
            value: inr(pulse.kpis.openCredit.value),
            sub: `${pulse.kpis.openCredit.customers} customers`,
          },
          {
            label: "Named bills",
            value: `${pulse.kpis.namedOrderPct.value}%`,
            sub: "Phone saved on bill",
          },
          {
            label: "Stock alerts",
            value: String(pulse.kpis.stockouts + pulse.kpis.lowStock),
            sub: `${pulse.kpis.stockouts} out · ${pulse.kpis.lowStock} low`,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-subtle bg-surface p-4">
            <p className="text-xs text-ink-secondary">{card.label}</p>
            <p className="text-xl font-bold text-ink mt-1 tabular-nums">{card.value}</p>
            {"delta" in card ? (
              <p className={`text-xs mt-1 ${deltaClass(card.delta)}`}>{deltaLabel(card.delta)}</p>
            ) : (
              <p className="text-xs text-ink-muted mt-1">{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {pulse.lights.map((l) => (
          <div key={l.key} className={`rounded-xl border px-3 py-3 ${lightStyles(l.status)}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">{l.label}</p>
            <p className="text-sm font-medium mt-1">{l.detail}</p>
          </div>
        ))}
      </div>

      {pulse.takeaways.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">What to do next</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {pulse.takeaways.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => t.href && onNavigate(t.href)}
                className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                  t.severity === "high"
                    ? "border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30"
                    : t.severity === "medium"
                      ? "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30"
                      : "border-subtle bg-surface-2/50"
                } ${t.href ? "hover:opacity-90 cursor-pointer" : "cursor-default"}`}
              >
                <p className="font-semibold text-sm text-ink">{t.title}</p>
                <p className="text-sm text-ink-secondary mt-1">{t.detail}</p>
                {t.action && (
                  <p className="text-xs text-ink-muted mt-2">{t.action}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">Call this week</h3>
            <button
              type="button"
              onClick={() => onNavigate("customers")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Full list
            </button>
          </div>
          {pulse.callListPreview.length === 0 ? (
            <p className="text-sm text-ink-muted">No at-risk / lapsed customers right now.</p>
          ) : (
            <ul className="space-y-2">
              {pulse.callListPreview.map((c) => (
                <li key={c.id} className="flex justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{c.name}</p>
                    <p className="text-xs text-ink-muted">
                      {c.phone} · {c.segment.replace("_", " ")}
                      {c.daysSinceLastVisit != null ? ` · ${c.daysSinceLastVisit}d ago` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">Top products</h3>
            <button
              type="button"
              onClick={() => onNavigate("demand")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Demand
            </button>
          </div>
          <ul className="space-y-2">
            {pulse.topProducts.map((p, i) => (
              <li key={i} className="flex justify-between text-sm gap-2">
                <span className="truncate text-ink">{p.name}</span>
                <span className="tabular-nums text-ink-secondary shrink-0">{inr(p.revenue)}</span>
              </li>
            ))}
          </ul>
          {pulse.peakHour && (
            <p className="text-xs text-ink-muted mt-3">
              Peak hour {pulse.peakHour.hour}:00{" "}
              {pulse.peakHour.timezone || "Asia/Kolkata"} ({pulse.peakHour.count} orders)
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">Open credit</h3>
            <button
              type="button"
              onClick={() => onNavigate("money")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Money
            </button>
          </div>
          {pulse.topDebtors.length === 0 ? (
            <p className="text-sm text-ink-muted">No open credit.</p>
          ) : (
            <ul className="space-y-2">
              {pulse.topDebtors.map((d, i) => (
                <li key={i} className="flex justify-between text-sm gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{d.name}</p>
                    <p className="text-xs text-ink-muted">{d.phone}</p>
                  </div>
                  <span className="tabular-nums font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                    {inr(d.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted mt-3">
            Delivery: {pulse.deliverySummary.delivery} home · {pulse.deliverySummary.pickup}{" "}
            pickup · {pulse.deliverySummary.failed} failed
          </p>
        </div>
      </div>

      {pulse.staffTop.length > 0 && (
        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">Staff this period</h3>
            <button
              type="button"
              onClick={() => onNavigate("staff")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Details
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="py-1">Cashier</th>
                  <th className="py-1 text-right">Bills</th>
                  <th className="py-1 text-right">Revenue</th>
                  <th className="py-1 text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {pulse.staffTop.map((s, i) => (
                  <tr key={i} className="border-t border-subtle">
                    <td className="py-2 text-ink">{s.name}</td>
                    <td className="py-2 text-right tabular-nums">{s.orders}</td>
                    <td className="py-2 text-right tabular-nums">{inr(s.revenue)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-secondary">
                      {inr(s.avgBill)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function MoneyHealthPanel({ money }: { money: MoneyHealth }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-subtle bg-surface p-5">
        <h2 className="text-xl font-bold text-ink">Money health</h2>
        <p className="text-sm text-ink-secondary mt-1">
          Cash vs credit, discounts, voids — {money.period.start} → {money.period.end}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-subtle bg-surface p-4">
          <p className="text-xs text-ink-secondary">Paid revenue</p>
          <p className="text-2xl font-bold text-ink mt-1">{inr(money.paidRevenue)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20 p-4">
          <p className="text-xs text-ink-secondary">Open credit (all time)</p>
          <p className="text-2xl font-bold text-ink mt-1">{inr(money.openCredit.amount)}</p>
          <p className="text-xs text-ink-muted mt-1">
            {money.openCredit.orders} bills · {money.openCredit.customers} customers
          </p>
        </div>
        <div className="rounded-xl border border-subtle bg-surface p-4">
          <p className="text-xs text-ink-secondary">Discounts</p>
          <p className="text-2xl font-bold text-ink mt-1">{inr(money.discounts.total)}</p>
          <p className="text-xs text-ink-muted mt-1">
            {money.discounts.pctOfRevenue}% of revenue · {money.discounts.overrideCount} overrides
          </p>
        </div>
        <div className="rounded-xl border border-subtle bg-surface p-4">
          <p className="text-xs text-ink-secondary">Voids / refunds</p>
          <p className="text-2xl font-bold text-ink mt-1">
            {money.voids.count + money.refunds.count}
          </p>
          <p className="text-xs text-ink-muted mt-1">
            {money.voids.count} void ({inr(money.voids.amount)}) · {money.refunds.count} refund (
            {inr(money.refunds.amount)})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">Payment mix</h3>
          {money.paymentMix.length > 0 ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={money.paymentMix}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                  >
                    {money.paymentMix.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-ink-muted py-8 text-center">No payments in range</p>
          )}
        </div>

        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">Who owes most</h3>
          {money.topDebtors.length === 0 ? (
            <p className="text-sm text-ink-muted py-8 text-center">No open credit</p>
          ) : (
            <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="text-left text-xs text-ink-muted border-b border-subtle">
                    <th className="py-2">Customer</th>
                    <th className="py-2 text-right">Bills</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {money.topDebtors.map((d) => (
                    <tr key={d.customerId} className="border-b border-subtle/60">
                      <td className="py-2">
                        <p className="font-medium text-ink">{d.name}</p>
                        <p className="text-xs text-ink-muted">{d.phone}</p>
                      </td>
                      <td className="py-2 text-right tabular-nums">{d.orders}</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                        {inr(d.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DeliveryOpsPanel({ delivery }: { delivery: DeliveryOps }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-subtle bg-surface p-5">
        <h2 className="text-xl font-bold text-ink">Delivery & pickup</h2>
        <p className="text-sm text-ink-secondary mt-1">
          Where orders go and where they fail — {delivery.period.start} → {delivery.period.end}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Total orders", value: String(delivery.total) },
          { label: "Home delivery", value: String(delivery.delivery) },
          { label: "Pickup", value: String(delivery.pickup) },
          { label: "Pending", value: String(delivery.pending) },
          {
            label: "Fail rate",
            value: `${delivery.failRate}%`,
            sub: `${delivery.failed + delivery.returned} failed/returned`,
          },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-subtle bg-surface p-4">
            <p className="text-xs text-ink-secondary">{c.label}</p>
            <p className="text-xl font-bold text-ink mt-1">{c.value}</p>
            {c.sub && <p className="text-xs text-ink-muted mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <h3 className="text-sm font-semibold mb-3">Type mix</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={delivery.typeMix.filter((x) => x.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  label
                >
                  {delivery.typeMix.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-ink-muted text-center">
            Delivery revenue {inr(delivery.deliveryRevenue)} · Pickup{" "}
            {inr(delivery.pickupRevenue)} · Fees {inr(delivery.deliveryFeeTotal)}
          </p>
        </div>

        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <h3 className="text-sm font-semibold mb-3">Revenue by area</h3>
          {delivery.byArea.length > 0 ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={delivery.byArea.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                  <YAxis type="category" dataKey="area" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => inr(v)} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-ink-muted py-12 text-center">No delivery area data</p>
          )}
        </div>
      </div>

      {delivery.byArea.some((a) => a.failed > 0) && (
        <div className="rounded-2xl border border-subtle bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-subtle font-semibold text-sm">
            Failures by area
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-2/50 text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-2 text-left">Area</th>
                <th className="px-4 py-2 text-right">Orders</th>
                <th className="px-4 py-2 text-right">Failed</th>
                <th className="px-4 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {delivery.byArea
                .filter((a) => a.failed > 0)
                .map((a) => (
                  <tr key={a.area} className="border-t border-subtle">
                    <td className="px-4 py-2">{a.area}</td>
                    <td className="px-4 py-2 text-right">{a.orders}</td>
                    <td className="px-4 py-2 text-right text-red-600">{a.failed}</td>
                    <td className="px-4 py-2 text-right">{inr(a.revenue)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CustomerSegmentsPanel({
  segments,
  filter,
  onFilterChange,
}: {
  segments: CustomerSegments;
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const keys = Object.keys(segments.segmentLabels || {});
  const rows =
    filter === "all"
      ? segments.customers
      : filter === "call"
        ? segments.callList
        : segments.customers.filter((c) => c.segment === filter);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-subtle bg-surface p-5">
        <h2 className="text-xl font-bold text-ink">Customer segments</h2>
        <p className="text-sm text-ink-secondary mt-1">
          RFM-style groups from purchase history · as of {segments.asOf} ·{" "}
          {segments.totalCustomers} in directory
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            filter === "all"
              ? "bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900"
              : "border-subtle text-ink-secondary"
          }`}
        >
          All ({segments.totalCustomers})
        </button>
        <button
          type="button"
          onClick={() => onFilterChange("call")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            filter === "call"
              ? "bg-amber-600 text-white border-amber-600"
              : "border-amber-300 text-amber-800 dark:text-amber-200"
          }`}
        >
          Call list ({segments.callList.length})
        </button>
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onFilterChange(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              filter === k
                ? "bg-blue-600 text-white border-blue-600"
                : "border-subtle text-ink-secondary"
            }`}
          >
            {segments.segmentLabels[k]} ({segments.counts[k] || 0})
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-subtle bg-surface overflow-hidden">
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2/95 text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Segment</th>
                <th className="px-3 py-2 text-right">Visits</th>
                <th className="px-3 py-2 text-right">Spent</th>
                <th className="px-3 py-2 text-right">Last</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((c) => (
                <tr key={c.id} className="border-t border-subtle hover:bg-surface-2/40">
                  <td className="px-3 py-2 font-medium text-ink">{c.name}</td>
                  <td className="px-3 py-2 text-ink-secondary">{c.phone}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full border border-subtle">
                      {(segments.segmentLabels[c.segment] || c.segment).replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.visits}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(c.lifetimeSpent)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-muted">
                    {c.daysSinceLastVisit != null ? `${c.daysSinceLastVisit}d` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.openCredit > 0 ? inr(c.openCredit) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">No customers in this segment.</p>
        )}
      </div>

      {segments.vips.length > 0 && filter !== "champion" && (
        <div className="rounded-xl border border-subtle bg-surface-2/40 p-4">
          <p className="text-sm font-semibold text-ink mb-2">VIP champions</p>
          <div className="flex flex-wrap gap-2">
            {segments.vips.slice(0, 10).map((v) => (
              <span
                key={v.id}
                className="text-xs px-2.5 py-1 rounded-full border border-subtle bg-surface"
              >
                {v.name} · {inr(v.lifetimeSpent)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StaffProductivityPanel({ staff }: { staff: StaffProductivity }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-subtle bg-surface p-5">
        <h2 className="text-xl font-bold text-ink">Staff productivity</h2>
        <p className="text-sm text-ink-secondary mt-1">
          Bills by cashier — {staff.period.start} → {staff.period.end}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-subtle bg-surface p-4">
          <p className="text-xs text-ink-secondary">Total bills</p>
          <p className="text-2xl font-bold">{staff.totalOrders}</p>
        </div>
        <div className="rounded-xl border border-subtle bg-surface p-4">
          <p className="text-xs text-ink-secondary">Total revenue</p>
          <p className="text-2xl font-bold">{inr(staff.totalRevenue)}</p>
        </div>
      </div>

      {staff.staff.length > 0 ? (
        <>
          <div className="h-[260px] rounded-2xl border border-subtle bg-surface p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staff.staff.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-subtle overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/60 text-xs text-ink-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Cashier</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-right">Bills</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Avg bill</th>
                </tr>
              </thead>
              <tbody>
                {staff.staff.map((s) => (
                  <tr key={s.userId} className="border-t border-subtle">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-ink-muted">{s.role}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.orders}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{inr(s.revenue)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{inr(s.avgBill)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-center text-ink-muted py-12">No staff sales in this range.</p>
      )}
    </div>
  );
}
