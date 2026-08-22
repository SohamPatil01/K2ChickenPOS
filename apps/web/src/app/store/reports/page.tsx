'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Receipt, ClipboardList, CalendarDays, Package, BarChart3, ChevronRight, FileText, LayoutGrid } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { CA_REPORT_ITEMS } from '@/lib/caReports';
import { fadeInUp, staggerContainer, hoverLift, useMotionSafe } from '@/lib/motion';

const REPORT_META: Record<string, { icon: React.ReactNode; description: string }> = {
  'bill-wise-sale': {
    icon: <Receipt className="h-5 w-5" />,
    description: 'Every bill in the period, one row per sale.',
  },
  'sales-register-summary': {
    icon: <ClipboardList className="h-5 w-5" />,
    description: 'Totals, discounts, tax and payment split.',
  },
  'daily-product-transaction': {
    icon: <CalendarDays className="h-5 w-5" />,
    description: 'Day-by-day sales summary.',
  },
  'product-wise-sale': {
    icon: <Package className="h-5 w-5" />,
    description: 'Revenue and quantity sold, per product.',
  },
  'monthly-sales': {
    icon: <BarChart3 className="h-5 w-5" />,
    description: 'Compare revenue, avg bill and customers month over month.',
  },
};

export default function StoreReportsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const motionSafe = useMotionSafe();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
      router.push('/store');
      return;
    }
  }, [user, router]);

  const handleReportClick = (path: string, id: string) => {
    setSelectedReport(id);
    router.push(path);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">Reports</h1>
        <p className="text-sm text-ink-secondary mt-1">CA-style registers for accounts & audit</p>
      </div>

      <Link
        href="/store/business-reports"
        className="glass-panel rounded-2xl p-4 mb-4 flex items-center gap-3 hover:ring-2 hover:ring-brand-500/30 transition-all"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm">Business Reports hub</p>
          <p className="text-xs text-ink-muted">All reports — sales, inventory, financial, analytics — in one place</p>
        </div>
        <ChevronRight className="h-5 w-5 text-ink-muted shrink-0" />
      </Link>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        variants={motionSafe ? staggerContainer(0.06) : undefined}
        initial={motionSafe ? 'hidden' : false}
        animate="show"
      >
        {CA_REPORT_ITEMS.map((item) => {
          const meta = REPORT_META[item.id] || {
            icon: <FileText className="h-5 w-5" />,
            description: '',
          };
          return (
            <motion.button
              key={item.id}
              variants={motionSafe ? fadeInUp : undefined}
              {...(motionSafe ? hoverLift : {})}
              onClick={() => handleReportClick(item.path, item.id)}
              className={`glass-panel text-left rounded-2xl p-4 sm:p-5 flex items-start gap-4 transition-colors touch-target ${
                selectedReport === item.id ? 'ring-2 ring-brand-500/40' : ''
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400">
                {meta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink text-sm sm:text-base">{item.label}</p>
                {meta.description && (
                  <p className="text-xs sm:text-sm text-ink-muted mt-0.5 truncate">{meta.description}</p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted mt-2" />
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
