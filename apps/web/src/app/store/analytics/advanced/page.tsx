"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import { localDateRangeToApiBounds, todayLocalYmd } from "@/lib/dateRangeParams";
import { format, subDays } from "date-fns";
import {
  SimplePieChart,
} from "@/components/charts";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Skeleton from "@/components/ui/Skeleton";
import { exportToCSV } from "@/lib/exportCSV";
import {
  ShopPulsePanel,
  MoneyHealthPanel,
  DeliveryOpsPanel,
  CustomerSegmentsPanel,
  StaffProductivityPanel,
  type ShopPulse,
  type MoneyHealth,
  type DeliveryOps,
  type CustomerSegments,
  type StaffProductivity,
} from "./ShopAnalyticsPanels";

function formatForecastDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

interface Forecast {
  historical: Array<{
    date: string;
    actual: number;
    ma7: number;
    ma30: number;
  }>;
  forecast: Array<{
    date: string;
    predicted: number;
    predictedLow?: number;
    predictedHigh?: number;
    confidence: string;
  }>;
  trend: string;
  naiveMapePct?: number | null;
  accuracyNote?: string;
  avgDailySales: number;
  insufficientHistory?: boolean;
  minDaysRecommended?: number;
  daysWithPositiveSales?: number;
}

interface Demand {
  fastMoving: Array<{
    productName: string;
    totalRevenue: number;
    frequency: number;
  }>;
  slowMoving: Array<{
    productName: string;
    totalRevenue: number;
    frequency: number;
  }>;
  categories?: Array<{
    categoryName: string;
    totalRevenue: number;
    totalQty: number;
    lineCount: number;
  }>;
  byStore?: Array<{ storeId: string; storeName: string; products: unknown[] }>;
  abcSummary?: { A: number; B: number; C: number; note?: string };
  peakHour: { hour: number; count: number; timezone?: string } | null;
  peakDay: { day: string; count: number } | null;
}

interface InventoryRecommendation {
  mode?: string;
  note?: string;
  historyDays?: number;
  leadTimeDays?: number;
  orderingCost?: number;
  holdingCostPerUnit?: number;
  recommendations: Array<{
    storeId?: string;
    storeName?: string;
    productName: string;
    currentStock: number;
    inboundOpenQty?: number;
    reorderPoint: number;
    suggestedOrderQty: number;
    status: string;
    action: string;
  }>;
  outOfStock: number;
  lowStock: number;
  overstock: number;
  stores?: Array<{
    storeId: string;
    storeName: string;
    recommendations: InventoryRecommendation["recommendations"];
  }>;
}

interface SalesOverview {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  bestDay: { date: string; revenue: number } | null;
  peakHour: { hour: number; count: number; timezone?: string } | null;
  dailyRevenue: Array<{ date: string; total: number }>;
  topProducts: Array<{ name: string; revenue: number }>;
  revenueByDayOfWeek: Array<{ day: string; value: number }>;
  paymentMix: Array<{ name: string; value: number }>;
  insufficientHistory?: boolean;
  minDaysRecommended?: number;
  daysWithSales?: number;
  calendarNote?: string;
  startDate?: string;
  endDate?: string;
}

interface InsightItem {
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  action?: string;
  href?: string;
}

interface InsightsPayload {
  insights: InsightItem[];
  period: { start: string; end: string; priorStart: string; priorEnd: string };
  franchiseStoreId: string | null;
  storeIds?: string[];
}

interface ProfitMarginProduct {
  productId: string;
  productName: string;
  sku: string;
  unitType: string;
  revenue: number;
  qtySold: number;
  avgCost: number | null;
  estimatedCogs: number | null;
  grossProfit: number | null;
  grossMarginPct: number | null;
  costStatus: "ok" | "unknown";
}

interface ProfitMarginPayload {
  summary: {
    totalSales: number;
    totalPurchases: number;
    expensesLabel: string;
    netProfit: number;
    profitMarginPct: number;
    estimatedCogsFromSales: number;
    productsWithCost: number;
    productsMissingCost: number;
  };
  products: ProfitMarginProduct[];
  period: { start: string; end: string };
}

