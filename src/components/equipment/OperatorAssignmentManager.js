/**
 * Operator Assignment Manager Component
 * Manages operator assignments for equipment
 *
 * @component
 * @param {string} equipmentId - Equipment ID
 * @param {string} projectId - Project ID
 * @param {object} equipment - Equipment details
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/loading';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';

export function OperatorAssignmentManager({
  equipmentId,
  projectId,
  equipment,
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);
  const [filter, setFilter] = useState('all');

  const [formData, setFormData] = useState({
    workerId: '',
    workerName: '',
    startDate: '',
    endDate: '',
    dailyRate: '',
    expectedHours: '8',
    notes: '',
  });

  useEffect(() => {
    fetchAssignments();
    fetchWorkers();
  }, [equipmentId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await fetch(`/api/equipment/${equipmentId}/operators/assignments${params}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (data.success) {
        // Enrich assignments with worker status
        const enrichedAssignments = await Promise.all(
          (data.data.assignments || []).map(async (assignment) => {
            if (assignment.workerId) {
              try {
                const workerResponse = await fetch(`/api/labour/workers/${assignment.workerId}`, {
                  cache: 'no-store',
                });
                const workerData = await workerResponse.json();
                if (workerData.success) {
                  return {
                    ...assignment,
                    workerStatus: workerData.data.status,
                    workerEmploymentType: workerData.data.employmentType,
                  };
                }
              } catch (err) {
                console.error('Error fetching worker status:', err);
              }
            }
            return assignment;
          })
        );
        setAssignments(enrichedAssignments);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkers = async () => {
    try {
      const response = await fetch('/api/users/by-role/worker?status=active&limit=200', {
        cache: 'no-store',
      });
      const data = await response.json();

      if (data.success) {
        // Transform worker profiles to match expected format
        const workers = (data.data.workers || []).map(w => ({
          _id: w._id,
          name: w.workerName,
          email: w.email || (w.user?.email),
          workerType: w.workerType,
          defaultHourlyRate: w.defaultHourlyRate,
          status: w.status,
          employmentType: w.employmentType,
        }));
        setWorkers(workers);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    }
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/equipment/${equipmentId}/operators/assignments`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.error?.conflicts) {
          const conflictMessages = data.error.conflicts.map(c => c.message).join('\n');
          throw new Error(`Conflicts detected:\n${conflictMessages}`);
        }
        throw new Error(data.error || 'Failed to create assignment');
      }

      toast.showSuccess('Operator assignment created successfully!');
      setShowAddModal(false);
      fetchAssignments();
      resetForm();
    } catch (err) {
      toast.showError(err.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAssignment = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/equipment/${equipmentId}/operators/assignments/${assignmentToEdit?._id}`, {
        method: 'PUT',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.error?.conflicts) {
          const conflictMessages = data.error.conflicts.map(c => c.message).join('\n');
          throw new Error(`Conflicts detected:\n${conflictMessages}`);
        }
        throw new Error(data.error || 'Failed to update assignment');
      }

      toast.showSuccess('Operator assignment updated successfully!');
      setShowEditModal(false);
      fetchAssignments();
      resetForm();
    } catch (err) {
      toast.showError(err.message || 'Failed to update assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/equipment/${equipmentId}/operators/assignments/${assignmentToDelete}`, {
        method: 'DELETE',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete assignment');
      }

      toast.showSuccess('Operator assignment deleted successfully!');
      setShowDeleteModal(false);
      fetchAssignments();
    } catch (err) {
      toast.showError(err.message || 'Failed to delete assignment');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      workerId: '',
      workerName: '',
      startDate: '',
      endDate: '',
      dailyRate: '',
      expectedHours: '8',
      notes: '',
    });
  };

  const openEditModal = (assignment) => {
    setAssignmentToEdit(assignment);
    setFormData({
      workerId: assignment.workerId || '',
      workerName: assignment.workerName || '',
      startDate: assignment.startDate ? new Date(assignment.startDate).toISOString().split('T')[0] : '',
      endDate: assignment.endDate ? new Date(assignment.endDate).toISOString().split('T')[0] : '',
      dailyRate: assignment.dailyRate?.toString() || '',
      expectedHours: assignment.expectedHours?.toString() || '8',
      notes: assignment.notes || '',
    });
    setShowEditModal(true);
  };

  const handleLogHours = (assignment) => {
    // Build URL with pre-filled parameters
    const params = new URLSearchParams({
      workerId: assignment.workerId || '',
      workerName: assignment.workerName || '', // PASS WORKER NAME!
      equipmentId: equipmentId,
      hourlyRate: (assignment.dailyRate / (assignment.expectedHours || 8)).toString(),
      dailyRate: assignment.dailyRate?.toString() || '',
      taskDescription: `Operating ${equipment?.equipmentName || 'equipment'} as per assignment ${assignment._id.toString().slice(-8)}`,
      // Auto-populate project/phase from equipment
      projectId: projectId || '',
      phaseId: equipment?.phaseId?.toString() || '',
    });

    // Redirect to labour entry form with pre-filled data
    router.push(`/labour/entries/new?${params.toString()}`);
  };

  const handleWorkerChange = (e) => {
    const workerId = e.target.value;
    const worker = workers.find(w => w._id === workerId);
    setFormData(prev => ({
      ...prev,
      workerId,
      workerName: worker ? worker.name || worker.email : '',
      // Auto-fill rate from worker profile
      dailyRate: worker && worker.defaultHourlyRate ? (worker.defaultHourlyRate * 8).toString() : prev.dailyRate,
    }));
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getWorkerStatusColor = (status) => {
    const colors = {
      active: 'text-green-600 bg-green-50',
      inactive: 'text-gray-600 bg-gray-50',
      terminated: 'text-red-600 bg-red-50',
      on_leave: 'text-yellow-600 bg-yellow-50',
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const scheduledAssignments = assignments.filter(a => a.status === 'scheduled');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold ds-text-primary">Operator Assignments</h3>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="ds-bg-accent-primary text-white px-4 py-2 rounded-lg hover:ds-bg-accent-hover font-semibold text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Assign Operator
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b ds-border-subtle">
        {['all', 'active', 'scheduled', 'completed', 'cancelled'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setFilter(status);
              fetchAssignments();
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === status
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent ds-text-secondary hover:ds-text-primary'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
          <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-2">
            Active Assignments
          </p>
          <p className="text-2xl font-bold text-green-600">{activeAssignments.length}</p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
          <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-2">
            Scheduled Assignments
          </p>
          <p className="text-2xl font-bold text-blue-600">{scheduledAssignments.length}</p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
          <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-2">
            Total Assignments
          </p>
          <p className="text-2xl font-bold ds-text-primary">{assignments.length}</p>
        </div>
      </div>

      {/* Assignments List */}
      {loading ? (
        <div className="ds-bg-surface rounded-lg shadow p-8 text-center">
          <LoadingSpinner size="md" />
          <p className="text-sm ds-text-secondary mt-2">Loading assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="ds-bg-surface rounded-lg shadow p-8 text-center border-2 border-dashed ds-border-subtle">
          <svg className="w-12 h-12 ds-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="ds-text-secondary mb-2">No operator assignments yet</p>
          <p className="text-sm ds-text-muted mb-4">Assign an operator to this equipment</p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="ds-bg-accent-primary text-white px-4 py-2 rounded-lg hover:ds-bg-accent-hover font-semibold text-sm"
          >
            Assign Operator
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div
              key={assignment._id}
              className="ds-bg-surface rounded-lg shadow border ds-border-subtle p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-bold ds-text-primary text-lg">{assignment.workerName}</h4>
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(assignment.status)}`}>
                      {assignment.status}
                    </span>
                    {assignment.workerStatus && (
                      <span className={`px-2 py-1 text-xs rounded ${getWorkerStatusColor(assignment.workerStatus)}`}>
                        {assignment.workerStatus.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                        Period
                      </p>
                      <p className="ds-text-primary">
                        {formatDate(assignment.startDate)} → {formatDate(assignment.endDate)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                        Rate
                      </p>
                      <p className="ds-text-primary font-bold">
                        KES {assignment.dailyRate?.toLocaleString()}/day
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                        Expected Hours
                      </p>
                      <p className="ds-text-primary">
                        {assignment.expectedHours || 8} hrs/day
                      </p>
                    </div>
                  </div>

                  {assignment.notes && (
                    <div className="mt-3 pt-3 border-t ds-border-subtle">
                      <p className="text-xs ds-text-secondary">{assignment.notes}</p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleLogHours(assignment)}
                      className="flex-1 ds-bg-accent-primary text-white px-3 py-2 rounded-lg hover:ds-bg-accent-hover font-semibold text-sm flex items-center justify-center gap-2"
                      title="Log hours for this assignment"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Log Hours
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(assignment)}
                    className="p-2 ds-bg-surface rounded-lg border ds-border-subtle hover:ds-bg-surface-muted hover:border-blue-400 transition-colors"
                    title="Edit assignment"
                  >
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentToDelete(assignment._id);
                      setShowDeleteModal(true);
                    }}
                    className="p-2 ds-bg-surface rounded-lg border ds-border-subtle hover:bg-red-50 hover:border-red-400 transition-colors"
                    title="Delete assignment"
                  >
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="ds-bg-surface rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold ds-text-primary">Assign Operator to Equipment</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="p-2 ds-bg-surface rounded-lg border ds-border-subtle hover:ds-bg-surface-muted"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddAssignment} className="space-y-4">
                {/* Worker Selection */}
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Operator <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.workerId}
                    onChange={handleWorkerChange}
                    required
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                  >
                    <option value="">Select Operator</option>
                    {workers.map((worker) => (
                      <option key={worker._id} value={worker._id}>
                        {worker.name || worker.email} - {worker.status === 'active' ? '✓' : '○'} ({worker.employmentType || 'casual'})
                      </option>
                    ))}
                  </select>
                  {formData.workerId && (
                    <p className="text-xs ds-text-secondary mt-1">
                      {workers.find(w => w._id === formData.workerId)?.status === 'active' 
                        ? '✓ Worker is active and available' 
                        : '○ Worker status may affect assignment'}
                    </p>
                  )}
                </div>

                {/* Assignment Period */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      required
                      min={formData.startDate}
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                    />
                  </div>
                </div>

                {/* Rate and Hours */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">
                      Daily Rate (KES) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.dailyRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dailyRate: e.target.value }))}
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">
                      Expected Hours/Day
                    </label>
                    <input
                      type="number"
                      value={formData.expectedHours}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedHours: e.target.value }))}
                      min="1"
                      max="24"
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Additional notes about the assignment..."
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t ds-border-subtle">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 ds-bg-surface-muted ds-text-primary font-bold rounded-lg hover:ds-bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-6 py-3 ds-bg-accent-primary text-white font-bold rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Creating...' : 'Create Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="ds-bg-surface rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold ds-text-primary">Edit Operator Assignment</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                    setAssignmentToEdit(null);
                  }}
                  className="p-2 ds-bg-surface rounded-lg border ds-border-subtle hover:ds-bg-surface-muted"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEditAssignment} className="space-y-4">
                {/* Worker Selection */}
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Operator <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.workerId}
                    onChange={handleWorkerChange}
                    required
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                  >
                    <option value="">Select Operator</option>
                    {workers.map((worker) => (
                      <option key={worker._id} value={worker._id}>
                        {worker.name || worker.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignment Period */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      required
                      min={formData.startDate}
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                    />
                  </div>
                </div>

                {/* Rate and Hours */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">
                      Daily Rate (KES) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.dailyRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dailyRate: e.target.value }))}
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">
                      Expected Hours/Day
                    </label>
                    <input
                      type="number"
                      value={formData.expectedHours}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedHours: e.target.value }))}
                      min="1"
                      max="24"
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Additional notes about the assignment..."
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t ds-border-subtle">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      resetForm();
                      setAssignmentToEdit(null);
                    }}
                    className="flex-1 px-6 py-3 ds-bg-surface-muted ds-text-primary font-bold rounded-lg hover:ds-bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-6 py-3 ds-bg-accent-primary text-white font-bold rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Updating...' : 'Update Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setAssignmentToDelete(null);
        }}
        onConfirm={handleDeleteAssignment}
        title="Delete Assignment"
        message="Are you sure you want to delete this operator assignment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

export default OperatorAssignmentManager;
