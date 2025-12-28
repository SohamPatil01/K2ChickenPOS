'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';

export default function EnhancedCompliancePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedFranchise, setSelectedFranchise] = useState<string>('');
  const [formData, setFormData] = useState({
    franchiseConfigId: '',
    checkType: 'DAILY_CLEANING',
    status: 'COMPLIANT',
    temperature: 0,
    photoUrl: '',
    documentUrl: '',
    expiryDate: '',
    notes: '',
    score: 100,
  });
  const [franchiseConfigs, setFranchiseConfigs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [reviewData, setReviewData] = useState({
    status: 'COMPLIANT',
    score: 100,
    notes: '',
  });

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router, filterType, filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recordsRes, summaryRes, configsRes] = await Promise.all([
        api.get('/api/v1/hq/compliance/records', {
          params: {
            checkType: filterType || undefined,
            status: filterStatus || undefined,
          },
        }),
        api.get('/api/v1/hq/compliance/summary'),
        api.get('/api/v1/hq/franchises/config'),
      ]);
      setRecords(recordsRes.data);
      setSummary(summaryRes.data);
      setFranchiseConfigs(configsRes.data);
    } catch (error: any) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecord = async () => {
    if (!formData.franchiseConfigId) {
      alert('Please select a franchise');
      return;
    }
    try {
      await api.post('/api/v1/hq/compliance/records', {
        ...formData,
        expiryDate: formData.expiryDate || undefined,
      });
      setShowModal(false);
      setFormData({
        franchiseConfigId: '',
        checkType: 'DAILY_CLEANING',
        status: 'COMPLIANT',
        temperature: 0,
        photoUrl: '',
        documentUrl: '',
        expiryDate: '',
        notes: '',
        score: 100,
      });
      await loadData();
      alert('Compliance record created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create compliance record');
    }
  };

  const handleOpenReview = (record: any) => {
    setSelectedRecord(record);
    setReviewData({
      status: record.status,
      score: record.score || 100,
      notes: record.notes || '',
    });
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async () => {
    if (!selectedRecord) return;
    try {
      await api.patch(`/api/v1/hq/compliance/records/${selectedRecord.id}/review`, reviewData);
      setShowReviewModal(false);
      setSelectedRecord(null);
      await loadData();
      alert('Compliance record reviewed successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to review compliance record');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'NON_COMPLIANT':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getCheckTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ');
  };

  if (loading) {
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
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Compliance & Hygiene</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track compliance records and hygiene checks</p>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            + Record Compliance Check
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {summary.map((item) => (
            <Card key={item.franchiseId}>
              <h3 className="font-semibold dark:text-white mb-2">{item.franchiseName}</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold dark:text-white">{item.averageScore}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Average Score</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                <p>Checks: {item.totalChecks} | Compliant: {item.compliantCount} | Warnings: {item.warningCount} | Non-Compliant: {item.nonCompliantCount}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-4 flex gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
          >
            <option value="">All Check Types</option>
            <option value="DAILY_CLEANING">Daily Cleaning</option>
            <option value="TEMPERATURE_LOG">Temperature Log</option>
            <option value="PHOTO_PROOF">Photo Proof</option>
            <option value="LICENSE_EXPIRY">License Expiry</option>
            <option value="DOCUMENT_EXPIRY">Document Expiry</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
          >
            <option value="">All Statuses</option>
            <option value="COMPLIANT">Compliant</option>
            <option value="WARNING">Warning</option>
            <option value="NON_COMPLIANT">Non-Compliant</option>
          </select>
        </div>

        {/* Records List */}
        <div className="space-y-4">
          {records.map((record) => (
            <Card key={record.id}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold dark:text-white">
                    {record.franchiseConfig.franchiseStore.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {getCheckTypeLabel(record.checkType)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Checked by: {record.checker.name} on {new Date(record.checkedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {record.score !== null && (
                    <span className="text-lg font-bold dark:text-white">{record.score}/100</span>
                  )}
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(record.status)}`}>
                    {record.status}
                  </span>
                  {!record.reviewedBy && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenReview(record)}
                    >
                      Review
                    </Button>
                  )}
                  {record.reviewedBy && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Reviewed ✓
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {record.temperature !== null && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Temperature</p>
                    <p className="font-semibold dark:text-white">{record.temperature}°C</p>
                  </div>
                )}
                {record.expiryDate && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Expiry Date</p>
                    <p className="font-semibold dark:text-white">{new Date(record.expiryDate).toLocaleDateString()}</p>
                  </div>
                )}
                {record.photoUrl && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Photo</p>
                    <a href={record.photoUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-600 text-sm">
                      View Photo
                    </a>
                  </div>
                )}
                {record.documentUrl && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Document</p>
                    <a href={record.documentUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-600 text-sm">
                      View Document
                    </a>
                  </div>
                )}
              </div>

              {record.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{record.notes}</p>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Create Record Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Record Compliance Check</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Franchise *</label>
                  <select
                    value={formData.franchiseConfigId}
                    onChange={(e) => setFormData({ ...formData, franchiseConfigId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="">Select franchise</option>
                    {franchiseConfigs
                      .filter((config) => config.franchiseConfigId) // Only show franchises with config
                      .map((config) => (
                        <option key={config.franchiseConfigId} value={config.franchiseConfigId}>
                          {config.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check Type *</label>
                  <select
                    value={formData.checkType}
                    onChange={(e) => setFormData({ ...formData, checkType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="DAILY_CLEANING">Daily Cleaning</option>
                    <option value="TEMPERATURE_LOG">Temperature Log</option>
                    <option value="PHOTO_PROOF">Photo Proof</option>
                    <option value="LICENSE_EXPIRY">License Expiry</option>
                    <option value="DOCUMENT_EXPIRY">Document Expiry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="COMPLIANT">Compliant</option>
                    <option value="WARNING">Warning</option>
                    <option value="NON_COMPLIANT">Non-Compliant</option>
                  </select>
                </div>
                {formData.checkType === 'TEMPERATURE_LOG' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature (°C)</label>
                    <input
                      type="number"
                      value={formData.temperature || ''}
                      onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      step="0.1"
                    />
                  </div>
                )}
                {(formData.checkType === 'PHOTO_PROOF' || formData.checkType === 'LICENSE_EXPIRY' || formData.checkType === 'DOCUMENT_EXPIRY') && (
                  <>
                    {formData.checkType === 'PHOTO_PROOF' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photo URL</label>
                        <input
                          type="url"
                          value={formData.photoUrl}
                          onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                          placeholder="https://..."
                        />
                      </div>
                    )}
                    {(formData.checkType === 'LICENSE_EXPIRY' || formData.checkType === 'DOCUMENT_EXPIRY') && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document URL</label>
                          <input
                            type="url"
                            value={formData.documentUrl}
                            onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                          <input
                            type="date"
                            value={formData.expiryDate}
                            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Score (0-100)</label>
                  <input
                    type="number"
                    value={formData.score}
                    onChange={(e) => setFormData({ ...formData, score: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreateRecord} className="flex-1">
                    Record Check
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {showReviewModal && selectedRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Review Compliance Submission</h2>
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <p className="text-sm font-semibold dark:text-white">{selectedRecord.franchiseConfig.franchiseStore.name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {getCheckTypeLabel(selectedRecord.checkType)} - Submitted on {new Date(selectedRecord.checkedAt).toLocaleString()}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Review Status *</label>
                  <select
                    value={reviewData.status}
                    onChange={(e) => setReviewData({ ...reviewData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="COMPLIANT">Compliant</option>
                    <option value="WARNING">Warning</option>
                    <option value="NON_COMPLIANT">Non-Compliant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Score (0-100) *</label>
                  <input
                    type="number"
                    value={reviewData.score}
                    onChange={(e) => setReviewData({ ...reviewData, score: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    min="0"
                    max="100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Review Notes</label>
                  <textarea
                    value={reviewData.notes}
                    onChange={(e) => setReviewData({ ...reviewData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    rows={3}
                    placeholder="Add review comments..."
                  />
                </div>

                {/* Show submission details */}
                {selectedRecord.submissionData && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <p className="text-sm font-semibold dark:text-white mb-2">Submission Data:</p>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                      {JSON.stringify(selectedRecord.submissionData, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedRecord.photoUrl && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photo:</p>
                    <a
                      href={selectedRecord.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-500 hover:text-brand-600 text-sm"
                    >
                      View Photo →
                    </a>
                  </div>
                )}

                {selectedRecord.documentUrl && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document:</p>
                    <a
                      href={selectedRecord.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-500 hover:text-brand-600 text-sm"
                    >
                      View Document →
                    </a>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowReviewModal(false);
                      setSelectedRecord(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleReviewSubmit} className="flex-1">
                    Submit Review
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

