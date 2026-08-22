'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

interface Budget {
  id: string;
  name: string;
  periodType: string;
  startDate: string;
  endDate: string;
  amount: number;
  status: string;
  category?: { name: string };
}

export default function BudgetManagementPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [form, setForm] = useState({
    name: '',
    periodType: 'MONTHLY',
    startDate: '',
    endDate: '',
    amount: '',
    notes: '',
  });
  const [status, setStatus] = useState<string | null>(null);

  const load = () => {
    api.get('/api/v1/reporting/budgets').then((r) => setBudgets(r.data));
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      await api.post('/api/v1/reporting/budgets', {
        ...form,
        amount: Number(form.amount),
      });
      setStatus('Budget created');
      setForm({ name: '', periodType: 'MONTHLY', startDate: '', endDate: '', amount: '', notes: '' });
      load();
    } catch (err: any) {
      setStatus(err?.response?.data?.error || 'Failed (Owner only)');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/store/business-reports" className="flex items-center gap-1 text-sm text-ink-secondary mb-4">
        <ArrowLeft className="h-4 w-4" /> Business Reports
      </Link>
      <h1 className="text-xl font-bold text-ink mb-4">Budget Management</h1>

      <form onSubmit={submit} className="glass-panel rounded-xl p-6 space-y-4 mb-6">
        <input
          placeholder="Budget name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="rounded-lg border border-border px-3 py-2 text-sm" />
          <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="rounded-lg border border-border px-3 py-2 text-sm" />
        </div>
        <input type="number" placeholder="Amount" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        <select value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2 text-sm">
          {['MONTHLY', 'QUARTERLY', 'ANNUAL'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button type="submit" className="w-full py-2.5 rounded-lg bg-brand-500 text-white font-medium">Create Budget</button>
        {status && <p className="text-sm text-center text-ink-muted">{status}</p>}
      </form>

      <div className="space-y-2">
        {budgets.map((b) => (
          <div key={b.id} className="glass-panel rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-medium text-ink">{b.name}</p>
              <p className="text-xs text-ink-muted">
                {b.startDate.slice(0, 10)} – {b.endDate.slice(0, 10)} · {b.periodType}
              </p>
            </div>
            <p className="font-semibold text-ink">₹{b.amount.toLocaleString('en-IN')}</p>
          </div>
        ))}
        {budgets.length === 0 && <p className="text-sm text-ink-muted text-center py-4">No budgets yet</p>}
      </div>
    </div>
  );
}
