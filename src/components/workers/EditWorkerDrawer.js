/**
 * Edit Worker Drawer Component
 * Slide-out drawer for editing worker information
 * 
 * Features:
 * - Pre-fills form with worker data
 * - Form validation
 * - Unsaved changes warning
 * - Save with loading state
 * - Error handling
 * - Skills selection UI
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Drawer } from '@/components/drawer';
import { EditWorkerSkeleton } from './EditWorkerSkeleton';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast/toast-container';
import {
  VALID_SKILL_TYPES,
  VALID_WORKER_TYPES,
  VALID_EMPLOYMENT_TYPES,
  VALID_WORKER_STATUSES,
  getSkillTypeLabel,
  getWorkerTypeLabel,
} from '@/lib/constants/labour-constants';

/**
 * Edit Worker Drawer
 * @param {Object} props
 * @param {string} props.workerId - Worker ID to edit
 * @param {boolean} props.isOpen - Is drawer open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler (called after successful save)
 */
export function EditWorkerDrawer({ workerId, isOpen, onClose, onSave }) {
  const toast = useToast();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const initialFormDataRef = useRef(null);

  const [formData, setFormData] = useState({
    workerName: '',
    employeeId: '',
    workerType: 'internal',
    phoneNumber: '',
    email: '',
    skillTypes: [],
    defaultHourlyRate: 0,
    defaultDailyRate: '',
    employmentType: 'casual',
    status: 'active',
  });

  // Fetch worker data when drawer opens
  useEffect(() => {
    if (isOpen && workerId) {
      fetchWorker();
    } else {
      // Reset state when drawer closes
      setWorker(null);
      setFormData({
        workerName: '',
        employeeId: '',
        workerType: 'internal',
        phoneNumber: '',
        email: '',
        skillTypes: [],
        defaultHourlyRate: 0,
        defaultDailyRate: '',
        employmentType: 'casual',
        status: 'active',
      });
      setError(null);
      setHasUnsavedChanges(false);
      setShowUnsavedWarning(false);
      initialFormDataRef.current = null;
    }
  }, [isOpen, workerId]);

  // Track unsaved changes
  useEffect(() => {
    if (initialFormDataRef.current) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData]);

  const fetchWorker = async () => {
    if (!workerId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/labour/workers/${workerId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch worker details');
      }

      const workerData = data.data;
      setWorker(workerData);

      // Initialize form data
      const initialData = {
        workerName: workerData.workerName || '',
        employeeId: workerData.employeeId || '',
        workerType: workerData.workerType || 'internal',
        phoneNumber: workerData.phoneNumber || '',
        email: workerData.email || '',
        skillTypes: workerData.skillTypes || [],
        defaultHourlyRate: workerData.defaultHourlyRate || 0,
        defaultDailyRate: workerData.defaultDailyRate || '',
        employmentType: workerData.employmentType || 'casual',
        status: workerData.status || 'active',
      };

      setFormData(initialData);
      initialFormDataRef.current = JSON.parse(JSON.stringify(initialData));
    } catch (err) {
      console.error('Error fetching worker:', err);
      setError(err.message);
      toast.showError('Failed to load worker details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const toggleSkill = (skill) => {
    setFormData((prev) => ({
      ...prev,
      skillTypes: prev.skillTypes.includes(skill)
        ? prev.skillTypes.filter((s) => s !== skill)
        : [...prev.skillTypes, skill],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updateResponse = await fetch(`/api/labour/workers/${workerId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          ...formData,
          defaultHourlyRate: parseFloat(formData.defaultHourlyRate) || 0,
          defaultDailyRate: formData.defaultDailyRate ? parseFloat(formData.defaultDailyRate) : null,
        }),
      });

      const data = await updateResponse.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update worker');
      }

      toast.showSuccess('Worker updated successfully');
      setHasUnsavedChanges(false);
      initialFormDataRef.current = JSON.parse(JSON.stringify(formData));
      onSave();
    } catch (err) {
      console.error('Error updating worker:', err);
      setError(err.message);
      toast.showError(err.message || 'Failed to update worker');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedWarning(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowUnsavedWarning(false);
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={handleCloseAttempt}
        title={worker ? `Edit Worker: ${worker.workerName}` : 'Edit Worker'}
        size="lg"
        isLoading={(loading && !worker) || saving}
        loadingMessage={saving ? 'Saving worker...' : 'Loading worker information...'}
        preventCloseDuringLoading={true}
        closeOnBackdrop={true}
        footer={
          worker && (
            <div className="flex items-center justify-between">
              {hasUnsavedChanges && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  Unsaved changes
                </p>
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={handleCloseAttempt}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  form="edit-worker-form"
                  loading={saving}
                  loadingText="Saving..."
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </LoadingButton>
              </div>
            </div>
          )
        }
      >
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => fetchWorker()}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Reload worker data
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !worker && <EditWorkerSkeleton />}

        {/* Form */}
        {worker && !loading && (
          <form id="edit-worker-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Worker Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="workerName"
                  value={formData.workerName}
                  onChange={handleChange}
                  required
                  minLength={2}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Worker Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="workerType"
                  value={formData.workerType}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {VALID_WORKER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getWorkerTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {VALID_WORKER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+254 700 000 000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="worker@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hourly Rate (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="defaultHourlyRate"
                  step="0.01"
                  min="0"
                  value={formData.defaultHourlyRate}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Rate (KES)
                </label>
                <input
                  type="number"
                  name="defaultDailyRate"
                  step="0.01"
                  min="0"
                  value={formData.defaultDailyRate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="employmentType"
                  value={formData.employmentType}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {VALID_EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Skills Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skills
              </label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto bg-gray-50">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {VALID_SKILL_TYPES.map((skill) => (
                    <label
                      key={skill}
                      className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.skillTypes.includes(skill)}
                        onChange={() => toggleSkill(skill)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{getSkillTypeLabel(skill)}</span>
                    </label>
                  ))}
                </div>
              </div>
              {formData.skillTypes.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {formData.skillTypes.length} skill{formData.skillTypes.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </form>
        )}
      </Drawer>

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unsaved Changes</h3>
            <p className="text-sm text-gray-600 mb-4">
              You have unsaved changes. Are you sure you want to close without saving?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCancelClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClose}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EditWorkerDrawer;
