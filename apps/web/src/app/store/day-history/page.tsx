'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Card } from '@/components/ui';

type HistoryItem = {
  id: string;
  businessDate: string | null;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  cashTakenHome: number | null;
  pettyCashCarryForward: number | null;
  overrideReason: string | null;
  openedBy: { id: string; name: string } | null;
  closedBy: { id: string; name: string } | null;
  cashInTotal: number;
  cashOutTotal: number;
  cashExpected: number | null;
  cashDifference: number | null;
  totalRevenue: number | null;
  totalSales: number | null;
  isFinalized: boolean;
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
}

export default function DayHistoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/v1/shifts/history', { params: { limit: 50 } });
        setItems(res.data?.items || []);
      } catch (e) {
        console.error(e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Day history</h1>
        <p className="text-sm text-gray-600">Who Day In / Day Out, petty cash, and take-home.</p>
      </div>
      <Card>
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No day sessions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Opened</th>
                  <th className="py-2 pr-3">Closed</th>
                  <th className="py-2 pr-3">In by</th>
                  <th className="py-2 pr-3">Out by</th>
                  <th className="py-2 pr-3">Petty in</th>
                  <th className="py-2 pr-3">Take home</th>
                  <th className="py-2 pr-3">Carry</th>
                  <th className="py-2 pr-3">Diff</th>
                  <th className="py-2 pr-3">Sales</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(row.openedAt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {row.closedAt ? fmtDate(row.closedAt) : (
                        <span className="text-emerald-700 font-medium">Open</span>
                      )}
                      {row.overrideReason && (
                        <div className="text-xs text-amber-700 max-w-[140px]">Override: {row.overrideReason}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3">{row.openedBy?.name || '—'}</td>
                    <td className="py-2 pr-3">{row.closedBy?.name || '—'}</td>
                    <td className="py-2 pr-3">₹{Number(row.openingCash || 0).toFixed(0)}</td>
                    <td className="py-2 pr-3">
                      {row.cashTakenHome != null ? `₹${Number(row.cashTakenHome).toFixed(0)}` : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {row.pettyCashCarryForward != null
                        ? `₹${Number(row.pettyCashCarryForward).toFixed(0)}`
                        : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {row.cashDifference != null ? `₹${Number(row.cashDifference).toFixed(0)}` : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {row.totalSales != null ? (
                        <>
                          {row.totalSales} · ₹{Number(row.totalRevenue || 0).toFixed(0)}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
