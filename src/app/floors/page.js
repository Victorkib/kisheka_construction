/**
 * Floors List Page
 * Displays floors with project filtering, view for all, create/edit for PM/OWNER
 * 
 * Route: /floors?projectId=xxx
 */

'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { FloorVisualization } from '@/components/floors/FloorVisualization';
import { groupFloorsByType, getFloorDisplayName, getFloorColorClass } from '@/lib/floor-helpers';
import { LoadingTable } from '@/components/loading';
import { BaseModal, ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState } from '@/components/empty-states';

function FloorsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const {
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const [floors, setFloors] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    searchParams.get('projectId') || currentProjectId || ''
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [projectMap, setProjectMap] = useState({});
  const [showFloorInitModal, setShowFloorInitModal] = useState(false);
  const [floorInitError, setFloorInitError] = useState('');
  const [initializingFloors, setInitializingFloors] = useState(false);
  const [floorInitForm, setFloorInitForm] = useState({
    floorCount: 10,
    includeBasements: false,
    basementCount: 0,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (currentProjectId && currentProjectId !== selectedProjectId) {
      setSelectedProjectId(currentProjectId);
    }
  }, [currentProjectId, selectedProjectId]);

  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setFloors([]);
      return;
    }
    if (!selectedProjectId) {
      if (projectLoading) return;
      setLoading(false);
      setFloors([]);
      return;
    }
    fetchFloors();
  }, [selectedProjectId, projectLoading, isEmpty]);

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
        setCanCreate(['owner', 'pm', 'project_manager'].includes(role));
        setCanDelete(['owner', 'pm', 'project_manager'].includes(role));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  useEffect(() => {
    const projectsList = accessibleProjects || [];
    const map = {};
    projectsList.forEach((project) => {
      map[project._id] = project;
    });
    setProjectMap(map);
  }, [accessibleProjects]);

  const fetchFloors = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = selectedProjectId 
        ? `/api/floors?projectId=${selectedProjectId}`
        : '/api/floors';
      
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch floors');
      }

      setFloors(data.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch floors error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group floors by type
  const groupedFloors = useMemo(() => {
    return groupFloorsByType(floors);
  }, [floors]);

  const handleProjectChange = (e) => {
    const projectId = e.target.value;
    setSelectedProjectId(projectId);
    // Update URL
    if (projectId) {
      router.push(`/floors?projectId=${projectId}`);
      if (projectId !== currentProjectId) {
        switchProject(projectId).catch((err) => {
          console.error('Error switching project:', err);
        });
      }
    } else {
      router.push('/floors');
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      NOT_STARTED: 'ds-bg-surface-muted ds-text-primary',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getProjectName = (projectId) => {
    if (!projectId) return 'N/A';
    const project = projectMap[projectId];
    return project ? `${project.projectCode} - ${project.projectName}` : 'Unknown Project';
  };

  const openFloorInitModal = () => {
    setFloorInitError('');
    setFloorInitForm((prev) => ({
      floorCount: typeof prev.floorCount === 'number' ? prev.floorCount : 10,
      includeBasements: !!prev.includeBasements,
      basementCount: typeof prev.basementCount === 'number' ? prev.basementCount : 0,
    }));
    setShowFloorInitModal(true);
  };

  const handleFloorInitChange = (field, value) => {
    setFloorInitError('');
    setFloorInitForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitFloorInit = async () => {
    if (!selectedProjectId) {
      toast.showError('Select a project first.');
      return;
    }

    const floorCount = parseInt(floorInitForm.floorCount, 10);
    const basementCount = parseInt(floorInitForm.basementCount, 10);
    const includeBasements = !!floorInitForm.includeBasements;

    if (isNaN(floorCount) || floorCount < 0 || floorCount > 50) {
      setFloorInitError('Floor count must be a number between 0 and 50.');
      return;
    }

    if (includeBasements && (isNaN(basementCount) || basementCount < 0 || basementCount > 10)) {
      setFloorInitError('Basement count must be a number between 0 and 10.');
      return;
    }

    if (floorCount === 0 && (!includeBasements || basementCount === 0)) {
      setFloorInitError('Please add at least one floor or basement.');
      return;
    }

    try {
      setInitializingFloors(true);
      const response = await fetch(`/api/projects/${selectedProjectId}/floors/initialize`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          floorCount: parseInt(floorInitForm.floorCount, 10),
          includeBasements: !!floorInitForm.includeBasements,
          basementCount: parseInt(floorInitForm.basementCount, 10),
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to initialize floors');
      }

      toast.showSuccess(`Successfully initialized ${data.data.count} floors`);
      setShowFloorInitModal(false);
      await fetchFloors();
    } catch (err) {
      const message = err.message || 'Failed to initialize floors';
      setFloorInitError(message);
      toast.showError(message);
      console.error('Initialize floors error:', err);
    } finally {
      setInitializingFloors(false);
    }
  };

  const handleDeleteClick = (floor) => {
    setDeleteError(null);
    setDeleteTarget(floor);
    setShowDeleteModal(true);
  };

  const handleDeleteFloor = async () => {
    if (!deleteTarget?._id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/floors/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete floor');
      }
      toast.showSuccess('Floor deleted successfully');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      await fetchFloors();
    } catch (err) {
      setDeleteError(err.message);
      toast.showError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const renderDependencyChips = (floor) => {
    const materialsCount = floor.materialsCount ?? floor.usageCount ?? 0;
    const requestsCount = floor.requestsCount ?? 0;
    const purchaseOrdersCount = floor.purchaseOrdersCount ?? 0;
    const hasDeps = materialsCount + requestsCount + purchaseOrdersCount > 0;

    if (!hasDeps) {
      return <span className="text-xs ds-text-muted">No dependencies</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {materialsCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-400/60">
            {materialsCount} material{materialsCount !== 1 ? 's' : ''}
          </span>
        )}
        {requestsCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-400/60">
            {requestsCount} request{requestsCount !== 1 ? 's' : ''}
          </span>
        )}
        {purchaseOrdersCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            {purchaseOrdersCount} PO{purchaseOrdersCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  };

  const renderActions = (floor) => (
    <div className="flex items-center gap-3">
      <Link
        href={`/floors/${floor._id}`}
        className="ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover transition-colors touch-manipulation"
      >
        {canEdit ? 'Edit/View' : 'View'}
      </Link>
      {canDelete && (
        <button
          type="button"
          onClick={() => handleDeleteClick(floor)}
          className="text-red-600 hover:text-red-800 active:text-red-950 transition-colors touch-manipulation"
        >
          Delete
        </button>
      )}
    </div>
  );

  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Floors</h1>
            <p className="text-sm sm:text-base md:text-lg ds-text-secondary mt-2 leading-relaxed">Manage building floors and their status</p>
          </div>
          <NoProjectsEmptyState />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Floors</h1>
            <p className="text-sm sm:text-base md:text-lg ds-text-secondary mt-2 leading-relaxed">
              {selectedProjectId 
                ? `Floors for ${getProjectName(selectedProjectId)}`
                : 'Manage building floors and their status'}
            </p>
          </div>
          {canCreate && (
            <div className="flex flex-col sm:flex-row gap-2">
              {selectedProjectId && (
                <Link
                  href={`/floors/new?projectId=${selectedProjectId}&basement=true`}
                  className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-medium px-4 sm:px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 touch-manipulation text-sm sm:text-base"
                  title="Add a basement floor"
                >
                  <span>🏢</span> Add Basement
                </Link>
              )}
              <Link
                href={selectedProjectId ? `/floors/new?projectId=${selectedProjectId}` : '/floors/new'}
                className="ds-bg-accent-primary hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-4 sm:px-6 py-2.5 rounded-lg transition-colors touch-manipulation text-sm sm:text-base text-center"
              >
                + Create Floor
              </Link>
            </div>
          )}
        </div>

        {/* Project Filter */}
        <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 mb-6">
          <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">
            Filter by Project
          </label>
          {projectLoading ? (
            <div className="px-3 py-2 ds-bg-surface-muted border ds-border-subtle rounded-lg ds-text-muted">
              Loading projects...
            </div>
          ) : (
            <select
              value={selectedProjectId}
              onChange={handleProjectChange}
              className="w-full sm:w-full md:w-1/3 px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
            >
              <option value="">All Projects</option>
              {accessibleProjects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectCode} - {project.projectName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Floors Table */}
        {loading ? (
          <LoadingTable rows={10} columns={8} showHeader={true} />
        ) : floors.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold ds-text-primary mb-2">No floors found</h3>
            {selectedProjectId ? (
              <>
                <p className="ds-text-secondary mb-6">
                  {canCreate
                    ? `No floors have been created for this project yet. Floors are automatically created when a project is set up, but you can also create additional floors manually.`
                    : `No floors have been created for this project yet. Contact a Project Manager or Owner to create floors.`}
                </p>
                {canCreate && (
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      type="button"
                      onClick={openFloorInitModal}
                      className="inline-flex items-center justify-center ds-bg-accent-primary hover:ds-bg-accent-hover active:ds-bg-accent-active text-white font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-500/20 touch-manipulation"
                    >
                      Auto-create Floors
                    </button>
                    <Link
                      href={`/floors/new?projectId=${selectedProjectId}`}
                      className="inline-block ds-bg-accent-primary hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors touch-manipulation text-center"
                    >
                      Create Floor Manually
                    </Link>
                    <Link
                      href="/floors/new"
                      className="inline-block bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors touch-manipulation text-center"
                    >
                      Create Floor (Select Project)
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="ds-text-secondary mb-6">
                  {canCreate
                    ? 'No floors have been created yet. Floors are automatically created when you create a project, but you can also create them manually.'
                    : 'No floors have been created yet. Floors are automatically created when projects are set up. Contact a Project Manager or Owner to create projects or additional floors.'}
                </p>
                {canCreate && (
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      type="button"
                      onClick={openFloorInitModal}
                      disabled={!selectedProjectId}
                      className="inline-flex items-center justify-center ds-bg-accent-primary hover:ds-bg-accent-hover active:ds-bg-accent-active text-white font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      Auto-create Floors
                    </button>
                    <Link
                      href="/floors/new"
                      className="inline-block ds-bg-accent-primary hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors touch-manipulation text-center"
                    >
                      Create First Floor
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basements Section */}
            {groupedFloors.basements.length > 0 && (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block ds-bg-surface rounded-lg shadow overflow-hidden">
                  <div className="bg-purple-50 px-6 py-3 border-b border-purple-400/60">
                    <h3 className="text-sm font-semibold text-purple-900">
                      Basements ({groupedFloors.basements.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Floor Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Floor Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Actual Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Dependencies
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {groupedFloors.basements.map((floor) => (
                      <tr key={floor._id} className="hover:ds-bg-surface-muted">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-purple-900">
                            {getFloorDisplayName(floor.floorNumber, null)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            <div>
                              <div>{getFloorDisplayName(floor.floorNumber, floor.name)}</div>
                              {floor.usageCount !== undefined && (
                                <div className="text-xs ds-text-muted mt-1">
                                  Used by {floor.usageCount} material{floor.usageCount !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                              floor.status
                            )}`}
                          >
                            {floor.status || 'NOT_STARTED'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {formatCurrency(floor.budgetAllocation?.total || floor.totalBudget || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {formatCurrency(floor.actualCost || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {floor.projectId ? (
                              <Link
                                href={`/projects/${floor.projectId}`}
                                className="ds-text-accent-primary hover:ds-text-accent-hover"
                              >
                                {getProjectName(floor.projectId)}
                              </Link>
                            ) : (
                              'N/A'
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {renderDependencyChips(floor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {renderActions(floor)}
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
                </div>

                {/* Mobile Card View - Basements */}
                <div className="md:hidden space-y-4">
                  <div className="bg-purple-50 px-4 py-2 border-b border-purple-400/60 rounded-t-lg">
                    <h3 className="text-sm font-semibold text-purple-900">
                      Basements ({groupedFloors.basements.length})
                    </h3>
                  </div>
                  {groupedFloors.basements.map((floor) => (
                    <div key={floor._id} className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-base font-semibold ds-text-accent-primary hover:ds-text-accent-hover block truncate"
                          >
                            {getFloorDisplayName(floor.floorNumber, floor.name)}
                          </Link>
                          {floor.usageCount !== undefined && (
                            <p className="text-xs ds-text-muted mt-0.5">
                              Used by {floor.usageCount} material{floor.usageCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${getStatusBadgeColor(floor.status)}`}>
                          {floor.status || 'NOT_STARTED'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b ds-border-subtle">
                        <div>
                          <p className="text-xs ds-text-muted mb-0.5">Budget</p>
                          <p className="text-sm font-semibold ds-text-primary">
                            {formatCurrency(floor.budgetAllocation?.total || floor.totalBudget || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs ds-text-muted mb-0.5">Actual Cost</p>
                          <p className="text-sm font-semibold ds-text-primary">
                            {formatCurrency(floor.actualCost || 0)}
                          </p>
                        </div>
                      </div>
                      {floor.projectId && (
                        <div className="mb-3 pb-3 border-b ds-border-subtle">
                          <p className="text-xs ds-text-muted mb-0.5">Project</p>
                          <Link
                            href={`/projects/${floor.projectId}`}
                            className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                          >
                            {getProjectName(floor.projectId)}
                          </Link>
                        </div>
                      )}
                      <div className="mb-3">
                        <p className="text-xs ds-text-muted mb-1.5">Dependencies</p>
                        {renderDependencyChips(floor)}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-3">
                        <Link
                          href={`/floors/${floor._id}`}
                          className="flex-1 px-3 py-2 bg-blue-500/10 ds-text-accent-primary text-sm font-semibold rounded-lg hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors touch-manipulation text-center border border-blue-400/60"
                        >
                          {canEdit ? 'Edit/View' : 'View'}
                        </Link>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(floor)}
                            className="flex-1 px-3 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 active:bg-red-200 transition-colors touch-manipulation"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Ground Floor Section */}
            {groupedFloors.ground.length > 0 && (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block ds-bg-surface rounded-lg shadow overflow-hidden">
                  <div className="bg-blue-50 px-6 py-3 border-b border-blue-400/60">
                    <h3 className="text-sm font-semibold text-blue-900">
                      Ground Floor ({groupedFloors.ground.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Floor Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Floor Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Actual Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Dependencies
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {groupedFloors.ground.map((floor) => (
                      <tr key={floor._id} className="hover:ds-bg-surface-muted">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-blue-900">
                            {getFloorDisplayName(floor.floorNumber, null)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            <div>
                              <div>{getFloorDisplayName(floor.floorNumber, floor.name)}</div>
                              {floor.usageCount !== undefined && (
                                <div className="text-xs ds-text-muted mt-1">
                                  Used by {floor.usageCount} material{floor.usageCount !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                              floor.status
                            )}`}
                          >
                            {floor.status || 'NOT_STARTED'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {formatCurrency(floor.budgetAllocation?.total || floor.totalBudget || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {formatCurrency(floor.actualCost || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {floor.projectId ? (
                              <Link
                                href={`/projects/${floor.projectId}`}
                                className="ds-text-accent-primary hover:ds-text-accent-hover"
                              >
                                {getProjectName(floor.projectId)}
                              </Link>
                            ) : (
                              'N/A'
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {renderDependencyChips(floor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {renderActions(floor)}
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
                </div>

                {/* Mobile Card View - Ground Floor */}
                <div className="md:hidden space-y-4">
                  <div className="bg-blue-50 px-4 py-2 border-b border-blue-400/60 rounded-t-lg">
                    <h3 className="text-sm font-semibold text-blue-900">
                      Ground Floor ({groupedFloors.ground.length})
                    </h3>
                  </div>
                  {groupedFloors.ground.map((floor) => (
                    <div key={floor._id} className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-base font-semibold ds-text-accent-primary hover:ds-text-accent-hover block truncate"
                          >
                            {getFloorDisplayName(floor.floorNumber, floor.name)}
                          </Link>
                          {floor.usageCount !== undefined && (
                            <p className="text-xs ds-text-muted mt-0.5">
                              Used by {floor.usageCount} material{floor.usageCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${getStatusBadgeColor(floor.status)}`}>
                          {floor.status || 'NOT_STARTED'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b ds-border-subtle">
                        <div>
                          <p className="text-xs ds-text-muted mb-0.5">Budget</p>
                          <p className="text-sm font-semibold ds-text-primary">
                            {formatCurrency(floor.budgetAllocation?.total || floor.totalBudget || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs ds-text-muted mb-0.5">Actual Cost</p>
                          <p className="text-sm font-semibold ds-text-primary">
                            {formatCurrency(floor.actualCost || 0)}
                          </p>
                        </div>
                      </div>
                      {floor.projectId && (
                        <div className="mb-3 pb-3 border-b ds-border-subtle">
                          <p className="text-xs ds-text-muted mb-0.5">Project</p>
                          <Link
                            href={`/projects/${floor.projectId}`}
                            className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                          >
                            {getProjectName(floor.projectId)}
                          </Link>
                        </div>
                      )}
                      <div className="mb-3">
                        <p className="text-xs ds-text-muted mb-1.5">Dependencies</p>
                        {renderDependencyChips(floor)}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-3">
                        <Link
                          href={`/floors/${floor._id}`}
                          className="flex-1 px-3 py-2 bg-blue-500/10 ds-text-accent-primary text-sm font-semibold rounded-lg hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors touch-manipulation text-center border border-blue-400/60"
                        >
                          {canEdit ? 'Edit/View' : 'View'}
                        </Link>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(floor)}
                            className="flex-1 px-3 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 active:bg-red-200 transition-colors touch-manipulation"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Above-Ground Floors Section */}
            {groupedFloors.aboveGround.length > 0 && (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block ds-bg-surface rounded-lg shadow overflow-hidden">
                  <div className="ds-bg-surface-muted px-6 py-3 border-b ds-border-subtle">
                    <h3 className="text-sm font-semibold ds-text-primary">
                      Above-Ground Floors ({groupedFloors.aboveGround.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Floor Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Floor Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Actual Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Dependencies
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {groupedFloors.aboveGround.map((floor) => (
                      <tr key={floor._id} className="hover:ds-bg-surface-muted">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {getFloorDisplayName(floor.floorNumber, null)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            <div>
                              <div>{getFloorDisplayName(floor.floorNumber, floor.name)}</div>
                              {floor.usageCount !== undefined && (
                                <div className="text-xs ds-text-muted mt-1">
                                  Used by {floor.usageCount} material{floor.usageCount !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                              floor.status
                            )}`}
                          >
                            {floor.status || 'NOT_STARTED'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {formatCurrency(floor.budgetAllocation?.total || floor.totalBudget || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {formatCurrency(floor.actualCost || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {floor.projectId ? (
                              <Link
                                href={`/projects/${floor.projectId}`}
                                className="ds-text-accent-primary hover:ds-text-accent-hover"
                              >
                                {getProjectName(floor.projectId)}
                              </Link>
                            ) : (
                              'N/A'
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {renderDependencyChips(floor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {renderActions(floor)}
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
                </div>

                {/* Mobile Card View - Above-Ground Floors */}
                <div className="md:hidden space-y-4">
                  <div className="ds-bg-surface-muted px-4 py-2 border-b ds-border-subtle rounded-t-lg">
                    <h3 className="text-sm font-semibold ds-text-primary">
                      Above-Ground Floors ({groupedFloors.aboveGround.length})
                    </h3>
                  </div>
                  {groupedFloors.aboveGround.map((floor) => (
                    <div key={floor._id} className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-base font-semibold ds-text-accent-primary hover:ds-text-accent-hover block truncate"
                          >
                            {getFloorDisplayName(floor.floorNumber, floor.name)}
                          </Link>
                          {floor.usageCount !== undefined && (
                            <p className="text-xs ds-text-muted mt-0.5">
                              Used by {floor.usageCount} material{floor.usageCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${getStatusBadgeColor(floor.status)}`}>
                          {floor.status || 'NOT_STARTED'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b ds-border-subtle">
                        <div>
                          <p className="text-xs ds-text-muted mb-0.5">Budget</p>
                          <p className="text-sm font-semibold ds-text-primary">
                            {formatCurrency(floor.budgetAllocation?.total || floor.totalBudget || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs ds-text-muted mb-0.5">Actual Cost</p>
                          <p className="text-sm font-semibold ds-text-primary">
                            {formatCurrency(floor.actualCost || 0)}
                          </p>
                        </div>
                      </div>
                      {floor.projectId && (
                        <div className="mb-3 pb-3 border-b ds-border-subtle">
                          <p className="text-xs ds-text-muted mb-0.5">Project</p>
                          <Link
                            href={`/projects/${floor.projectId}`}
                            className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                          >
                            {getProjectName(floor.projectId)}
                          </Link>
                        </div>
                      )}
                      <div className="mb-3">
                        <p className="text-xs ds-text-muted mb-1.5">Dependencies</p>
                        {renderDependencyChips(floor)}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-3">
                        <Link
                          href={`/floors/${floor._id}`}
                          className="flex-1 px-3 py-2 bg-blue-500/10 ds-text-accent-primary text-sm font-semibold rounded-lg hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors touch-manipulation text-center border border-blue-400/60"
                        >
                          {canEdit ? 'Edit/View' : 'View'}
                        </Link>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(floor)}
                            className="flex-1 px-3 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 active:bg-red-200 transition-colors touch-manipulation"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Summary Stats */}
        {floors.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6">
              <p className="text-xs sm:text-sm ds-text-secondary">Total Floors</p>
              <p className="text-xl sm:text-2xl font-bold ds-text-primary">{floors.length}</p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6">
              <p className="text-xs sm:text-sm ds-text-secondary">In Progress</p>
              <p className="text-xl sm:text-2xl font-bold ds-text-accent-primary">
                {floors.filter((f) => f.status === 'IN_PROGRESS').length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6">
              <p className="text-xs sm:text-sm ds-text-secondary">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">
                {floors.filter((f) => f.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 col-span-2 md:col-span-1">
              <p className="text-xs sm:text-sm ds-text-secondary">Total Budget</p>
              <p className="text-xl sm:text-2xl font-bold ds-text-primary truncate">
                {formatCurrency(floors.reduce((sum, f) => sum + (f.budgetAllocation?.total || f.totalBudget || 0), 0))}
              </p>
            </div>
          </div>
        )}

        {/* Auto-create Floors Modal */}
        <BaseModal
          isOpen={showFloorInitModal}
          onClose={() => !initializingFloors && setShowFloorInitModal(false)}
          maxWidth="max-w-2xl"
          variant="indigo"
          showCloseButton={true}
          isLoading={initializingFloors}
          loadingMessage="Creating floors..."
          preventCloseDuringLoading={true}
        >
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-b ds-border-subtle/50">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600/90 text-white rounded-xl p-2 sm:p-3 shadow-lg shadow-indigo-500/30 flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-2xl font-bold ds-text-primary">Auto-create Floors</h3>
                <p className="text-xs sm:text-sm ds-text-secondary">Generate a default floor stack for this project.</p>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-6">
            {floorInitError && (
              <div className="bg-red-50/80 border border-red-400/60/70 text-red-700 px-4 py-3 rounded-xl">
                {floorInitError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-semibold ds-text-secondary mb-2">
                  Number of Floors
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={floorInitForm.floorCount}
                  onChange={(e) => handleFloorInitChange('floorCount', e.target.value)}
                  className="w-full px-4 py-3 ds-bg-surface/80 border ds-border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition ds-text-primary touch-manipulation"
                />
                <p className="text-xs ds-text-muted mt-2">Includes ground floor. Range: 0-50.</p>
              </div>

              <div className="ds-bg-accent-subtle border ds-border-accent-subtle rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold ds-text-primary">Include Basements</p>
                    <p className="text-xs ds-text-secondary">Optional underground floors</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={floorInitForm.includeBasements}
                    onChange={(e) => handleFloorInitChange('includeBasements', e.target.checked)}
                      className="h-5 w-5 text-indigo-600 ds-border-subtle rounded focus:ring-indigo-500 touch-manipulation"
                  />
                </div>
                {floorInitForm.includeBasements && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium ds-text-secondary mb-2">
                      Basement Count
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={floorInitForm.basementCount}
                      onChange={(e) => handleFloorInitChange('basementCount', e.target.value)}
                      className="w-full px-4 py-2.5 ds-bg-surface/90 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition ds-text-primary touch-manipulation"
                    />
                    <p className="text-xs ds-text-muted mt-2">Range: 0-10.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-8 py-4 sm:py-6 border-t ds-border-subtle/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 ds-bg-surface-muted/60">
            <button
              type="button"
              onClick={() => setShowFloorInitModal(false)}
              disabled={initializingFloors}
              className="w-full sm:w-auto px-6 py-3 text-sm font-semibold ds-text-secondary ds-bg-surface/70 backdrop-blur-sm border ds-border-subtle/50 rounded-xl hover:ds-bg-surface/90 active:ds-bg-surface active:border-ds-border-strong/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitFloorInit}
              disabled={initializingFloors}
              className="relative w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white ds-bg-accent-primary rounded-xl hover:from-indigo-600 hover:to-blue-700 active:from-indigo-700 active:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 touch-manipulation"
            >
              {initializingFloors ? 'Creating Floors...' : 'Create Floors'}
            </button>
          </div>
        </BaseModal>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deleteTarget && (
          <ConfirmationModal
            isOpen={showDeleteModal}
            onClose={() => {
              if (!deleting) {
                setShowDeleteModal(false);
                setDeleteError(null);
                setDeleteTarget(null);
              }
            }}
            onConfirm={handleDeleteFloor}
            title="Delete Floor"
            message={
              <div>
                <p className="mb-2">
                  Are you sure you want to delete <strong>{deleteTarget?.name || `Floor ${deleteTarget?.floorNumber}`}</strong>?
                </p>
                <div className="bg-yellow-50 border border-yellow-400/60 rounded p-3 mt-3">
                  <p className="text-sm text-yellow-800 font-semibold mb-1">Dependencies:</p>
                  <p className="text-sm text-yellow-700">
                    {deleteTarget.materialsCount || 0} material(s), {deleteTarget.requestsCount || 0} request(s), {deleteTarget.purchaseOrdersCount || 0} purchase order(s).
                  </p>
                </div>
                {deleteError && (
                  <div className="bg-red-50 border border-red-400/60 rounded p-3 mt-3">
                    <p className="text-sm text-red-800">{deleteError}</p>
                  </div>
                )}
                <p className="text-sm ds-text-secondary mt-3">This action cannot be undone.</p>
              </div>
            }
            confirmText="Delete Floor"
            cancelText="Cancel"
            confirmColor="red"
            isLoading={deleting}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default function FloorsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 ds-text-secondary">Loading floors...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <FloorsPageContent />
    </Suspense>
  );
}

