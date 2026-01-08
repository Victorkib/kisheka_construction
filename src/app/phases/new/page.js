/**
 * New Phase Page
 * Creates a new construction phase for a project
 * 
 * Route: /phases/new?projectId=xxx
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';

function NewPhasePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    projectId: searchParams.get('projectId') || '',
    phaseName: '',
    phaseCode: '',
    phaseType: 'construction',
    sequence: 0,
    description: '',
    budgetAllocation: {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      contingency: 0
    },
    applicableFloors: 'all',
    applicableCategories: [],
    startDate: '',
    plannedEndDate: '',
    useTemplate: false,
    templateName: ''
  });

  useEffect(() => {
    fetchUser();
    fetchProjects();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        if (!['owner', 'pm', 'project_manager'].includes(role)) {
          setError('You do not have permission to create phases. Only Project Managers and Owners can create phases.');
        }
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('budgetAllocation.')) {
      const budgetField = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        budgetAllocation: {
          ...prev.budgetAllocation,
          [budgetField]: parseFloat(value) || 0
        }
      }));
    } else if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Validation
    if (!formData.projectId) {
      setError('Project is required');
      setSubmitting(false);
      return;
    }

    if (!formData.phaseName || formData.phaseName.trim().length === 0) {
      setError('Phase name is required');
      setSubmitting(false);
      return;
    }

    if (formData.sequence === undefined || formData.sequence === null || formData.sequence < 0) {
      setError('Sequence must be a non-negative number');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/phases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create phase');
      }

      // Redirect to phase detail page
      router.push(`/phases/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      console.error('Create phase error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const phaseTypes = [
    { value: 'construction', label: 'Construction' },
    { value: 'finishing', label: 'Finishing' },
    { value: 'final', label: 'Final Systems' }
  ];

  const templates = [
    { name: 'Basement/Substructure', code: 'PHASE-01' },
    { name: 'Superstructure', code: 'PHASE-02' },
    { name: 'Finishing Works', code: 'PHASE-03' },
    { name: 'Final Systems', code: 'PHASE-04' }
  ];

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/phases" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Phases
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create New Phase</h1>
          <p className="text-gray-600 mt-1">Add a new construction phase to track progress and budget</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project <span className="text-red-500">*</span>
                </label>
                <select
                  name="projectId"
                  value={formData.projectId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectName} ({project.projectCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phase Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="phaseName"
                  value={formData.phaseName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Basement/Substructure"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phase Code
                </label>
                <input
                  type="text"
                  name="phaseCode"
                  value={formData.phaseCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., PHASE-01 (auto-generated if empty)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phase Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="phaseType"
                  value={formData.phaseType}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {phaseTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sequence <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="sequence"
                  value={formData.sequence}
                  onChange={handleChange}
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Order of execution (0 = first, 1 = second, etc.)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Applicable Floors
                </label>
                <select
                  name="applicableFloors"
                  value={formData.applicableFloors}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Floors</option>
                  <option value="basement">Basement Only</option>
                  <option value="ground">Ground Floor Only</option>
                  <option value="upper">Upper Floors Only</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe this phase..."
              />
            </div>
          </div>

          {/* Budget Allocation */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Allocation</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Budget
                </label>
                <input
                  type="number"
                  name="budgetAllocation.total"
                  value={formData.budgetAllocation.total}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materials
                </label>
                <input
                  type="number"
                  name="budgetAllocation.materials"
                  value={formData.budgetAllocation.materials}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Labour
                </label>
                <input
                  type="number"
                  name="budgetAllocation.labour"
                  value={formData.budgetAllocation.labour}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Equipment
                </label>
                <input
                  type="number"
                  name="budgetAllocation.equipment"
                  value={formData.budgetAllocation.equipment}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subcontractors
                </label>
                <input
                  type="number"
                  name="budgetAllocation.subcontractors"
                  value={formData.budgetAllocation.subcontractors}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contingency
                </label>
                <input
                  type="number"
                  name="budgetAllocation.contingency"
                  value={formData.budgetAllocation.contingency}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Template Option */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="useTemplate"
                checked={formData.useTemplate}
                onChange={handleChange}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Use Phase Template</span>
            </label>
            {formData.useTemplate && (
              <select
                name="templateName"
                value={formData.templateName}
                onChange={handleChange}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Template</option>
                {templates.map((template) => (
                  <option key={template.code} value={template.name}>
                    {template.name} ({template.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Link
              href="/phases"
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Phase'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewPhasePage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <NewPhasePageContent />
    </Suspense>
  );
}



