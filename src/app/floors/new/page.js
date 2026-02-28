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

  const isBasement = searchParams.get('basement') === 'true';
  
  const [formData, setFormData] = useState({
    projectId: searchParams.get('projectId') || '',
    floorNumber: isBasement ? '-1' : '',
    name: isBasement ? 'Basement 1' : '',
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
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
      const response = await fetch('/api/projects', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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

    // Auto-calculate basement floor number if creating basement and floor number not set
    let floorNumber = parseInt(formData.floorNumber);
    if (isBasement && (isNaN(floorNumber) || floorNumber >= 0)) {
      // Find the lowest basement number for this project
      try {
        const response = await fetch(`/api/floors?projectId=${formData.projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const floorsData = await response.json();
        if (floorsData.success) {
          const existingFloors = floorsData.data || [];
          const basementFloors = existingFloors.filter(f => f.floorNumber < 0);
          const lowestBasement = basementFloors.length > 0 
            ? Math.min(...basementFloors.map(f => f.floorNumber))
            : 0;
          floorNumber = lowestBasement - 1; // Next basement number
        } else {
          floorNumber = -1; // Default to Basement 1
        }
      } catch (err) {
        floorNumber = -1; // Default to Basement 1
      }
    }
    
    if (isNaN(floorNumber) || floorNumber < -10 || floorNumber > 100) {
      setError('Floor number must be between -10 (Basement 10) and 100');
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
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          projectId: formData.projectId,
          floorNumber: parseInt(formData.floorNumber),
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
          <div className="bg-yellow-50 border border-yellow-400/60 text-yellow-700 px-4 py-3 rounded mb-6 text-sm sm:text-base">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to create floors. Only Project Managers and Owners can create floors.</p>
          </div>
          <Link href="/floors" className="text-blue-600 hover:text-blue-900 active:text-blue-800 underline text-sm sm:text-base transition-colors touch-manipulation">
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
        <div className="mb-6 sm:mb-8">
          <Link href="/floors" className="text-blue-600 hover:text-blue-900 active:text-blue-800 text-sm sm:text-base mb-4 inline-block transition-colors touch-manipulation">
            ← Back to Floors
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Create New Floor</h1>
          <p className="text-sm sm:text-base ds-text-secondary mt-2">Add a new floor to a project</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-6 text-sm sm:text-base">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="ds-bg-surface rounded-lg shadow border ds-border-subtle p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Project Selection */}
          <div>
            <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
              Project <span className="text-red-500">*</span>
            </label>
            {loadingProjects ? (
              <div className="px-3 py-2.5 ds-bg-surface-muted border ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="px-3 py-2.5 bg-yellow-50 border border-yellow-400/60 rounded-lg text-yellow-700 text-sm sm:text-base">
                No projects found. Please create a project first.
                <Link href="/projects/new" className="ml-2 text-blue-600 hover:underline active:text-blue-800 touch-manipulation">
                  Create Project
                </Link>
              </div>
            ) : (
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
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
          <div>
            <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
              Floor Number <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="floorNumber"
              value={formData.floorNumber}
              onChange={handleChange}
              min="-10"
              max="100"
              required
              placeholder="e.g., -2 for Basement 2, -1 for Basement 1, 0 for Ground Floor, 1 for First Floor"
              className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
            />
            <div className="mt-2 space-y-1">
              <p className="text-xs sm:text-sm ds-text-secondary">
                <strong>Floor Numbering System:</strong>
              </p>
              <ul className="text-xs sm:text-sm ds-text-secondary list-disc list-inside space-y-1 ml-2">
                <li><strong>Negative numbers (-1, -2, etc.):</strong> Basements (below ground level)</li>
                <li><strong>Zero (0):</strong> Ground Floor (at ground level)</li>
                <li><strong>Positive numbers (1, 2, 3, etc.):</strong> Above-ground floors</li>
              </ul>
              <p className="text-xs sm:text-sm ds-text-muted mt-2">
                <strong>Tip:</strong> If creating a basement and leaving floor number empty, the system will automatically assign the next available basement number.
              </p>
            </div>
          </div>

          {/* Floor Name */}
          <div>
            <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
              Floor Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Ground Floor, First Floor, Basement"
              className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Optional description of this floor"
              className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Budget Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
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
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
              />
            </div>
            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
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
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
              />
            </div>
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
              />
            </div>
            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
                Completion Date
              </label>
              <input
                type="date"
                name="completionDate"
                value={formData.completionDate}
                onChange={handleChange}
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t">
            <Link
              href="/floors"
              className="w-full sm:w-auto px-6 py-2.5 border ds-border-subtle rounded-lg ds-text-secondary hover:ds-bg-surface-muted active:ds-bg-surface transition-colors text-center touch-manipulation"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              isLoading={loading}
              disabled={loading || !formData.projectId || projects.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
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
