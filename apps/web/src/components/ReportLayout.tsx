'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, Download } from 'lucide-react';
import { fadeInUp, useMotionSafe } from '@/lib/motion';

interface ReportLayoutProps {
  title: string;
  children: React.ReactNode;
  dateRange?: boolean;
  /** Default date picker range — `today` aligns bill-wise totals with the dashboard. */
  defaultRange?: 'today' | 'last30';
  onDateRangeChange?: (startDate: string, endDate: string) => void;
  exportable?: boolean;
  onExport?: () => void;
}

export default function ReportLayout({
  title,
  children,
  dateRange = true,
  defaultRange = 'last30',
  onDateRangeChange,
  exportable = true,
  onExport,
}: ReportLayoutProps) {
  const router = useRouter();
  const motionSafe = useMotionSafe();
  const todayYmd = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(
    defaultRange === 'today' ? todayYmd : format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(todayYmd);

  const handleDateChange = (newStartDate?: string, newEndDate?: string) => {
    const effectiveStartDate = newStartDate !== undefined ? newStartDate : startDate;
    const effectiveEndDate = newEndDate !== undefined ? newEndDate : endDate;

    if (onDateRangeChange) {
      onDateRangeChange(effectiveStartDate, effectiveEndDate);
    }
  };

  useEffect(() => {
    if (dateRange && onDateRangeChange) {
      onDateRangeChange(startDate, endDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <button
          onClick={() => router.push('/reports')}
          className="px-3 sm:px-4 py-2 text-ink-secondary hover:text-ink flex items-center gap-2 text-sm sm:text-base transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </button>
        {exportable && (
          <button
            onClick={onExport}
            className="px-4 py-2 bg-gradient-brand text-white rounded-xl font-medium shadow-glow-brand hover:shadow-glow-brand-lg hover:brightness-105 transition-all active:scale-95 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        )}
      </div>

      <motion.div
        initial={motionSafe ? 'hidden' : false}
        animate="show"
        variants={motionSafe ? fadeInUp : undefined}
        className="glass-panel-strong rounded-2xl p-4 sm:p-6"
      >
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-ink">{title}</h1>
            {dateRange && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch sm:items-center">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 sm:items-center">
                  <label className="text-xs sm:text-sm text-ink-secondary sm:whitespace-nowrap">
                    From:
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      setStartDate(newStartDate);
                      handleDateChange(newStartDate, endDate);
                    }}
                    className="input-glass flex-1 sm:flex-none px-3 py-2 rounded-md text-sm sm:text-base min-w-[140px] [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 sm:items-center">
                  <label className="text-xs sm:text-sm text-ink-secondary sm:whitespace-nowrap">
                    To:
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      const newEndDate = e.target.value;
                      setEndDate(newEndDate);
                      handleDateChange(startDate, newEndDate);
                    }}
                    className="input-glass flex-1 sm:flex-none px-3 py-2 rounded-md text-sm sm:text-base min-w-[140px] [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <button
                  onClick={() => {
                    // Force reload with current state values
                    handleDateChange(startDate, endDate);
                  }}
                  className="px-4 py-2 bg-gradient-brand text-white rounded-xl font-medium shadow-glow-brand hover:shadow-glow-brand-lg hover:brightness-105 transition-all active:scale-95 text-sm sm:text-base whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
