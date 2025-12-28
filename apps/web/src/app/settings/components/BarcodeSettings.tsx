'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card } from '@/components/ui';
import { Button } from '@/components/ui';

interface ScaleBarcodeConfig {
  id: string;
  name: string;
  prefix: string;
  pluStart: number;
  pluLength: number;
  weightStart: number;
  weightLength: number;
  weightDecimal: number;
  priceStart?: number | null;
  priceLength?: number | null;
  priceDecimal?: number | null;
  checksumType: 'NONE' | 'MOD10' | 'MOD11';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function BarcodeSettings() {
  const [configs, setConfigs] = useState<ScaleBarcodeConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ScaleBarcodeConfig | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    prefix: '',
    pluStart: 0,
    pluLength: 5,
    weightStart: 5,
    weightLength: 5,
    weightDecimal: 2,
    priceStart: '',
    priceLength: '',
    priceDecimal: '',
    checksumType: 'NONE' as 'NONE' | 'MOD10' | 'MOD11',
    isActive: true,
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/scale/config');
      setConfigs(response.data || []);
    } catch (error: any) {
      console.error('Failed to load scale configs:', error);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (config?: ScaleBarcodeConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        name: config.name,
        prefix: config.prefix,
        pluStart: config.pluStart,
        pluLength: config.pluLength,
        weightStart: config.weightStart,
        weightLength: config.weightLength,
        weightDecimal: config.weightDecimal,
        priceStart: config.priceStart?.toString() || '',
        priceLength: config.priceLength?.toString() || '',
        priceDecimal: config.priceDecimal?.toString() || '',
        checksumType: config.checksumType,
        isActive: config.isActive,
      });
    } else {
      setEditingConfig(null);
      setFormData({
        name: '',
        prefix: '',
        pluStart: 0,
        pluLength: 5,
        weightStart: 5,
        weightLength: 5,
        weightDecimal: 2,
        priceStart: '',
        priceLength: '',
        priceDecimal: '',
        checksumType: 'NONE',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name,
        prefix: formData.prefix,
        pluStart: formData.pluStart,
        pluLength: formData.pluLength,
        weightStart: formData.weightStart,
        weightLength: formData.weightLength,
        weightDecimal: formData.weightDecimal,
        checksumType: formData.checksumType,
        isActive: formData.isActive,
      };

      if (formData.priceStart) payload.priceStart = parseInt(formData.priceStart);
      if (formData.priceLength) payload.priceLength = parseInt(formData.priceLength);
      if (formData.priceDecimal) payload.priceDecimal = parseInt(formData.priceDecimal);

      if (editingConfig) {
        await api.put(`/api/v1/scale/config/${editingConfig.id}`, payload);
      } else {
        await api.post('/api/v1/scale/config', payload);
      }

      await loadConfigs();
      setShowModal(false);
      alert(editingConfig ? 'Configuration updated!' : 'Configuration created!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save configuration');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    try {
      await api.delete(`/api/v1/scale/config/${id}`);
      await loadConfigs();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete');
    }
  };

  const handleToggleActive = async (config: ScaleBarcodeConfig) => {
    try {
      await api.put(`/api/v1/scale/config/${config.id}`, {
        ...config,
        isActive: !config.isActive,
      });
      await loadConfigs();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update');
    }
  };

  return (
    <Card hasAccent>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Scale Barcode Configuration</h2>
          <p className="text-gray-600 text-sm mt-1">Configure how scale barcodes are parsed</p>
        </div>
        <Button onClick={() => handleOpenModal()}>+ Add Configuration</Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : configs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No configurations found</p>
          <Button onClick={() => handleOpenModal()}>Create First Configuration</Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prefix</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PLU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {configs.map((config) => (
                <tr key={config.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{config.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{config.prefix}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    Start: {config.pluStart}, Length: {config.pluLength}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    Start: {config.weightStart}, Length: {config.weightLength}, Decimals: {config.weightDecimal}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {config.priceStart !== null && config.priceStart !== undefined
                      ? `Start: ${config.priceStart}, Length: ${config.priceLength}, Decimals: ${config.priceDecimal}`
                      : 'Not encoded'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      onClick={() => handleToggleActive(config)}
                      className={`px-2 py-1 rounded text-xs cursor-pointer ${
                        config.isActive ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {config.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button onClick={() => handleOpenModal(config)} className="text-blue-600 hover:text-blue-800">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(config.id)} className="text-red-600 hover:text-red-800">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{editingConfig ? 'Edit Configuration' : 'Add Configuration'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prefix *</label>
                  <input
                    type="text"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Product Identifier (PLU/SKU) Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product ID Start Position *</label>
                    <input
                      type="number"
                      value={formData.pluStart}
                      onChange={(e) => setFormData({ ...formData, pluStart: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product ID Length *</label>
                    <input
                      type="number"
                      value={formData.pluLength}
                      onChange={(e) => setFormData({ ...formData, pluLength: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Weight Configuration</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight Start Position *</label>
                    <input
                      type="number"
                      value={formData.weightStart}
                      onChange={(e) => setFormData({ ...formData, weightStart: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight Length *</label>
                    <input
                      type="number"
                      value={formData.weightLength}
                      onChange={(e) => setFormData({ ...formData, weightLength: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight Decimals *</label>
                    <input
                      type="number"
                      value={formData.weightDecimal}
                      onChange={(e) => setFormData({ ...formData, weightDecimal: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Price Configuration (Optional)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price Start Position</label>
                    <input
                      type="number"
                      value={formData.priceStart}
                      onChange={(e) => setFormData({ ...formData, priceStart: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price Length</label>
                    <input
                      type="number"
                      value={formData.priceLength}
                      onChange={(e) => setFormData({ ...formData, priceLength: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price Decimals</label>
                    <input
                      type="number"
                      value={formData.priceDecimal}
                      onChange={(e) => setFormData({ ...formData, priceDecimal: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Checksum Type</label>
                  <select
                    value={formData.checksumType}
                    onChange={(e) => setFormData({ ...formData, checksumType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="NONE">None</option>
                    <option value="MOD10">MOD10</option>
                    <option value="MOD11">MOD11</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  {editingConfig ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Card>
  );
}

