/**
 * New Work Item Page
 * Form to create a new work item
 * 
 * Route: /work-items/new
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { WORK_ITEM_STATUSES, WORK_ITEM_CATEGORIES, WORK_ITEM_PRIORITIES } from '@/lib/constants/work-item-constants';

export default function NewWorkItemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { canAccess } = usePermissions();
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const projectIdFromUrl = searchParams.get('projectId');
  const phaseIdFromUrl = searchParams.get('phaseId');
  
  const [formData, setFormData] = useState({
    projectId: projectIdFromUrl || '',
    phaseId: phaseIdFromUrl || '',
    name: '',
    description: '',
    category: '',
    status: 'not_started',
    assignedTo: '',
    estimatedHours: '',
    actualHours: '',
    estimatedCost: '',
    actualCost: '',
    startDate: '',
    plannedEndDate: '',
    dependencies: [],
    priority: 3,
    notes: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
    } else {
      setPhases([]);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      setLoadingPhases(true);
      const response = await fetch(`/api/phases?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/work-items', {
        method: 'POST',
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
        throw new Error(data.error || 'Failed to create work item');
      }

      toast.showSuccess('Work item created successfully');
      router.push(`/work-items/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to create work item');
      console.error('Create work item error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/work-items" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Work Items
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">New Work Item</h1>
          <p className="text-gray-600 mt-1">Create a new work item for a phase</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                required
                disabled={loadingProjects}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select Project</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>

            {/* Phase Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase <span className="text-red-500">*</span>
              </label>
              <select
                name="phaseId"
                value={formData.phaseId}
                onChange={handleChange}
                required
                disabled={loadingPhases || !formData.projectId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">{formData.projectId ? 'Select Phase' : 'Select Project First'}</option>
                {phases.map((phase) => (
                  <option key={phase._id} value={phase._id}>
                    {phase.phaseName} ({phase.phaseCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Work Item Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                minLength={2}
                placeholder="e.g., Pour Foundation Concrete"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Describe the work item..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
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
                  onChange={handleChange}
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

            {/* Hours and Cost */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Hours
                </label>
                <input
                  type="number"
                  name="estimatedHours"
                  value={formData.estimatedHours}
                  onChange={handleChange}
                  min="0"
                  step="0.1"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Cost (KES)
                </label>
                <input
                  type="number"
                  name="estimatedCost"
                  value={formData.estimatedCost}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
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
                  onChange={handleChange}
                  min={formData.startDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {WORK_ITEM_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                placeholder="Additional notes about this work item..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link
                href="/work-items"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                loading={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Work Item
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

