'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StoreLayout from '@/components/StoreLayout';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface PO {
  id: string;
  poNo: string;
  status: string;
  createdAt: string;
  franchiseStore?: { name: string };
  ownerStore?: { name: string };
  items: Array<{
    id: string;
    product: { name: string; unitType?: 'KG' | 'PCS' };
    qtyKg?: number;
    qtyPcs?: number;
    receivedQtyKg?: number | null;
    receivedQtyPcs?: number | null;
    requestedRate?: number;
  }>;
  dispatch?: {
    id: string;
    dispatchNo: string;
    status: string;
    items: Array<{
      product: { name: string };
      qtyKg?: number;
      qtyPcs?: number;
    }>;
  };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unitType: 'KG' | 'PCS';
  pricePerUnit: number;
}

interface POItem {
  productId: string;
  productName: string;
  qtyKg?: number;
  qtyPcs?: number;
  requestedRate: number;
}

export default function POPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditReceivedModal, setShowEditReceivedModal] = useState(false);
  const [editingReceivedItems, setEditingReceivedItems] = useState<Array<{
    itemId: string;
    productName: string;
    originalQtyKg?: number;
    originalQtyPcs?: number;
    receivedQtyKg?: number | null;
    receivedQtyPcs?: number | null;
    unitType?: 'KG' | 'PCS';
  }>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [poNotes, setPoNotes] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemForm, setItemForm] = useState({
    qtyKg: '',
    qtyPcs: '',
    requestedRate: '',
  });

  useEffect(() => {
    // Wait for user to load
    if (user === undefined) {
      return; // Still loading
    }

    if (!user) {
      router.push('/login');
      return;
    }

    // Only MANAGER and OWNER can access purchase orders
    if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
      alert('Access denied. Only Managers and Owners can access purchase orders.');
      router.push('/pos');
      return;
    }

    // Only load POs if user is valid and has correct role
    if (user && (user.role === 'MANAGER' || user.role === 'OWNER')) {
      loadPOs();
      if (showCreateModal) {
        loadProducts();
      }
    }
  }, [user, showCreateModal, router]);

  const loadPOs = async () => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      const response = await api.get('/api/v1/po', {
        params: { _t: timestamp },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      setPos(response.data || []);
      // Also update selectedPO if it exists
      if (selectedPO) {
        const updatedPO = response.data?.find((p: PO) => p.id === selectedPO.id);
        if (updatedPO) {
          setSelectedPO(updatedPO);
        }
      }
    } catch (error) {
      console.error('Failed to load POs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (poId: string, action: string) => {
    try {
      const response = await api.post(`/api/v1/po/${poId}/${action}`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Force reload with a small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadPOs();
      const actionName = action.charAt(0).toUpperCase() + action.slice(1);
      if (action === 'approve') {
        alert(`${actionName} completed successfully! Inventory will be added when you finalize the PO after editing received quantities.`);
      } else {
        alert(`${actionName} completed successfully!`);
      }
    } catch (error: any) {
      console.error(`Failed to ${action} PO:`, error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Action failed';
      alert(`Failed to ${action} PO: ${errorMessage}`);
    }
  };

  const handleReceiveDispatch = async (dispatchId: string) => {
    if (!confirm('Receive this dispatch? You can edit received quantities before finalizing.')) {
      return;
    }
    try {
      await api.post(`/api/v1/po/dispatch/${dispatchId}/receive`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Force reload with a small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadPOs();
      alert('Dispatch received! You can now edit received quantities to account for shrinkage.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to receive dispatch');
    }
  };

  const handleEditReceivedQuantities = (po: PO) => {
    if (po.status !== 'RECEIVED' && po.status !== 'DISPATCHED') {
      alert('Can only edit received quantities for RECEIVED or DISPATCHED POs');
      return;
    }

    setSelectedPO(po);
    setEditingReceivedItems(
      po.items.map((item) => ({
        itemId: item.id,
        productName: item.product?.name || 'Unknown',
        originalQtyKg: item.qtyKg,
        originalQtyPcs: item.qtyPcs,
        receivedQtyKg: item.receivedQtyKg !== undefined ? item.receivedQtyKg : item.qtyKg,
        receivedQtyPcs: item.receivedQtyPcs !== undefined ? item.receivedQtyPcs : item.qtyPcs,
        unitType: item.product?.unitType,
      }))
    );
    setShowEditReceivedModal(true);
  };

  const handleUpdateReceivedQuantities = async () => {
    if (!selectedPO) return;

    try {
      const items = editingReceivedItems.map((item) => ({
        itemId: item.itemId,
        receivedQtyKg: item.receivedQtyKg !== undefined && item.receivedQtyKg !== null ? item.receivedQtyKg : null,
        receivedQtyPcs: item.receivedQtyPcs !== undefined && item.receivedQtyPcs !== null ? item.receivedQtyPcs : null,
      }));

      await api.put(`/api/v1/po/${selectedPO.id}/receive`, { items });
      // Force reload with a small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadPOs();
      setShowEditReceivedModal(false);
      setSelectedPO(null);
      setEditingReceivedItems([]);
      alert('Received quantities updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update received quantities');
    }
  };

  const handleFinalizePO = async (poId: string) => {
    if (!confirm('Finalize this PO? This will add the received stock to inventory. This action cannot be undone.')) {
      return;
    }

    try {
      await api.post(`/api/v1/po/${poId}/finalize`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Force reload with a small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadPOs();
      // Close modals if open
      setShowViewModal(false);
      setShowEditReceivedModal(false);
      setSelectedPO(null);
      // Dispatch event to notify inventory page to refresh
      window.dispatchEvent(new Event('po-finalized'));
      alert('PO finalized! Stock has been added to inventory.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to finalize PO');
    }
  };

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/v1/products');
      setProducts(response.data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleAddPOItem = () => {
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    const qtyKg = parseFloat(itemForm.qtyKg) || 0;
    const qtyPcs = parseFloat(itemForm.qtyPcs) || 0;
    const requestedRate = parseFloat(itemForm.requestedRate) || selectedProduct.pricePerUnit;

    if (selectedProduct.unitType === 'KG' && qtyKg <= 0) {
      alert('Please enter quantity');
      return;
    }
    if (selectedProduct.unitType === 'PCS' && qtyPcs <= 0) {
      alert('Please enter quantity');
      return;
    }

    setPoItems([
      ...poItems,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        qtyKg: selectedProduct.unitType === 'KG' ? qtyKg : undefined,
        qtyPcs: selectedProduct.unitType === 'PCS' ? qtyPcs : undefined,
        requestedRate,
      },
    ]);

    setSelectedProduct(null);
    setItemForm({ qtyKg: '', qtyPcs: '', requestedRate: '' });
  };

  const handleRemovePOItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleCreatePO = async () => {
    if (poItems.length === 0) {
      alert('Please add at least one item to the PO');
      return;
    }

    try {
      // API will use default owner store if not provided
      await api.post('/api/v1/po', {
        items: poItems.map((item) => ({
          productId: item.productId,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          requestedRate: item.requestedRate,
        })),
        notes: poNotes || undefined,
      });

      // Force reload with a small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadPOs();
      setShowCreateModal(false);
      setPoItems([]);
      setPoNotes('');
      setSelectedProduct(null);
      setItemForm({ qtyKg: '', qtyPcs: '', requestedRate: '' });
      alert('Purchase Order created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create PO');
    }
  };

  const openCreateModal = () => {
    if (user?.role !== 'MANAGER' && user?.role !== 'OWNER') {
      alert('Only Managers and Owners can create Purchase Orders');
      return;
    }
    setShowCreateModal(true);
    loadProducts();
  };

  return (
    <StoreLayout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <div className="flex gap-2">
          {(user?.role === 'MANAGER' || user?.role === 'OWNER') && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              + Create PO
            </button>
          )}
          <button
            onClick={loadPOs}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Refresh
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispatch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center">Loading...</td>
              </tr>
            ) : pos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">No purchase orders</td>
              </tr>
            ) : (
              pos.map((po) => (
                <tr 
                  key={po.id}
                  onClick={() => {
                    setSelectedPO(po);
                    setShowViewModal(true);
                  }}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{po.poNo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {po.franchiseStore?.name || po.ownerStore?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs ${
                      po.status === 'APPROVED' ? 'bg-primary-100 text-primary-800' :
                      po.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      po.status === 'DISPATCHED' ? 'bg-primary-200 text-primary-800' :
                      po.status === 'RECEIVED' ? 'bg-primary-100 text-primary-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {po.items.length} item(s)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {po.dispatch ? (
                      <span className="text-blue-600">{po.dispatch.dispatchNo}</span>
                    ) : (
                      <span className="text-gray-400">No dispatch</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(po.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2" onClick={(e) => e.stopPropagation()}>
                    {po.status === 'DRAFT' && (
                      <>
                        {user?.role !== 'OWNER' && (
                          <button
                            onClick={() => handleAction(po.id, 'submit')}
                            className="px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm font-medium"
                          >
                            Submit
                          </button>
                        )}
                        {user?.role === 'OWNER' && (
                          <>
                            <button
                              onClick={() => handleAction(po.id, 'submit')}
                              className="px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm font-medium mr-2"
                            >
                              Submit
                            </button>
                            <button
                              onClick={() => handleAction(po.id, 'approve')}
                              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                            >
                              Approve
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {po.status === 'SUBMITTED' && user?.role === 'OWNER' && (
                      <>
                        <button
                          onClick={() => handleAction(po.id, 'approve')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium mr-2"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(po.id, 'reject')}
                          className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {po.status === 'APPROVED' && user?.role === 'OWNER' && (
                      <button
                        onClick={() => handleAction(po.id, 'dispatch')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Dispatch
                      </button>
                    )}
                    {po.dispatch && po.dispatch.status === 'CREATED' && user?.role !== 'OWNER' && (
                      <button
                        onClick={() => handleReceiveDispatch(po.dispatch!.id)}
                        className="text-accent-600 hover:text-accent-800 font-semibold"
                      >
                        Receive
                      </button>
                    )}
                    {(po.status === 'RECEIVED' || po.status === 'DISPATCHED') && (
                      <>
                        <button
                          onClick={() => handleEditReceivedQuantities(po)}
                          className="px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors text-sm font-medium mr-2"
                        >
                          Edit Received
                        </button>
                        <button
                          onClick={() => handleFinalizePO(po.id)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          Finalize
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create PO Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create Purchase Order</h2>
            
            {/* Add Item Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-3">Add Item</h3>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                  <select
                    value={selectedProduct?.id || ''}
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value);
                      setSelectedProduct(product || null);
                      if (product) {
                        setItemForm({
                          qtyKg: '',
                          qtyPcs: '',
                          requestedRate: product.pricePerUnit.toString(),
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {selectedProduct?.unitType === 'KG' ? 'Quantity (kg)' : 'Quantity (pcs)'}
                  </label>
                  <input
                    type="number"
                    value={selectedProduct?.unitType === 'KG' ? itemForm.qtyKg : itemForm.qtyPcs}
                    onChange={(e) => {
                      if (selectedProduct?.unitType === 'KG') {
                        setItemForm({ ...itemForm, qtyKg: e.target.value });
                      } else {
                        setItemForm({ ...itemForm, qtyPcs: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder={selectedProduct?.unitType === 'KG' ? '0.00' : '0'}
                    step={selectedProduct?.unitType === 'KG' ? '0.01' : '1'}
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requested Rate</label>
                  <input
                    type="number"
                    value={itemForm.requestedRate}
                    onChange={(e) => setItemForm({ ...itemForm, requestedRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddPOItem}
                    disabled={!selectedProduct}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* PO Items List */}
            {poItems.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">PO Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Rate</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {poItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm">{item.productName}</td>
                          <td className="px-4 py-2 text-sm">
                            {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`}
                          </td>
                          <td className="px-4 py-2 text-sm">₹{item.requestedRate.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm font-semibold">
                            ₹{((item.qtyKg || item.qtyPcs || 0) * item.requestedRate).toFixed(2)}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleRemovePOItem(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Add any notes about this purchase order..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setPoItems([]);
                  setPoNotes('');
                  setSelectedProduct(null);
                  setItemForm({ qtyKg: '', qtyPcs: '', requestedRate: '' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePO}
                disabled={poItems.length === 0}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
              >
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View PO Details Modal */}
      {showViewModal && selectedPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold dark:text-white mb-2">Purchase Order Details</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">PO Number: <span className="font-semibold dark:text-white">{selectedPO.poNo}</span></p>
                </div>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedPO(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* PO Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Store</label>
                  <p className="text-base font-semibold dark:text-white mt-1">
                    {selectedPO.franchiseStore?.name || selectedPO.ownerStore?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <p className="mt-1">
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      selectedPO.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                      selectedPO.status === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                      selectedPO.status === 'DISPATCHED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                      selectedPO.status === 'RECEIVED' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' :
                      selectedPO.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {selectedPO.status}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Date</label>
                  <p className="text-base dark:text-white mt-1">
                    {new Date(selectedPO.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
                {selectedPO.dispatch && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Dispatch</label>
                    <p className="text-base font-semibold text-blue-600 dark:text-blue-400 mt-1">
                      {selectedPO.dispatch.dispatchNo}
                    </p>
                  </div>
                )}
              </div>

              {/* PO Items */}
              <div>
                <h3 className="text-lg font-semibold dark:text-white mb-4">Items ({selectedPO.items.length})</h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ordered Qty</th>
                        {(selectedPO.status === 'RECEIVED' || selectedPO.status === 'DISPATCHED' || selectedPO.status === 'CLOSED') && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Received Qty</th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Requested Rate</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedPO.items.map((item, index) => {
                        const orderedQty = item.qtyKg || item.qtyPcs || 0;
                        const receivedQty = item.receivedQtyKg !== undefined && item.receivedQtyKg !== null 
                          ? item.receivedQtyKg 
                          : (item.receivedQtyPcs !== undefined && item.receivedQtyPcs !== null 
                            ? item.receivedQtyPcs 
                            : null);
                        const qty = receivedQty !== null ? receivedQty : orderedQty;
                        const rate = item.requestedRate || 0;
                        const total = qty * rate;
                        const hasShrinkage = receivedQty !== null && receivedQty < orderedQty;
                        return (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-sm font-medium dark:text-white">
                              {item.product?.name || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`}
                            </td>
                            {(selectedPO.status === 'RECEIVED' || selectedPO.status === 'DISPATCHED' || selectedPO.status === 'CLOSED') && (
                              <td className="px-4 py-3 text-sm">
                                {receivedQty !== null ? (
                                  <span className={hasShrinkage ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-300'}>
                                    {item.receivedQtyKg !== undefined && item.receivedQtyKg !== null 
                                      ? `${item.receivedQtyKg} kg` 
                                      : `${item.receivedQtyPcs} pcs`}
                                    {hasShrinkage && (
                                      <span className="ml-2 text-xs">(Shrinkage: {item.qtyKg 
                                        ? `${((item.qtyKg - (item.receivedQtyKg || 0)) / item.qtyKg * 100).toFixed(1)}%`
                                        : `${((item.qtyPcs || 0) - (item.receivedQtyPcs || 0))} pcs`})</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">Not set</span>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              ₹{rate.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold dark:text-white">
                              ₹{total.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <td colSpan={selectedPO.status === 'RECEIVED' || selectedPO.status === 'DISPATCHED' || selectedPO.status === 'CLOSED' ? 4 : 3} className="px-4 py-3 text-sm font-semibold text-right dark:text-white">
                          Grand Total:
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-lg dark:text-white">
                          ₹{selectedPO.items.reduce((sum, item) => {
                            const orderedQty = item.qtyKg || item.qtyPcs || 0;
                            const receivedQty = item.receivedQtyKg !== undefined && item.receivedQtyKg !== null 
                              ? item.receivedQtyKg 
                              : (item.receivedQtyPcs !== undefined && item.receivedQtyPcs !== null 
                                ? item.receivedQtyPcs 
                                : null);
                            const qty = receivedQty !== null ? receivedQty : orderedQty;
                            const rate = item.requestedRate || 0;
                            return sum + (qty * rate);
                          }, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              {(selectedPO.status === 'RECEIVED' || selectedPO.status === 'DISPATCHED') && (
                <>
                  <button
                    onClick={() => handleEditReceivedQuantities(selectedPO)}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                  >
                    Edit Received Quantities
                  </button>
                  <button
                    onClick={() => handleFinalizePO(selectedPO.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Finalize PO
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedPO(null);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Received Quantities Modal */}
      {showEditReceivedModal && selectedPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold dark:text-white mb-2">Edit Received Quantities</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    PO Number: <span className="font-semibold dark:text-white">{selectedPO.poNo}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Update quantities to account for shrinkage. Both original and received quantities will be recorded.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowEditReceivedModal(false);
                    setSelectedPO(null);
                    setEditingReceivedItems([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {editingReceivedItems.map((item, index) => (
                  <div key={item.itemId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold dark:text-white">{item.productName}</h4>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Ordered: {item.originalQtyKg ? `${item.originalQtyKg} kg` : `${item.originalQtyPcs} pcs`}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {item.unitType === 'KG' || item.originalQtyKg ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Received Quantity (kg)
                          </label>
                          <input
                            type="number"
                            value={item.receivedQtyKg !== undefined && item.receivedQtyKg !== null ? item.receivedQtyKg : ''}
                            onChange={(e) => {
                              const newItems = [...editingReceivedItems];
                              newItems[index].receivedQtyKg = e.target.value === '' ? null : parseFloat(e.target.value);
                              setEditingReceivedItems(newItems);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            placeholder="Enter received quantity"
                            step="0.01"
                            min="0"
                          />
                          {item.receivedQtyKg !== null && item.receivedQtyKg !== undefined && item.originalQtyKg && item.receivedQtyKg < item.originalQtyKg && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              Shrinkage: {((item.originalQtyKg - item.receivedQtyKg) / item.originalQtyKg * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Received Quantity (pcs)
                          </label>
                          <input
                            type="number"
                            value={item.receivedQtyPcs !== undefined && item.receivedQtyPcs !== null ? item.receivedQtyPcs : ''}
                            onChange={(e) => {
                              const newItems = [...editingReceivedItems];
                              newItems[index].receivedQtyPcs = e.target.value === '' ? null : parseInt(e.target.value) || null;
                              setEditingReceivedItems(newItems);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            placeholder="Enter received quantity"
                            step="1"
                            min="0"
                          />
                          {item.receivedQtyPcs !== null && item.receivedQtyPcs !== undefined && item.originalQtyPcs && item.receivedQtyPcs < item.originalQtyPcs && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              Shrinkage: {item.originalQtyPcs - item.receivedQtyPcs} pcs
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEditReceivedModal(false);
                  setSelectedPO(null);
                  setEditingReceivedItems([]);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateReceivedQuantities}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
              >
                Update Quantities
              </button>
            </div>
          </div>
        </div>
      )}
    </StoreLayout>
  );
}

