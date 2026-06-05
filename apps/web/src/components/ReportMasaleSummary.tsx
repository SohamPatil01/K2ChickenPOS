'use client';

interface MasaleSummaryProps {
  masaleRevenue?: number;
  masaleQtyPcs?: number;
  masaleQtyKg?: number;
  masaleLineCount?: number;
  otherRevenue?: number;
  compact?: boolean;
}

export function ReportMasaleSummary({
  masaleRevenue = 0,
  masaleQtyPcs = 0,
  masaleQtyKg = 0,
  masaleLineCount,
  otherRevenue,
  compact = false,
}: MasaleSummaryProps) {
  if (!masaleRevenue && !masaleQtyPcs && !masaleQtyKg) return null;

  const gridClass = compact
    ? 'grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700'
    : 'grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-brand-200 dark:border-brand-800';

  return (
    <div className={gridClass}>
      <div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Masale Revenue</div>
        <div className="text-xl font-bold text-brand-700 dark:text-brand-300">
          ₹{masaleRevenue.toFixed(2)}
        </div>
      </div>
      <div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Masale Qty (PCS)</div>
        <div className="text-xl font-bold dark:text-white">{masaleQtyPcs}</div>
      </div>
      {masaleQtyKg > 0 && (
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Masale Qty (KG)</div>
          <div className="text-xl font-bold dark:text-white">{masaleQtyKg.toFixed(2)}</div>
        </div>
      )}
      {masaleLineCount != null && (
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Masale Lines</div>
          <div className="text-xl font-bold dark:text-white">{masaleLineCount}</div>
        </div>
      )}
      {otherRevenue != null && otherRevenue > 0 && (
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Chicken / Other Revenue</div>
          <div className="text-xl font-bold dark:text-white">₹{otherRevenue.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}

export function MasaleTypeBadge({ isMasale }: { isMasale?: boolean }) {
  if (!isMasale) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
      Masale
    </span>
  );
}
