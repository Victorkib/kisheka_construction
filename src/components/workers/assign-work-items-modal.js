/**
 * Assign Work Items Modal Component
 * Allows selecting and assigning multiple work items to a worker
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, CheckCircle, Briefcase, Users, Loader } from 'lucide-react';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';

export function AssignWorkItemsModal({
  isOpen,
  onClose,
  workerId,
  workerName,
  onAssignComplete
}) {
  const toast = useToast();
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedWorkItems, setSelectedWorkItems] = useState(new Set());
  const [filters, setFilters] = useState({
    projectId: '',
    phaseId: '',
    status: '',
    search: '',
    unassigned: false
  });
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      fetchWorkItems();
    } else {
      // Reset when modal closes
      setSelectedWorkItems(new Set());
      setFilters({ projectId: '', phaseId: '', status: '', search: '', unassigned: false });
    }
  }, [isOpen]);

  useEffect(() => {
    if (filters.projectId) {
      fetchPhases(filters.projectId);
    } else {
      setPhases([]);
    }
  }, [filters.projectId]);

  useEffect(() => {
    if (isOpen) {
      fetchWorkItems();
    }
  }, [filters, isOpen]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects/accessible', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    }
  };

  const fetchWorkItems = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.projectId) queryParams.set('projectId', filters.projectId);
      if (filters.phaseId) queryParams.set('phaseId', filters.phaseId);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.unassigned) queryParams.set('unassigned', 'true');

      const response = await fetch(`/api/work-items?${queryParams.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (data.success) {
        setWorkItems(data.data?.workItems || []);
      }
    } catch (err) {
      console.error('Error fetching work items:', err);
      toast.showError('Failed to load work items');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelection = (workItemId) => {
    const newSelection = new Set(selectedWorkItems);
    if (newSelection.has(workItemId)) {
      newSelection.delete(workItemId);
    } else {
      newSelection.add(workItemId);
    }
    setSelectedWorkItems(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedWorkItems.size === filteredWorkItems.length) {
      setSelectedWorkItems(new Set());
    } else {
      setSelectedWorkItems(new Set(filteredWorkItems.map(item => item._id.toString())));
    }
  };

  const handleAssign = async () => {
    if (selectedWorkItems.size === 0) {
      toast.showError('Please select at least one work item');
      return;
    }

    try {
      setAssigning(true);
      const assignResponse = await fetch('/api/work-items/assign', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          workItemIds: Array.from(selectedWorkItems),
          workerIds: [workerId]
        }),
      });

      const data = await assignResponse.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to assign work items');
      }

      toast.showSuccess(`Successfully assigned ${data.data.assigned} work item(s) to ${workerName}`);
      
      if (onAssignComplete) {
        onAssignComplete();
      }
      
      onClose();
    } catch (err) {
      console.error('Error assigning work items:', err);
      toast.showError(err.message || 'Failed to assign work items');
    } finally {
      setAssigning(false);
    }
  };

  const filteredWorkItems = useMemo(() => {
    let filtered = workItems;

    // Filter out work items already assigned to this worker
    filtered = filtered.filter(item => {
      if (!item.assignedWorkers || item.assignedWorkers.length === 0) return true;
      return !item.assignedWorkers.some(w => 
        (w._id?.toString() === workerId) || (w.userId?.toString() === workerId)
      );
    });

    return filtered;
  }, [workItems, workerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="ds-bg-surface rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border ds-border-subtle">
        {/* Header */}
        <div className="p-6 border-b ds-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold ds-text-primary flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Assign Work Items to {workerName}
            </h2>
            <p className="text-sm ds-text-secondary mt-1">
              Select work items to assign to this worker
            </p>
          </div>
          <button
            onClick={onClose}
            className="ds-text-muted hover:ds-text-secondary transition-colors p-1 rounded-lg hover:ds-bg-surface-muted"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b ds-border-subtle ds-bg-surface-muted">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">
                Project
              </label>
              <select
                value={filters.projectId}
                onChange={(e) => setFilters(prev => ({ ...prev, projectId: e.target.value, phaseId: '' }))}
                className="w-full px-3 py-2 ds-bg-surface border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map(project => (
                  <option key={project._id} value={project._id}>
                    {project.projectName || project.projectCode}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">
                Phase
              </label>
              <select
                value={filters.phaseId}
                onChange={(e) => setFilters(prev => ({ ...prev, phaseId: e.target.value }))}
                disabled={!filters.projectId}
                className="w-full px-3 py-2 ds-bg-surface border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:ds-bg-surface-muted"
              >
                <option value="">All Phases</option>
                {phases.map(phase => (
                  <option key={phase._id} value={phase._id}>
                    {phase.phaseName || phase.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 ds-bg-surface border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.unassigned}
                  onChange={(e) => setFilters(prev => ({ ...prev, unassigned: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 ds-border-subtle rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium ds-text-secondary">
                  Unassigned Only
                </span>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ds-text-muted" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search work items..."
                className="w-full pl-10 pr-4 py-2 ds-bg-surface border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Work Items List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredWorkItems.length === 0 ? (
            <div className="text-center py-12 ds-text-muted">
              <Briefcase className="w-12 h-12 mx-auto mb-3 ds-text-muted" />
              <p className="font-medium">No work items found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selectedWorkItems.size === filteredWorkItems.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm ds-text-secondary">
                    ({selectedWorkItems.size} selected)
                  </span>
                </div>
                <span className="text-sm ds-text-secondary">
                  {filteredWorkItems.length} work item(s) available
                </span>
              </div>

              <div className="space-y-2">
                {filteredWorkItems.map((workItem) => {
                  const isSelected = selectedWorkItems.has(workItem._id.toString());
                  return (
                    <div
                      key={workItem._id}
                      onClick={() => handleToggleSelection(workItem._id.toString())}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'ds-border-subtle hover:ds-border-subtle hover:ds-bg-surface-muted'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {isSelected ? (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          ) : (
                            <div className="w-5 h-5 border-2 ds-border-subtle rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold ds-text-primary">{workItem.name}</h3>
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              workItem.status === 'completed' ? 'bg-green-100 text-green-800' :
                              workItem.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              workItem.status === 'blocked' ? 'bg-red-100 text-red-800' :
                              'ds-bg-surface-muted ds-text-primary'
                            }`}>
                              {workItem.status?.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm ds-text-secondary space-y-1">
                            {workItem.phaseName && (
                              <p>Phase: {workItem.phaseName}</p>
                            )}
                            {workItem.category && (
                              <p>Category: {workItem.category}</p>
                            )}
                            {workItem.estimatedHours > 0 && (
                              <p>
                                Hours: {workItem.actualHours || 0}/{workItem.estimatedHours} hrs
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t ds-border-subtle flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border ds-border-subtle ds-text-secondary rounded-lg hover:ds-bg-surface-muted font-medium"
          >
            Cancel
          </button>
          <LoadingButton
            onClick={handleAssign}
            loading={assigning}
            disabled={selectedWorkItems.size === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Assign {selectedWorkItems.size > 0 ? `(${selectedWorkItems.size})` : ''}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
