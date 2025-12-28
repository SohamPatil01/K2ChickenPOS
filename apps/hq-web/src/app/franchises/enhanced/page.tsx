'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button } from '@/components/ui';
import { Card } from '@/components/ui';

interface FranchiseConfig {
  id: string;
  name: string;
  status: string;
  pricingPlan?: {
    id: string;
    name: string;
    type: string;
  };
  royaltyPercentage: number;
  allowedWastagePercent: number;
  allowedDiscountPercent: number;
  areaManager?: {
    id: string;
    name: string;
    phone: string;
  };
  onboardingCompleted: boolean;
  stats: {
    users: number;
    sales: number;
    customers: number;
  };
}

export default function EnhancedFranchisesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [franchises, setFranchises] = useState<FranchiseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [selectedFranchise, setSelectedFranchise] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    pricingPlanId: '',
    royaltyPercentage: 5,
    allowedWastagePercent: 5,
    allowedDiscountPercent: 10,
    areaManagerId: '',
  });
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [areaManagers, setAreaManagers] = useState<any[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadFranchises();
    loadPricingPlans();
    loadAreaManagers();
  }, [user, router]);

  const loadFranchises = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/hq/franchises/config');
      setFranchises(response.data);
    } catch (error: any) {
      console.error('Failed to load franchises:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPricingPlans = async () => {
    try {
      const response = await api.get('/api/v1/hq/pricing-plans');
      setPricingPlans(response.data.filter((p: any) => p.isActive));
    } catch (error: any) {
      console.error('Failed to load pricing plans:', error);
    }
  };

  const loadAreaManagers = async () => {
    try {
      // Get all users with MANAGER role from owner store
      const response = await api.get('/api/v1/users');
      setAreaManagers(response.data.filter((u: any) => u.role === 'MANAGER' && u.isActive));
    } catch (error: any) {
      console.error('Failed to load area managers:', error);
    }
  };

  const handleStartOnboarding = (franchiseId: string) => {
    setSelectedFranchise(franchiseId);
    setShowOnboardingModal(true);
    setOnboardingStep(1);
  };

  const handleCompleteOnboarding = async () => {
    if (!selectedFranchise) return;

    try {
      // First create/update franchise config
      const configResponse = await api.post(`/api/v1/hq/franchises/${selectedFranchise}/config`, onboardingData);
      const configId = configResponse.data.id;

      // Complete onboarding
      await api.post(`/api/v1/hq/franchises/${selectedFranchise}/onboarding/complete`, {
        onboardingData: { ...onboardingData, franchiseConfigId: configId },
      });

      setShowOnboardingModal(false);
      setSelectedFranchise(null);
      setOnboardingStep(1);
      await loadFranchises();
      alert('Onboarding completed successfully!');
    } catch (error: any) {
      console.error('Failed to complete onboarding:', error);
      alert(error.response?.data?.error || 'Failed to complete onboarding');
    }
  };

  const handleUpdateConfig = async (franchiseId: string, updates: any) => {
    try {
      await api.post(`/api/v1/hq/franchises/${franchiseId}/config`, updates);
      await loadFranchises();
      alert('Configuration updated successfully!');
    } catch (error: any) {
      console.error('Failed to update config:', error);
      alert(error.response?.data?.error || 'Failed to update configuration');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'UNDER_AUDIT':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading franchises...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Franchise Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage franchise configurations and onboarding</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {franchises.map((franchise) => (
            <Card key={franchise.id} hasAccent>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold dark:text-white">{franchise.name}</h2>
                  <span className={`px-2 py-1 rounded text-xs font-semibold mt-2 inline-block ${getStatusColor(franchise.status)}`}>
                    {franchise.status.replace(/_/g, ' ')}
                  </span>
                </div>
                {!franchise.onboardingCompleted && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleStartOnboarding(franchise.id)}
                  >
                    Start Onboarding
                  </Button>
                )}
              </div>

              {/* Lock Status Indicators */}
              {(franchise.isPricingLocked || franchise.isDiscountLocked || franchise.isWastageLocked) && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-2">🔒 Locked Controls:</p>
                  <div className="flex gap-4 text-xs">
                    {franchise.isPricingLocked && (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 rounded">Pricing</span>
                    )}
                    {franchise.isDiscountLocked && (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 rounded">Discount</span>
                    )}
                    {franchise.isWastageLocked && (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 rounded">Wastage</span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pricing Plan</p>
                  <p className="font-semibold dark:text-white">{franchise.pricingPlan?.name || 'Not Assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Royalty %</p>
                  <p className="font-semibold dark:text-white">{franchise.royaltyPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Area Manager</p>
                  <p className="font-semibold dark:text-white">{franchise.areaManager?.name || 'Not Assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Allowed Wastage % {franchise.isWastageLocked && '🔒'}
                  </p>
                  <p className="font-semibold dark:text-white">{franchise.allowedWastagePercent}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Allowed Discount % {franchise.isDiscountLocked && '🔒'}
                  </p>
                  <p className="font-semibold dark:text-white">{franchise.allowedDiscountPercent}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Stats</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {franchise.stats.users} users, {franchise.stats.sales} sales, {franchise.stats.customers} customers
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  href={`/franchises/${franchise.id}`}
                  className="text-brand-500 hover:text-brand-600 text-sm font-medium"
                >
                  View Details →
                </Link>
              </div>
            </Card>
          ))}
        </div>

        {/* Onboarding Modal */}
        {showOnboardingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Franchise Onboarding Wizard</h2>

              {onboardingStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold dark:text-white">Step 1: Pricing Plan</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Pricing Plan</label>
                    <select
                      value={onboardingData.pricingPlanId}
                      onChange={(e) => setOnboardingData({ ...onboardingData, pricingPlanId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    >
                      <option value="">Select a plan</option>
                      {pricingPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} ({plan.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setShowOnboardingModal(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={() => setOnboardingStep(2)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold dark:text-white">Step 2: Royalty & Limits</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Royalty Percentage</label>
                    <input
                      type="number"
                      value={onboardingData.royaltyPercentage}
                      onChange={(e) => setOnboardingData({ ...onboardingData, royaltyPercentage: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed Wastage %</label>
                    <input
                      type="number"
                      value={onboardingData.allowedWastagePercent}
                      onChange={(e) => setOnboardingData({ ...onboardingData, allowedWastagePercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed Discount %</label>
                    <input
                      type="number"
                      value={onboardingData.allowedDiscountPercent}
                      onChange={(e) => setOnboardingData({ ...onboardingData, allowedDiscountPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setOnboardingStep(1)}>
                      Back
                    </Button>
                    <Button variant="primary" onClick={() => setOnboardingStep(3)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold dark:text-white">Step 3: Area Manager</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign Area Manager</label>
                    <select
                      value={onboardingData.areaManagerId}
                      onChange={(e) => setOnboardingData({ ...onboardingData, areaManagerId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    >
                      <option value="">No Manager</option>
                      {areaManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} ({manager.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 dark:text-white">Summary</h4>
                    <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                      <li>Pricing Plan: {pricingPlans.find((p) => p.id === onboardingData.pricingPlanId)?.name || 'Not selected'}</li>
                      <li>Royalty: {onboardingData.royaltyPercentage}%</li>
                      <li>Allowed Wastage: {onboardingData.allowedWastagePercent}%</li>
                      <li>Allowed Discount: {onboardingData.allowedDiscountPercent}%</li>
                      <li>Area Manager: {areaManagers.find((m) => m.id === onboardingData.areaManagerId)?.name || 'Not assigned'}</li>
                    </ul>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setOnboardingStep(2)}>
                      Back
                    </Button>
                    <Button variant="primary" onClick={handleCompleteOnboarding}>
                      Complete Onboarding
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </HQLayout>
  );
}

