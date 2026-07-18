'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { localDateRangeToApiBounds, todayLocalYmd } from '@/lib/dateRangeParams';
import type { DashboardRange } from '../components/RevenueHero';

export interface RevenuePoint {
  label: string;
  total: number;
  isCurrent: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]}`;
}

function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour >= 12 ? 'PM' : 'AM'}`;
}

/**
 * Chart series for the dashboard revenue hero, matching the selected range:
 * today = hourly (client-bucketed from today's PAID bills), 7d = daily trend
 * already loaded by the dashboard, month = month-to-date daily trend.
 */
export function useRevenueSeries({
  range,
  salesTrendLast7,
  refreshKey,
  enabled,
}: {
  range: DashboardRange;
  salesTrendLast7: Array<{ date: string; total: number }>;
  refreshKey: number;
  enabled: boolean;
}) {
  const [todaySeries, setTodaySeries] = useState<RevenuePoint[] | null>(null);
  const [monthSeries, setMonthSeries] = useState<RevenuePoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  // A manual/auto refresh invalidates both cached series.
  useEffect(() => {
    setTodaySeries(null);
    setMonthSeries(null);
  }, [refreshKey]);

  useEffect(() => {
    if (!enabled) return;
    if (range === '7d') return;
    if (range === 'today' && todaySeries !== null) return;
    if (range === 'month' && monthSeries !== null) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        if (range === 'today') {
          const todayYmd = todayLocalYmd();
          const { startDate, endDate } = localDateRangeToApiBounds(todayYmd, todayYmd);
          const res = await api.get('/api/v1/sales', {
            params: { startDate, endDate, status: 'PAID' },
          });
          const sales = res.data || [];

          const totalsByHour = new Array<number>(24).fill(0);
          for (const sale of sales) {
            const created = new Date(sale.createdAt);
            if (Number.isNaN(created.getTime())) continue;
            totalsByHour[created.getHours()] += sale.grandTotal || 0;
          }

          const nowHour = new Date().getHours();
          const firstSaleHour = totalsByHour.findIndex((t) => t > 0);
          // Show from the first sale (or a small window before now when idle) up to now.
          const startHour =
            firstSaleHour === -1 ? Math.max(0, nowHour - 6) : Math.min(firstSaleHour, nowHour);

          const points: RevenuePoint[] = [];
          for (let h = startHour; h <= nowHour; h++) {
            points.push({
              label: hourLabel(h),
              total: Math.round(totalsByHour[h] * 100) / 100,
              isCurrent: h === nowHour,
            });
          }
          if (!cancelled) setTodaySeries(points);
        } else {
          const todayYmd = todayLocalYmd();
          const monthStartYmd = `${todayYmd.slice(0, 8)}01`;
          const res = await api.get('/api/v1/analytics/sales-trend', {
            params: { startDate: monthStartYmd, endDate: todayYmd },
          });
          const rows: Array<{ date: string; total: number }> = Array.isArray(res?.data)
            ? res.data
            : [];
          const points = rows.map((d, i) => ({
            label: dayLabel(d.date),
            total: d.total,
            isCurrent: i === rows.length - 1,
          }));
          if (!cancelled) setMonthSeries(points);
        }
      } catch {
        if (!cancelled) {
          if (range === 'today') setTodaySeries([]);
          else setMonthSeries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range, refreshKey, enabled, todaySeries, monthSeries]);

  const series: RevenuePoint[] =
    range === '7d'
      ? salesTrendLast7.map((d, i) => ({
          label: dayLabel(d.date),
          total: d.total,
          isCurrent: i === salesTrendLast7.length - 1,
        }))
      : range === 'today'
        ? todaySeries ?? []
        : monthSeries ?? [];

  const seriesLoading =
    loading &&
    ((range === 'today' && todaySeries === null) || (range === 'month' && monthSeries === null));

  return { series, seriesLoading };
}
