'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Delivery {
  id: string;
  type: string;
  status: string;
  deliveryFee: number;
  sale: {
    saleNo: string;
    grandTotal: number;
    customer: { name: string; phone: string } | null;
  };
  address: { line1: string; city: string } | null;
  assignedDriver: { name: string } | null;
}

export default function DeliveryPage() {
  const { user } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadDeliveries();
  }, [statusFilter]);

  const loadDeliveries = async () => {
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const response = await api.get('/api/v1/delivery', { params });
      setDeliveries(response.data);
    } catch (error) {
      console.error('Failed to load deliveries:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.post(`/api/v1/delivery/${id}/status`, { status });
      loadDeliveries();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update status');
    }
  };

  const groupedByStatus = deliveries.reduce((acc, delivery) => {
    if (!acc[delivery.status]) acc[delivery.status] = [];
    acc[delivery.status].push(delivery);
    return acc;
  }, {} as Record<string, Delivery[]>);

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h1 className="text-xl sm:text-2xl font-bold">Delivery Management</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md w-full sm:w-auto text-sm sm:text-base"
        >
          <option value="">All Status</option>
          <option value="CREATED">Created</option>
          <option value="READY">Ready</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
          <option value="DELIVERED">Delivered</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {['CREATED', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'].map((status) => (
          <div key={status} className="bg-white rounded-lg shadow p-4 min-h-[200px]">
            <h2 className="font-bold mb-4 text-sm sm:text-base text-center sm:text-left break-words">
              {status.replace(/_/g, ' ')}
            </h2>
            <div className="space-y-2">
              {(groupedByStatus[status] || []).length === 0 ? (
                <div className="text-center text-gray-400 text-xs sm:text-sm py-4">
                  No deliveries
                </div>
              ) : (
                (groupedByStatus[status] || []).map((delivery) => (
                  <div key={delivery.id} className="border rounded p-2 sm:p-3 hover:bg-gray-50 transition-colors">
                    <div className="font-semibold text-xs sm:text-sm truncate" title={delivery.sale.saleNo}>
                      {delivery.sale.saleNo}
                    </div>
                    <div className="text-xs text-gray-600 truncate" title={delivery.sale.customer?.name || 'Walk-in'}>
                      {delivery.sale.customer?.name || 'Walk-in'}
                    </div>
                    <div className="text-xs text-gray-500 font-medium">₹{delivery.sale.grandTotal.toFixed(2)}</div>
                    {delivery.address && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2" title={`${delivery.address.line1}, ${delivery.address.city}`}>
                        {delivery.address.line1}, {delivery.address.city}
                      </div>
                    )}
                    {delivery.assignedDriver && (
                      <div className="text-xs text-blue-600 mt-1">
                        Driver: {delivery.assignedDriver.name}
                      </div>
                    )}
                    {user?.role !== 'DRIVER' && delivery.status === 'ASSIGNED' && (
                      <button
                        onClick={() => updateStatus(delivery.id, 'OUT_FOR_DELIVERY')}
                        className="mt-2 w-full text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                      >
                        Mark Out
                      </button>
                    )}
                    {user?.role === 'DRIVER' && delivery.status === 'OUT_FOR_DELIVERY' && (
                      <button
                        onClick={() => {
                          const otp = prompt('Enter OTP:');
                          if (otp) {
                            api.post(`/api/v1/delivery/${delivery.id}/otp/verify`, { otp })
                              .then(() => loadDeliveries())
                              .catch((err) => alert(err.response?.data?.error || 'Invalid OTP'));
                          }
                        }}
                        className="mt-2 w-full text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                      >
                        Verify OTP
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

