"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import { localDateRangeToApiBounds, todayLocalYmd } from "@/lib/dateRangeParams";
import { format, subDays } from "date-fns";
import {
  SimpleLineChart,
  SimpleBarChart,
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
  const [activeTab, setActiveTab] = useState<
    "sales-overview" | "profit-margin" | "forecast" | "demand" | "inventory" | "insights"
  >("sales-overview");

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
        setActiveTab("forecast");
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
        setActiveTab("demand");
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Advanced Analytics
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Predictive insights and recommendations (UTC day boundaries; peak hour UTC)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const tag = `${startDateStr}_${endDateStr}`;
                if (activeTab === "sales-overview" && salesOverview) {
                  exportToCSV({
                    data: salesOverview.dailyRevenue.map((r) => ({
                      date: r.date,
                      revenue: r.total,
                    })),
                    filename: `sales_overview_${tag}.csv`,
                  });
                } else if (activeTab === "forecast" && forecast) {
                  exportToCSV({
                    data: forecast.forecast,
                    filename: `sales_forecast_${tag}.csv`,
                  });
                } else if (activeTab === "demand" && demand) {
                  exportToCSV({
                    data: [...demand.fastMoving, ...demand.slowMoving],
                    filename: `demand_analysis_${tag}.csv`,
                  });
                } else if (activeTab === "inventory" && inventory) {
                  exportToCSV({
                    data: inventory.recommendations,
                    filename: `inventory_recommendations_${tag}.csv`,
                  });
                } else if (activeTab === "insights" && insights) {
                  exportToCSV({
                    data: insights.insights,
                    filename: `analytics_insights_${tag}.csv`,
                  });
                } else if (activeTab === "profit-margin" && profitMargin) {
                  exportToCSV({
                    data: profitMargin.products.map((p) => ({
                      product: p.productName,
                      sku: p.sku,
                      revenue: p.revenue,
                      qtySold: p.qtySold,
                      avgCost: p.avgCost ?? "",
                      estimatedCogs: p.estimatedCogs ?? "",
                      grossProfit: p.grossProfit ?? "",
                      grossMarginPct: p.grossMarginPct ?? "",
                      costStatus: p.costStatus,
                    })),
                    filename: `profit_margin_${tag}.csv`,
                  });
                }
              }}
              className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors font-medium text-sm border border-green-200 dark:border-green-800"
            >
              📥 Export CSV
            </button>
            <button
              onClick={() => {
                loadAnalytics();
                loadSalesOverview();
                loadInsights();
              }}
              className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors font-medium text-sm border border-blue-200 dark:border-blue-800"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Start date
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) =>
                setDateRange((r) => ({ ...r, startDateStr: e.target.value }))
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              End date
            </label>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) =>
                setDateRange((r) => ({ ...r, endDateStr: e.target.value }))
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
            />
          </div>
          {isOwner && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Store scope
              </label>
              <select
                value={franchiseStoreId}
                onChange={(e) => setFranchiseStoreId(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
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
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={demandByStore}
                onChange={(e) => setDemandByStore(e.target.checked)}
              />
              Demand: per-store breakdown
            </label>
          )}
        </div>

        {(analyticsErrors.length > 0 || overviewError || insightsError || profitMarginError) && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 space-y-1">
            {overviewError && <p>Overview: {overviewError}</p>}
            {insightsError && <p>Insights: {insightsError}</p>}
            {profitMarginError && <p>Profit margin: {profitMarginError}</p>}
            {analyticsErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        <button
          onClick={() => setActiveTab("sales-overview")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "sales-overview"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          📊 Sales Overview
        </button>
        <button
          onClick={() => setActiveTab("profit-margin")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "profit-margin"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          💹 Profit Margin
        </button>
        <button
          onClick={() => setActiveTab("forecast")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "forecast"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          📈 Sales Forecast
        </button>
        <button
          onClick={() => setActiveTab("demand")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "demand"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          🎯 Demand Analysis
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "inventory"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          📦 Inventory Recommendations
        </button>
        <button
          onClick={() => setActiveTab("insights")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "insights"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          💡 Insights
        </button>
      </div>

      {/* Sales Overview Tab */}
      {activeTab === "sales-overview" && (
        <div className="space-y-6">
          {salesOverview ? (
            <>
              {salesOverview.insufficientHistory && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
                  Limited history: {salesOverview.daysWithSales ?? 0} day(s) with sales in this range.
                  {salesOverview.minDaysRecommended != null &&
                    ` We recommend at least ${salesOverview.minDaysRecommended} days for steadier charts.`}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                  <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                    Total Revenue ({salesOverview.startDate && salesOverview.endDate ? `${salesOverview.startDate} → ${salesOverview.endDate}` : "range"})
                  </h3>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    ₹{salesOverview.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                  <h3 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Total Orders</h3>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{salesOverview.totalOrders}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                  <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">Avg Order Value</h3>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    ₹{salesOverview.avgOrderValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-lg p-6 border border-amber-200 dark:border-amber-800">
                  <h3 className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">Best Day</h3>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                    {salesOverview.bestDay ? salesOverview.bestDay.date : "—"}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {salesOverview.bestDay ? `₹${salesOverview.bestDay.revenue.toLocaleString("en-IN")}` : ""}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 rounded-lg p-6 border border-cyan-200 dark:border-cyan-800">
                  <h3 className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-2">Peak Hour (UTC)</h3>
                  <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                    {salesOverview.peakHour ? `${salesOverview.peakHour.hour}:00` : "—"}
                  </p>
                  <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                    {salesOverview.peakHour ? `${salesOverview.peakHour.count} orders` : ""}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Revenue</h3>
                {salesOverview.dailyRevenue.some((r) => r.total > 0) ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesOverview.dailyRevenue.map((r) => ({ ...r, total: r.total }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(v) => (v && v.length >= 10 ? v.slice(5) : v)} />
                        <YAxis stroke="#6b7280" tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                        <Tooltip formatter={(value: number) => [`₹${value?.toLocaleString("en-IN") ?? 0}`, "Revenue"]} />
                        <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Revenue" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No daily sales in this period</p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue by Day of Week</h3>
                  {salesOverview.revenueByDayOfWeek.some((d) => d.value > 0) ? (
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesOverview.revenueByDayOfWeek} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 11 }} />
                          <YAxis stroke="#6b7280" tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                          <Tooltip formatter={(value: number) => [`₹${value?.toLocaleString("en-IN") ?? 0}`, "Revenue"]} />
                          <Bar dataKey="value" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data</p>
                  )}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Mix</h3>
                  {salesOverview.paymentMix.length > 0 ? (
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={salesOverview.paymentMix}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {salesOverview.paymentMix.map((_, i) => (
                              <Cell key={i} fill={["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][i % 5]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `₹${value?.toLocaleString("en-IN") ?? 0}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No payment data</p>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top 10 Products by Revenue</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Product</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {salesOverview.topProducts.length > 0 ? (
                        salesOverview.topProducts.map((p, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{p.name}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-700 dark:text-gray-300">
                              ₹{p.revenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-sm text-center text-gray-500">No product sales in this period</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">Could not load sales overview. Please try again.</p>
              <button onClick={loadSalesOverview} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sales Forecast Tab */}
      {activeTab === "forecast" && (
        <div className="space-y-6">
          {!forecast ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Could not load sales forecast. Please try again.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={loadAnalytics}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={() => loadSalesFallback("forecast")}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Show from sales data
                </button>
              </div>
            </div>
          ) : (
            <>
          {forecast.insufficientHistory && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              Low history for forecasting: {forecast.daysWithPositiveSales ?? 0} day(s) with sales.
              {forecast.minDaysRecommended != null &&
                ` ${forecast.minDaysRecommended}+ days recommended; projections may be noisy.`}
            </div>
          )}
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                Trend
              </h3>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 capitalize">
                {forecast.trend}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
              <h3 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                Naive MAPE (7d)
              </h3>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                {forecast.naiveMapePct != null
                  ? `${forecast.naiveMapePct}%`
                  : "—"}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Same-day-as-yesterday baseline; lower is better.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
              <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
                Avg Daily Sales
              </h3>
              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                {typeof forecast.avgDailySales === "number" && !Number.isNaN(forecast.avgDailySales)
                  ? `₹${forecast.avgDailySales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                  : "₹0"}
              </p>
            </div>
          </div>

          {/* Historical Chart with Moving Averages */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Historical sales (recent window)
            </h3>
            {forecast.historical && forecast.historical.length > 0 ? (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={forecast.historical.slice(-30).map((h) => ({
                      date: h?.date ? h.date.substring(5) : "",
                      actual: h?.actual ?? 0,
                      ma7: h?.ma7 ?? 0,
                      ma30: h?.ma30 ?? 0,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      stroke="#6b7280"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      formatter={(value: any) =>
                        `₹${value ? value.toLocaleString("en-IN") : "0"}`
                      }
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Actual Sales"
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ma7"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="7-Day Average"
                    />
                    <Line
                      type="monotone"
                      dataKey="ma30"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      name="30-Day Average"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                No historical data available
              </div>
            )}
          </div>

          {/* Growth Metrics */}
          {forecast.historical && forecast.historical.length > 14 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg p-6 border border-emerald-200 dark:border-emerald-800">
                <h3 className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">
                  Last 7 Days
                </h3>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  ₹
                  {forecast.historical
                    .slice(-7)
                    .reduce((sum: number, h: any) => sum + (h.actual || 0), 0)
                    .toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Average: ₹
                  {Math.round(
                    forecast.historical
                      .slice(-7)
                      .reduce(
                        (sum: number, h: any) => sum + (h.actual || 0),
                        0
                      ) / 7
                  ).toLocaleString("en-IN")}{" "}
                  per day
                </p>
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 rounded-lg p-6 border border-cyan-200 dark:border-cyan-800">
                <h3 className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-2">
                  Previous 7 Days
                </h3>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                  ₹
                  {forecast.historical
                    .slice(-14, -7)
                    .reduce((sum: number, h: any) => sum + (h.actual || 0), 0)
                    .toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                  Average: ₹
                  {Math.round(
                    forecast.historical
                      .slice(-14, -7)
                      .reduce(
                        (sum: number, h: any) => sum + (h.actual || 0),
                        0
                      ) / 7
                  ).toLocaleString("en-IN")}{" "}
                  per day
                </p>
              </div>
              <div className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 rounded-lg p-6 border border-violet-200 dark:border-violet-800">
                <h3 className="text-sm font-medium text-violet-700 dark:text-violet-300 mb-2">
                  Week-over-Week Change
                </h3>
                {(() => {
                  const lastWeek = forecast.historical
                    .slice(-7)
                    .reduce((sum: number, h: any) => sum + (h.actual || 0), 0);
                  const prevWeek = forecast.historical
                    .slice(-14, -7)
                    .reduce((sum: number, h: any) => sum + (h.actual || 0), 0);
                  const change =
                    prevWeek > 0 ? ((lastWeek - prevWeek) / prevWeek) * 100 : 0;
                  return (
                    <>
                      <p
                        className={`text-2xl font-bold ${
                          change >= 0
                            ? "text-violet-900 dark:text-violet-100"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(1)}%
                      </p>
                      <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                        {change >= 0 ? "Growth" : "Decline"} vs previous week
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Forecast Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Forecast (next days)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Predicted Sales
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Low / High
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Confidence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {forecast.forecast && forecast.forecast.length > 0 ? (
                    forecast.forecast.map((f, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {formatForecastDate(f?.date ?? "")}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-medium">
                          {typeof f.predicted === "number" && !Number.isNaN(f.predicted)
                            ? `₹${f.predicted.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                            : "₹0"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-400">
                          {f.predictedLow != null && f.predictedHigh != null
                            ? `₹${Math.round(f.predictedLow).toLocaleString("en-IN")} – ₹${Math.round(f.predictedHigh).toLocaleString("en-IN")}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              f?.confidence === "high"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                : f?.confidence === "medium"
                                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                            }`}
                          >
                            {f?.confidence || "low"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-sm text-center text-gray-500"
                      >
                        No forecast data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Forecast preview: last 7 days actual + next 7 days predicted */}
          {forecast.forecast?.length > 0 && forecast.historical?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Forecast (next 7 days)
              </h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      ...forecast.historical.slice(-7).map((h) => ({
                        date: formatForecastDate(h.date),
                        actual: h.actual,
                        predicted: undefined as number | undefined,
                      })),
                      ...forecast.forecast.map((f) => ({
                        date: formatForecastDate(f.date),
                        actual: undefined as number | undefined,
                        predicted: f.predicted,
                      })),
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#6b7280" tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        value != null && !Number.isNaN(value) ? `₹${Number(value).toLocaleString("en-IN")}` : "",
                        name || "",
                      ]}
                      contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} name="Actual" dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="predicted" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Forecast" dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* Demand Analysis Tab */}
      {activeTab === "demand" && (
        demand ? (
        <div className="space-y-6">
          {demand.abcSummary && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
              <strong>ABC mix:</strong> A={demand.abcSummary.A}, B={demand.abcSummary.B}, C=
              {demand.abcSummary.C}. {demand.abcSummary.note}
            </div>
          )}
          {/* Peak Times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demand.peakHour && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-6 border border-orange-200 dark:border-orange-800">
                <h3 className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">
                  Peak Hour (UTC)
                </h3>
                <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                  {demand.peakHour.hour}:00
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                  {demand.peakHour.count} orders
                </p>
              </div>
            )}
            {demand.peakDay && (
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
                <h3 className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                  Peak Day
                </h3>
                <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
                  {demand.peakDay.day}
                </p>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
                  {demand.peakDay.count} orders
                </p>
              </div>
            )}
          </div>

          {/* Fast Moving Products */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Fast movers (ABC class A — top revenue share)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Orders
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {demand.fastMoving && demand.fastMoving.length > 0 ? (
                    demand.fastMoving.map((product, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {product.productName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-medium">
                          {typeof product.totalRevenue === "number" && !Number.isNaN(product.totalRevenue)
                            ? `₹${product.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                            : "₹0"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                          {product.frequency || 0}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-3 text-sm text-center text-gray-500"
                      >
                        No fast-moving products found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slow Moving Products */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Slow movers (ABC class C — tail revenue)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Orders
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {demand.slowMoving && demand.slowMoving.length > 0 ? (
                    demand.slowMoving.map((product, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {product.productName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-medium">
                          {typeof product.totalRevenue === "number" && !Number.isNaN(product.totalRevenue)
                            ? `₹${product.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                            : "₹0"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                          {product.frequency || 0}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-3 text-sm text-center text-gray-500"
                      >
                        No slow-moving products found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {demand.categories && demand.categories.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Category revenue
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Category
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Revenue
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Lines
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {demand.categories.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {c.categoryName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          ₹{c.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                          {c.lineCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {demand.byStore && demand.byStore.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Per-store products (owner)
              </h3>
              {demand.byStore.map((s) => (
                <div
                  key={s.storeId}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
                >
                  <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 font-medium">
                    {s.storeName}
                  </div>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">Product</th>
                          <th className="px-4 py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(s.products as any[]).slice(0, 15).map((p: any, i: number) => (
                          <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                            <td className="px-4 py-2">{p.productName}</td>
                            <td className="px-4 py-2 text-right">
                              ₹{(p.totalRevenue || 0).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Could not load demand analysis. Please try again.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={loadAnalytics}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => loadSalesFallback("demand")}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Show from sales data
              </button>
            </div>
          </div>
        )
      )}

      {/* Inventory Recommendations Tab */}
      {activeTab === "inventory" && (
        inventory ? (
        <div className="space-y-6">
          {inventory.mode === "multi" && inventory.note && (
            <p className="text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 bg-gray-50 dark:bg-gray-900/40">
              {inventory.note}
            </p>
          )}
          {(inventory.leadTimeDays != null || inventory.historyDays != null) && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lead time {inventory.leadTimeDays ?? "—"}d · History window {inventory.historyDays ?? "—"}d · EOQ uses
              ordering cost ₹{inventory.orderingCost ?? "—"} / holding ₹
              {inventory.holdingCostPerUnit ?? "—"} per unit (env overrides).
            </p>
          )}
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                Out of Stock
              </h3>
              <p className="text-3xl font-bold text-red-900 dark:text-red-100">
                {inventory.outOfStock}
              </p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
              <h3 className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                Low Stock
              </h3>
              <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                {inventory.lowStock}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                Overstock
              </h3>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {inventory.overstock}
              </p>
            </div>
          </div>

          {/* Recommendations Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Inventory Actions Required
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {inventory.mode === "multi" && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Store
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Current
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      On order
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Reorder Point
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Suggested Qty
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {inventory.recommendations &&
                  inventory.recommendations.length > 0 ? (
                    inventory.recommendations.map((rec, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                      >
                        {inventory.mode === "multi" && (
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {rec.storeName || rec.storeId || "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {rec.productName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                          {typeof rec.currentStock === "number" && !Number.isNaN(rec.currentStock)
                            ? rec.currentStock.toFixed(2)
                            : "0.00"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                          {rec.inboundOpenQty != null && !Number.isNaN(rec.inboundOpenQty)
                            ? rec.inboundOpenQty.toFixed(2)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                          {typeof rec.reorderPoint === "number" && !Number.isNaN(rec.reorderPoint)
                            ? rec.reorderPoint.toFixed(2)
                            : "0.00"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-medium">
                          {typeof rec.suggestedOrderQty === "number" && !Number.isNaN(rec.suggestedOrderQty)
                            ? rec.suggestedOrderQty.toFixed(2)
                            : "0.00"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              rec.status === "out-of-stock"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                                : rec.status === "low-stock"
                                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                            }`}
                          >
                            {rec.status
                              ? rec.status.replace("-", " ")
                              : "adequate"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {rec.action ? rec.action.replace("-", " ") : "none"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={inventory.mode === "multi" ? 8 : 7}
                        className="px-4 py-3 text-sm text-center text-gray-500"
                      >
                        No inventory recommendations — stock levels look adequate for this window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Could not load inventory recommendations. Please try again.
            </p>
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )
      )}

      {activeTab === "profit-margin" && (
        <div className="space-y-6">
          {profitMargin ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="text-xs uppercase text-gray-500">Sales</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatINR(profitMargin.summary.totalSales)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="text-xs uppercase text-gray-500">Purchases</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatINR(profitMargin.summary.totalPurchases)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="text-xs uppercase text-gray-500">Expenses</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {profitMargin.summary.expensesLabel}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="text-xs uppercase text-gray-500">Net profit</p>
                  <p
                    className={`text-xl font-bold mt-1 ${
                      profitMargin.summary.netProfit >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatINR(profitMargin.summary.netProfit)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="text-xs uppercase text-gray-500">Margin %</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {profitMargin.summary.profitMarginPct.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="text-xs uppercase text-gray-500">Est. COGS (sold)</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatINR(profitMargin.summary.estimatedCogsFromSales)}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                Net profit uses paid sales minus purchase orders in range. Expenses are not tracked
                yet. Product costs use the average of the last 10 closed franchise POs.
              </p>

              {profitMargin.summary.productsMissingCost > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                  {profitMargin.summary.productsMissingCost} product line(s) have no PO cost —
                  revenue is included; gross margin columns show a warning.
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Product gross margin
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                          Product
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                          Revenue
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                          Qty sold
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                          Avg cost
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                          Est. COGS
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                          Gross profit
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                          Margin %
                        </th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {profitMargin.products.map((p) => (
                        <tr key={p.productId} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                          <td className="px-4 py-3 text-gray-900 dark:text-white">
                            <div className="font-medium">{p.productName}</div>
                            <div className="text-xs text-gray-500">{p.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-right">{formatINR(p.revenue)}</td>
                          <td className="px-4 py-3 text-right">
                            {p.qtySold} {p.unitType === "PCS" ? "pcs" : "kg"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {p.avgCost != null ? formatINR(p.avgCost) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {p.estimatedCogs != null ? formatINR(p.estimatedCogs) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {p.grossProfit != null ? formatINR(p.grossProfit) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {p.grossMarginPct != null ? `${p.grossMarginPct.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.costStatus === "ok" ? (
                              <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400" title="No PO cost">
                                ⚠ Unknown
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-8 text-center text-gray-600 dark:text-gray-400">
              {profitMarginError || "No profit data for this range."}
            </div>
          )}
        </div>
      )}

      {activeTab === "insights" && (
        <div className="space-y-4">
          {insights && insights.insights.length > 0 ? (
            <div className="grid gap-3">
              {insights.insights.map((ins, i) => (
                <div
                  key={i}
                  className={`rounded-lg border px-4 py-3 ${
                    ins.severity === "high"
                      ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30"
                      : ins.severity === "medium"
                      ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  }`}
                >
                  <p className="font-semibold text-gray-900 dark:text-white">{ins.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ins.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-8 text-center text-gray-600 dark:text-gray-400">
              {insights
                ? "No insights for this range — try widening dates or adding more sales."
                : "Load failed or no data. Use Refresh or check errors above."}
            </div>
          )}
          {insights?.period && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Compared current {insights.period.start}–{insights.period.end} vs prior{" "}
              {insights.period.priorStart}–{insights.period.priorEnd}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
