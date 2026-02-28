/**
 * Profile Info Component
 * Displays and allows editing of profile information
 */

'use client';

import { useState } from 'react';

export function ProfileInfo({ user, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    role: user?.role || '',
    status: user?.status || '',
    createdAt: user?.createdAt || '',
    lastLogin: user?.lastLogin || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      role: user?.role || '',
      status: user?.status || '',
      createdAt: user?.createdAt || '',
      lastLogin: user?.lastLogin || '',
    });
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.firstName.trim()) {
      setError('First name is required');
      setLoading(false);
      return;
    }

    if (!formData.lastName.trim()) {
      setError('Last name is required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setIsEditing(false);
      if (onUpdate) {
        onUpdate(data.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const roleDisplay = {
    owner: 'Owner',
    investor: 'Investor',
    pm: 'Project Manager',
    project_manager: 'Project Manager',
    supervisor: 'Supervisor',
    site_clerk: 'Clerk',
    clerk: 'Clerk',
    accountant: 'Accountant',
    supplier: 'Supplier',
  }[formData.role?.toLowerCase()] || formData.role;

  return (
    <div className="ds-bg-surface rounded-lg shadow p-6 mb-6 border ds-border-subtle">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold ds-text-primary">Profile Information</h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* First Name */}
        <div>
          <label className="block text-sm font-medium ds-text-secondary mb-1">
            First Name
          </label>
          {isEditing ? (
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:ds-bg-surface-muted disabled:ds-text-muted"
              required
            />
          ) : (
            <p className="ds-text-primary">{formData.firstName || 'N/A'}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-sm font-medium ds-text-secondary mb-1">
            Last Name
          </label>
          {isEditing ? (
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:ds-bg-surface-muted disabled:ds-text-muted"
              required
            />
          ) : (
            <p className="ds-text-primary">{formData.lastName || 'N/A'}</p>
          )}
        </div>

        {/* Email (Read-only) */}
        <div>
          <label className="block text-sm font-medium ds-text-secondary mb-1">
            Email
          </label>
          <p className="ds-text-primary">{formData.email || 'N/A'}</p>
          <p className="text-xs ds-text-muted mt-1">
            Email cannot be changed. Contact administrator if you need to update your email.
          </p>
        </div>

        {/* Role (Read-only) */}
        <div>
          <label className="block text-sm font-medium ds-text-secondary mb-1">
            Role
          </label>
          <p className="ds-text-primary">{roleDisplay || 'N/A'}</p>
          <p className="text-xs ds-text-muted mt-1">
            Role is managed by system administrators.
          </p>
        </div>

        {/* Status (Read-only) */}
        <div>
          <label className="block text-sm font-medium ds-text-secondary mb-1">
            Status
          </label>
          <p className="ds-text-primary capitalize">{formData.status || 'N/A'}</p>
        </div>

        {/* Created At (Read-only) */}
        <div>
          <label className="block text-sm font-medium ds-text-secondary mb-1">
            Account Created
          </label>
          <p className="ds-text-primary">{formatDate(formData.createdAt)}</p>
        </div>

        {/* Last Login (Read-only) */}
        <div>
          <label className="block text-sm font-medium ds-text-secondary mb-1">
            Last Login
          </label>
          <p className="ds-text-primary">{formatDate(formData.lastLogin)}</p>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-3 pt-4 border-t ds-border-subtle">
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-slate-500 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface-muted transition font-medium disabled:ds-bg-surface-muted disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}





























