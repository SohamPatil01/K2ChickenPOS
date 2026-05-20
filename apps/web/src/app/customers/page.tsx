'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { parseCustomerListResponse } from '@/lib/customers';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyPoints?: number;
  loyaltyTier?: string;
  totalSpent?: number;
  addresses: Array<{
    id: string;
    label: string;
    line1: string;
    city: string;
  }>;
  sales: Array<{
    id: string;
    saleNo: string;
    grandTotal: number;
    createdAt: string;
  }>;
}

interface PurchaseHistorySale {
  id: string;
  saleNo: string;
  grandTotal: number;
  discountTotal: number;
  taxTotal: number;
  createdAt: string;
  items: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      unitType: string;
    };
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    lineTotal: number;
  }>;
  payments: Array<{
    method: string;
    amount: number;
  }>;
}

interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  balance: number;
  description?: string;
  createdAt: string;
  sale?: {
    id: string;
    saleNo: string;
    grandTotal: number;
    createdAt: string;
  };
}

interface Address {
  id?: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [addressForm, setAddressForm] = useState<Address>({
    label: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
  });
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistorySale[]>([]);
  const [loyaltyInfo, setLoyaltyInfo] = useState<any>(null);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyAction, setLoyaltyAction] = useState<'redeem' | 'adjust' | null>(null);
  const [loyaltyForm, setLoyaltyForm] = useState({ points: 0, description: '' });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await api.get('/api/v1/customers');
      const totalHeader =
        response.headers['x-customer-total'] ?? response.headers['X-Customer-Total'];
      const { customers } = parseCustomerListResponse(response.data, totalHeader);
      setCustomers(customers as Customer[]);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchPhone) {
      loadCustomers();
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/api/v1/customers?phone=${searchPhone}`);
      if (response.data) {
        setSelectedCustomer(response.data);
        setCustomers([response.data]);
      } else {
        setCustomers([]);
        setSelectedCustomer(null);
      }
    } catch (error) {
      console.error('Failed to search customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!customerForm.name || !customerForm.phone) {
      alert('Please fill in name and phone');
      return;
    }

    try {
      const response = await api.post('/api/v1/customers', {
        name: customerForm.name,
        phone: customerForm.phone,
        email: customerForm.email || undefined,
      });
      await loadCustomers();
      setShowCustomerModal(false);
      setCustomerForm({ name: '', phone: '', email: '' });
      setSelectedCustomer(response.data);
      alert('Customer added successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create customer');
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer || !customerForm.name || !customerForm.phone) {
      alert('Please fill in name and phone');
      return;
    }

    try {
      const response = await api.post('/api/v1/customers', {
        name: customerForm.name,
        phone: customerForm.phone,
        email: customerForm.email || undefined,
      });
      await loadCustomers();
      setShowCustomerModal(false);
      setEditingCustomer(null);
      setCustomerForm({ name: '', phone: '', email: '' });
      setSelectedCustomer(response.data);
      alert('Customer updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update customer');
    }
  };

  const handleAddAddress = async () => {
    if (!selectedCustomer) {
      alert('Please select a customer first');
      return;
    }

    if (!addressForm.label || !addressForm.line1 || !addressForm.city || !addressForm.state || !addressForm.zip) {
      alert('Please fill in all required address fields');
      return;
    }

    try {
      await api.post(`/api/v1/customers/${selectedCustomer.id}/addresses`, addressForm);
      await loadCustomers();
      // Reload selected customer with addresses
      const response = await api.get(`/api/v1/customers?phone=${selectedCustomer.phone}`);
      if (response.data) {
        setSelectedCustomer(response.data);
      }
      setShowAddressModal(false);
      setAddressForm({ label: '', line1: '', line2: '', city: '', state: '', zip: '' });
      alert('Address added successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add address');
    }
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
    });
    setShowCustomerModal(true);
  };

  const openNewCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({ name: '', phone: '', email: '' });
    setShowCustomerModal(true);
  };

  const loadPurchaseHistory = async () => {
    if (!selectedCustomer) return;
    setLoadingHistory(true);
    try {
      const response = await api.get(`/api/v1/customers/${selectedCustomer.id}/purchase-history`);
      setPurchaseHistory(response.data.sales);
      setShowPurchaseHistory(true);
    } catch (error: any) {
      console.error('Failed to load purchase history:', error);
      alert(error.response?.data?.error || 'Failed to load purchase history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadLoyaltyInfo = async () => {
    if (!selectedCustomer) return;
    setLoadingLoyalty(true);
    try {
      const response = await api.get(`/api/v1/customers/${selectedCustomer.id}/loyalty`);
      setLoyaltyInfo(response.data);
      setShowLoyaltyModal(true);
    } catch (error: any) {
      console.error('Failed to load loyalty info:', error);
      alert(error.response?.data?.error || 'Failed to load loyalty information');
    } finally {
      setLoadingLoyalty(false);
    }
  };

  const handleRedeemPoints = async () => {
    if (!selectedCustomer || !loyaltyForm.points || !loyaltyForm.description) {
      alert('Please fill in points and description');
      return;
    }

    try {
      await api.post(`/api/v1/customers/${selectedCustomer.id}/loyalty/redeem`, {
        points: loyaltyForm.points,
        description: loyaltyForm.description,
      });
      alert('Points redeemed successfully!');
      setLoyaltyForm({ points: 0, description: '' });
      setLoyaltyAction(null);
      await loadLoyaltyInfo();
      // Reload customer to update points
      const response = await api.get(`/api/v1/customers?phone=${selectedCustomer.phone}`);
      if (response.data) {
        setSelectedCustomer(response.data);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to redeem points');
    }
  };

  const handleAdjustPoints = async () => {
    if (!selectedCustomer || !loyaltyForm.description) {
      alert('Please fill in description');
      return;
    }

    try {
      await api.post(`/api/v1/customers/${selectedCustomer.id}/loyalty/adjust`, {
        points: loyaltyForm.points,
        description: loyaltyForm.description,
      });
      alert('Points adjusted successfully!');
      setLoyaltyForm({ points: 0, description: '' });
      setLoyaltyAction(null);
      await loadLoyaltyInfo();
      // Reload customer to update points
      const response = await api.get(`/api/v1/customers?phone=${selectedCustomer.phone}`);
      if (response.data) {
        setSelectedCustomer(response.data);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to adjust points');
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h1 className="text-xl sm:text-2xl font-bold">Customers</h1>
            <button
              onClick={openNewCustomer}
              className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm sm:text-base"
            >
              + Add Customer
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Search by phone..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm sm:text-base dark:placeholder-gray-400"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm sm:text-base"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="space-y-2">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedCustomer?.id === customer.id ? 'border-primary-500 bg-primary-50' : ''
                  }`}
                >
                  <div className="font-semibold">{customer.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">{customer.phone}</div>
                  {customer.email && <div className="text-sm text-gray-500 dark:text-gray-400">{customer.email}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
        {selectedCustomer && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Customer Details</h2>
              <button
                onClick={() => openEditCustomer(selectedCustomer)}
                className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Edit
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-sm text-gray-600 dark:text-gray-300">Name</div>
                <div className="text-lg">{selectedCustomer.name}</div>
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-600">Phone</div>
                <div className="text-lg">{selectedCustomer.phone}</div>
              </div>
              {selectedCustomer.email && (
                <div>
                  <div className="font-semibold text-sm text-gray-600">Email</div>
                  <div className="text-lg">{selectedCustomer.email}</div>
                </div>
              )}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold">Addresses</div>
                  <button
                    onClick={() => setShowAddressModal(true)}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    + Add Address
                  </button>
                </div>
                {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                  selectedCustomer.addresses.map((addr) => (
                    <div key={addr.id} className="mb-2 p-3 bg-gray-50 rounded">
                      <div className="font-medium">{addr.label}</div>
                      <div className="text-sm text-gray-600">{addr.line1}, {addr.city}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No addresses added</p>
                )}
              </div>
              {/* Loyalty Information */}
              <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold text-lg">Loyalty Program</div>
                  <button
                    onClick={loadLoyaltyInfo}
                    className="text-sm text-primary-600 hover:underline"
                    disabled={loadingLoyalty}
                  >
                    {loadingLoyalty ? 'Loading...' : 'View Details'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Points</div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {selectedCustomer.loyaltyPoints || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Tier</div>
                    <div className="text-lg font-semibold capitalize text-orange-600 dark:text-orange-400">
                      {selectedCustomer.loyaltyTier || 'BRONZE'}
                    </div>
                  </div>
                </div>
                {selectedCustomer.totalSpent !== undefined && (
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Total Spent: ₹{selectedCustomer.totalSpent.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Purchase History & Loyalty Actions */}
              <div className="flex gap-2">
                <button
                  onClick={loadPurchaseHistory}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
                  disabled={loadingHistory}
                >
                  {loadingHistory ? 'Loading...' : '📋 Purchase History'}
                </button>
                <button
                  onClick={() => {
                    setLoyaltyAction('redeem');
                    setLoyaltyForm({ points: 0, description: '' });
                    setShowLoyaltyModal(true);
                  }}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm"
                >
                  🎁 Redeem Points
                </button>
              </div>

              {selectedCustomer.sales && selectedCustomer.sales.length > 0 && (
                <div>
                  <div className="font-semibold mb-2">Recent Purchases</div>
                  <div className="space-y-2">
                    {selectedCustomer.sales.slice(0, 5).map((sale) => (
                      <div key={sale.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded flex justify-between">
                        <div>
                          <div className="font-medium">{sale.saleNo}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(sale.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="font-semibold">₹{sale.grandTotal.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingCustomer ? 'Edit Customer' : 'Add Customer'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Customer name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="10 digit phone number"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="customer@example.com"
                />
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setEditingCustomer(null);
                    setCustomerForm({ name: '', phone: '', email: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  {editingCustomer ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Add Address</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
                <input
                  type="text"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Home, Office, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  value={addressForm.line1}
                  onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Street address"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={addressForm.line2}
                  onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Apartment, suite, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input
                    type="text"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code *</label>
                <input
                  type="text"
                  value={addressForm.zip}
                  onChange={(e) => setAddressForm({ ...addressForm, zip: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowAddressModal(false);
                    setAddressForm({ label: '', line1: '', line2: '', city: '', state: '', zip: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAddress}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  Add Address
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase History Modal */}
      {showPurchaseHistory && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Purchase History - {selectedCustomer.name}</h2>
              <button
                onClick={() => setShowPurchaseHistory(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            {purchaseHistory.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No purchase history found</p>
            ) : (
              <div className="space-y-4">
                {purchaseHistory.map((sale) => (
                  <div key={sale.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-lg">{sale.saleNo}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(sale.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">₹{sale.grandTotal.toFixed(2)}</div>
                        {sale.discountTotal > 0 && (
                          <div className="text-sm text-green-600 dark:text-green-400">
                            Discount: ₹{sale.discountTotal.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="font-medium mb-2">Items:</div>
                      <div className="space-y-1">
                        {sale.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>
                              {item.product.name} ×{' '}
                              {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`}
                            </span>
                            <span className="font-medium">₹{item.lineTotal.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm">
                      {sale.payments.map((payment, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          {payment.method}: ₹{payment.amount.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loyalty Modal */}
      {showLoyaltyModal && loyaltyInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Loyalty Information</h2>
              <button
                onClick={() => {
                  setShowLoyaltyModal(false);
                  setLoyaltyAction(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {loyaltyAction ? (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold capitalize">
                  {loyaltyAction === 'redeem' ? 'Redeem Points' : 'Adjust Points'}
                </h3>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Points {loyaltyAction === 'redeem' ? 'to Redeem' : 'Adjustment'} *
                  </label>
                  <input
                    type="number"
                    value={loyaltyForm.points || ''}
                    onChange={(e) =>
                      setLoyaltyForm({ ...loyaltyForm, points: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    placeholder="Enter points"
                    min={loyaltyAction === 'redeem' ? 1 : undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <textarea
                    value={loyaltyForm.description}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    rows={3}
                    placeholder="Enter description"
                  />
                </div>
                {loyaltyAction === 'redeem' && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Current Balance: {loyaltyInfo.customer.loyaltyPoints} points
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLoyaltyAction(null);
                      setLoyaltyForm({ points: 0, description: '' });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={loyaltyAction === 'redeem' ? handleRedeemPoints : handleAdjustPoints}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                  >
                    {loyaltyAction === 'redeem' ? 'Redeem' : 'Adjust'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Points</div>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                      {loyaltyInfo.customer.loyaltyPoints}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Tier</div>
                    <div className="text-xl font-semibold capitalize text-orange-600 dark:text-orange-400">
                      {loyaltyInfo.customer.loyaltyTier}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Spent</div>
                    <div className="text-xl font-semibold">₹{loyaltyInfo.customer.totalSpent.toFixed(2)}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Transaction History</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setLoyaltyAction('redeem');
                          setLoyaltyForm({ points: 0, description: '' });
                        }}
                        className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                      >
                        Redeem
                      </button>
                    </div>
                  </div>
                  {loyaltyInfo.transactions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No transactions yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {loyaltyInfo.transactions.map((tx: LoyaltyTransaction) => (
                        <div
                          key={tx.id}
                          className="p-3 bg-gray-50 dark:bg-gray-700 rounded flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium">{tx.description || tx.type}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(tx.createdAt).toLocaleString()}
                            </div>
                            {tx.sale && (
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                Sale: {tx.sale.saleNo}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-semibold ${
                                tx.points > 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {tx.points > 0 ? '+' : ''}
                              {tx.points}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Balance: {tx.balance}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

