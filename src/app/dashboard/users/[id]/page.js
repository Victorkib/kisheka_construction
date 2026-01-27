/**
 * User Detail Page
 * Displays user details with role management and history
 * 
 * Route: /dashboard/users/[id]
 * Auth: OWNER only
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingCard, LoadingSpinner, LoadingOverlay } from '@/components/loading';
import { ConfirmationModal, EditModal } from '@/components/modals';
import { useToast } from '@/components/toast';

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const [userData, setUserData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [roleHistory, setRoleHistory] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [activityStats, setActivityStats] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    role: '',
    status: '',
    firstName: '',
    lastName: '',
    reason: '',
  });

  // Fetch current user and check permissions
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (data.success) {
          setCurrentUser(data.data);
          const role = data.data.role?.toLowerCase();
          if (role !== 'owner') {
            router.push('/dashboard');
          }
        } else {
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('Fetch user error:', err);
        router.push('/auth/login');
      }
    };

    fetchCurrentUser();
  }, [router]);

  // Fetch user data
  useEffect(() => {
    if (params.id && currentUser) {
      fetchUserData();
      fetchRoleHistory();
      fetchUserActivity();
    }
  }, [params.id, currentUser]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/users/${params.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch user');
      }

      setUserData(data.data);
      setFormData({
        role: data.data.role || '',
        status: data.data.status || 'active',
        firstName: data.data.firstName || '',
        lastName: data.data.lastName || '',
        reason: '',
      });
    } catch (err) {
      setError(err.message);
      console.error('Fetch user error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleHistory = async () => {
    try {
      const response = await fetch(`/api/users/${params.id}/history`);
      const data = await response.json();

      if (data.success) {
        setRoleHistory(data.data.history || []);
      }
    } catch (err) {
      console.error('Fetch role history error:', err);
    }
  };

  const fetchUserActivity = async () => {
    try {
      setLoadingActivity(true);
      const response = await fetch(`/api/users/${params.id}/activity`);
      const data = await response.json();

      if (data.success) {
        setUserActivity(data.data.activities || []);
        setActivityStats(data.data.stats || null);
      }
    } catch (err) {
      console.error('Fetch user activity error:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditClick = () => {
    if (userData) {
      const initialFormData = {
        role: userData.role || '',
        status: userData.status || 'active',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        reason: '',
      };
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
      setShowEditModal(true);
      setError(null);
    }
  };

  const hasUnsavedChanges = () => {
    if (!originalFormData) return false;
    return (
      formData.role !== originalFormData.role ||
      formData.status !== originalFormData.status ||
      formData.firstName !== originalFormData.firstName ||
      formData.lastName !== originalFormData.lastName ||
      formData.reason !== originalFormData.reason
    );
  };

  const hasRoleChange = () => {
    return originalFormData && formData.role !== originalFormData.role;
  };

  const validateForm = () => {
    if (!formData.firstName?.trim()) {
      toast.showError('First name is required');
      return false;
    }
    if (!formData.lastName?.trim()) {
      toast.showError('Last name is required');
      return false;
    }
    if (!formData.role) {
      toast.showError('Role is required');
      return false;
    }
    if (!formData.status) {
      toast.showError('Status is required');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updateData = {
        ...(formData.role !== originalFormData.role && { role: formData.role }),
        ...(formData.status !== originalFormData.status && { status: formData.status }),
        ...(formData.firstName !== originalFormData.firstName && { firstName: formData.firstName.trim() }),
        ...(formData.lastName !== originalFormData.lastName && { lastName: formData.lastName.trim() }),
        ...(formData.reason && { reason: formData.reason }),
      };

      if (Object.keys(updateData).length === 0) {
        toast.showWarning('No changes to save');
        setIsSaving(false);
        return;
      }

      const response = await fetch(`/api/users/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update user');
      }

      toast.showSuccess('User updated successfully!');
      setShowEditModal(false);
      await fetchUserData();
      await fetchRoleHistory();
      setFormData((prev) => ({ ...prev, reason: '' }));
      setOriginalFormData(null);
    } catch (err) {
      toast.showError(err.message || 'Failed to update user');
      console.error('Update user error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivateClick = () => {
    setShowActivateModal(true);
  };

  const handleActivate = async () => {

    try {
      const response = await fetch(`/api/users/${params.id}/activate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to activate user');
      }

      toast.showSuccess('User activated successfully!');
      setShowActivateModal(false);
      await fetchUserData();
      await fetchRoleHistory();
    } catch (err) {
      toast.showError(err.message || 'Failed to activate user');
      console.error('Activate user error:', err);
    }
  };

  const handleDeactivateClick = () => {
    setShowDeactivateModal(true);
  };

  const handleDeactivate = async () => {

    try {
      const response = await fetch(`/api/users/${params.id}/deactivate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to deactivate user');
      }

      toast.showSuccess('User deactivated successfully!');
      setShowDeactivateModal(false);
      await fetchUserData();
      await fetchRoleHistory();
    } catch (err) {
      toast.showError(err.message || 'Failed to deactivate user');
      console.error('Deactivate user error:', err);
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      owner: 'bg-purple-100 text-purple-800',
      investor: 'bg-blue-100 text-blue-800',
      pm: 'bg-green-100 text-green-800',
      project_manager: 'bg-green-100 text-green-800',
      supervisor: 'bg-yellow-100 text-yellow-800',
      site_clerk: 'bg-gray-100 text-gray-800',
      accountant: 'bg-indigo-100 text-indigo-800',
      supplier: 'bg-orange-100 text-orange-800',
    };

    const normalizedRole = role?.toLowerCase() || 'unknown';
    const colorClass = colors[normalizedRole] || 'bg-gray-100 text-gray-800';
    const displayRole = normalizedRole === 'pm' || normalizedRole === 'project_manager' 
      ? 'Project Manager' 
      : normalizedRole === 'site_clerk' 
      ? 'Clerk' 
      : normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${colorClass}`}>
        {displayRole}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800',
      suspended: 'bg-yellow-100 text-yellow-800',
    };

    const colorClass = colors[status] || 'bg-gray-100 text-gray-800';
    const displayStatus = status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown';

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${colorClass}`}>
        {displayStatus}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!currentUser) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingCard count={3} showHeader={true} lines={6} />
        </div>
      </AppLayout>
    );
  }

  if (error && !userData) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
          <Link href="/dashboard/users" className="mt-4 text-blue-600 hover:underline">
            ← Back to Users
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!userData) {
    return null;
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={isSaving}
          message="Saving user changes..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/users" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Users
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                {userData.firstName || userData.lastName
                  ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
                  : 'User Details'}
              </h1>
              <p className="text-gray-700 mt-2">{userData.email}</p>
            </div>
            <div className="flex gap-2">
              {userData.status === 'active' ? (
                <button
                  onClick={handleDeactivateClick}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={handleActivateClick}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Activate
                </button>
              )}
              <button
                onClick={handleEditClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Error Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Edit Modal */}
        <EditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setError(null);
          }}
          onSave={handleSave}
          title="Edit User"
          isLoading={isSaving}
          hasUnsavedChanges={hasUnsavedChanges()}
          showRoleChangeWarning={hasRoleChange()}
        >
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role || ''}
                  onChange={handleInputChange}
                  required
                  disabled={userData.role?.toLowerCase() === 'owner'}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-700"
                >
                  <option value="site_clerk">Clerk</option>
                  <option value="pm">Project Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="accountant">Accountant</option>
                  <option value="investor">Investor</option>
                  <option value="supplier">Supplier</option>
                  {userData.role?.toLowerCase() === 'owner' && <option value="owner">Owner</option>}
                </select>
                {userData.role?.toLowerCase() === 'owner' && (
                  <p className="text-sm text-gray-700 mt-1">Owner role cannot be changed</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status || 'active'}
                  onChange={handleInputChange}
                  required
                  disabled={userData.role?.toLowerCase() === 'owner'}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-700"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Change (optional)
                </label>
                <textarea
                  name="reason"
                  value={formData.reason || ''}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Enter reason for role/status change..."
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                />
              </div>
            </div>
          </form>
        </EditModal>

        {/* User Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Role</h3>
            <div className="mt-2">{getRoleBadge(userData.role)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Status</h3>
            <div className="mt-2">{getStatusBadge(userData.status)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Email Verified</h3>
            <div className="mt-2">
              {userData.isVerified ? (
                <span className="text-green-600 font-medium">Yes</span>
              ) : (
                <span className="text-red-600 font-medium">No</span>
              )}
            </div>
          </div>
        </div>

        {/* User Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">User Information</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-700">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{userData.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700">First Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{userData.firstName || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700">Last Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{userData.lastName || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(userData.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700">Last Login</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(userData.lastLogin)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700">Last Activity</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(userData.metadata?.lastActivityAt)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Activity Statistics */}
        {activityStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-base font-semibold text-gray-700 mb-1 leading-normal">Total Logins</h3>
              <p className="text-2xl font-bold text-gray-900">{activityStats.totalLogins || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-base font-semibold text-gray-700 mb-1 leading-normal">Role Changes</h3>
              <p className="text-2xl font-bold text-gray-900">{activityStats.totalRoleChanges || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-base font-semibold text-gray-700 mb-1 leading-normal">Total Actions</h3>
              <p className="text-2xl font-bold text-gray-900">{activityStats.totalActions || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-base font-semibold text-gray-700 mb-1 leading-normal">Unread Notifications</h3>
              <p className="text-2xl font-bold text-gray-900">{activityStats.unreadNotifications || 0}</p>
            </div>
          </div>
        )}

        {/* Role Change History */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Role Change History</h2>
          {roleHistory.length === 0 ? (
            <p className="text-gray-700">No role changes recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      From
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      To
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Changed By
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {roleHistory.map((change) => (
                    <tr key={change.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(change.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(change.oldRole)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(change.newRole)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {change.changedBy?.name || change.changedBy?.email || 'System'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {change.reason || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* User Activity Timeline */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Timeline</h2>
          {loadingActivity ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-700">Loading activity...</p>
            </div>
          ) : userActivity.length === 0 ? (
            <p className="text-gray-700">No activity recorded</p>
          ) : (
            <div className="space-y-4">
              {userActivity.map((activity, index) => {
                const getActivityIcon = (type) => {
                  const icons = {
                    login: '🔐',
                    account_created: '✨',
                    role_change: '👤',
                    action: '📝',
                    notification: '🔔',
                  };
                  return icons[type] || '📌';
                };

                const getActivityColor = (type) => {
                  const colors = {
                    login: 'bg-blue-100 text-blue-800',
                    account_created: 'bg-green-100 text-green-800',
                    role_change: 'bg-purple-100 text-purple-800',
                    action: 'bg-gray-100 text-gray-800',
                    notification: 'bg-yellow-100 text-yellow-800',
                  };
                  return colors[type] || 'bg-gray-100 text-gray-800';
                };

                return (
                  <div key={activity.id || index} className="flex items-start gap-4 pb-4 border-b border-gray-200 last:border-0">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${getActivityColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-sm text-gray-700 mt-1 leading-normal">{formatDate(activity.timestamp)}</p>
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 text-sm text-gray-700">
                          {activity.metadata.reason && (
                            <p className="italic">Reason: {activity.metadata.reason}</p>
                          )}
                          {activity.metadata.changedBy && (
                            <p>Changed by: {activity.metadata.changedBy}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activate User Confirmation Modal */}
      <ConfirmationModal
        isOpen={showActivateModal}
        onClose={() => setShowActivateModal(false)}
        onConfirm={handleActivate}
        title="Activate User"
        message="Are you sure you want to activate this user?"
        confirmText="Activate"
        cancelText="Cancel"
        variant="info"
      />

      {/* Deactivate User Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        onConfirm={handleDeactivate}
        title="Deactivate User"
        message="Are you sure you want to deactivate this user? They will not be able to log in."
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="warning"
      />
    </AppLayout>
  );
}



