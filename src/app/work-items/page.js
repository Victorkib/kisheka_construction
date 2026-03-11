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
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { useToast } from '@/components/toast';

function WorkItemsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, currentProjectId, loading: projectLoading, isEmpty, switchProject } = useProjectContext();
  const toast = useToast();

  const [workItems, setWorkItems] = useState([]);
  const [phases, setPhases] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || currentProjectId || '',
    phaseId: searchParams.get('phaseId') || '',
    status: searchParams.get('status') || '',
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    unassigned: searchParams.get('unassigned') === 'true' || false
  });

  // Define fetchWorkItems BEFORE useEffect that uses it
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
      if (filters.unassigned) queryParams.set('unassigned', 'true');

      const response = await fetch(`/api/work-items?${queryParams.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
  }, [filters.projectId, filters.phaseId, filters.status, filters.category, filters.search, filters.unassigned, isEmpty, toast]);

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
        setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

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
      console.error('Fetch projects error:', err);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchProjects();
  }, []);

  useEffect(() => {
    const nextProjectId = normalizeProjectId(currentProject?._id) || currentProjectId || '';
    if (nextProjectId && nextProjectId !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: nextProjectId, phaseId: '' }));
    }
  }, [currentProject?._id, currentProjectId, filters.projectId]);

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
  }, [filters.projectId, filters.phaseId, filters.status, filters.category, filters.search, filters.unassigned, isEmpty, fetchWorkItems]);

  const fetchPhases = async () => {
    if (!filters.projectId) return;
    try {
      const response = await fetch(`/api/phases?projectId=${filters.projectId}`, {
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
      console.error('Fetch phases error:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const updatedFilters = key === 'projectId'
        ? { ...prev, projectId: value, phaseId: '' }
        : { ...prev, [key]: value };
      
      // Update URL params
      const params = new URLSearchParams();
      Object.entries(updatedFilters).forEach(([k, v]) => {
        if (v && v !== false) {
          if (k === 'unassigned' && v === true) {
            params.set(k, 'true');
          } else if (k !== 'unassigned') {
            params.set(k, v);
          }
        }
      });
      router.push(`/work-items?${params.toString()}`, { scroll: false });
      
      return updatedFilters;
    });

    if (key === 'projectId' && value && value !== currentProjectId) {
      switchProject(value).catch((err) => {
        console.error('Error switching project:', err);
      });
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'ds-bg-surface-muted ds-text-primary',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'blocked': 'bg-red-100 text-red-800',
      'on_hold': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      1: 'bg-red-100 text-red-800',
      2: 'bg-orange-100 text-orange-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-blue-100 text-blue-800',
      5: 'ds-bg-surface-muted ds-text-primary'
    };
    return colors[priority] || 'ds-bg-surface-muted ds-text-primary';
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
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary">Work Items</h1>
            <p className="text-sm sm:text-base ds-text-secondary mt-1">Manage and track work items across phases</p>
          </div>
          {canEdit && (
            <Link
              href={`/work-items/new${filters.projectId ? `?projectId=${filters.projectId}` : ''}${filters.phaseId ? `&phaseId=${filters.phaseId}` : ''}`}
              className="ds-bg-accent-primary text-white px-4 sm:px-6 py-2.5 rounded-lg hover:ds-bg-accent-hover active:ds-bg-accent-active font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 touch-manipulation text-sm sm:text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Work Item
            </Link>
          )}
        </div>

        <PrerequisiteGuide
          title="Get ready to assign work items"
          description="Work items depend on projects, phases, and available workers. Create those first so assignments are fast and consistent."
          prerequisites={[
            'At least one project is available',
            'Phases exist for the selected project',
            'Workers are added for assignment',
          ]}
          actions={[
            { href: '/projects/new', label: 'Create Project' },
            { href: '/phases/new', label: 'Create Phase' },
            { href: '/labour/workers/new', label: 'Add Worker' },
            { href: '/work-items/new', label: 'New Work Item' },
          ]}
          tip="Use the filters below to narrow by phase or status once your project is set."
        />

        {/* Information Card */}
        <div className="ds-bg-accent-subtle rounded-xl border-2 ds-border-accent-subtle p-4 sm:p-6 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 ds-bg-accent-primary rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-lg sm:text-xl font-bold ds-text-primary flex items-center gap-2">
                  What are Work Items?
                </h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 ds-bg-surface/80 hover:ds-bg-surface active:ds-bg-surface border ds-border-accent-subtle rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:ring-offset-2 touch-manipulation"
                  aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                  aria-expanded={isInfoExpanded}
                >
                  <svg 
                    className={`w-5 h-5 sm:w-6 sm:h-6 ds-text-accent-primary transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {isInfoExpanded ? (
                <div className="space-y-4 animate-fadeIn">
                  <p className="text-sm sm:text-base ds-text-secondary leading-relaxed">
                    Work items are specific tasks and activities that need to be completed in each construction phase. They break down complex phases into manageable, trackable tasks with time estimates, costs, dependencies, and progress tracking.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="ds-bg-surface/60 rounded-lg p-4 border ds-border-accent-subtle">
                      <h4 className="font-semibold ds-text-primary mb-2 flex items-center gap-2 text-sm sm:text-base">
                        <svg className="w-5 h-5 ds-text-accent-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Who uses this?
                      </h4>
                      <p className="text-xs sm:text-sm ds-text-secondary leading-relaxed">
                        <strong>Project Managers</strong> and <strong>Owners</strong> use work items to plan, track progress, and manage phase completion. <strong>Site Supervisors</strong> use them to coordinate daily activities and ensure tasks are completed on time.
                      </p>
                    </div>
                    <div className="ds-bg-surface/60 rounded-lg p-4 border ds-border-accent-subtle">
                      <h4 className="font-semibold ds-text-primary mb-2 flex items-center gap-2 text-sm sm:text-base">
                        <svg className="w-5 h-5 ds-text-accent-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Why it's important?
                      </h4>
                      <p className="text-xs sm:text-sm ds-text-secondary leading-relaxed">
                        Work items help ensure nothing is missed, track actual vs. estimated time and costs, manage dependencies between tasks, and provide clear progress visibility for better project control and accountability.
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t-2 ds-border-accent-subtle">
                    <h4 className="font-semibold ds-text-primary mb-3 flex items-center gap-2 text-sm sm:text-base">
                      <svg className="w-5 h-5 ds-text-accent-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Common Examples:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {['Pour Foundation Concrete', 'Install Electrical Wiring', 'Complete Wall Painting', 'Conduct Quality Inspection', 'Steel Reinforcement Work', 'Roof Installation', 'Plumbing Installation'].map((example) => (
                        <span key={example} className="px-2.5 sm:px-3 py-1 sm:py-1.5 ds-bg-surface rounded-full text-xs sm:text-sm font-medium ds-text-secondary border ds-border-accent-subtle shadow-sm hover:shadow-md transition-shadow">
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm ds-text-muted italic mt-1 animate-fadeIn">
                  Click to expand for more information
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            <div>
              <label htmlFor="project-filter" className="block text-sm font-semibold ds-text-primary mb-2">
                Project
              </label>
              <select
                id="project-filter"
                value={filters.projectId}
                onChange={(e) => {
                  handleFilterChange('projectId', e.target.value);
                  handleFilterChange('phaseId', ''); // Reset phase when project changes
                }}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
              >
                <option value="" className="ds-text-muted">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id} className="ds-text-primary">
                    {project.projectName || project.projectCode || 'Unnamed Project'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="phase-filter" className="block text-sm font-semibold ds-text-primary mb-2">
                Phase
              </label>
              <select
                id="phase-filter"
                value={filters.phaseId}
                onChange={(e) => handleFilterChange('phaseId', e.target.value)}
                disabled={!filters.projectId}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary disabled:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
              >
                <option value="" className="ds-text-muted">All Phases</option>
                {phases.map((phase) => (
                  <option key={phase._id} value={phase._id} className="ds-text-primary">
                    {phase.phaseCode ? `${phase.phaseCode}: ` : ''}{phase.phaseName || phase.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status-filter" className="block text-sm font-semibold ds-text-primary mb-2">
                Status
              </label>
              <select
                id="status-filter"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
              >
                <option value="" className="ds-text-muted">All Statuses</option>
                <option value="not_started" className="ds-text-primary">Not Started</option>
                <option value="in_progress" className="ds-text-primary">In Progress</option>
                <option value="completed" className="ds-text-primary">Completed</option>
                <option value="blocked" className="ds-text-primary">Blocked</option>
                <option value="on_hold" className="ds-text-primary">On Hold</option>
              </select>
            </div>

            <div>
              <label htmlFor="category-filter" className="block text-sm font-semibold ds-text-primary mb-2">
                Category
              </label>
              <select
                id="category-filter"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
              >
                <option value="" className="ds-text-muted">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category} className="ds-text-primary">
                    {category.replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <label className="flex items-center gap-2 cursor-pointer touch-manipulation min-h-[44px]">
                <input
                  type="checkbox"
                  checked={filters.unassigned}
                  onChange={(e) => handleFilterChange('unassigned', e.target.checked)}
                  className="w-5 h-5 ds-text-accent-primary ds-border-subtle rounded focus:ring-ds-accent-focus touch-manipulation"
                />
                <span className="text-sm font-semibold ds-text-primary">
                  Unassigned Only
                </span>
              </label>
            </div>

            <div>
              <label htmlFor="search-filter" className="block text-sm font-semibold ds-text-primary mb-2">
                Search
              </label>
              <input
                type="text"
                id="search-filter"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search work items..."
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted transition-all duration-200 font-medium touch-manipulation"
              />
            </div>

            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button
                onClick={() => {
                  setFilters({ projectId: '', phaseId: '', status: '', category: '', search: '', unassigned: false });
                  router.push('/work-items', { scroll: false });
                }}
                className="w-full px-4 py-2.5 border-2 ds-border-subtle hover:ds-bg-surface-muted active:ds-bg-surface-muted hover:border-ds-border-strong ds-text-primary font-semibold rounded-lg transition-all duration-200 touch-manipulation"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border-2 border-red-400/60 text-red-800 px-4 py-3 rounded-lg mb-6 font-medium">
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
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block ds-bg-surface rounded-xl shadow-lg border ds-border-subtle overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ds-border-subtle">
                <thead className="ds-bg-surface-muted">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Work Item
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Phase
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Labour
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {Array.isArray(workItems) && workItems.length > 0 ? (
                    workItems.map((item) => {
                      const completionPercentage = item.estimatedHours > 0
                        ? Math.round((item.actualHours / item.estimatedHours) * 100)
                        : 0;
                      
                      return (
                        <tr key={item._id} className="hover:bg-blue-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <Link
                                href={`/work-items/${item._id}`}
                                className="text-sm font-semibold ds-text-accent-primary hover:ds-text-accent-hover transition-colors"
                              >
                                {item.name}
                              </Link>
                              {item.category && (
                                <p className="text-xs font-medium ds-text-secondary mt-1">
                                  {item.category.replace(/\b\w/g, l => l.toUpperCase())}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.phaseName ? (
                              <Link
                                href={`/phases/${item.phaseId}`}
                                className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover transition-colors"
                              >
                                {item.phaseName}
                              </Link>
                            ) : item.phaseId ? (
                              <Link
                                href={`/phases/${item.phaseId}`}
                                className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover transition-colors"
                              >
                                View Phase
                              </Link>
                            ) : (
                              <span className="text-sm font-medium ds-text-muted">No Phase</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.assignedWorkers && item.assignedWorkers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.assignedWorkers.slice(0, 2).map((worker) => (
                                  <Link
                                    key={worker._id?.toString()}
                                    href={`/labour/workers/${worker._id}`}
                                    className="text-xs font-medium ds-text-accent-primary hover:ds-text-accent-hover transition-colors"
                                    title={worker.workerName}
                                  >
                                    {worker.workerName}
                                  </Link>
                                ))}
                                {item.assignedWorkers.length > 2 && (
                                  <span className="text-xs ds-text-muted">
                                    +{item.assignedWorkers.length - 2} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs ds-text-muted italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(item.status)}`}>
                              {item.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${getPriorityColor(item.priority || 3)}`}>
                              P{item.priority || 3}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-20 ds-bg-surface-muted rounded-full h-2.5 shadow-inner">
                                <div
                                  className="ds-bg-accent-primary h-2.5 rounded-full transition-all duration-300 shadow-sm"
                                  style={{ width: `${Math.min(100, completionPercentage)}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold ds-text-primary min-w-[3rem]">
                                {completionPercentage}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium ds-text-primary">
                              <span className="ds-text-accent-primary font-semibold">{item.actualHours || 0}</span>
                              <span className="ds-text-muted mx-1">/</span>
                              <span className="ds-text-secondary">{item.estimatedHours || 0}</span>
                              <span className="ds-text-muted ml-1">hrs</span>
                            </div>
                            {item.estimatedCost > 0 && (
                              <div className="text-xs ds-text-secondary mt-1">
                                {(item.actualCost || 0).toLocaleString()} / {item.estimatedCost.toLocaleString()} KES
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <Link
                                href={`/labour/entries?workItemId=${item._id}`}
                                className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                              >
                                View Entries →
                              </Link>
                              {canEdit && (
                                <div className="flex flex-col gap-1 mt-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide ds-text-muted">
                                    Log labour
                                  </span>
                                  <div className="flex gap-2">
                                    {item.assignedWorkers && item.assignedWorkers.length > 1 ? (
                                      <Link
                                        href={`/labour/batches/new?workItemId=${item._id}&workerIds=${item.assignedWorkers
                                          .map((worker) => worker._id?.toString() || worker.userId?.toString())
                                          .filter(Boolean)
                                          .join(',')}`}
                                        className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 font-medium"
                                        title="Bulk Entry (Prefilled)"
                                      >
                                        Bulk
                                      </Link>
                                    ) : (
                                      <Link
                                        href={`/labour/entries/new?workItemId=${item._id}&workerId=${item.assignedWorkers?.[0]?._id?.toString() || item.assignedWorkers?.[0]?.userId?.toString() || ''}`}
                                        className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium"
                                        title="Quick Entry"
                                      >
                                        Quick
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/work-items/${item._id}`}
                                className="ds-text-accent-primary hover:ds-text-accent-hover font-semibold transition-colors"
                              >
                                View →
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" className="px-6 py-4 text-center ds-text-muted font-medium">
                        No work items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {Array.isArray(workItems) && workItems.length > 0 ? (
                workItems.map((item) => {
                  const completionPercentage = item.estimatedHours > 0
                    ? Math.round((item.actualHours / item.estimatedHours) * 100)
                    : 0;
                  
                  return (
                    <div
                      key={item._id}
                      className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle"
                    >
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/work-items/${item._id}`}
                            className="text-base font-semibold ds-text-accent-primary hover:ds-text-accent-hover block truncate"
                          >
                            {item.name}
                          </Link>
                          {item.category && (
                            <p className="text-xs ds-text-secondary mt-0.5">
                              {item.category.replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-end ml-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${getStatusColor(item.status)}`}>
                            {item.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${getPriorityColor(item.priority || 3)}`}>
                            P{item.priority || 3}
                          </span>
                        </div>
                      </div>

                      {/* Phase & Assigned To */}
                      <div className="mb-3 pb-3 border-b ds-border-subtle">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-xs ds-text-muted w-20 flex-shrink-0">Phase:</span>
                          {item.phaseName ? (
                            <Link
                              href={`/phases/${item.phaseId}`}
                              className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium flex-1"
                            >
                              {item.phaseName}
                            </Link>
                          ) : (
                            <span className="text-sm ds-text-muted">No Phase</span>
                          )}
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs ds-text-muted w-20 flex-shrink-0">Assigned:</span>
                          {item.assignedWorkers && item.assignedWorkers.length > 0 ? (
                            <div className="flex flex-wrap gap-1 flex-1">
                              {item.assignedWorkers.slice(0, 2).map((worker) => (
                                <Link
                                  key={worker._id?.toString()}
                                  href={`/labour/workers/${worker._id}`}
                                  className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                                >
                                  {worker.workerName}
                                </Link>
                              ))}
                              {item.assignedWorkers.length > 2 && (
                                <span className="text-xs ds-text-muted">
                                  +{item.assignedWorkers.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs ds-text-muted italic">Unassigned</span>
                          )}
                        </div>
                      </div>

                      {/* Progress & Hours */}
                      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b ds-border-subtle">
                        <div>
                          <p className="text-xs ds-text-muted mb-1">Progress</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-20 ds-bg-surface-muted rounded-full h-2.5">
                              <div
                                className="ds-bg-accent-primary h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, completionPercentage)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold ds-text-primary">
                              {completionPercentage}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs ds-text-muted mb-1">Hours</p>
                          <p className="text-sm font-semibold ds-text-primary">
                            <span className="ds-text-accent-primary">{item.actualHours || 0}</span>
                            <span className="ds-text-muted mx-1">/</span>
                            <span className="ds-text-secondary">{item.estimatedHours || 0}</span>
                          </p>
                        </div>
                      </div>

                      {/* Cost & Labour */}
                      {item.estimatedCost > 0 && (
                        <div className="mb-3 pb-3 border-b ds-border-subtle">
                          <p className="text-xs ds-text-muted mb-0.5">Cost</p>
                          <p className="text-sm font-semibold ds-text-primary">
                            {(item.actualCost || 0).toLocaleString()} / {item.estimatedCost.toLocaleString()} KES
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-3">
                        <Link
                          href={`/work-items/${item._id}`}
                          className="flex-1 px-3 py-2 bg-blue-50 ds-text-accent-primary text-sm font-semibold rounded-lg hover:bg-blue-100 active:bg-blue-200 transition-colors touch-manipulation text-center"
                        >
                          View →
                        </Link>
                        {item.assignedWorkers && item.assignedWorkers.length > 0 && (
                          <Link
                            href={`/labour/entries?workItemId=${item._id}`}
                            className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 text-sm font-semibold rounded-lg hover:bg-purple-100 active:bg-purple-200 transition-colors touch-manipulation text-center"
                          >
                            Entries
                          </Link>
                        )}
                        {canEdit && item.assignedWorkers && item.assignedWorkers.length > 0 && (
                          <Link
                            href={item.assignedWorkers.length > 1
                              ? `/labour/batches/new?workItemId=${item._id}&workerIds=${item.assignedWorkers
                                  .map((worker) => worker._id?.toString() || worker.userId?.toString())
                                  .filter(Boolean)
                                  .join(',')}`
                              : `/labour/entries/new?workItemId=${item._id}&workerId=${item.assignedWorkers[0]?._id?.toString() || item.assignedWorkers[0]?.userId?.toString() || ''}`}
                            className="flex-1 px-3 py-2 bg-green-50 text-green-600 text-sm font-semibold rounded-lg hover:bg-green-100 active:bg-green-200 transition-colors touch-manipulation text-center"
                          >
                            {item.assignedWorkers.length > 1 ? 'Bulk Log' : 'Quick Log'}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="ds-bg-surface rounded-lg shadow p-8 text-center border ds-border-subtle">
                  <p className="ds-text-muted font-medium">No work items found</p>
                </div>
              )}
            </div>
          </>
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
