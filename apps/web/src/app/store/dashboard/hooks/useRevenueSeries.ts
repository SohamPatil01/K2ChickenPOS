'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  defaultDateRangeLast7Days,
  localDateRangeToApiBounds,
  todayLocalYmd,
} from '@/lib/dateRangeParams';
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

function rowsToPoints(rows: Array<{ date: string; total: number }>): RevenuePoint[] {
  return rows.map((d, i) => ({
    label: dayLabel(d.date),
    total: d.total,
    isCurrent: i === rows.length - 1,
  }));
}

/**
 * Chart series for the dashboard revenue hero.
 * Loads each range only when selected (5GB Neon budget) and caches until refreshKey bumps.
 */
export function useRevenueSeries({
  range,
  refreshKey,
  enabled,
}: {
  range: DashboardRange;
  refreshKey: number;
  enabled: boolean;
}) {
  const [todaySeries, setTodaySeries] = useState<RevenuePoint[] | null>(null);
  const [weekSeries, setWeekSeries] = useState<RevenuePoint[] | null>(null);
  const [weekRows, setWeekRows] = useState<Array<{ date: string; total: number }>>([]);
  const [monthSeries, setMonthSeries] = useState<RevenuePoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTodaySeries(null);
    setWeekSeries(null);
    setWeekRows([]);
    setMonthSeries(null);
  }, [refreshKey]);

  useEffect(() => {
    if (!enabled) return;
    if (range === 'today' && todaySeries !== null) return;
    if (range === '7d' && weekSeries !== null) return;
    if (range === 'month' && monthSeries !== null) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        if (range === 'today') {
          const todayYmd = todayLocalYmd();
          const { startDate, endDate } = localDateRangeToApiBounds(todayYmd, todayYmd);
          const res = await api.get('/api/v1/sales', {
            params: { startDate, endDate, status: 'PAID', limit: 200 },
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
        } else if (range === '7d') {
          const { start, end } = defaultDateRangeLast7Days();
          const res = await api.get('/api/v1/analytics/sales-trend', {
            params: { startDate: start, endDate: end },
          });
          const rows: Array<{ date: string; total: number }> = Array.isArray(res?.data)
            ? res.data
            : [];
          if (!cancelled) {
            setWeekRows(rows);
            setWeekSeries(rowsToPoints(rows));
          }
        } else {
          const todayYmd = todayLocalYmd();
          const monthStartYmd = `${todayYmd.slice(0, 8)}01`;
          const res = await api.get('/api/v1/analytics/sales-trend', {
            params: { startDate: monthStartYmd, endDate: todayYmd },
          });
          const rows: Array<{ date: string; total: number }> = Array.isArray(res?.data)
            ? res.data
            : [];
          if (!cancelled) setMonthSeries(rowsToPoints(rows));
        }
      } catch {
        if (!cancelled) {
          if (range === 'today') setTodaySeries([]);
          else if (range === '7d') {
            setWeekRows([]);
            setWeekSeries([]);
          } else setMonthSeries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range, refreshKey, enabled, todaySeries, weekSeries, monthSeries]);

  const series: RevenuePoint[] =
    range === '7d'
      ? weekSeries ?? []
      : range === 'today'
        ? todaySeries ?? []
        : monthSeries ?? [];

  const seriesLoading =
    loading &&
    ((range === 'today' && todaySeries === null) ||
      (range === '7d' && weekSeries === null) ||
      (range === 'month' && monthSeries === null));

  return { series, seriesLoading, salesTrendLast7: weekRows };
}
