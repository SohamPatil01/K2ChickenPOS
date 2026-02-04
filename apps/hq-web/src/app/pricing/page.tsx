'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'plans' | 'rules' | 'overrides'>('plans');
  const [loading, setLoading] = useState(false);

  // Pricing Plans
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    type: 'STANDARD',
    description: '',
  });

  // Pricing Rules
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    pricingPlanId: '',
    productId: '',
    categoryId: '',
    basePrice: 0,
    minPrice: 0,
    maxPrice: 0,
  });

  // Pricing Overrides
  const [overrides, setOverrides] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    franchiseConfigId: '',
    productId: '',
    overridePrice: 0,
    reason: '',
  });

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [franchiseConfigs, setFranchiseConfigs] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router, activeTab, selectedPlanId, selectedFranchiseId]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (activeTab === 'plans') {
        const res = await api.get('/api/v1/hq/pricing-plans');
        setPricingPlans(res.data);
      } else if (activeTab === 'rules' && selectedPlanId) {
        const [rulesRes, mastersRes] = await Promise.all([
          api.get(`/api/v1/hq/pricing-plans/${selectedPlanId}/rules`),
          api.get('/api/v1/hq/product-masters'),
        ]);
        const rules = rulesRes.data;
        const masters = mastersRes.data;
        // Merge lock status from ProductMaster
        const rulesWithLocks = rules.map((rule: any) => {
          if (rule.productId) {
            const master = masters.find((m: any) => m.productId === rule.productId);
            return {
              ...rule,
              lockStatus: master?.isHQLocked ? 'LOCKED_BY_HQ' : 'UNLOCKED',
            };
          }
          return { ...rule, lockStatus: 'UNLOCKED' };
        });
        setPricingRules(rulesWithLocks);
      } else if (activeTab === 'overrides' && selectedFranchiseId) {
        const res = await api.get(`/api/v1/hq/franchises/${selectedFranchiseId}/pricing-overrides`);
        setOverrides(res.data);
      }

      // Load common data
      const [productsRes, categoriesRes, franchisesRes, configsRes] = await Promise.all([
        api.get('/api/v1/products'),
        api.get('/api/v1/categories'),
        api.get('/api/v1/stores/franchises'),
        api.get('/api/v1/hq/franchises/config'),
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setFranchises(franchisesRes.data);
      setFranchiseConfigs(configsRes.data);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      if (error?.isNetworkError || error?.code === 'ERR_NETWORK') {
        setLoadError('Cannot connect to the API. Make sure the server is running (e.g. port 3003).');
      } else if (error?.response?.status === 401) {
        setLoadError('Session expired or not logged in. Redirecting to login...');
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      } else {
        setLoadError(error?.response?.data?.error || 'Failed to load data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    try {
      await api.post('/api/v1/hq/pricing-plans', planForm);
      setShowPlanModal(false);
      setPlanForm({ name: '', type: 'STANDARD', description: '' });
      await loadData();
      alert('Pricing plan created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create pricing plan');
    }
  };

  const handleCreateRule = async () => {
    if (!ruleForm.pricingPlanId || !ruleForm.basePrice) {
      alert('Please fill required fields');
      return;
    }
    try {
      await api.post('/api/v1/hq/pricing-rules', ruleForm);
      setShowRuleModal(false);
      setRuleForm({
        pricingPlanId: '',
        productId: '',
        categoryId: '',
        basePrice: 0,
        minPrice: 0,
        maxPrice: 0,
      });
      await loadData();
      alert('Pricing rule created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create pricing rule');
    }
  };

  const handleCreateOverride = async () => {
    try {
      await api.post('/api/v1/hq/pricing-overrides', overrideForm);
      setShowOverrideModal(false);
      setOverrideForm({
        franchiseConfigId: '',
        productId: '',
        overridePrice: 0,
        reason: '',
      });
      await loadData();
      alert('Pricing override created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create override');
    }
  };

  const handleLockRule = async (id: string, lockStatus: string) => {
    try {
      await api.patch(`/api/v1/hq/pricing-rules/${id}/lock`, { lockStatus });
      await loadData();
      alert(`Pricing rule ${lockStatus === 'LOCKED_BY_HQ' ? 'locked' : 'unlocked'} successfully!`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update lock status');
    }
  };

  const handleApproveOverride = async (id: string) => {
    try {
      await api.patch(`/api/v1/hq/pricing-overrides/${id}/approve`);
      await loadData();
      alert('Override approved successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve override');
    }
  };

  if (loadError) {
    return (
      <HQLayout>
        <div className="text-center py-12 max-w-md mx-auto">
          <p className="text-red-600 dark:text-red-400 mb-4">{loadError}</p>
          {!loadError.includes('Redirecting') && (
            <Button variant="primary" onClick={() => { setLoadError(null); loadData(); }}>
              Retry
            </Button>
          )}
        </div>
      </HQLayout>
    );
  }

  if (loading && pricingPlans.length === 0 && products.length === 0) {
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
          <h1 className="text-3xl font-bold dark:text-white">Pricing & Standardization</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage pricing plans, rules, and overrides</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'plans', label: 'Pricing Plans', icon: '📋' },
              { id: 'rules', label: 'Pricing Rules', icon: '📐' },
              { id: 'overrides', label: 'Pricing Overrides', icon: '🔓' },
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

        {/* Pricing Plans Tab */}
        {activeTab === 'plans' && (
          <div>
            <div className="mb-4 flex justify-end">
              <Button variant="primary" onClick={() => setShowPlanModal(true)}>
                + Create Pricing Plan
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {pricingPlans.map((plan) => (
                <Card key={plan.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold dark:text-white">{plan.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{plan.type}</p>
                      {plan.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.description}</p>}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {plan.franchises?.length || 0} franchises | {plan.pricingRules?.length || 0} rules
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${plan.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pricing Rules Tab */}
        {activeTab === 'rules' && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
              >
                <option value="">Select pricing plan</option>
                {pricingPlans.filter(p => p.isActive).map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
              {selectedPlanId && (
                <Button variant="primary" onClick={() => {
                  setRuleForm({ ...ruleForm, pricingPlanId: selectedPlanId });
                  setShowRuleModal(true);
                }}>
                  + Add Rule
                </Button>
              )}
            </div>
            {selectedPlanId ? (
              <div className="space-y-4">
                {pricingRules.map((rule) => (
                  <Card key={rule.id}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold dark:text-white">
                            {rule.product?.name || rule.category?.name || 'General Rule'}
                          </h3>
                          {rule.lockStatus && rule.lockStatus !== 'UNLOCKED' && (
                            <span className={`px-2 py-1 rounded text-xs ${
                              rule.lockStatus === 'LOCKED_BY_HQ' 
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                : 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                            }`}>
                              🔒 {rule.lockStatus.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Base: ₹{rule.basePrice}/kg
                          {rule.minPrice && ` | Min: ₹${rule.minPrice}/kg`}
                          {rule.maxPrice && ` | Max: ₹${rule.maxPrice}/kg`}
                        </p>
                        {rule.effectiveFrom && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Effective: {new Date(rule.effectiveFrom).toLocaleDateString()}
                            {rule.effectiveTo && ` - ${new Date(rule.effectiveTo).toLocaleDateString()}`}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setRuleForm({
                              pricingPlanId: rule.pricingPlanId,
                              productId: rule.productId || '',
                              categoryId: rule.categoryId || '',
                              basePrice: rule.basePrice,
                              minPrice: rule.minPrice || 0,
                              maxPrice: rule.maxPrice || 0,
                            });
                            setShowRuleModal(true);
                          }}
                          className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                          disabled={rule.lockStatus === 'LOCKED_BY_HQ'}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleLockRule(rule.id, rule.lockStatus === 'LOCKED_BY_HQ' ? 'UNLOCKED' : 'LOCKED_BY_HQ')}
                          className={`px-3 py-1 text-sm rounded ${
                            rule.lockStatus === 'LOCKED_BY_HQ'
                              ? 'bg-gray-600 text-white hover:bg-gray-700'
                              : 'bg-yellow-600 text-white hover:bg-yellow-700'
                          }`}
                        >
                          {rule.lockStatus === 'LOCKED_BY_HQ' ? '🔓 Unlock' : '🔒 Lock'}
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Please select a pricing plan to view rules</p>
              </div>
            )}
          </div>
        )}

        {/* Pricing Overrides Tab */}
        {activeTab === 'overrides' && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <select
                value={selectedFranchiseId}
                onChange={(e) => setSelectedFranchiseId(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
              >
                <option value="">Select franchise</option>
                {franchises.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {selectedFranchiseId && (
                <Button variant="primary" onClick={() => {
                  const config = franchiseConfigs.find(c => c.id === selectedFranchiseId);
                  setOverrideForm({ ...overrideForm, franchiseConfigId: config?.id || '' });
                  setShowOverrideModal(true);
                }}>
                  + Request Override
                </Button>
              )}
            </div>
            {selectedFranchiseId ? (
              <div className="space-y-4">
                {overrides.map((override) => (
                  <Card key={override.id}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold dark:text-white">{override.product.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Override Price: ₹{override.overridePrice}
                        </p>
                        {override.reason && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Reason: {override.reason}</p>}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Status: {override.lockStatus} | Approved: {override.approvedByHQ ? 'Yes' : 'No'}
                        </p>
                      </div>
                      {!override.approvedByHQ && (
                        <Button variant="primary" size="sm" onClick={() => handleApproveOverride(override.id)}>
                          Approve
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Please select a franchise to view overrides</p>
              </div>
            )}
          </div>
        )}

        {/* Plan Modal */}
        {showPlanModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Create Pricing Plan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input
                    type="text"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
                  <select
                    value={planForm.type}
                    onChange={(e) => setPlanForm({ ...planForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowPlanModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreatePlan} className="flex-1">
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rule Modal */}
        {showRuleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Add Pricing Rule</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product (or leave blank for category)</label>
                  <select
                    value={ruleForm.productId}
                    onChange={(e) => setRuleForm({ ...ruleForm, productId: e.target.value, categoryId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {!ruleForm.productId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={ruleForm.categoryId}
                      onChange={(e) => setRuleForm({ ...ruleForm, categoryId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Price *</label>
                  <input
                    type="number"
                    value={ruleForm.basePrice || ''}
                    onChange={(e) => setRuleForm({ ...ruleForm, basePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    step="0.01"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Price</label>
                    <input
                      type="number"
                      value={ruleForm.minPrice || ''}
                      onChange={(e) => setRuleForm({ ...ruleForm, minPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Price</label>
                    <input
                      type="number"
                      value={ruleForm.maxPrice || ''}
                      onChange={(e) => setRuleForm({ ...ruleForm, maxPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowRuleModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreateRule} className="flex-1">
                    Add Rule
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Override Modal */}
        {showOverrideModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Request Pricing Override</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product *</label>
                  <select
                    value={overrideForm.productId}
                    onChange={(e) => setOverrideForm({ ...overrideForm, productId: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Override Price *</label>
                  <input
                    type="number"
                    value={overrideForm.overridePrice || ''}
                    onChange={(e) => setOverrideForm({ ...overrideForm, overridePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                  <textarea
                    value={overrideForm.reason}
                    onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    rows={3}
                    placeholder="Explain why this override is needed"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowOverrideModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreateOverride} className="flex-1">
                    Request Override
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

