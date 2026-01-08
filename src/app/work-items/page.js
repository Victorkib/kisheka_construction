/**
 * Work Items List Page
 * Displays all work items with filtering by phase, project, and status
 * 
 * Route: /work-items
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState, NoDataEmptyState } from '@/components/empty-states';
import { useToast } from '@/components/toast';

function WorkItemsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isEmpty } = useProjectContext();
  const toast = useToast();

  const [workItems, setWorkItems] = useState([]);
  const [phases, setPhases] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || '',
    phaseId: searchParams.get('phaseId') || '',
    status: searchParams.get('status') || '',
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || ''
  });

  useEffect(() => {
    fetchUser();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (currentProject && !filters.projectId) {
      setFilters(prev => ({ ...prev, projectId: normalizeProjectId(currentProject._id) }));
    }
  }, [currentProject, filters.projectId]);

  useEffect(() => {
    if (filters.projectId) {
      fetchPhases();
    }
  }, [filters.projectId]);

  useEffect(() => {
    if (filters.projectId) {
      fetchWorkItems();
    } else if (!isEmpty) {
      fetchWorkItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isEmpty]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects/accessible');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    }
  };

  const fetchPhases = async () => {
    if (!filters.projectId) return;
    try {
      const response = await fetch(`/api/phases?projectId=${filters.projectId}`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Fetch phases error:', err);
    }
  };

  const fetchWorkItems = useCallback(async () => {
    if (isEmpty) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters.projectId) queryParams.set('projectId', filters.projectId);
      if (filters.phaseId) queryParams.set('phaseId', filters.phaseId);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.category) queryParams.set('category', filters.category);
      if (filters.search) queryParams.set('search', filters.search);

      const response = await fetch(`/api/work-items?${queryParams.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch work items');
      }

      // API returns { workItems: [...], pagination: {...} }
      setWorkItems(data.data?.workItems || []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch work items error:', err);
      toast.showError(err.message || 'Failed to load work items');
    } finally {
      setLoading(false);
    }
  }, [filters, isEmpty, toast]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    const params = new URLSearchParams();
    Object.entries({ ...filters, [key]: value }).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/work-items?${params.toString()}`, { scroll: false });
  };

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'bg-gray-100 text-gray-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'blocked': 'bg-red-100 text-red-800',
      'on_hold': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      1: 'bg-red-100 text-red-800',
      2: 'bg-orange-100 text-orange-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-blue-100 text-blue-800',
      5: 'bg-gray-100 text-gray-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isEmpty) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <NoProjectsEmptyState />
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    );
  }

  // Get unique categories from work items (ensure workItems is an array)
  const categories = Array.isArray(workItems) 
    ? [...new Set(workItems.map(item => item.category).filter(Boolean))]
    : [];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Work Items</h1>
            <p className="text-gray-600 mt-1">Manage and track work items across phases</p>
          </div>
          {canEdit && (
            <Link
              href={`/work-items/new${filters.projectId ? `?projectId=${filters.projectId}` : ''}${filters.phaseId ? `&phaseId=${filters.phaseId}` : ''}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New Work Item
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label htmlFor="project-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Project
              </label>
              <select
                id="project-filter"
                value={filters.projectId}
                onChange={(e) => {
                  handleFilterChange('projectId', e.target.value);
                  handleFilterChange('phaseId', ''); // Reset phase when project changes
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="phase-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Phase
              </label>
              <select
                id="phase-filter"
                value={filters.phaseId}
                onChange={(e) => handleFilterChange('phaseId', e.target.value)}
                disabled={!filters.projectId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">All Phases</option>
                {phases.map((phase) => (
                  <option key={phase._id} value={phase._id}>
                    {phase.phaseCode}: {phase.phaseName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="status-filter"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>

            <div>
              <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                id="category-filter"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                id="search-filter"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search work items..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ projectId: '', phaseId: '', status: '', category: '', search: '' });
                  router.push('/work-items', { scroll: false });
                }}
                className="w-full px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        ) : !Array.isArray(workItems) || workItems.length === 0 ? (
          <NoDataEmptyState 
            message="No work items found. Create your first work item to get started."
            actionLabel="Create Work Item"
            actionHref={`/work-items/new${filters.projectId ? `?projectId=${filters.projectId}` : ''}`}
            canAction={canEdit}
          />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Work Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phase
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.isArray(workItems) && workItems.length > 0 ? (
                    workItems.map((item) => {
                      const completionPercentage = item.estimatedHours > 0
                        ? Math.round((item.actualHours / item.estimatedHours) * 100)
                        : 0;
                      
                      return (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <Link
                                href={`/work-items/${item._id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800"
                              >
                                {item.name}
                              </Link>
                              {item.category && (
                                <p className="text-xs text-gray-500 mt-1">{item.category}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.phaseId ? (
                              <Link
                                href={`/phases/${item.phaseId}`}
                                className="text-sm text-blue-600 hover:text-blue-800"
                              >
                                View Phase
                              </Link>
                            ) : (
                              <span className="text-sm text-gray-500">No Phase</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                              {item.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(item.priority)}`}>
                              P{item.priority || 3}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${Math.min(100, completionPercentage)}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{completionPercentage}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {item.actualHours || 0} / {item.estimatedHours || 0} hrs
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Link
                              href={`/work-items/${item._id}`}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              View
                            </Link>
                            {item.phaseId && (
                              <Link
                                href={`/phases/${item.phaseId}`}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                Phase
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                        No work items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function WorkItemsPage() {
  return (
    <Suspense fallback={<LoadingTable />}>
      <WorkItemsPageContent />
    </Suspense>
  );
}
