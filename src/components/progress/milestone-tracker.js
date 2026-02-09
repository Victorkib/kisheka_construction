/**
 * Milestone Tracker Component
 * Component for managing project milestones
 * 
 * @component
 */

'use client';

import { useState, useEffect } from 'react';
import { ConfirmationModal, EditModal } from '@/components/modals';
import { useToast } from '@/components/toast';

export function MilestoneTracker({ projectId, milestones = [], onMilestoneUpdate }) {
  const toast = useToast();
  const [milestonesList, setMilestonesList] = useState(milestones);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    targetDate: '',
    completedDate: '',
    completionPercentage: 0,
    notes: '',
  });
  const [originalFormData, setOriginalFormData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMilestoneId, setDeleteMilestoneId] = useState(null);

  useEffect(() => {
    setMilestonesList(milestones);
  }, [milestones]);

  const handleAdd = () => {
    setEditingId(null);
    const initialFormData = {
      name: '',
      targetDate: '',
      completedDate: '',
      completionPercentage: 0,
      notes: '',
    };
    setFormData(initialFormData);
    setOriginalFormData(initialFormData);
    setShowEditModal(true);
    setError(null);
  };

  const handleEdit = (milestone) => {
    setEditingId(milestone._id?.toString() || milestone._id || milestone.tempId);
    const initialFormData = {
      name: milestone.name || '',
      targetDate: milestone.targetDate 
        ? new Date(milestone.targetDate).toISOString().split('T')[0]
        : '',
      completedDate: milestone.completedDate
        ? new Date(milestone.completedDate).toISOString().split('T')[0]
        : '',
      completionPercentage: milestone.completionPercentage || 0,
      notes: milestone.notes || '',
    };
    setFormData(initialFormData);
    setOriginalFormData(initialFormData);
    setShowEditModal(true);
    setError(null);
  };

  const hasUnsavedChanges = () => {
    if (!originalFormData) return false;
    return (
      formData.name !== originalFormData.name ||
      formData.targetDate !== originalFormData.targetDate ||
      formData.completedDate !== originalFormData.completedDate ||
      formData.completionPercentage !== originalFormData.completionPercentage ||
      formData.notes !== originalFormData.notes
    );
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.showError('Milestone name is required');
      setError('Milestone name is required');
      return;
    }

    if (formData.completionPercentage < 0 || formData.completionPercentage > 100) {
      toast.showError('Completion percentage must be between 0 and 100');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const endpoint = `/api/projects/${projectId}/progress`;
      const action = editingId ? 'update' : 'add';

      // Find the milestone to get its name for fallback
      const existingMilestone = editingId 
        ? milestonesList.find((m) => (m._id?.toString() || m._id || m.tempId) === editingId)
        : null;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          milestone: editingId
            ? {
                _id: editingId,
                name: formData.name || existingMilestone?.name, // Include name as fallback
                ...formData,
              }
            : formData,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save milestone');
      }

      // Notify parent
      if (onMilestoneUpdate) {
        onMilestoneUpdate(data.data);
      }

      setShowEditModal(false);
      setEditingId(null);
      setFormData({
        name: '',
        targetDate: '',
        completedDate: '',
        completionPercentage: 0,
        notes: '',
      });
      setOriginalFormData(null);
      toast.showSuccess(editingId ? 'Milestone updated successfully!' : 'Milestone added successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to save milestone');
      setError(err.message);
      console.error('Save milestone error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (milestoneId) => {
    setDeleteMilestoneId(milestoneId);
    setShowDeleteModal(true);
  };

  const handleDelete = async (milestoneId) => {
    setLoading(true);
    setError(null);

    try {
      // Find the milestone to get its name for fallback
      const milestone = milestonesList.find(
        (m) => (m._id?.toString() || m._id || m.tempId) === milestoneId
      );

      const response = await fetch(`/api/projects/${projectId}/progress?milestoneId=${milestoneId}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete milestone');
      }

      // Notify parent
      if (onMilestoneUpdate) {
        onMilestoneUpdate(data.data);
      }

      setShowDeleteModal(false);
      setDeleteMilestoneId(null);
      toast.showSuccess('Milestone deleted successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to delete milestone');
      setError(err.message);
      console.error('Delete milestone error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCompletionColor = (percentage) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Milestones</h3>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add Milestone
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Edit Milestone Modal */}
      <EditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingId(null);
          setError(null);
        }}
        onSave={handleSubmit}
        title={editingId ? 'Edit Milestone' : 'Add New Milestone'}
        isLoading={isSaving}
        hasUnsavedChanges={hasUnsavedChanges()}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Milestone Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Foundation Complete"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={formData.targetDate || ''}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Completed Date
                </label>
                <input
                  type="date"
                  value={formData.completedDate || ''}
                  onChange={(e) => setFormData({ ...formData, completedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Completion Percentage: {formData.completionPercentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.completionPercentage || 0}
                onChange={(e) => setFormData({ ...formData, completionPercentage: parseInt(e.target.value) || 0 })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </form>
      </EditModal>

      {milestonesList.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No milestones added yet</p>
      ) : (
        <div className="space-y-3">
          {milestonesList.map((milestone, index) => {
            const milestoneId = milestone._id?.toString() || milestone._id || milestone.tempId || index;
            const completionPercentage = milestone.completionPercentage || 0;
            
            return (
              <div
                key={milestoneId}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{milestone.name}</h4>
                    {milestone.targetDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Target: {new Date(milestone.targetDate).toLocaleDateString()}
                      </p>
                    )}
                    {milestone.completedDate && (
                      <p className="text-xs text-green-600 mt-1">
                        Completed: {new Date(milestone.completedDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(milestone)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(milestoneId)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">Progress</span>
                    <span className="text-xs font-medium text-gray-900">
                      {completionPercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getCompletionColor(completionPercentage)}`}
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>

                {milestone.notes && (
                  <p className="text-sm text-gray-600 mt-2">{milestone.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Milestone Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteMilestoneId(null);
        }}
        onConfirm={() => {
          if (deleteMilestoneId) {
            handleDelete(deleteMilestoneId);
          }
        }}
        title="Delete Milestone"
        message={
          deleteMilestoneId ? (() => {
            const milestone = milestonesList.find(
              (m) => (m._id?.toString() || m._id || m.tempId) === deleteMilestoneId
            );
            return milestone ? (
              <>
                <p className="mb-3">
                  Are you sure you want to delete the milestone <strong>"{milestone.name}"</strong>?
                </p>
                <p className="text-red-600 font-medium">This action cannot be undone.</p>
              </>
            ) : (
              'Are you sure you want to delete this milestone? This action cannot be undone.'
            );
          })() : 'Are you sure you want to delete this milestone? This action cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={loading}
      />
    </div>
  );
}