interface CustomerDemographicsPayload {
  period: { start: string; end: string };
  headline: string;
  takeaways: Array<{
    title: string;
    detail: string;
    tone: "good" | "warn" | "info";
  }>;
  summary: {
    totalCustomers: number;
    newCustomersInPeriod: number;
    activeCustomers: number;
    repeatCustomers: number;
    walkInOrders: number;
    identifiedOrders: number;
    totalOrders: number;
    periodRevenue: number;
    identifiedRevenue: number;
    avgSpendPerActiveCustomer: number;
    avgOrderValue: number;
    portalRegistered: number;
    profileCompleted: number;
    creditOrders: number;
    returningActive: number;
    newActive: number;
    namedOrderPct: number;
    walkInPct: number;
    returningPct: number;
    repeatPct: number;
  };
  byArea: Array<{
    name: string;
    customers: number;
    revenue: number;
    orders: number;
    revenueSharePct: number;
  }>;
  byCity: Array<{ name: string; customers: number }>;
  byTier: Array<{ name: string; customers: number }>;
  spendBands: Array<{ name: string; customers: number }>;
  newVsReturning: Array<{ name: string; value: number }>;
  orderMix: Array<{ name: string; value: number }>;
  topCustomers: Array<{
    id: string;
    name: string;
    phone: string;
    area: string;
    orders: number;
    revenue: number;
    loyaltyPoints: number;
    creditOrders: number;
  }>;
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function defaultDateRange() {
  const endDateStr = todayLocalYmd();
  const startDateStr = format(subDays(new Date(), 29), "yyyy-MM-dd");
  return { startDateStr, endDateStr };
}

export default function AdvancedAnalyticsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [demand, setDemand] = useState<Demand | null>(null);
  const [inventory, setInventory] = useState<InventoryRecommendation | null>(
    null
  );
  const [salesOverview, setSalesOverview] = useState<SalesOverview | null>(null);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [{ startDateStr, endDateStr }, setDateRange] = useState(defaultDateRange);
  const [franchiseStoreId, setFranchiseStoreId] = useState<string>("");
  const [franchiseOptions, setFranchiseOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [demandByStore, setDemandByStore] = useState(false);
  const [analyticsErrors, setAnalyticsErrors] = useState<string[]>([]);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [profitMargin, setProfitMargin] = useState<ProfitMarginPayload | null>(null);
  const [profitMarginError, setProfitMarginError] = useState<string | null>(null);
  const [demographics, setDemographics] = useState<CustomerDemographicsPayload | null>(null);
  const [demographicsError, setDemographicsError] = useState<string | null>(null);
  const [shopPulse, setShopPulse] = useState<ShopPulse | null>(null);
  const [shopPulseError, setShopPulseError] = useState<string | null>(null);
  const [moneyHealth, setMoneyHealth] = useState<MoneyHealth | null>(null);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [deliveryOps, setDeliveryOps] = useState<DeliveryOps | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [customerSegments, setCustomerSegments] = useState<CustomerSegments | null>(null);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [segmentFilter, setSegmentFilter] = useState("call");
  const [staffProductivity, setStaffProductivity] = useState<StaffProductivity | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "money"
    | "people"
    | "stock"
    | "more"
  >("overview");
  const [moreSection, setMoreSection] = useState<
    "sales" | "forecast" | "demand" | "margin" | "who" | "staff" | "delivery"
  >("sales");

  const isOwner = user?.store?.type === "OWNER";

  const scopeParams = () => ({
    startDate: startDateStr,
    endDate: endDateStr,
    ...(franchiseStoreId ? { franchiseStoreId } : {}),
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!isOwner) return;
    (async () => {
      try {
        const res = await api.get("/api/v1/stores/franchises/summary");
        const list = (res.data || []).map((f: { id: string; name: string }) => ({
          id: f.id,
          name: f.name,
        }));
        setFranchiseOptions(list);
      } catch {
        setFranchiseOptions([]);
      }
    })();
  }, [user, isOwner, router]);

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
    loadSalesOverview();
    loadInsights();
    loadProfitMargin();
    loadDemographics();
    loadShopExtras();
  }, [user, startDateStr, endDateStr, franchiseStoreId, demandByStore]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setAnalyticsErrors([]);

      if (!user?.storeId) {
        console.error("[Analytics] User storeId is missing");
        return;
      }

      const common = scopeParams();
      const errs: string[] = [];

      const forecastRes = await api
        .get("/api/v1/analytics/forecast", {
          params: {
            ...common,
            days: 7,
            historyDays: 90,
          },
        })
        .catch((err) => {
          const msg =
            err.response?.data?.message ||
            err.response?.data?.error ||
            err.message;
          errs.push(`Forecast: ${msg}`);
          return { data: null };
        });

      const demandRes = await api
        .get("/api/v1/analytics/demand", {
          params: {
            ...common,
            days: 30,
            ...(isOwner && !franchiseStoreId && demandByStore
              ? { byStore: "true" }
              : {}),
          },
        })
        .catch((err) => {
          const msg =
            err.response?.data?.message ||
            err.response?.data?.error ||
            err.message;
          errs.push(`Demand: ${msg}`);
          return { data: null };
        });

      const inventoryRes = await api
        .get("/api/v1/analytics/inventory-recommendations", {
          params: {
            ...common,
            historyDays: 30,
          },
        })
        .catch((err) => {
          const msg =
            err.response?.data?.message ||
            err.response?.data?.error ||
            err.message;
          errs.push(`Inventory: ${msg}`);
          return { data: null };
        });

      setAnalyticsErrors(errs);
      setForecast(forecastRes.data);
      setDemand(demandRes.data);
      setInventory(inventoryRes.data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesOverview = async () => {
    if (!user?.storeId) return;
    setOverviewError(null);
    try {
      const res = await api.get("/api/v1/analytics/sales-overview", {
        params: scopeParams(),
      });
      setSalesOverview(res.data || null);
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        e.response?.data?.error ||
        e.message ||
        "Failed to load sales overview";
      console.error("Failed to load sales overview:", e);
      setSalesOverview(null);
      setOverviewError(msg);
    }
  };

  const loadProfitMargin = async () => {
    if (!user?.storeId) return;
    setProfitMarginError(null);
    try {
      const res = await api.get("/api/v1/analytics/profit-margin", {
        params: scopeParams(),
      });
      setProfitMargin(res.data || null);
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        e.response?.data?.error ||
        e.message ||
        "Failed to load profit margin";
      setProfitMargin(null);
      setProfitMarginError(msg);
    }
  };

  const loadDemographics = async () => {
    if (!user?.storeId) return;
    setDemographicsError(null);
    try {
      const res = await api.get("/api/v1/analytics/customer-demographics", {
        params: scopeParams(),
      });
      setDemographics(res.data || null);
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        e.response?.data?.error ||
        e.message ||
        "Failed to load customer demographics";
      setDemographics(null);
      setDemographicsError(msg);
    }
  };

  const loadInsights = async () => {
    if (!user?.storeId) return;
    setInsightsError(null);
    try {
      const res = await api.get("/api/v1/analytics/insights", {
        params: scopeParams(),
      });
      setInsights(res.data || null);
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        e.response?.data?.error ||
        e.message ||
        "Failed to load insights";
      setInsights(null);
      setInsightsError(msg);
    }
  };

  const loadShopExtras = async () => {
    if (!user?.storeId) return;
    const common = scopeParams();
    setShopPulseError(null);
    setMoneyError(null);
    setDeliveryError(null);
    setSegmentsError(null);
    setStaffError(null);

    const [pulseRes, moneyRes, deliveryRes, segmentsRes, staffRes] = await Promise.all([
      api.get("/api/v1/analytics/shop-pulse", { params: common }).catch((e: any) => {
        setShopPulseError(
          e.response?.data?.message || e.response?.data?.error || e.message || "Pulse failed"
        );
        return { data: null };
      }),
      api.get("/api/v1/analytics/money-health", { params: common }).catch((e: any) => {
        setMoneyError(
          e.response?.data?.message || e.response?.data?.error || e.message || "Money failed"
        );
        return { data: null };
      }),
      api.get("/api/v1/analytics/delivery-ops", { params: common }).catch((e: any) => {
        setDeliveryError(
          e.response?.data?.message || e.response?.data?.error || e.message || "Delivery failed"
        );
        return { data: null };
      }),
      api
        .get("/api/v1/analytics/customer-segments", {
          params: franchiseStoreId ? { franchiseStoreId } : {},
        })
        .catch((e: any) => {
          setSegmentsError(
            e.response?.data?.message ||
              e.response?.data?.error ||
              e.message ||
              "Segments failed"
          );
          return { data: null };
        }),
      api.get("/api/v1/analytics/staff-productivity", { params: common }).catch((e: any) => {
        setStaffError(
          e.response?.data?.message || e.response?.data?.error || e.message || "Staff failed"
        );
        return { data: null };
      }),
    ]);

    setShopPulse(pulseRes.data || null);
    setMoneyHealth(moneyRes.data || null);
    setDeliveryOps(deliveryRes.data || null);
    setCustomerSegments(segmentsRes.data || null);
    setStaffProductivity(staffRes.data || null);
  };

  const applyPreset = (days: number) => {
    const endDateStr = todayLocalYmd();
    const startDateStr = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
    setDateRange({ startDateStr, endDateStr });
  };

  const loadSalesFallback = async (tab: "forecast" | "demand") => {
    setLoading(true);
    try {
      const { startDate, endDate } = localDateRangeToApiBounds(startDateStr, endDateStr);
      const res = await api.get("/api/v1/sales", {
        params: {
          startDate,
          endDate,
          status: "PAID",
        },
      });
      const sales = res.data || [];
      if (tab === "forecast") {
        const salesByDate: Record<string, number> = {};
        sales.forEach((s: any) => {
          const key = String(s.createdAt).slice(0, 10);
          salesByDate[key] = (salesByDate[key] || 0) + (s.grandTotal || 0);
        });
        const dates: string[] = [];
        const values: number[] = [];
        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();
        const dayMs = 86400000;
        const n = Math.max(1, Math.round((endMs - startMs) / dayMs) + 1);
        for (let i = 0; i < n; i++) {
          const d = new Date(startMs + i * dayMs);
          const key = d.toLocaleDateString("en-CA");
          dates.push(key);
          values.push(salesByDate[key] || 0);
        }
        const avgLast7 = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const forecastArr = Array.from({ length: 7 }, (_, i) => {
          const fd = new Date();
          fd.setDate(fd.getDate() + i + 1);
          return {
            date: fd.toISOString().split("T")[0],
            predicted: Math.round(avgLast7 * 100) / 100,
            confidence: i <= 2 ? "high" : i <= 5 ? "medium" : "low",
          };
        });
        const last7 = values.slice(-7).reduce((a, b) => a + b, 0);
        const prev7 = values.slice(-14, -7).reduce((a, b) => a + b, 0);
        const trend = prev7 > 0 ? (last7 > prev7 ? "upward" : last7 < prev7 ? "downward" : "stable") : "stable";
        setForecast({
          historical: dates.map((date, i) => ({
            date,
            actual: values[i] ?? 0,
            ma7: values[i] ?? 0,
            ma30: values[i] ?? 0,
          })),
          forecast: forecastArr,
          trend,
          naiveMapePct: null,
          avgDailySales: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
        });
        setActiveTab("more");
        setMoreSection("forecast");
      } else {
        const productDemand: Record<string, { productName: string; totalRevenue: number; frequency: number }> = {};
        const hourly: Record<number, number> = {};
        const byDay: Record<number, number> = {};
        sales.forEach((s: any) => {
          const hour = new Date(s.createdAt).getHours();
          const day = new Date(s.createdAt).getDay();
          hourly[hour] = (hourly[hour] || 0) + 1;
          byDay[day] = (byDay[day] || 0) + 1;
          (s.items || []).forEach((item: any) => {
            const name = item.product?.name || "Unknown";
            if (!productDemand[name]) productDemand[name] = { productName: name, totalRevenue: 0, frequency: 0 };
            productDemand[name].totalRevenue += item.lineTotal || 0;
            productDemand[name].frequency += 1;
          });
        });
        const arr = Object.values(productDemand);
        const avgF = 30 > 0 ? arr.reduce((s, p) => s + p.frequency, 0) / 30 : 0;
        const fastMoving = arr.filter((p) => p.frequency / 30 > 2).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
        const slowMoving = arr.filter((p) => p.frequency / 30 < 0.5).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
        const peakHourEntry = Object.entries(hourly).sort((a, b) => b[1] - a[1])[0];
        const peakDayEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        setDemand({
          fastMoving,
          slowMoving,
          peakHour: peakHourEntry ? { hour: parseInt(peakHourEntry[0]), count: peakHourEntry[1] } : null,
          peakDay: peakDayEntry ? { day: dayNames[parseInt(peakDayEntry[0])], count: peakDayEntry[1] } : null,
        });
        setActiveTab("more");
        setMoreSection("demand");
      }
    } catch (e) {
      console.error("Sales fallback failed:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">Shop dashboard</h1>
            <p className="text-sm text-ink-secondary mt-1">
              Quick view of sales, money owed, and who to call
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const tag = `${startDateStr}_${endDateStr}`;
                if (activeTab === "overview" && shopPulse) {
                  exportToCSV({
                    data: shopPulse.callListPreview,
                    filename: `call_list_${tag}.csv`,
                  });
                } else if (activeTab === "money" && moneyHealth) {
                  exportToCSV({
                    data: moneyHealth.topDebtors,
                    filename: `credit_due_${tag}.csv`,
                  });
                } else if (activeTab === "people" && customerSegments) {
                  exportToCSV({
                    data: (segmentFilter === "call"
                      ? customerSegments.callList
                      : customerSegments.customers.filter((c) => c.segment === segmentFilter)
                    ).map((c) => ({
                      name: c.name,
                      phone: c.phone,
                      lastVisitDays: c.daysSinceLastVisit ?? "",
                      spent: c.lifetimeSpent,
                    })),
                    filename: `people_${segmentFilter}_${tag}.csv`,
                  });
                } else if (activeTab === "stock" && inventory) {
                  exportToCSV({
                    data: inventory.recommendations,
                    filename: `stock_${tag}.csv`,
                  });
                } else if (activeTab === "more" && moreSection === "margin" && profitMargin) {
                  exportToCSV({
                    data: profitMargin.products.map((p) => ({
                      product: p.productName,
                      revenue: p.revenue,
                      marginPct: p.grossMarginPct ?? "",
                    })),
                    filename: `margin_${tag}.csv`,
                  });
                } else if (salesOverview) {
                  exportToCSV({
                    data: salesOverview.dailyRevenue.map((r) => ({
                      date: r.date,
                      revenue: r.total,
                    })),
                    filename: `sales_${tag}.csv`,
                  });
                }
              }}
              className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors font-medium text-sm border border-green-200 dark:border-green-800"
            >
              Export
            </button>
            <button
              onClick={() => {
                loadAnalytics();
                loadSalesOverview();
                loadInsights();
                loadProfitMargin();
                loadDemographics();
                loadShopExtras();
              }}
              className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors font-medium text-sm border border-blue-200 dark:border-blue-800"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 p-4 bg-surface-2/60 rounded-xl border border-subtle">
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto mb-1 sm:mb-0 sm:mr-2">
            {[
              { label: "Today", days: 1 },
              { label: "7 days", days: 7 },
              { label: "30 days", days: 30 },
              { label: "90 days", days: 90 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-subtle bg-surface hover:bg-surface-2 text-ink-secondary"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              Start date
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) =>
                setDateRange((r) => ({ ...r, startDateStr: e.target.value }))
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 glass-panel px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              End date
            </label>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) =>
                setDateRange((r) => ({ ...r, endDateStr: e.target.value }))
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 glass-panel px-2 py-1.5 text-sm"
            />
          </div>
          {isOwner && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                Store scope
              </label>
              <select
                value={franchiseStoreId}
                onChange={(e) => setFranchiseStoreId(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 glass-panel px-2 py-1.5 text-sm"
              >
                <option value="">All locations (owner + franchises)</option>
                <option value={user?.storeId || ""}>
                  {user?.store?.name || "HQ"} (owner store)
                </option>
                {franchiseOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isOwner && !franchiseStoreId && (
            <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={demandByStore}
                onChange={(e) => setDemandByStore(e.target.checked)}
              />
              Demand: per-store breakdown
            </label>
          )}
        </div>

        {(analyticsErrors.length > 0 ||
          overviewError ||
          insightsError ||
          profitMarginError ||
          demographicsError ||
          shopPulseError ||
          moneyError ||
          deliveryError ||
          segmentsError ||
          staffError) && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 space-y-1">
            {overviewError && <p>Overview: {overviewError}</p>}
            {insightsError && <p>Insights: {insightsError}</p>}
            {profitMarginError && <p>Profit margin: {profitMarginError}</p>}
            {demographicsError && <p>Demographics: {demographicsError}</p>}
            {shopPulseError && <p>Pulse: {shopPulseError}</p>}
            {moneyError && <p>Money: {moneyError}</p>}
            {deliveryError && <p>Delivery: {deliveryError}</p>}
            {segmentsError && <p>Segments: {segmentsError}</p>}
            {staffError && <p>Staff: {staffError}</p>}
            {analyticsErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}
      </div>

      {/* Tabs — keep it simple */}
      <div className="flex gap-1 border-b border-stone-200 dark:border-gray-700 flex-wrap">
        {(
          [
            ["overview", "Overview"],
            ["money", "Money"],
            ["people", "People"],
            ["stock", "Stock"],
            ["more", "More"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
              activeTab === id
                ? "border-teal-700 text-teal-800 dark:border-teal-400 dark:text-teal-300"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div>
          {shopPulse ? (
            <ShopPulsePanel
              pulse={shopPulse}
              dailyRevenue={salesOverview?.dailyRevenue}
              onNavigate={(tab) => {
                if (tab === "overview" || tab === "sales-overview") setActiveTab("overview");
                else if (tab === "money" || tab === "delivery") setActiveTab("money");
                else if (tab === "people" || tab === "customers") setActiveTab("people");
                else if (tab === "stock" || tab === "inventory") setActiveTab("stock");
                else if (tab === "more" || tab === "demand" || tab === "forecast") {
                  setActiveTab("more");
                  if (tab === "demand") setMoreSection("demand");
                  if (tab === "forecast") setMoreSection("forecast");
                } else setActiveTab("overview");
              }}
            />
          ) : (
            <div className="rounded-2xl border border-stone-200 dark:border-gray-800 p-10 text-center text-stone-500">
              {shopPulseError || "Loading dashboard…"}
            </div>
          )}
        </div>
      )}

      {activeTab === "money" && (
        <div>
          {moneyHealth ? (
            <MoneyHealthPanel money={moneyHealth} />
          ) : (
            <div className="rounded-2xl border border-stone-200 p-10 text-center text-stone-500">
              {moneyError || "Loading…"}
            </div>
          )}
        </div>
      )}

      {activeTab === "people" && (
        <div>
          {customerSegments ? (
            <CustomerSegmentsPanel
              segments={customerSegments}
              filter={segmentFilter === "all" ? "call" : segmentFilter}
              onFilterChange={setSegmentFilter}
            />
          ) : (
            <div className="rounded-2xl border border-stone-200 p-10 text-center text-stone-500">
              {segmentsError || "Loading…"}
            </div>
          )}
        </div>
      )}

      {activeTab === "stock" && (
        inventory ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Out of stock", value: inventory.outOfStock, bad: true },
              { label: "Low stock", value: inventory.lowStock, warn: true },
              { label: "Overstock", value: inventory.overstock },
            ].map((c) => (
              <div
                key={c.label}
                className={`rounded-2xl border p-4 ${
                  c.bad && c.value > 0
                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                    : c.warn && c.value > 0
                      ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                      : "border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                }`}
              >
                <p className="text-xs text-stone-500">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-stone-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950">
            <table className="w-full text-sm">
              <thead className="text-xs text-stone-500 bg-stone-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left px-4 py-2">Item</th>
                  <th className="text-right px-4 py-2">Now</th>
                  <th className="text-right px-4 py-2">Order</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.recommendations.slice(0, 25).map((r, i) => (
                  <tr key={i} className="border-t border-stone-100 dark:border-gray-800">
                    <td className="px-4 py-2 font-medium">{r.productName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.currentStock}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.suggestedOrderQty}</td>
                    <td className="px-4 py-2 text-stone-500">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inventory.recommendations.length === 0 && (
              <p className="p-8 text-center text-stone-400 text-sm">Stock looks fine</p>
            )}
          </div>
        </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 p-10 text-center text-stone-500">
            Loading stock…
          </div>
        )
      )}

      {activeTab === "more" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["sales", "Sales chart"],
                ["forecast", "Next week"],
                ["demand", "Fast / slow"],
                ["margin", "Profit"],
                ["who", "Who buys"],
                ["staff", "Staff"],
                ["delivery", "Delivery"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMoreSection(id)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  moreSection === id
                    ? "bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900"
                    : "border-stone-200 text-stone-600 dark:border-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {moreSection === "sales" && salesOverview && (
            <div className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesOverview.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => (v?.length >= 10 ? v.slice(5) : v)} />
                    <YAxis tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                    <Tooltip formatter={(v: number) => [`₹${v?.toLocaleString("en-IN")}`, "Sales"]} />
                    <Line type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {moreSection === "staff" && staffProductivity && (
            <StaffProductivityPanel staff={staffProductivity} />
          )}

          {moreSection === "delivery" && deliveryOps && (
            <DeliveryOpsPanel delivery={deliveryOps} />
          )}

          {moreSection === "forecast" && forecast && (
            <div className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
              <p className="text-sm text-stone-500 mb-3">Expected sales for the next few days</p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecast.forecast}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => formatForecastDate(v)} />
                    <YAxis tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                    <Tooltip formatter={(v: number) => [`₹${Math.round(v).toLocaleString("en-IN")}`, "Expected"]} />
                    <Bar dataKey="predicted" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {moreSection === "demand" && demand && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-stone-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                <p className="text-sm font-semibold mb-2">Selling fast</p>
                <ul className="space-y-2 text-sm">
                  {demand.fastMoving.slice(0, 8).map((p, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{p.productName}</span>
                      <span className="tabular-nums text-stone-500">₹{Math.round(p.totalRevenue).toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-stone-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                <p className="text-sm font-semibold mb-2">Selling slow</p>
                <ul className="space-y-2 text-sm">
                  {demand.slowMoving.slice(0, 8).map((p, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{p.productName}</span>
                      <span className="tabular-nums text-stone-500">₹{Math.round(p.totalRevenue).toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {moreSection === "margin" && profitMargin && (
            <div className="rounded-2xl border border-stone-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950">
              <div className="grid grid-cols-2 gap-3 p-4 border-b border-stone-100 dark:border-gray-800">
                <div>
                  <p className="text-xs text-stone-500">Sales</p>
                  <p className="text-xl font-bold">₹{Math.round(profitMargin.summary.totalSales).toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Est. profit %</p>
                  <p className="text-xl font-bold">{profitMargin.summary.profitMarginPct}%</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-stone-500">
                  <tr>
                    <th className="text-left px-4 py-2">Item</th>
                    <th className="text-right px-4 py-2">Sales</th>
                    <th className="text-right px-4 py-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {profitMargin.products.slice(0, 15).map((p) => (
                    <tr key={p.productId} className="border-t border-stone-100 dark:border-gray-800">
                      <td className="px-4 py-2">{p.productName}</td>
                      <td className="px-4 py-2 text-right tabular-nums">₹{Math.round(p.revenue).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {p.grossMarginPct != null ? `${p.grossMarginPct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {moreSection === "who" && demographics && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Buyers", value: demographics.summary.activeCustomers },
                { label: "Regulars", value: `${demographics.summary.returningPct}%` },
                { label: "Named bills", value: `${demographics.summary.namedOrderPct}%` },
                { label: "Walk-ins", value: `${demographics.summary.walkInPct}%` },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl border border-stone-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                  <p className="text-xs text-stone-500">{c.label}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                </div>
              ))}
            </div>
          )}

          {moreSection === "sales" && !salesOverview && (
            <p className="text-center text-stone-400 py-8">Loading…</p>
          )}
          {moreSection === "forecast" && !forecast && (
            <p className="text-center text-stone-400 py-8">Loading…</p>
          )}
          {moreSection === "demand" && !demand && (
            <p className="text-center text-stone-400 py-8">Loading…</p>
          )}
          {moreSection === "margin" && !profitMargin && (
            <p className="text-center text-stone-400 py-8">{profitMarginError || "Loading…"}</p>
          )}
          {moreSection === "who" && !demographics && (
            <p className="text-center text-stone-400 py-8">Loading…</p>
          )}
          {moreSection === "staff" && !staffProductivity && (
            <p className="text-center text-stone-400 py-8">Loading…</p>
          )}
          {moreSection === "delivery" && !deliveryOps && (
            <p className="text-center text-stone-400 py-8">Loading…</p>
          )}
        </div>
      )}

    </div>
  );
}
