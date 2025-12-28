'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface FranchiseOnboardingWizardProps {
  franchiseId: string;
  franchiseName: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface OnboardingData {
  // Step 1: Basic Info
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;

  // Step 2: Pricing Plan
  pricingPlanId: string;

  // Step 3: Royalty Plan
  royaltyPercentage: number;
  royaltyCalculationBase: 'GROSS_SALES' | 'NET_SALES';

  // Step 4: Wastage Limits
  allowedWastagePercent: number;
  allowedDiscountPercent: number;

  // Step 5: Area Manager
  areaManagerId: string;
}

export default function FranchiseOnboardingWizard({
  franchiseId,
  franchiseName,
  onComplete,
  onCancel,
}: FranchiseOnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [areaManagers, setAreaManagers] = useState<any[]>([]);
  const [formData, setFormData] = useState<OnboardingData>({
    name: franchiseName,
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    pricingPlanId: '',
    royaltyPercentage: 5,
    royaltyCalculationBase: 'GROSS_SALES',
    allowedWastagePercent: 5,
    allowedDiscountPercent: 10,
    areaManagerId: '',
  });

  useEffect(() => {
    loadPricingPlans();
    loadAreaManagers();
  }, []);

  const loadPricingPlans = async () => {
    try {
      const response = await api.get('/api/v1/hq/pricing-plans');
      setPricingPlans(response.data.filter((p: any) => p.isActive));
    } catch (error) {
      console.error('Failed to load pricing plans:', error);
    }
  };

  const loadAreaManagers = async () => {
    try {
      const response = await api.get('/api/v1/users');
      setAreaManagers(response.data.filter((u: any) => u.role === 'MANAGER' && u.isActive));
    } catch (error) {
      console.error('Failed to load area managers:', error);
    }
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Update franchise store with basic info
      await api.put(`/api/v1/stores/franchises/${franchiseId}`, {
        name: formData.name,
        // Add address fields if your Store model supports them
      });

      // Create/update franchise config
      await api.post(`/api/v1/hq/franchises/${franchiseId}/config`, {
        pricingPlanId: formData.pricingPlanId || undefined,
        royaltyPercentage: formData.royaltyPercentage,
        royaltyCalculationBase: formData.royaltyCalculationBase,
        allowedWastagePercent: formData.allowedWastagePercent,
        allowedDiscountPercent: formData.allowedDiscountPercent,
        areaManagerId: formData.areaManagerId || undefined,
      });

      // Mark onboarding as complete
      await api.patch(`/api/v1/hq/franchises/${franchiseId}/onboarding-complete`, {
        onboardingData: formData,
      });

      onComplete();
    } catch (error: any) {
      console.error('Failed to complete onboarding:', error);
      alert(error.response?.data?.error || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Basic Info' },
    { number: 2, title: 'Pricing Plan' },
    { number: 3, title: 'Royalty Plan' },
    { number: 4, title: 'Wastage Limits' },
    { number: 5, title: 'Area Manager' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Franchise Onboarding</h2>
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => (
              <div key={s.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      step >= s.number
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {step > s.number ? '✓' : s.number}
                  </div>
                  <div className="text-xs mt-1 text-center">{s.title}</div>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step > s.number ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Store Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">State *</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Pricing Plan */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Pricing Plan</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Select Pricing Plan *</label>
                <select
                  value={formData.pricingPlanId}
                  onChange={(e) => setFormData({ ...formData, pricingPlanId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                >
                  <option value="">Select a pricing plan</option>
                  {pricingPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.type})
                    </option>
                  ))}
                </select>
              </div>
              {formData.pricingPlanId && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Selected plan will determine the base pricing rules for this franchise.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Royalty Plan */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Royalty Plan</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Royalty Percentage *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.royaltyPercentage}
                  onChange={(e) =>
                    setFormData({ ...formData, royaltyPercentage: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Percentage of sales to be paid as royalty
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Calculation Base *</label>
                <select
                  value={formData.royaltyCalculationBase}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      royaltyCalculationBase: e.target.value as 'GROSS_SALES' | 'NET_SALES',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                >
                  <option value="GROSS_SALES">Gross Sales (Before discounts/wastage)</option>
                  <option value="NET_SALES">Net Sales (After discounts/wastage)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Wastage Limits */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Wastage & Discount Limits</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Allowed Wastage % *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.allowedWastagePercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      allowedWastagePercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum allowed wastage percentage before alerts
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Allowed Discount % *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.allowedDiscountPercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      allowedDiscountPercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum discount percentage allowed without manager approval
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Area Manager */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Area Manager Assignment</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Assign Area Manager</label>
                <select
                  value={formData.areaManagerId}
                  onChange={(e) => setFormData({ ...formData, areaManagerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                >
                  <option value="">No area manager (optional)</option>
                  {areaManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.phone})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Area manager will be responsible for monitoring this franchise
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between">
          <button
            onClick={step === 1 ? onCancel : handleBack}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 5 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Completing...' : 'Complete Onboarding'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

