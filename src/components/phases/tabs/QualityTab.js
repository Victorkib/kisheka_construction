/**
 * Phase Quality Tab Component
 * Displays and manages quality checkpoints for a phase
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { QualityCheckpointCard } from '@/components/phases/QualityCheckpointCard';
import { getQualityCheckpointStatistics, QUALITY_CHECKPOINT_STATUSES } from '@/lib/constants/quality-checkpoint-constants';

export function QualityTab({ phase, canEdit, formatDate }) {
  const toast = useToast();
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCheckpoint, setEditingCheckpoint] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    required: true
  });

  useEffect(() => {
    if (phase?._id) {
      fetchCheckpoints();
    }
  }, [phase?._id]);

  const fetchCheckpoints = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/phases/${phase._id}/quality-checkpoints`);
      const data = await response.json();
      if (data.success) {
        setCheckpoints(data.data || []);
        setStats(getQualityCheckpointStatistics(data.data || []));
      }
    } catch (err) {
      console.error('Fetch quality checkpoints error:', err);
      toast.showError('Failed to load quality checkpoints');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCheckpoint = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingCheckpoint
        ? `/api/phases/${phase._id}/quality-checkpoints/${editingCheckpoint.checkpointId}`
        : `/api/phases/${phase._id}/quality-checkpoints`;
      
      const method = editingCheckpoint ? 'PATCH' : 'POST';

      const payload = {
        name: formData.name,
        description: formData.description,
        required: formData.required
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save quality checkpoint');
      }

      toast.showSuccess(editingCheckpoint ? 'Quality checkpoint updated successfully' : 'Quality checkpoint created successfully');
      setShowAddModal(false);
      setEditingCheckpoint(null);
      setFormData({
        name: '',
        description: '',
        required: true
      });
      fetchCheckpoints();
    } catch (err) {
      toast.showError(err.message || 'Failed to save quality checkpoint');
      console.error('Save quality checkpoint error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (checkpoint) => {
    setEditingCheckpoint(checkpoint);
    setFormData({
      name: checkpoint.name || '',
      description: checkpoint.description || '',
      required: checkpoint.required !== false
    });
    setShowAddModal(true);
  };

  const handleDelete = async (checkpoint) => {
    if (!confirm(`Are you sure you want to delete "${checkpoint.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/phases/${phase._id}/quality-checkpoints/${checkpoint.checkpointId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete quality checkpoint');
      }

      toast.showSuccess('Quality checkpoint deleted successfully');
      fetchCheckpoints();
    } catch (err) {
      toast.showError(err.message || 'Failed to delete quality checkpoint');
      console.error('Delete quality checkpoint error:', err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading quality checkpoints...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Total Checkpoints</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Passed</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.passed}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.pending}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pass Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.passRate}%</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Required</p>
              <p className="text-lg font-semibold text-orange-600 mt-1">{stats.required}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Optional</p>
              <p className="text-lg font-semibold text-gray-600 mt-1">{stats.optional}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quality Checkpoints Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Quality Checkpoints ({checkpoints.length})
          </h3>
          {canEdit && (
            <button
              onClick={() => {
                setEditingCheckpoint(null);
                setFormData({
                  name: '',
                  description: '',
                  required: true
                });
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Checkpoint
            </button>
          )}
        </div>

        {checkpoints.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No quality checkpoints defined for this phase</p>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingCheckpoint(null);
                  setFormData({
                    name: '',
                    description: '',
                    required: true
                  });
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Checkpoint
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {checkpoints.map((checkpoint) => (
              <QualityCheckpointCard
                key={checkpoint.checkpointId?.toString() || checkpoint._id?.toString()}
                checkpoint={{ ...checkpoint, phaseId: phase._id }}
                canEdit={canEdit}
                onEdit={() => handleEdit(checkpoint)}
                onDelete={() => handleDelete(checkpoint)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Quality Checkpoint Modal */}
      {showAddModal && canEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingCheckpoint ? 'Edit Quality Checkpoint' : 'Add Quality Checkpoint'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCheckpoint(null);
                    setFormData({
                      name: '',
                      description: '',
                      required: true
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveCheckpoint} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Checkpoint Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    minLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.required}
                      onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Required Checkpoint</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Required checkpoints must be inspected before phase completion
                  </p>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingCheckpoint(null);
                      setFormData({
                        name: '',
                        description: '',
                        required: true
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingCheckpoint ? 'Update' : 'Add'} Checkpoint
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QualityTab;

