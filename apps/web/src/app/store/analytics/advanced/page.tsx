'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { SimpleLineChart, SimpleBarChart, SimplePieChart } from '@/components/charts';
import Skeleton from '@/components/ui/Skeleton';
import { exportToCSV } from '@/lib/exportCSV';

interface Forecast {
  historical: Array<{ date: string; actual: number; ma7: number; ma30: number }>;
  forecast: Array<{ date: string; predicted: number; confidence: string }>;
  trend: string;
  accuracy: number;
  avgDailySales: number;
}

interface Demand {
  fastMoving: Array<{ productName: string; totalRevenue: number; frequency: number }>;
  slowMoving: Array<{ productName: string; totalRevenue: number; frequency: number }>;
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
  const [inventory, setInventory] = useState<InventoryRecommendation | null>(null);
  const [activeTab, setActiveTab] = useState<'forecast' | 'demand' | 'inventory'>('forecast');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadAnalytics();
  }, [user, router]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:57',message:'loadAnalytics entry',data:{userId:user?.id,storeId:user?.storeId,role:user?.role},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      const [forecastRes, demandRes, inventoryRes] = await Promise.all([
        api.get('/api/v1/analytics/forecast', { params: { days: 7 } }).catch(err => {
          console.error('Forecast API error:', err.response?.data || err.message);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:63',message:'Forecast API error',data:{error:err.message,status:err.response?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          return { data: null };
        }),
        api.get('/api/v1/analytics/demand', { params: { days: 30 } }).catch(err => {
          console.error('Demand API error:', err.response?.data || err.message);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:67',message:'Demand API error',data:{error:err.message,status:err.response?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          return { data: null };
        }),
        api.get('/api/v1/analytics/inventory-recommendations').catch(err => {
          console.error('Inventory API error:', err.response?.data || err.message);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:71',message:'Inventory API error',data:{error:err.message,status:err.response?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          return { data: null };
        }),
      ]);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:76',message:'API responses received',data:{forecastHasData:!!forecastRes.data,forecastAvgDailySales:forecastRes.data?.avgDailySales,forecastAccuracy:forecastRes.data?.accuracy,demandHasData:!!demandRes.data,demandFastMovingCount:demandRes.data?.fastMoving?.length,inventoryHasData:!!inventoryRes.data,inventoryRecCount:inventoryRes.data?.recommendations?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      console.log('[Analytics] API responses:', {
        forecast: forecastRes.data ? 'loaded' : 'null',
        demand: demandRes.data ? 'loaded' : 'null',
        inventory: inventoryRes.data ? 'loaded' : 'null',
      });

      // #region agent log
      const forecastCheck = forecastRes.data ? {avgDailySales:forecastRes.data.avgDailySales,accuracy:forecastRes.data.accuracy,hasForecast:!!forecastRes.data.forecast,forecastCount:forecastRes.data.forecast?.length} : null;
      const demandCheck = demandRes.data ? {fastMovingCount:demandRes.data.fastMoving?.length,slowMovingCount:demandRes.data.slowMoving?.length,hasPeakHour:!!demandRes.data.peakHour} : null;
      const inventoryCheck = inventoryRes.data ? {recCount:inventoryRes.data.recommendations?.length,outOfStock:inventoryRes.data.outOfStock,lowStock:inventoryRes.data.lowStock} : null;
      fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:82',message:'Before setting state - checking for undefined values',data:{forecast:forecastCheck,demand:demandCheck,inventory:inventoryCheck},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      setForecast(forecastRes.data);
      setDemand(demandRes.data);
      setInventory(inventoryRes.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advanced Analytics</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Predictive insights and recommendations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (activeTab === 'forecast' && forecast) {
                exportToCSV({ data: forecast.forecast, filename: `sales_forecast_${new Date().toISOString().split('T')[0]}.csv` });
              } else if (activeTab === 'demand' && demand) {
                exportToCSV({ data: [...demand.fastMoving, ...demand.slowMoving], filename: `demand_analysis_${new Date().toISOString().split('T')[0]}.csv` });
              } else if (activeTab === 'inventory' && inventory) {
                exportToCSV({ data: inventory.recommendations, filename: `inventory_recommendations_${new Date().toISOString().split('T')[0]}.csv` });
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
          onClick={() => setActiveTab('forecast')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'forecast'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          📈 Sales Forecast
        </button>
        <button
          onClick={() => setActiveTab('demand')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'demand'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          🎯 Demand Analysis
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'inventory'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          📦 Inventory Recommendations
        </button>
      </div>

      {/* Sales Forecast Tab */}
      {activeTab === 'forecast' && forecast && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Trend</h3>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 capitalize">
                {forecast.trend}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
              <h3 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Accuracy</h3>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                {forecast.accuracy !== undefined && forecast.accuracy !== null ? `${forecast.accuracy}%` : '0%'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
              <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">Avg Daily Sales</h3>
              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                {/* #region agent log */}
                {(() => {
                  const val = forecast.avgDailySales;
                  fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:194',message:'avgDailySales value check',data:{value:val,isUndefined:val===undefined,isNull:val===null,type:typeof val},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                  return val ? `₹${val.toLocaleString()}` : '₹0';
                })()}
                {/* #endregion */}
              </p>
            </div>
          </div>

          {/* Historical Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <SimpleLineChart
              data={forecast.historical && forecast.historical.length > 0 
                ? forecast.historical.slice(-30).map(h => ({
                    name: h?.date ? h.date.substring(5) : '',
                    actual: h?.actual ?? 0,
                    ma7: h?.ma7 ?? 0,
                  }))
                : []}
              dataKey="actual"
              xAxisKey="name"
              title="Historical Sales with 7-Day Moving Average"
              height={300}
              lineColor="#3b82f6"
            />
          </div>

          {/* Forecast Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">7-Day Forecast</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Predicted Sales</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {forecast.forecast && forecast.forecast.length > 0 ? forecast.forecast.map((f, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{f?.date || ''}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-medium">
                        {/* #region agent log */}
                        {(() => {
                          const val = f.predicted;
                          if (val === undefined || val === null) {
                            fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:234',message:'predicted value is undefined/null',data:{index,date:f.date,value:val},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                          }
                          return val ? `₹${val.toLocaleString()}` : '₹0';
                        })()}
                        {/* #endregion */}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          f?.confidence === 'high' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : f?.confidence === 'medium'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                        }`}>
                          {f?.confidence || 'low'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm text-center text-gray-500">
                        No forecast data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Demand Analysis Tab */}
      {activeTab === 'demand' && demand && (
        <div className="space-y-6">
          {/* Peak Times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demand.peakHour && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-6 border border-orange-200 dark:border-orange-800">
                <h3 className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">Peak Hour</h3>
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
                <h3 className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">Peak Day</h3>
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Fast Moving Products</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {demand.fastMoving && demand.fastMoving.length > 0 ? demand.fastMoving.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{product.productName}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-medium">
                        {/* #region agent log */}
                        {(() => {
                          const val = product.totalRevenue;
                          if (val === undefined || val === null) {
                            fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:342',message:'totalRevenue is undefined/null in fastMoving',data:{productName:product.productName,value:val},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                          }
                          return val ? `₹${val.toLocaleString()}` : '₹0';
                        })()}
                        {/* #endregion */}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                        {product.frequency || 0}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm text-center text-gray-500">
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Slow Moving Products</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {demand.slowMoving && demand.slowMoving.length > 0 ? demand.slowMoving.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{product.productName}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-medium">
                        {/* #region agent log */}
                        {(() => {
                          const val = product.totalRevenue;
                          if (val === undefined || val === null) {
                            fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:335',message:'totalRevenue is undefined/null in slowMoving',data:{productName:product.productName,value:val},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                          }
                          return val ? `₹${val.toLocaleString()}` : '₹0';
                        })()}
                        {/* #endregion */}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                        {product.frequency || 0}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm text-center text-gray-500">
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
      {activeTab === 'inventory' && inventory && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Out of Stock</h3>
              <p className="text-3xl font-bold text-red-900 dark:text-red-100">
                {inventory.outOfStock}
              </p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
              <h3 className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">Low Stock</h3>
              <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                {inventory.lowStock}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Overstock</h3>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {inventory.overstock}
              </p>
            </div>
          </div>

          {/* Recommendations Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Actions Required</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Current Stock</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Reorder Point</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Suggested Qty</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {inventory.recommendations && inventory.recommendations.length > 0 ? inventory.recommendations.map((rec, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{rec.productName}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                        {/* #region agent log */}
                        {(() => {
                          const val = rec.currentStock;
                          if (val === undefined || val === null) {
                            fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:396',message:'currentStock is undefined/null',data:{productName:rec.productName,value:val},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                          }
                          return val !== undefined && val !== null ? val.toFixed(2) : '0.00';
                        })()}
                        {/* #endregion */}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                        {/* #region agent log */}
                        {(() => {
                          const val = rec.reorderPoint;
                          if (val === undefined || val === null) {
                            fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:399',message:'reorderPoint is undefined/null',data:{productName:rec.productName,value:val},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                          }
                          return val !== undefined && val !== null ? val.toFixed(2) : '0.00';
                        })()}
                        {/* #endregion */}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-medium">
                        {/* #region agent log */}
                        {(() => {
                          const val = rec.suggestedOrderQty;
                          if (val === undefined || val === null) {
                            fetch('http://127.0.0.1:7242/ingest/1fb1209b-1b69-4e4d-9ecc-fb4e76f49e13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'advanced/page.tsx:402',message:'suggestedOrderQty is undefined/null',data:{productName:rec.productName,value:val},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                          }
                          return val !== undefined && val !== null ? val.toFixed(2) : '0.00';
                        })()}
                        {/* #endregion */}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          rec.status === 'out-of-stock'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                            : rec.status === 'low-stock'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        }`}>
                          {rec.status ? rec.status.replace('-', ' ') : 'adequate'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {rec.action ? rec.action.replace('-', ' ') : 'none'}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-sm text-center text-gray-500">
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

