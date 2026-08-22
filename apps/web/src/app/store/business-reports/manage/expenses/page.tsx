'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function ExpenseEntryPage() {
  const { user } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    categoryId: '',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'CASH',
    description: '',
    receiptRef: '',
  });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/v1/reporting/expense-categories').then((r) => setCategories(r.data));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      await api.post('/api/v1/reporting/expenses', {
        ...form,
        amount: Number(form.amount),
      });
      setStatus('Expense saved');
      setForm((f) => ({ ...f, amount: '', description: '', receiptRef: '' }));
    } catch (err: any) {
      setStatus(err?.response?.data?.error || 'Failed to save');
    }
  };

  const addCategory = async () => {
    const name = prompt('Category name');
    if (!name) return;
    try {
      const r = await api.post('/api/v1/reporting/expense-categories', { name });
      setCategories((c) => [...c, r.data]);
    } catch {
      alert('Failed to create category (Owner only for new categories)');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <Link href="/store/business-reports" className="flex items-center gap-1 text-sm text-ink-secondary mb-4">
        <ArrowLeft className="h-4 w-4" /> Business Reports
      </Link>
      <h1 className="text-xl font-bold text-ink mb-4">Expense Entry</h1>
      <form onSubmit={submit} className="glass-panel rounded-xl p-6 space-y-4">
        <div>
          <label className="text-sm text-ink-muted">Category</label>
          <div className="flex gap-2 mt-1">
            <select
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {user?.role === 'OWNER' && (
              <button type="button" onClick={addCategory} className="text-sm text-brand-500 px-2">
                + Add
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="text-sm text-ink-muted">Amount (₹)</label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full mt-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-ink-muted">Date</label>
          <input
            type="date"
            required
            value={form.expenseDate}
            onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
            className="w-full mt-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-ink-muted">Payment method</label>
          <select
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="w-full mt-1 rounded-lg border border-border px-3 py-2 text-sm"
          >
            {['CASH', 'CARD', 'UPI', 'ONLINE'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-ink-muted">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full mt-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-ink-muted">Receipt ref</label>
          <input
            value={form.receiptRef}
            onChange={(e) => setForm({ ...form, receiptRef: e.target.value })}
            className="w-full mt-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="w-full py-2.5 rounded-lg bg-brand-500 text-white font-medium">
          Save Expense
        </button>
        {status && <p className="text-sm text-center text-ink-muted">{status}</p>}
      </form>
    </div>
  );
}
