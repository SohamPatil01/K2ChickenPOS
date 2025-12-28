'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';

export default function ProcurementPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'suppliers' | 'pos' | 'inward' | 'allocation'>('suppliers');
  const [loading, setLoading] = useState(false);

  // Suppliers
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    gstin: '',
  });

  // Central POs
  const [centralPOs, setCentralPOs] = useState<any[]>([]);
  const [showPOModal, setShowPOModal] = useState(false);
  const [poForm, setPOForm] = useState({
    supplierId: '',
    poNo: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDate: '',
    notes: '',
    items: [] as any[],
  });

  // Inward Stock
  const [inwardStocks, setInwardStocks] = useState<any[]>([]);
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [inwardForm, setInwardForm] = useState({
    centralPOId: '',
    supplierId: '',
    productId: '',
    batchNo: '',
    totalWeightKg: 0,
    temperatureCheck: 0,
    notes: '',
  });

  // Stock Allocations
  const [allocations, setAllocations] = useState<any[]>([]);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [allocationForm, setAllocationForm] = useState({
    centralPOId: '',
    inwardStockId: '',
    franchiseStoreId: '',
    productId: '',
    allocatedQtyKg: 0,
    allocatedQtyPcs: 0,
    notes: '',
  });

  const [products, setProducts] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'suppliers') {
        const res = await api.get('/api/v1/hq/suppliers');
        setSuppliers(res.data);
      } else if (activeTab === 'pos') {
        const res = await api.get('/api/v1/hq/central-pos');
        setCentralPOs(res.data);
      } else if (activeTab === 'inward') {
        const res = await api.get('/api/v1/hq/inward-stock');
        setInwardStocks(res.data);
      } else if (activeTab === 'allocation') {
        const res = await api.get('/api/v1/hq/stock-allocations');
        setAllocations(res.data);
      }

      // Load common data
      const [productsRes, franchisesRes] = await Promise.all([
        api.get('/api/v1/products'),
        api.get('/api/v1/stores/franchises'),
      ]);
      setProducts(productsRes.data);
      setFranchises(franchisesRes.data);
    } catch (error: any) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    try {
      await api.post('/api/v1/hq/suppliers', supplierForm);
      setShowSupplierModal(false);
      setSupplierForm({
        name: '',
        contactName: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        gstin: '',
      });
      await loadData();
      alert('Supplier created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create supplier');
    }
  };

  const handleCreatePO = async () => {
    if (!poForm.supplierId || poForm.items.length === 0) {
      alert('Please select supplier and add items');
      return;
    }
    try {
      await api.post('/api/v1/hq/central-pos', poForm);
      setShowPOModal(false);
      setPOForm({
        supplierId: '',
        poNo: '',
        orderDate: new Date().toISOString().split('T')[0],
        expectedDate: '',
        notes: '',
        items: [],
      });
      await loadData();
      alert('Purchase Order created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create PO');
    }
  };

  const handleCreateInwardStock = async () => {
    try {
      await api.post('/api/v1/hq/inward-stock', inwardForm);
      setShowInwardModal(false);
      setInwardForm({
        centralPOId: '',
        supplierId: '',
        productId: '',
        batchNo: '',
        totalWeightKg: 0,
        temperatureCheck: 0,
        notes: '',
      });
      await loadData();
      alert('Inward stock recorded successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to record inward stock');
    }
  };

  const handleCreateAllocation = async () => {
    try {
      await api.post('/api/v1/hq/stock-allocations', allocationForm);
      setShowAllocationModal(false);
      setAllocationForm({
        centralPOId: '',
        inwardStockId: '',
        franchiseStoreId: '',
        productId: '',
        allocatedQtyKg: 0,
        allocatedQtyPcs: 0,
        notes: '',
      });
      await loadData();
      alert('Stock allocation created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create allocation');
    }
  };

  const addPOItem = () => {
    setPOForm({
      ...poForm,
      items: [...poForm.items, { productId: '', qtyKg: 0, qtyPcs: 0, unitRate: 0 }],
    });
  };

  const removePOItem = (index: number) => {
    setPOForm({
      ...poForm,
      items: poForm.items.filter((_, i) => i !== index),
    });
  };

  if (loading && suppliers.length === 0 && centralPOs.length === 0) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold dark:text-white">Central Procurement</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage suppliers, purchase orders, inward stock, and allocations</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'suppliers', label: 'Suppliers', icon: '👥' },
              { id: 'pos', label: 'Purchase Orders', icon: '📋' },
              { id: 'inward', label: 'Inward Stock', icon: '📥' },
              { id: 'allocation', label: 'Stock Allocation', icon: '📦' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <div>
            <div className="mb-4 flex justify-end">
              <Button variant="primary" onClick={() => setShowSupplierModal(true)}>
                + Add Supplier
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {suppliers.map((supplier) => (
                <Card key={supplier.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold dark:text-white">{supplier.name}</h3>
                      {supplier.contactName && <p className="text-sm text-gray-600 dark:text-gray-400">Contact: {supplier.contactName}</p>}
                      {supplier.phone && <p className="text-sm text-gray-600 dark:text-gray-400">Phone: {supplier.phone}</p>}
                      {supplier.email && <p className="text-sm text-gray-600 dark:text-gray-400">Email: {supplier.email}</p>}
                      {supplier.address && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {supplier.address}, {supplier.city}, {supplier.state} {supplier.zip}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${supplier.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {supplier.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Purchase Orders Tab */}
        {activeTab === 'pos' && (
          <div>
            <div className="mb-4 flex justify-end">
              <Button variant="primary" onClick={() => setShowPOModal(true)}>
                + Create PO
              </Button>
            </div>
            <div className="space-y-4">
              {centralPOs.map((po) => (
                <Card key={po.id}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold dark:text-white">PO #{po.poNo}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Supplier: {po.supplier.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Date: {new Date(po.orderDate).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      po.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                      po.status === 'DISPATCHED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {po.status}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-semibold dark:text-white mb-2">Items:</p>
                    <div className="space-y-2">
                      {po.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                          <span className="dark:text-white">{item.product.name}</span>
                          <span className="dark:text-white">
                            {item.qtyKg || 0} kg / {item.qtyPcs || 0} pcs @ ₹{item.unitRate}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm font-semibold dark:text-white mt-4">Total: ₹{po.totalAmount.toLocaleString()}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Inward Stock Tab */}
        {activeTab === 'inward' && (
          <div>
            <div className="mb-4 flex justify-end">
              <Button variant="primary" onClick={() => setShowInwardModal(true)}>
                + Record Inward Stock
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Weight (kg)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Temperature</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {inwardStocks.map((stock) => (
                    <tr key={stock.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{stock.product.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{stock.supplier.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{stock.totalWeightKg}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{stock.batchNo || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{stock.temperatureCheck ? `${stock.temperatureCheck}°C` : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(stock.receivedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stock Allocation Tab */}
        {activeTab === 'allocation' && (
          <div>
            <div className="mb-4 flex justify-end">
              <Button variant="primary" onClick={() => setShowAllocationModal(true)}>
                + Allocate Stock
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Franchise</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {allocations.map((allocation) => (
                    <tr key={allocation.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{allocation.franchiseStore.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{allocation.product.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {allocation.allocatedQtyKg} kg / {allocation.allocatedQtyPcs || 0} pcs
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          allocation.status === 'DELIVERED' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                          allocation.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {allocation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(allocation.allocatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Supplier Modal */}
        {showSupplierModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Add Supplier</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input
                    type="text"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  <input
                    type="text"
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                    <input
                      type="text"
                      value={supplierForm.city}
                      onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                    <input
                      type="text"
                      value={supplierForm.state}
                      onChange={(e) => setSupplierForm({ ...supplierForm, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={supplierForm.gstin}
                    onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowSupplierModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreateSupplier} className="flex-1">
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PO Modal */}
        {showPOModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Create Purchase Order</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier *</label>
                  <select
                    value={poForm.supplierId}
                    onChange={(e) => setPOForm({ ...poForm, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="">Select supplier</option>
                    {suppliers.filter(s => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order Date</label>
                  <input
                    type="date"
                    value={poForm.orderDate}
                    onChange={(e) => setPOForm({ ...poForm, orderDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Date</label>
                  <input
                    type="date"
                    value={poForm.expectedDate}
                    onChange={(e) => setPOForm({ ...poForm, expectedDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Items *</label>
                  <Button variant="secondary" size="sm" onClick={addPOItem} className="mb-2">
                    + Add Item
                  </Button>
                  <div className="space-y-2">
                    {poForm.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-end bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[idx].productId = e.target.value;
                            setPOForm({ ...poForm, items: newItems });
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                        >
                          <option value="">Select product</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Qty (kg)"
                          value={item.qtyKg || ''}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[idx].qtyKg = parseFloat(e.target.value) || 0;
                            setPOForm({ ...poForm, items: newItems });
                          }}
                          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                          step="0.01"
                        />
                        <input
                          type="number"
                          placeholder="Rate"
                          value={item.unitRate || ''}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[idx].unitRate = parseFloat(e.target.value) || 0;
                            setPOForm({ ...poForm, items: newItems });
                          }}
                          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                          step="0.01"
                        />
                        <button
                          onClick={() => removePOItem(idx)}
                          className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowPOModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreatePO} className="flex-1">
                    Create PO
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inward Stock Modal */}
        {showInwardModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Record Inward Stock</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier *</label>
                  <select
                    value={inwardForm.supplierId}
                    onChange={(e) => setInwardForm({ ...inwardForm, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="">Select supplier</option>
                    {suppliers.filter(s => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product *</label>
                  <select
                    value={inwardForm.productId}
                    onChange={(e) => setInwardForm({ ...inwardForm, productId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Weight (kg) *</label>
                  <input
                    type="number"
                    value={inwardForm.totalWeightKg || ''}
                    onChange={(e) => setInwardForm({ ...inwardForm, totalWeightKg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch No</label>
                  <input
                    type="text"
                    value={inwardForm.batchNo}
                    onChange={(e) => setInwardForm({ ...inwardForm, batchNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature Check (°C)</label>
                  <input
                    type="number"
                    value={inwardForm.temperatureCheck || ''}
                    onChange={(e) => setInwardForm({ ...inwardForm, temperatureCheck: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    step="0.1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowInwardModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreateInwardStock} className="flex-1">
                    Record
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Allocation Modal */}
        {showAllocationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Allocate Stock to Franchise</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Franchise *</label>
                  <select
                    value={allocationForm.franchiseStoreId}
                    onChange={(e) => setAllocationForm({ ...allocationForm, franchiseStoreId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="">Select franchise</option>
                    {franchises.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product *</label>
                  <select
                    value={allocationForm.productId}
                    onChange={(e) => setAllocationForm({ ...allocationForm, productId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allocated Quantity (kg) *</label>
                  <input
                    type="number"
                    value={allocationForm.allocatedQtyKg || ''}
                    onChange={(e) => setAllocationForm({ ...allocationForm, allocatedQtyKg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    step="0.01"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowAllocationModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreateAllocation} className="flex-1">
                    Allocate
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </HQLayout>
  );
}

