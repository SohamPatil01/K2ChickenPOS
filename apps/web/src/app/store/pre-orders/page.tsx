'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Card, Button } from '@/components/ui';
import Link from 'next/link';
import { LOYALTY } from '@/lib/customerDisplay/brand';

function customerBookUrl(storeId?: string | null) {
  const base = (LOYALTY.bookUrl || 'https://book.k2chicken.com').replace(/\/$/, '');
  return storeId ? `${base}?store=${storeId}` : base;
}

export default function StorePreOrdersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookUrl, setBookUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    setBookUrl(customerBookUrl(user.storeId));
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/v1/pre-orders', { params: { status: 'ALL' } });
        setItems(res.data?.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  const openItems = items.filter((po) =>
    ['PENDING', 'CONFIRMED', 'READY'].includes(po.status)
  );
  const closedItems = items.filter(
    (po) => !['PENDING', 'CONFIRMED', 'READY'].includes(po.status)
  );

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pre-orders</h1>
        <p className="text-sm text-gray-600">
          Full day log of every customer booking (including cancelled). Bill open ones from POS →
          Pre-orders → Load to cart.
        </p>
      </div>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Customer booking link</h2>
        <p className="text-sm text-gray-600">
          Share this K2 Chicken link on WhatsApp. It opens the pre-order form (and redirects to the
          live booking page). Customers track status at book.k2chicken.com/book/track with phone + code.
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
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(bookUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* ignore */
                }
              }}
            >
              {copied ? 'Copied' : 'Copy'}
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
          <p className="text-gray-500 py-6 text-center">No pre-orders logged for today.</p>
        ) : (
          <div className="space-y-4">
            {openItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Open ({openItems.length})
                </p>
                <ul className="divide-y">
                  {openItems.map((po) => (
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
                        {po.notes && (
                          <div className="text-amber-800 text-xs mt-0.5">{po.notes}</div>
                        )}
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
              </div>
            )}
            {closedItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Log — cancelled / done ({closedItems.length})
                </p>
                <ul className="divide-y">
                  {closedItems.map((po) => (
                    <li
                      key={po.id}
                      className={`py-3 flex justify-between gap-3 text-sm ${
                        po.status === 'CANCELLED' ? 'bg-red-50/60 -mx-2 px-2 rounded-lg' : ''
                      }`}
                    >
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
                        {po.cancelReason && (
                          <div className="text-red-700 text-xs mt-0.5">
                            Cancel reason: {po.cancelReason}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div>
                          {new Date(po.readyAt).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div
                          className={`text-xs font-semibold ${
                            po.status === 'CANCELLED' ? 'text-red-700' : 'text-gray-500'
                          }`}
                        >
                          {po.status}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
