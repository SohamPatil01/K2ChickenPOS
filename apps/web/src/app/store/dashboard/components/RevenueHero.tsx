'use client';

import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { AnimatedNumber, Badge } from '@/components/ui';
import { exportToCSV } from '@/lib/exportCSV';
import { formatInr } from '@/lib/utils';
import { useIsDark } from '@/lib/useIsDark';
import type { DashboardStats } from '../hooks/useDashboardStats';
import type { RevenuePoint } from '../hooks/useRevenueSeries';

export type DashboardRange = 'today' | '7d' | 'month';

interface RevenueHeroProps {
  stats: DashboardStats;
  series: RevenuePoint[];
  seriesLoading?: boolean;
  range: DashboardRange;
}

function HeroTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel-strong rounded-xl px-3 py-2 text-sm">
      <p className="text-ink-muted text-xs mb-0.5">{label}</p>
      <p className="font-semibold text-ink tabular-nums">{formatInr(payload[0].value)}</p>
    </div>
  );
}

export default function RevenueHero({ stats, series, seriesLoading = false, range }: RevenueHeroProps) {
  const isDark = useIsDark();

  const data = series.map((d) => ({
    day: d.label,
    revenue: d.total,
    isToday: d.isCurrent,
  }));
  const hasData = data.some((d) => d.revenue > 0);

  const headline =
    range === 'today'
      ? stats.today.revenue
      : range === '7d'
        ? series.reduce((s, d) => s + d.total, 0)
        : stats.month.revenue;
  const sub =
    range === 'today'
      ? `${stats.today.count} sales · avg ${formatInr(stats.today.avgBill, { maxFractionDigits: 0 })}`
      : range === '7d'
        ? 'last 7 days'
        : `${stats.month.count} sales this month`;

  const emptyLabel =
    range === 'today'
      ? 'No revenue yet today'
      : range === '7d'
        ? 'No revenue data for the last 7 days'
        : 'No revenue data this month';

  const vsYesterday =
    stats.yesterday.revenue > 0
      ? ((stats.today.revenue - stats.yesterday.revenue) / stats.yesterday.revenue) * 100
      : null;

  // Concrete hex per mode (SVG attrs can't resolve CSS vars); recessive grid/axes.
  const line = isDark ? '#FF8A3D' : '#FF6A00';
  const grid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,15,15,0.07)';
  const tick = '#8A8580';

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-1.5">
            {range === 'today' ? "Today's revenue" : range === '7d' ? 'Revenue · 7 days' : 'Revenue · this month'}
          </p>
          <p className="text-4xl sm:text-5xl font-bold text-ink tabular-nums leading-none">
            <AnimatedNumber value={headline} format={(v) => formatInr(v, { maxFractionDigits: 0 })} />
          </p>
          <p className="text-sm text-ink-secondary mt-2 flex items-center gap-2 flex-wrap">
            {sub}
            {range === 'today' && vsYesterday !== null && (
              <Badge variant={vsYesterday >= 0 ? 'success' : 'danger'}>
                {vsYesterday >= 0 ? '▲' : '▼'} {Math.abs(vsYesterday).toFixed(1)}% vs yesterday
              </Badge>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportToCSV({
              data: series.map((d) => ({ period: d.label, revenue: d.total })),
              filename: `revenue_${range}_${new Date().toISOString().split('T')[0]}.csv`,
            })
          }
          className="self-start inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors touch-target"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {seriesLoading ? (
        <div className="flex items-center justify-center rounded-xl min-h-[220px]">
          <p className="text-ink-muted text-sm animate-pulse">Loading chart…</p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-strong min-h-[220px]">
          <p className="text-ink-muted font-medium mb-3">{emptyLabel}</p>
          <Link
            href="/store/pos"
            className="px-4 py-2 bg-gradient-brand text-white rounded-xl text-sm font-medium shadow-glow-brand hover:brightness-105 transition-all"
          >
            Go to POS
          </Link>
        </div>
      ) : (
        <div className="h-[220px] sm:h-[260px] -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="heroRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={line} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={line} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis
                dataKey="day"
                stroke="transparent"
                tick={{ fontSize: 11, fill: tick }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                stroke="transparent"
                tick={{ fontSize: 11, fill: tick }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`)}
              />
              <Tooltip content={<HeroTooltip />} cursor={{ stroke: grid, strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={line}
                strokeWidth={2}
                fill="url(#heroRevenueFill)"
                isAnimationActive={false}
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  if (!payload?.isToday) return <g key={`d-${index}`} />;
                  return (
                    <g key={`d-${index}`}>
                      <circle cx={cx} cy={cy} r={8} fill={line} opacity={0.25} />
                      <circle cx={cx} cy={cy} r={4} fill={line} stroke="#fff" strokeWidth={1.5} />
                    </g>
                  );
                }}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
