"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function inr(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function deltaClass(pct: number | null | undefined) {
  if (pct == null) return "text-stone-400";
  if (pct > 0) return "text-emerald-600 dark:text-emerald-400";
  if (pct < 0) return "text-red-600 dark:text-red-400";
  return "text-stone-400";
}

function statusDot(status: "ok" | "warn" | "bad") {
  if (status === "bad") return "bg-red-500";
  if (status === "warn") return "bg-amber-400";
  return "bg-emerald-500";
}

function tip(text: string) {
  return (
    <span
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-stone-300 text-[10px] text-stone-500 cursor-help"
      title={text}
    >
      ?
    </span>
  );
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

const LIGHT_HELP: Record<string, string> = {
  revenue: "Green = sales up vs last period. Red = sales down.",
  credit: "Money customers still owe you.",
  stock: "Items that are empty or almost empty.",
  customers: "Regular buyers who stopped coming — call them.",
  delivery: "Home delivery orders that failed.",
};

/** Main dashboard — numbers first, almost no prose. */
export function ShopPulsePanel({
  pulse,
  dailyRevenue,
  onNavigate,
}: {
  pulse: ShopPulse;
  dailyRevenue?: Array<{ date: string; total: number }>;
  onNavigate: (tab: string) => void;
}) {
  const actions = pulse.takeaways.filter((t) => t.severity !== "low").slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Status row */}
      <div className="flex flex-wrap gap-2">
        {pulse.lights.map((l) => (
          <button
            key={l.key}
            type="button"
            title={LIGHT_HELP[l.key] || l.detail}
            onClick={() => {
              if (l.key === "credit") onNavigate("money");
              else if (l.key === "customers") onNavigate("people");
              else if (l.key === "stock") onNavigate("stock");
              else if (l.key === "delivery") onNavigate("money");
            }}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-1.5 text-sm text-stone-800 dark:text-gray-100"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${statusDot(l.status)}`} />
            {l.label}
          </button>
        ))}
      </div>

      {/* Big numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Sales",
            help: "Total money from paid bills in this period.",
            value: inr(pulse.kpis.revenue.value),
            delta: pulse.kpis.revenue.deltaPct,
          },
          {
            label: "Bills",
            help: "How many bills were completed.",
            value: String(pulse.kpis.orders.value),
            delta: pulse.kpis.orders.deltaPct,
          },
          {
            label: "Avg bill",
            help: "Average amount per bill.",
            value: inr(pulse.kpis.aov.value),
            delta: pulse.kpis.aov.deltaPct,
          },
          {
            label: "Credit due",
            help: "Still unpaid by customers.",
            value: inr(pulse.kpis.openCredit.value),
            sub: `${pulse.kpis.openCredit.customers} people`,
            warn: pulse.kpis.openCredit.value > 0,
          },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border p-4 ${
              c.warn
                ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20"
                : "border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950"
            }`}
          >
            <p className="text-xs text-stone-500 flex items-center">
              {c.label}
              {tip(c.help)}
            </p>
            <p className="text-2xl font-bold text-stone-900 dark:text-white mt-1 tabular-nums">
              {c.value}
            </p>
            {"delta" in c ? (
              <p className={`text-xs mt-1 font-medium ${deltaClass(c.delta)}`}>
                {c.delta == null ? "—" : `${c.delta > 0 ? "▲" : c.delta < 0 ? "▼" : "●"} ${Math.abs(c.delta)}%`}
              </p>
            ) : (
              <p className="text-xs text-stone-500 mt-1">{c.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Do next */}
      {actions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => a.href && onNavigate(a.href === "customers" ? "people" : a.href === "inventory" ? "stock" : a.href === "delivery" ? "money" : a.href === "sales-overview" ? "overview" : a.href)}
              className={`text-left rounded-2xl border px-4 py-3 ${
                a.severity === "high"
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                  : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
              }`}
            >
              <p className="font-semibold text-sm text-stone-900 dark:text-white">{a.title}</p>
              <p className="text-xs text-stone-600 dark:text-gray-400 mt-1 line-clamp-2">{a.detail}</p>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chart */}
        <div className="lg:col-span-3 rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
          <p className="text-sm font-semibold text-stone-800 dark:text-gray-100 mb-3 flex items-center">
            Daily sales
            {tip("Each bar/point is one day’s total sales.")}
          </p>
          {dailyRevenue && dailyRevenue.some((d) => d.total > 0) ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => (v && v.length >= 10 ? v.slice(5) : v)}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <Tooltip formatter={(v: number) => [inr(v), "Sales"]} />
                  <Line type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-stone-400 py-16 text-center">No sales in this period</p>
          )}
        </div>

        {/* Top products */}
        <div className="lg:col-span-2 rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
          <p className="text-sm font-semibold text-stone-800 dark:text-gray-100 mb-3 flex items-center">
            Top sellers
            {tip("Items that made the most money.")}
          </p>
          <ul className="space-y-2.5">
            {pulse.topProducts.slice(0, 5).map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-stone-400 w-4">{i + 1}</span>
                <span className="flex-1 truncate text-stone-900 dark:text-white">{p.name}</span>
                <span className="tabular-nums text-stone-600 dark:text-gray-300">{inr(p.revenue)}</span>
              </li>
            ))}
            {pulse.topProducts.length === 0 && (
              <li className="text-sm text-stone-400 py-8 text-center">No data</li>
            )}
          </ul>
          {pulse.peakHour && (
            <p className="text-xs text-stone-500 mt-4 pt-3 border-t border-stone-100 dark:border-gray-800">
              Busiest around {pulse.peakHour.hour}:00
            </p>
          )}
        </div>
      </div>

      {/* Three lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ListCard
          title="Call them"
          help="Regular customers who haven’t come recently."
          empty="Nobody to call"
          onMore={() => onNavigate("people")}
          rows={pulse.callListPreview.slice(0, 5).map((c) => ({
            primary: c.name,
            secondary: c.phone,
            right: c.daysSinceLastVisit != null ? `${c.daysSinceLastVisit}d` : "",
          }))}
        />
        <ListCard
          title="Credit due"
          help="People who still owe money."
          empty="No open credit"
          onMore={() => onNavigate("money")}
          rows={pulse.topDebtors.slice(0, 5).map((d) => ({
            primary: d.name,
            secondary: d.phone,
            right: inr(d.amount),
            warn: true,
          }))}
        />
        <ListCard
          title="Staff"
          help="Who billed the most in this period."
          empty="No staff data"
          onMore={() => onNavigate("more")}
          rows={pulse.staffTop.slice(0, 5).map((s) => ({
            primary: s.name,
            secondary: `${s.orders} bills`,
            right: inr(s.revenue),
          }))}
        />
      </div>
    </div>
  );
}

function ListCard({
  title,
  help,
  empty,
  rows,
  onMore,
}: {
  title: string;
  help: string;
  empty: string;
  rows: Array<{ primary: string; secondary: string; right: string; warn?: boolean }>;
  onMore: () => void;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-stone-800 dark:text-gray-100 flex items-center">
          {title}
          {tip(help)}
        </p>
        <button type="button" onClick={onMore} className="text-xs text-teal-700 dark:text-teal-400">
          See all
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-400 py-6 text-center">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-stone-900 dark:text-white truncate">{r.primary}</p>
                <p className="text-xs text-stone-500 truncate">{r.secondary}</p>
              </div>
              <span
                className={`tabular-nums shrink-0 ${
                  r.warn ? "text-amber-700 dark:text-amber-400 font-semibold" : "text-stone-600"
                }`}
              >
                {r.right}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Simple money view */
export function MoneyHealthPanel({ money }: { money: MoneyHealth }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Sales collected", value: inr(money.paidRevenue), help: "Paid bills in this period." },
          {
            label: "Still owed",
            value: inr(money.openCredit.amount),
            help: "Credit not yet collected.",
            warn: money.openCredit.amount > 0,
          },
          {
            label: "Discounts",
            value: inr(money.discounts.total),
            help: "Money given off on bills.",
          },
          {
            label: "Voids",
            value: String(money.voids.count + money.refunds.count),
            help: "Cancelled or refunded bills.",
          },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border p-4 ${
              c.warn
                ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20"
                : "border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950"
            }`}
          >
            <p className="text-xs text-stone-500 flex items-center">
              {c.label}
              {tip(c.help)}
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums text-stone-900 dark:text-white">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 dark:border-gray-800 flex items-center gap-1">
          <p className="text-sm font-semibold">Who owes money</p>
          {tip("Call these people to collect payment.")}
        </div>
        {money.topDebtors.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-400">Nobody owes right now</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-stone-500">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Phone</th>
                <th className="text-right px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {money.topDebtors.map((d) => (
                <tr key={d.customerId} className="border-t border-stone-100 dark:border-gray-800">
                  <td className="px-4 py-2.5 font-medium">{d.name}</td>
                  <td className="px-4 py-2.5 text-stone-500">{d.phone}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-amber-700 tabular-nums">
                    {inr(d.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {money.paymentMix.length > 0 && (
        <div className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
          <p className="text-sm font-semibold mb-3 flex items-center">
            How people paid
            {tip("Cash, UPI, card, or credit.")}
          </p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={money.paymentMix}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="value" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

/** People to call / VIPs — short */
export function CustomerSegmentsPanel({
  segments,
  filter,
  onFilterChange,
}: {
  segments: CustomerSegments;
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const chips = [
    { id: "call", label: "Call list", n: segments.callList.length },
    { id: "champion", label: "VIPs", n: segments.counts.champion || 0 },
    { id: "loyal", label: "Regulars", n: segments.counts.loyal || 0 },
    { id: "credit_heavy", label: "Credit", n: segments.counts.credit_heavy || 0 },
  ];

  const rows =
    filter === "call"
      ? segments.callList
      : segments.customers.filter((c) => c.segment === filter);

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Tap a group · ? = what it means
        {tip(
          "Call list = used to buy often but quiet now. VIPs = your best customers. Regulars = come often. Credit = owe money."
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onFilterChange(c.id)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              filter === c.id
                ? "bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900"
                : "border-stone-200 text-stone-700 dark:border-gray-700 dark:text-gray-200"
            }`}
          >
            {c.label} · {c.n}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-stone-500 bg-stone-50 dark:bg-gray-900">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Phone</th>
              <th className="text-right px-3 py-2">Last visit</th>
              <th className="text-right px-3 py-2">Spent</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((c) => (
              <tr key={c.id} className="border-t border-stone-100 dark:border-gray-800">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-stone-500">{c.phone}</td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-500">
                  {c.daysSinceLastVisit != null ? `${c.daysSinceLastVisit}d ago` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{inr(c.lifetimeSpent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-8 text-center text-sm text-stone-400">No one in this group</p>
        )}
      </div>
    </div>
  );
}

/** Keep type exports for delivery/staff if page still references them */
export function DeliveryOpsPanel({ delivery }: { delivery: DeliveryOps }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: "Orders", value: delivery.total },
        { label: "Home delivery", value: delivery.delivery },
        { label: "Pickup", value: delivery.pickup },
        { label: "Failed", value: delivery.failed + delivery.returned },
      ].map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4"
        >
          <p className="text-xs text-stone-500">{c.label}</p>
          <p className="text-2xl font-bold mt-1">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export function StaffProductivityPanel({ staff }: { staff: StaffProductivity }) {
  return (
    <div className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-xs text-stone-500 bg-stone-50 dark:bg-gray-900">
          <tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-right px-4 py-2">Bills</th>
            <th className="text-right px-4 py-2">Sales</th>
          </tr>
        </thead>
        <tbody>
          {staff.staff.map((s) => (
            <tr key={s.userId} className="border-t border-stone-100 dark:border-gray-800">
              <td className="px-4 py-2.5 font-medium">{s.name}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{s.orders}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{inr(s.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
