/**
 * Work Item Detail Page
 * Displays work item details, tracking, and allows editing
 * 
 * Route: /work-items/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { WORK_ITEM_STATUSES, WORK_ITEM_CATEGORIES, WORK_ITEM_PRIORITIES, getStatusColor, getPriorityColor, getPriorityLabel } from '@/lib/constants/work-item-constants';

export default function WorkItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { canAccess, user } = usePermissions();
  const [workItem, setWorkItem] = useState(null);
  const [phase, setPhase] = useState(null);
  const [project, setProject] = useState(null);
  const [dependencies, setDependencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    status: 'not_started',
    estimatedHours: '',
    actualHours: '',
    estimatedCost: '',
    actualCost: '',
    startDate: '',
    plannedEndDate: '',
    priority: 3,
    notes: ''
  });

  useEffect(() => {
    fetchWorkItem();
  }, [params.id]);

  useEffect(() => {
    if (user) {
      const role = user.role?.toLowerCase();
      setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
      setCanDelete(role === 'owner');
    }
  }, [user]);

  const fetchWorkItem = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/work-items/${params.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch work item');
      }

      setWorkItem(data.data);
      
      // Populate form data
      setFormData({
        name: data.data.name || '',
        description: data.data.description || '',
        category: data.data.category || '',
        status: data.data.status || 'not_started',
        estimatedHours: data.data.estimatedHours || '',
        actualHours: data.data.actualHours || '',
        estimatedCost: data.data.estimatedCost || '',
        actualCost: data.data.actualCost || '',
        startDate: data.data.startDate ? new Date(data.data.startDate).toISOString().split('T')[0] : '',
        plannedEndDate: data.data.plannedEndDate ? new Date(data.data.plannedEndDate).toISOString().split('T')[0] : '',
        priority: data.data.priority || 3,
        notes: data.data.notes || ''
      });
      
      // Fetch phase
      if (data.data.phaseId) {
        const phaseResponse = await fetch(`/api/phases/${data.data.phaseId}`);
        const phaseData = await phaseResponse.json();
        if (phaseData.success) {
          setPhase(phaseData.data);
          
          // Fetch project
          if (phaseData.data.projectId) {
            const projectResponse = await fetch(`/api/projects/${phaseData.data.projectId}`);
            const projectData = await projectResponse.json();
            if (projectData.success) {
              setProject(projectData.data);
            }
          }
        }
      }

      // Fetch dependencies
      if (data.data.dependencies && data.data.dependencies.length > 0) {
        const depIds = data.data.dependencies.map(id => id.toString()).join(',');
        const depResponse = await fetch(`/api/work-items?${data.data.dependencies.map((id, idx) => `_id=${id}`).join('&')}`);
        // Actually, we need to fetch each dependency individually or use a different approach
        // For now, we'll just store the IDs
        setDependencies(data.data.dependencies);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch work item error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/work-items/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : 0,
          actualHours: formData.actualHours ? parseFloat(formData.actualHours) : 0,
          estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : 0,
          actualCost: formData.actualCost ? parseFloat(formData.actualCost) : 0,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update work item');
      }

      toast.showSuccess('Work item updated successfully');
      setShowEditModal(false);
      fetchWorkItem();
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to update work item');
      console.error('Update work item error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/work-items/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete work item');
      }

      toast.showSuccess('Work item deleted successfully');
      router.push('/work-items');
    } catch (err) {
      toast.showError(err.message || 'Failed to delete work item');
      console.error('Delete work item error:', err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (error || !workItem) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Work item not found'}
          </div>
          <Link href="/work-items" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Work Items
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/work-items" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Work Items
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{workItem.name}</h1>
              <p className="text-gray-600 mt-1">
                {workItem.category?.replace(/\b\w/g, l => l.toUpperCase()) || 'Work Item'}
              </p>
              {project && phase && (
                <div className="mt-2 space-x-4 text-sm">
                  <Link 
                    href={`/projects/${project._id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Project: {project.projectName}
                  </Link>
                  <span className="text-gray-400">•</span>
                  <Link 
                    href={`/phases/${phase._id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Phase: {phase.phaseName}
                  </Link>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Status</p>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(workItem.status)}`}>
              {workItem.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
            </span>
            <p className="text-sm text-gray-600 mt-4">Priority</p>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getPriorityColor(workItem.priority)}`}>
              {getPriorityLabel(workItem.priority)}
            </span>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Estimated Hours</p>
            <p className="text-2xl font-bold text-gray-900">
              {workItem.estimatedHours || 0}h
            </p>
            <p className="text-sm text-gray-600 mt-4">Actual Hours</p>
            <p className="text-xl font-semibold text-blue-600">
              {workItem.actualHours || 0}h
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Estimated Cost</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(workItem.estimatedCost || 0)}
            </p>
            <p className="text-sm text-gray-600 mt-4">Actual Cost</p>
            <p className="text-xl font-semibold text-blue-600">
              {formatCurrency(workItem.actualCost || 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Dates</p>
            <p className="text-sm text-gray-900">
              Start: {formatDate(workItem.startDate)}<br />
              {workItem.plannedEndDate && (
                <>Planned End: {formatDate(workItem.plannedEndDate)}<br /></>
              )}
              {workItem.actualEndDate && (
                <>Actual End: {formatDate(workItem.actualEndDate)}</>
              )}
            </p>
          </div>
        </div>

        {/* Description */}
        {workItem.description && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{workItem.description}</p>
          </div>
        )}

        {/* Dependencies */}
        {workItem.dependencies && workItem.dependencies.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dependencies</h2>
            <p className="text-sm text-gray-600">
              This work item depends on {workItem.dependencies.length} other work item(s).
            </p>
          </div>
        )}

        {/* Notes */}
        {workItem.notes && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{workItem.notes}</p>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && canEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Edit Work Item</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Work Item Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Category</option>
                        {WORK_ITEM_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category.replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {WORK_ITEM_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority} - {priority === 1 ? 'Critical' : priority === 2 ? 'High' : priority === 3 ? 'Medium' : priority === 4 ? 'Low' : 'Very Low'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estimated Hours
                      </label>
                      <input
                        type="number"
                        name="estimatedHours"
                        value={formData.estimatedHours}
                        onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Actual Hours
                      </label>
                      <input
                        type="number"
                        name="actualHours"
                        value={formData.actualHours}
                        onChange={(e) => setFormData({ ...formData, actualHours: e.target.value })}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estimated Cost (KES)
                      </label>
                      <input
                        type="number"
                        name="estimatedCost"
                        value={formData.estimatedCost}
                        onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Actual Cost (KES)
                      </label>
                      <input
                        type="number"
                        name="actualCost"
                        value={formData.actualCost}
                        onChange={(e) => setFormData({ ...formData, actualCost: e.target.value })}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Planned End Date
                      </label>
                      <input
                        type="date"
                        name="plannedEndDate"
                        value={formData.plannedEndDate}
                        onChange={(e) => setFormData({ ...formData, plannedEndDate: e.target.value })}
                        min={formData.startDate}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {WORK_ITEM_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      loading={saving}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Changes
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Work Item"
          message={`Are you sure you want to delete "${workItem.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmColor="red"
          isLoading={deleting}
        />
      </div>
    </AppLayout>
  );
}

