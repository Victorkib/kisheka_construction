/**
 * Create New Floor Page
 * Form for creating a new floor for a project
 * 
 * Route: /floors/new
 * Auth: PM, OWNER only
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton, LoadingSpinner } from '@/components/loading';

function NewFloorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [formData, setFormData] = useState({
    projectId: searchParams.get('projectId') || '',
    floorNumber: '',
    name: '',
    description: '',
    status: 'NOT_STARTED',
    totalBudget: '',
    actualCost: '',
    startDate: '',
    completionDate: '',
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
        const hasPermission = ['owner', 'pm', 'project_manager'].includes(role);
        setCanCreate(hasPermission);
        if (!hasPermission) {
          setError('You do not have permission to create floors. Only Project Managers and Owners can create floors.');
        }
      }
    } catch (err) {
      console.error('Fetch user error:', err);
      setError('Failed to verify permissions');
    }
  };

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
        // Auto-select first project if only one exists and no projectId from query params
        if (data.data && data.data.length === 1 && !formData.projectId) {
          setFormData(prev => ({ ...prev, projectId: data.data[0]._id }));
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.projectId) {
      setError('Project is required');
      setLoading(false);
      return;
    }

    if (formData.floorNumber === '' || formData.floorNumber === null) {
      setError('Floor number is required');
      setLoading(false);
      return;
    }

    const floorNumber = parseInt(formData.floorNumber);
    if (isNaN(floorNumber) || floorNumber < 0) {
      setError('Floor number must be a non-negative number');
      setLoading(false);
      return;
    }

    if (!formData.name || formData.name.trim().length === 0) {
      setError('Floor name is required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/floors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: formData.projectId,
          floorNumber: floorNumber,
          name: formData.name.trim(),
          description: formData.description.trim(),
          status: formData.status,
          totalBudget: parseFloat(formData.totalBudget) || 0,
          actualCost: parseFloat(formData.actualCost) || 0,
          startDate: formData.startDate || null,
          completionDate: formData.completionDate || null,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create floor');
      }

      // Redirect to floors list, filtered by project
      router.push(`/floors?projectId=${formData.projectId}`);
    } catch (err) {
      setError(err.message);
      console.error('Create floor error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!canCreate && user) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to create floors. Only Project Managers and Owners can create floors.</p>
          </div>
          <Link href="/floors" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Floors
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/floors" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Floors
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Create New Floor</h1>
          <p className="text-gray-600 mt-2">Add a new floor to a project</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          {/* Project Selection */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
              Project <span className="text-red-500">*</span>
            </label>
            {loadingProjects ? (
              <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-700">
                No projects found. Please create a project first.
                <Link href="/projects/new" className="ml-2 text-blue-600 hover:underline">
                  Create Project
                </Link>
              </div>
            ) : (
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectCode} - {project.projectName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Floor Number */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
              Floor Number <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="floorNumber"
              value={formData.floorNumber}
              onChange={handleChange}
              min="0"
              required
              placeholder="e.g., 0 for Basement/Ground Floor, 1 for First Floor"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Use 0 for Basement/Ground Floor, 1 for First Floor, 2 for Second Floor, etc. (up to 10 for superstructure)
            </p>
          </div>

          {/* Floor Name */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
              Floor Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Ground Floor, First Floor, Basement"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Optional description of this floor"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Budget Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Total Budget (KES)
              </label>
              <input
                type="number"
                name="totalBudget"
                value={formData.totalBudget}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Actual Cost (KES)
              </label>
              <input
                type="number"
                name="actualCost"
                value={formData.actualCost}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Completion Date
              </label>
              <input
                type="date"
                name="completionDate"
                value={formData.completionDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Link
              href="/floors"
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              isLoading={loading}
              disabled={loading || !formData.projectId || projects.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Floor
            </LoadingButton>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewFloorPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        </div>
      </AppLayout>
    }>
      <NewFloorPageContent />
    </Suspense>
  );
}

