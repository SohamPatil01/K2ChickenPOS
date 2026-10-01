'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Card, Button } from '@/components/ui';
import Link from 'next/link';

export default function StorePreOrdersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookUrl, setBookUrl] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const storeQ = user.storeId ? `?store=${user.storeId}` : '';
      setBookUrl(`${origin}/book${storeQ}`);
    }
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/v1/pre-orders');
        setItems(res.data?.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pre-orders</h1>
        <p className="text-sm text-gray-600">
          Customer bookings and phone orders for today. Bill them from POS → Pre-orders → Load to cart.
        </p>
      </div>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Customer booking link</h2>
        <p className="text-sm text-gray-600">
          Share the booking link with customers. Staff control status, messages, and cancellations
          from POS. Customers track live at /book/track with phone + code.
        </p>
        {bookUrl && (
          <div className="flex flex-wrap gap-2 items-center">
            <code className="text-xs sm:text-sm bg-gray-100 px-2 py-1 rounded break-all flex-1">
              {bookUrl}
            </code>
            <Button
              type="button"
              variant="secondary"
              className="!py-1 !px-3 text-sm"
              onClick={() => {
                navigator.clipboard?.writeText(bookUrl);
              }}
            >
              Copy
            </Button>
            <Link href={bookUrl} target="_blank" className="text-sm text-brand-600 underline">
              Open form
            </Link>
          </div>
        )}
      </Card>

      <Card className="p-4">
        {loading ? (
          <p className="text-gray-500 py-6 text-center">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500 py-6 text-center">No open pre-orders for today.</p>
        ) : (
          <ul className="divide-y">
            {items.map((po) => (
              <li key={po.id} className="py-3 flex justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">
                    {po.customerName} · {po.customerPhone}
                    {po.trackingCode ? (
                      <span className="ml-2 font-mono text-orange-800 text-xs">
                        {po.trackingCode}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-gray-600">
                    {(po.items || [])
                      .map(
                        (it: any) =>
                          `${it.productName} (${
                            it.unitType === 'KG' ? `${it.qtyKg}kg` : `${it.qtyPcs}pcs`
                          })`
                      )
                      .join(', ')}
                  </div>
                  {po.notes && <div className="text-amber-800 text-xs mt-0.5">{po.notes}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div>
                    {new Date(po.readyAt).toLocaleTimeString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="text-xs text-gray-500">{po.status}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
