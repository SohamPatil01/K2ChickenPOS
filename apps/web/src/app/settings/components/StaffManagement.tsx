'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card } from '@/components/ui';
import { Button } from '@/components/ui';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'DRIVER';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'CASHIER' as 'OWNER' | 'MANAGER' | 'CASHIER' | 'DRIVER',
    password: '',
    isActive: true,
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/users');
      setStaff(response.data || []);
    } catch (error: any) {
      console.error('Failed to load staff:', error);
      alert(error.response?.data?.error || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (staffMember?: StaffMember) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({
        name: staffMember.name,
        phone: staffMember.phone,
        email: staffMember.email || '',
        role: staffMember.role,
        password: '',
        isActive: staffMember.isActive,
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        role: 'CASHIER',
        password: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingStaff) {
        const updateData: any = {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          role: formData.role,
          isActive: formData.isActive,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await api.put(`/api/v1/users/${editingStaff.id}`, updateData);
        alert('Staff member updated successfully!');
      } else {
        if (!formData.password) {
          alert('Password is required for new staff members');
          setFormLoading(false);
          return;
        }
        await api.post('/api/v1/users', {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          role: formData.role,
          password: formData.password,
          isActive: formData.isActive,
        });
        alert('Staff member created successfully!');
      }

      await loadStaff();
      setShowModal(false);
    } catch (error: any) {
      console.error('Failed to save staff:', error);
      alert(error.response?.data?.error || 'Failed to save staff member');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    try {
      await api.delete(`/api/v1/users/${id}`);
      alert('Staff member deleted successfully!');
      await loadStaff();
    } catch (error: any) {
      console.error('Failed to delete staff:', error);
      alert(error.response?.data?.error || 'Failed to delete staff member');
    }
  };

  const handleToggleActive = async (staffMember: StaffMember) => {
    try {
      await api.put(`/api/v1/users/${staffMember.id}`, {
        isActive: !staffMember.isActive,
      });
      await loadStaff();
    } catch (error: any) {
      console.error('Failed to toggle active status:', error);
      alert(error.response?.data?.error || 'Failed to update status');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-brand-100 text-brand-800';
      case 'MANAGER':
        return 'bg-brand-200 text-brand-800';
      case 'CASHIER':
        return 'bg-yellow-100 text-yellow-800';
      case 'DRIVER':
        return 'bg-yellow-200 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card hasAccent>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <p className="text-gray-600 text-sm mt-1">Manage staff members, roles, and credentials</p>
        </div>
        <Button onClick={() => handleOpenModal()}>+ Add Staff</Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading staff...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-glass min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-2/80 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No staff members found. Click "+ Add Staff" to create one.
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{member.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{member.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                      {member.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`px-2 py-1 text-xs rounded ${ member.isActive ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800' }`}
                      >
                        {member.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenModal(member)} className="text-blue-600 hover:text-blue-800">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(member.id)} className="text-red-600 hover:text-red-800">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  minLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                  <option value="DRIVER">Driver</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingStaff ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required={!editingStaff}
                  minLength={6}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex gap-2 mt-6">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={formLoading} className="flex-1">
                  {formLoading ? 'Saving...' : editingStaff ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Card>
  );
}

