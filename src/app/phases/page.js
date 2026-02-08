/**
 * Phases List Page
 * Displays phases with project filtering, view for all, create/edit for PM/OWNER
 * 
 * Route: /phases?projectId=xxx
 */

'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState, NoDataEmptyState } from '@/components/empty-states';
import { PhaseTimeline } from '@/components/phases/PhaseTimeline';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';

function PhasesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    currentProject,
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const [phases, setPhases] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    searchParams.get('projectId') || currentProjectId || ''
  );
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [phaseTypeFilter, setPhaseTypeFilter] = useState(searchParams.get('phaseType') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'sequence');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [projectMap, setProjectMap] = useState({});
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'timeline'
  const fetchingRef = useRef(false);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
        setCanCreate(['owner', 'pm', 'project_manager'].includes(role));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };


  const fetchPhases = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    
    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedProjectId) params.append('projectId', selectedProjectId);
      if (statusFilter) params.append('status', statusFilter);
      if (phaseTypeFilter) params.append('phaseType', phaseTypeFilter);
      params.append('includeFinancials', 'true');

      const url = `/api/phases?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch phases');
      }

      let phasesData = data.data || [];

      // Client-side sorting
      phasesData.sort((a, b) => {
        let aVal, bVal;
        switch (sortBy) {
          case 'sequence':
            aVal = a.sequence || 0;
            bVal = b.sequence || 0;
            break;
          case 'name':
            aVal = a.phaseName || '';
            bVal = b.phaseName || '';
            break;
          case 'budget':
            aVal = a.budgetAllocation?.total || 0;
            bVal = b.budgetAllocation?.total || 0;
            break;
          case 'spent':
            aVal = a.actualSpending?.total || 0;
            bVal = b.actualSpending?.total || 0;
            break;
          case 'status':
            aVal = a.status || '';
            bVal = b.status || '';
            break;
          default:
            aVal = a.sequence || 0;
            bVal = b.sequence || 0;
        }

        if (typeof aVal === 'string') {
          return sortOrder === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        } else {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
      });

      setPhases(phasesData);
    } catch (err) {
      setError(err.message);
      console.error('Fetch phases error:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [selectedProjectId, statusFilter, phaseTypeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    const projectsList = accessibleProjects || [];
    const map = {};
    projectsList.forEach((project) => {
      map[project._id] = project;
    });
    setProjectMap(map);
  }, [accessibleProjects]);

  // Update selectedProjectId when project context changes
  useEffect(() => {
    const newProjectId = normalizeProjectId(currentProject?._id) || currentProjectId || '';
    if (newProjectId && selectedProjectId !== newProjectId) {
      setSelectedProjectId(newProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?._id, currentProjectId]);

  // Fetch phases when filters or project changes
  useEffect(() => {
    // Don't fetch if empty state
    if (isEmpty) {
      setLoading(false);
      setPhases([]);
      return;
    }
    if (!selectedProjectId) {
      if (projectLoading) return;
      setLoading(false);
      setPhases([]);
      return;
    }
    fetchPhases();
    // Only depend on the actual values, not fetchPhases itself to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, statusFilter, phaseTypeFilter, sortBy, sortOrder, isEmpty, projectLoading]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'bg-gray-100 text-gray-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'on_hold': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPhaseTypeLabel = (type) => {
    const labels = {
      'construction': 'Construction',
      'finishing': 'Finishing',
      'final': 'Final Systems'
    };
    return labels[type] || type;
  };

  if (projectLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Construction Phases</h1>
            <p className="text-gray-600 mt-1">Manage and track construction phases</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Table
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Timeline
              </button>
            </div>
            {canCreate && (
              <Link
                href={`/phases/new${selectedProjectId ? `?projectId=${selectedProjectId}` : ''}`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + New Phase
              </Link>
            )}
          </div>
        </div>

        <PrerequisiteGuide
          title="Phases depend on projects and budgets"
          description="Create a project first, then define its phases and budgets so tracking stays accurate."
          prerequisites={[
            'Project exists',
            'Phase budget or scope is defined',
          ]}
          actions={[
            { href: '/projects/new', label: 'Create Project' },
            { href: '/phases/new', label: 'Create Phase' },
            { href: '/projects', label: 'Set Budgets' },
          ]}
          tip="Timeline view works best after start and end dates are set."
        />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Filters & Sorting</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  const nextProjectId = e.target.value;
                  setSelectedProjectId(nextProjectId);
                  const params = new URLSearchParams();
                  if (nextProjectId) params.append('projectId', nextProjectId);
                  if (statusFilter) params.append('status', statusFilter);
                  if (phaseTypeFilter) params.append('phaseType', phaseTypeFilter);
                  if (sortBy) params.append('sortBy', sortBy);
                  if (sortOrder) params.append('sortOrder', sortOrder);
                  router.push(`/phases?${params.toString()}`);
                  if (nextProjectId && nextProjectId !== currentProjectId) {
                    switchProject(nextProjectId).catch((err) => {
                      console.error('Error switching project:', err);
                    });
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {accessibleProjects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  const params = new URLSearchParams();
                  if (selectedProjectId) params.append('projectId', selectedProjectId);
                  if (e.target.value) params.append('status', e.target.value);
                  if (phaseTypeFilter) params.append('phaseType', phaseTypeFilter);
                  if (sortBy) params.append('sortBy', sortBy);
                  if (sortOrder) params.append('sortOrder', sortOrder);
                  router.push(`/phases?${params.toString()}`);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Phase Type
              </label>
              <select
                value={phaseTypeFilter}
                onChange={(e) => {
                  setPhaseTypeFilter(e.target.value);
                  const params = new URLSearchParams();
                  if (selectedProjectId) params.append('projectId', selectedProjectId);
                  if (statusFilter) params.append('status', statusFilter);
                  if (e.target.value) params.append('phaseType', e.target.value);
                  if (sortBy) params.append('sortBy', sortBy);
                  if (sortOrder) params.append('sortOrder', sortOrder);
                  router.push(`/phases?${params.toString()}`);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="construction">Construction</option>
                <option value="finishing">Finishing</option>
                <option value="final">Final Systems</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  const params = new URLSearchParams();
                  if (selectedProjectId) params.append('projectId', selectedProjectId);
                  if (statusFilter) params.append('status', statusFilter);
                  if (phaseTypeFilter) params.append('phaseType', phaseTypeFilter);
                  params.append('sortBy', e.target.value);
                  if (sortOrder) params.append('sortOrder', sortOrder);
                  router.push(`/phases?${params.toString()}`);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sequence">Sequence</option>
                <option value="name">Name</option>
                <option value="budget">Budget</option>
                <option value="spent">Spent</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  const params = new URLSearchParams();
                  if (selectedProjectId) params.append('projectId', selectedProjectId);
                  if (statusFilter) params.append('status', statusFilter);
                  if (phaseTypeFilter) params.append('phaseType', phaseTypeFilter);
                  if (sortBy) params.append('sortBy', sortBy);
                  params.append('sortOrder', e.target.value);
                  router.push(`/phases?${params.toString()}`);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Phases View */}
        {loading ? (
          <LoadingTable />
        ) : phases.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 text-lg">
              {selectedProjectId 
                ? 'No phases found for this project. Create one to get started.'
                : 'No phases found. Select a project or create a new phase.'}
            </p>
            {canCreate && (
              <Link
                href={`/phases/new${selectedProjectId ? `?projectId=${selectedProjectId}` : ''}`}
                className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Phase
              </Link>
            )}
          </div>
        ) : viewMode === 'timeline' ? (
          <PhaseTimeline phases={phases} projectId={selectedProjectId} />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phase
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Budget
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {phases.map((phase) => {
                    const financialSummary = phase.financialSummary || {
                      budgetTotal: phase.budgetAllocation?.total || 0,
                      actualTotal: phase.actualSpending?.total || 0,
                      remaining: phase.financialStates?.remaining || 0,
                      utilizationPercentage: 0
                    };
                    const project = projectMap[phase.projectId] || {};
                    
                    return (
                      <tr key={phase._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {phase.phaseName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {phase.phaseCode} • {getPhaseTypeLabel(phase.phaseType)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {project.projectName || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {project.projectCode || ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(phase.status)}`}>
                              {phase.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {/* Dependency Status Indicator */}
                            {phase.dependsOn && phase.dependsOn.length > 0 && (
                              <span 
                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800"
                                title={`Depends on ${phase.dependsOn.length} phase(s)`}
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                {phase.dependsOn.length}
                              </span>
                            )}
                            {phase.canStartAfter && new Date(phase.canStartAfter) > new Date() && phase.status === 'not_started' && (
                              <span 
                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800"
                                title={`Cannot start until ${new Date(phase.canStartAfter).toLocaleDateString()}`}
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Blocked
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(financialSummary.budgetTotal)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(financialSummary.actualTotal)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(financialSummary.remaining)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${
                                  financialSummary.utilizationPercentage > 100 
                                    ? 'bg-red-600' 
                                    : financialSummary.utilizationPercentage > 80 
                                    ? 'bg-yellow-600' 
                                    : 'bg-green-600'
                                }`}
                                style={{
                                  width: `${Math.min(100, financialSummary.utilizationPercentage)}%`
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {financialSummary.utilizationPercentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/phases/${phase._id}/dashboard`}
                              className="text-purple-600 hover:text-purple-900"
                              title="View Dashboard"
                            >
                              Dashboard
                            </Link>
                            <Link
                              href={`/phases/${phase._id}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View
                            </Link>
                            {canEdit && (
                              <Link
                                href={`/phases/${phase._id}?edit=true`}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Edit
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function PhasesPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    }>
      <PhasesPageContent />
    </Suspense>
  );
}

