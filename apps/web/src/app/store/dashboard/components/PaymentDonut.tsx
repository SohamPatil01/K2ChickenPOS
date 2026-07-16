'use client';

import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Download } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui';
import { exportToCSV } from '@/lib/exportCSV';
import { formatInr } from '@/lib/utils';
import { useIsDark } from '@/lib/useIsDark';
import type { DashboardStats } from '../hooks/useDashboardStats';

interface PaymentDonutProps {
  breakdown: DashboardStats['paymentBreakdown'];
}

// Categorical palette, validated with the dataviz six-checks script in
// both modes (order matters — adjacency drives CVD separation):
// light: #FF6A00,#2563EB,#16A34A,#6D5AD1 · dark: #E8650A,#3987E5,#189E52,#9085E9.
// Light-mode orange sits below 3:1 contrast → relief = the direct label
// list beside the donut (label + value + %), never color alone.
const SLOTS = [
  { key: 'cash', label: 'Cash', light: '#FF6A00', dark: '#E8650A' },
  { key: 'upi', label: 'UPI', light: '#2563EB', dark: '#3987E5' },
  { key: 'card', label: 'Card', light: '#16A34A', dark: '#189E52' },
  { key: 'other', label: 'Other', light: '#6D5AD1', dark: '#9085E9' },
] as const;

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="glass-panel-strong rounded-xl px-3 py-2 text-sm">
      <p className="text-ink-muted text-xs mb-0.5">{p.name}</p>
      <p className="font-semibold text-ink tabular-nums">{formatInr(p.value)}</p>
    </div>
  );
}

export default function PaymentDonut({ breakdown }: PaymentDonutProps) {
  const isDark = useIsDark();
  const surface = isDark ? '#171614' : '#FFFFFF';

  const data = SLOTS.map((s) => ({
    name: s.label,
    value: breakdown[s.key] || 0,
    color: isDark ? s.dark : s.light,
  }));
  const total = breakdown.total || 0;

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold text-ink">Payments today</h2>
        <button
          type="button"
          onClick={() =>
            exportToCSV({
              data: data.map((d) => ({ method: d.name, amount: d.value })),
              filename: `payment_distribution_${new Date().toISOString().split('T')[0]}.csv`,
            })
          }
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors touch-target"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {total <= 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-strong min-h-[240px] flex-1">
          <p className="text-ink-muted font-medium mb-3">No payments yet today</p>
          <Link
            href="/store/pos"
            className="px-4 py-2 bg-gradient-brand text-white rounded-xl text-sm font-medium shadow-glow-brand hover:brightness-105 transition-all"
          >
            Go to POS
          </Link>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 flex-1">
          <div className="relative h-[190px] w-[190px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={2}
                  strokeWidth={2}
                  stroke={surface}
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-widest text-ink-muted">Total</span>
              <span className="text-lg font-bold text-ink tabular-nums">
                <AnimatedNumber value={total} format={(v) => formatInr(v, { maxFractionDigits: 0 })} />
              </span>
            </div>
          </div>

          {/* Direct labels: identity + value + share (relief for low-contrast slices) */}
          <div className="flex-1 w-full space-y-2">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: d.color }}
                  aria-hidden
                />
                <span className="text-sm text-ink-secondary flex-1">{d.name}</span>
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {formatInr(Math.round(d.value))}
                </span>
                <span className="text-xs text-ink-muted tabular-nums w-12 text-right">
                  {total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
