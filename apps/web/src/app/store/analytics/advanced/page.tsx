"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import {
  SimpleLineChart,
  SimpleBarChart,
  SimplePieChart,
} from "@/components/charts";
import {
  LineChart,
  Line,
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
  forecast: Array<{ date: string; predicted: number; confidence: string }>;
  trend: string;
  accuracy: number;
  avgDailySales: number;
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
  peakHour: { hour: number; count: number } | null;
  peakDay: { day: string; count: number } | null;
}

interface InventoryRecommendation {
  recommendations: Array<{
    productName: string;
    currentStock: number;
    reorderPoint: number;
    suggestedOrderQty: number;
    status: string;
    action: string;
  }>;
  outOfStock: number;
  lowStock: number;
  overstock: number;
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
  const [activeTab, setActiveTab] = useState<
    "forecast" | "demand" | "inventory"
  >("forecast");

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    loadAnalytics();
  }, [user, router]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      if (!user?.storeId) {
        console.error("[Analytics] User storeId is missing");
        return;
      }

      console.log("[Analytics] Loading analytics for store:", user.storeId);

      const [forecastRes, demandRes, inventoryRes] = await Promise.all([
        api
          .get("/api/v1/analytics/forecast", { params: { days: 7 } })
          .catch((err) => {
            console.error(
              "Forecast API error:",
              err.response?.data || err.message
            );
            if (err.response?.status === 400) {
              console.error("Forecast error details:", err.response.data);
            }
            return { data: null };
          }),
        api
          .get("/api/v1/analytics/demand", { params: { days: 30 } })
          .catch((err) => {
            console.error(
              "Demand API error:",
              err.response?.data || err.message
            );
            if (err.response?.status === 400) {
              console.error("Demand error details:", err.response.data);
            }
            return { data: null };
          }),
        api.get("/api/v1/analytics/inventory-recommendations").catch((err) => {
          console.error(
            "Inventory API error:",
            err.response?.data || err.message
          );
          if (err.response?.status === 400) {
            console.error("Inventory error details:", err.response.data);
          }
          return { data: null };
        }),
      ]);

      console.log("[Analytics] API responses:", {
        forecast: forecastRes.data ? "loaded" : "null",
        demand: demandRes.data ? "loaded" : "null",
        inventory: inventoryRes.data ? "loaded" : "null",
        forecastSales: forecastRes.data?.avgDailySales,
        demandFastMoving: demandRes.data?.fastMoving?.length,
        inventoryRecs: inventoryRes.data?.recommendations?.length,
      });

      setForecast(forecastRes.data);
      setDemand(demandRes.data);
      setInventory(inventoryRes.data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Advanced Analytics
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Predictive insights and recommendations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (activeTab === "forecast" && forecast) {
                exportToCSV({
                  data: forecast.forecast,
                  filename: `sales_forecast_${
                    new Date().toISOString().split("T")[0]
                  }.csv`,
                });
              } else if (activeTab === "demand" && demand) {
                exportToCSV({
                  data: [...demand.fastMoving, ...demand.slowMoving],
                  filename: `demand_analysis_${
                    new Date().toISOString().split("T")[0]
                  }.csv`,
                });
              } else if (activeTab === "inventory" && inventory) {
                exportToCSV({
                  data: inventory.recommendations,
                  filename: `inventory_recommendations_${
                    new Date().toISOString().split("T")[0]
                  }.csv`,
                });
              }
            }}
            className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors font-medium text-sm border border-green-200 dark:border-green-800"
          >
            📥 Export CSV
          </button>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors font-medium text-sm border border-blue-200 dark:border-blue-800"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
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
      </div>

      {/* Sales Forecast Tab */}
      {activeTab === "forecast" && (
        <div className="space-y-6">
          {!forecast ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Could not load sales forecast. Please try again.
              </p>
              <button
                onClick={loadAnalytics}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
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
                Accuracy
              </h3>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                {forecast.accuracy !== undefined && forecast.accuracy !== null
                  ? `${forecast.accuracy}%`
                  : "0%"}
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
              Historical Sales Trend (Last 30 Days)
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
                7-Day Forecast
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
                        colSpan={3}
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
      {activeTab === "demand" && demand && (
        <div className="space-y-6">
          {/* Peak Times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demand.peakHour && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-6 border border-orange-200 dark:border-orange-800">
                <h3 className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">
                  Peak Hour
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
                Fast Moving Products
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
                Slow Moving Products
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
        </div>
      )}

      {/* Inventory Recommendations Tab */}
      {activeTab === "inventory" && inventory && (
        <div className="space-y-6">
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Current Stock
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
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {rec.productName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                          {typeof rec.currentStock === "number" && !Number.isNaN(rec.currentStock)
                            ? rec.currentStock.toFixed(2)
                            : "0.00"}
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
                        colSpan={6}
                        className="px-4 py-3 text-sm text-center text-gray-500"
                      >
                        No inventory recommendations available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
