/**
 * Phase Milestones Tab Component
 * Displays and manages phase milestones with enhanced features
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { MilestoneCard } from '@/components/phases/MilestoneCard';
import { getMilestoneStatistics, updateMilestoneStatuses } from '@/lib/constants/milestone-constants';

export function MilestonesTab({ phase, canEdit, formatDate }) {
  const toast = useToast();
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetDate: '',
    completionCriteria: [],
    signOffRequired: false,
    newCriterion: ''
  });

  useEffect(() => {
    if (phase?._id) {
      fetchMilestones();
    }
  }, [phase?._id]);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/phases/${phase._id}/milestones`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        const updatedMilestones = updateMilestoneStatuses(data.data || []);
        setMilestones(updatedMilestones);
        setStats(getMilestoneStatistics(updatedMilestones));
      }
    } catch (err) {
      console.error('Fetch milestones error:', err);
      toast.showError('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMilestone = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingMilestone
        ? `/api/phases/${phase._id}/milestones/${editingMilestone.milestoneId}`
        : `/api/phases/${phase._id}/milestones`;
      
      const method = editingMilestone ? 'PATCH' : 'POST';

      const payload = {
        name: formData.name,
        description: formData.description,
        targetDate: formData.targetDate,
        completionCriteria: formData.completionCriteria,
        signOffRequired: formData.signOffRequired
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save milestone');
      }

      toast.showSuccess(editingMilestone ? 'Milestone updated successfully' : 'Milestone created successfully');
      setShowAddModal(false);
      setEditingMilestone(null);
      setFormData({
        name: '',
        description: '',
        targetDate: '',
        completionCriteria: [],
        signOffRequired: false,
        newCriterion: ''
      });
      fetchMilestones();
    } catch (err) {
      toast.showError(err.message || 'Failed to save milestone');
      console.error('Save milestone error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      name: milestone.name || '',
      description: milestone.description || '',
      targetDate: milestone.targetDate ? new Date(milestone.targetDate).toISOString().split('T')[0] : '',
      completionCriteria: milestone.completionCriteria || [],
      signOffRequired: milestone.signOffRequired || false,
      newCriterion: ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (milestone) => {
    if (!confirm(`Are you sure you want to delete "${milestone.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/phases/${phase._id}/milestones/${milestone.milestoneId}`, {
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

      toast.showSuccess('Milestone deleted successfully');
      fetchMilestones();
    } catch (err) {
      toast.showError(err.message || 'Failed to delete milestone');
      console.error('Delete milestone error:', err);
    }
  };

  const addCriterion = () => {
    if (formData.newCriterion.trim()) {
      setFormData({
        ...formData,
        completionCriteria: [...formData.completionCriteria, formData.newCriterion.trim()],
        newCriterion: ''
      });
    }
  };

  const removeCriterion = (index) => {
    setFormData({
      ...formData,
      completionCriteria: formData.completionCriteria.filter((_, i) => i !== index)
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading milestones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Milestones</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.pending}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.overdue}</p>
            </div>
          </div>
          {stats.total > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Completion Rate</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${stats.completionPercentage}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">{stats.completionPercentage}%</p>
            </div>
          )}
        </div>
      )}

      {/* Milestones Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Milestones ({milestones.length})
          </h3>
          {canEdit && (
            <button
              onClick={() => {
                setEditingMilestone(null);
                setFormData({
                  name: '',
                  description: '',
                  targetDate: '',
                  completionCriteria: [],
                  signOffRequired: false,
                  newCriterion: ''
                });
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Milestone
            </button>
          )}
        </div>

        {milestones.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No milestones defined for this phase</p>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingMilestone(null);
                  setFormData({
                    name: '',
                    description: '',
                    targetDate: '',
                    completionCriteria: [],
                    signOffRequired: false,
                    newCriterion: ''
                  });
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Milestone
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {milestones.map((milestone) => (
              <MilestoneCard
                key={milestone.milestoneId?.toString() || milestone._id?.toString()}
                milestone={{ ...milestone, phaseId: phase._id }}
                canEdit={canEdit}
                onEdit={() => handleEdit(milestone)}
                onDelete={() => handleDelete(milestone)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Timeline View */}
      {milestones.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Milestone Timeline</h3>
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
            
            {/* Milestones */}
            <div className="space-y-6">
              {milestones.map((milestone, index) => {
                const status = milestone.status || 'pending';
                return (
                  <div key={milestone.milestoneId?.toString() || index} className="relative pl-12">
                    {/* Timeline Dot */}
                    <div className={`
                      absolute left-2 top-1 w-4 h-4 rounded-full border-2 border-white
                      ${status === 'completed' ? 'bg-green-500' : 
                        status === 'overdue' ? 'bg-red-500' : 'bg-gray-400'}
                    `}></div>
                    
                    {/* Milestone Content */}
                    <div>
                      <h4 className="font-semibold text-gray-900">{milestone.name || `Milestone ${index + 1}`}</h4>
                      {milestone.targetDate && (
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDate(milestone.targetDate)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Milestone Modal */}
      {showAddModal && canEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingMilestone ? 'Edit Milestone' : 'Add Milestone'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingMilestone(null);
                    setFormData({
                      name: '',
                      description: '',
                      targetDate: '',
                      completionCriteria: [],
                      signOffRequired: false,
                      newCriterion: ''
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveMilestone} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Milestone Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
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
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Criteria
                  </label>
                  <div className="space-y-2">
                    {formData.completionCriteria.map((criterion, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                          {criterion}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCriterion(index)}
                          className="px-3 py-2 text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.newCriterion}
                        onChange={(e) => setFormData({ ...formData, newCriterion: e.target.value })}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCriterion();
                          }
                        }}
                        placeholder="Add completion criterion..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addCriterion}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.signOffRequired}
                      onChange={(e) => setFormData({ ...formData, signOffRequired: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Require Sign-Off</span>
                  </label>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingMilestone(null);
                      setFormData({
                        name: '',
                        description: '',
                        targetDate: '',
                        completionCriteria: [],
                        signOffRequired: false,
                        newCriterion: ''
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
                    {saving ? 'Saving...' : editingMilestone ? 'Update' : 'Add'} Milestone
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

export default MilestonesTab;
