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

function FloorsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [floors, setFloors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') || '');
  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [projectMap, setProjectMap] = useState({});

  useEffect(() => {
    fetchUser();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      fetchFloors();
    }
  }, [selectedProjectId, projects]);

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

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        const projectsList = data.data || [];
        setProjects(projectsList);
        // Create project map for quick lookup
        const map = {};
        projectsList.forEach(p => {
          map[p._id] = p;
        });
        setProjectMap(map);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

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
    } else {
      router.push('/floors');
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      NOT_STARTED: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Floors</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">
              {selectedProjectId 
                ? `Floors for ${getProjectName(selectedProjectId)}`
                : 'Manage building floors and their status'}
            </p>
          </div>
          {canCreate && (
            <div className="flex gap-2">
              {selectedProjectId && (
                <Link
                  href={`/floors/new?projectId=${selectedProjectId}&basement=true`}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2 rounded-lg transition flex items-center gap-2"
                  title="Add a basement floor"
                >
                  <span>🏢</span> Add Basement
                </Link>
              )}
              <Link
                href={selectedProjectId ? `/floors/new?projectId=${selectedProjectId}` : '/floors/new'}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                + Create Floor
              </Link>
            </div>
          )}
        </div>

        {/* Project Filter */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
            Filter by Project
          </label>
          {loadingProjects ? (
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500">
              Loading projects...
            </div>
          ) : (
            <select
              value={selectedProjectId}
              onChange={handleProjectChange}
              className="w-full md:w-1/3 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectCode} - {project.projectName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Floors Table */}
        {loading ? (
          <LoadingTable rows={10} columns={7} showHeader={true} />
        ) : floors.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No floors found</h3>
            {selectedProjectId ? (
              <>
                <p className="text-gray-600 mb-6">
                  {canCreate
                    ? `No floors have been created for this project yet. Floors are automatically created when a project is set up, but you can also create additional floors manually.`
                    : `No floors have been created for this project yet. Contact a Project Manager or Owner to create floors.`}
                </p>
                {canCreate && (
                  <div className="flex gap-4 justify-center">
                    <Link
                      href={`/floors/new?projectId=${selectedProjectId}`}
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
                    >
                      Create Floor for This Project
                    </Link>
                    <Link
                      href="/floors/new"
                      className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-medium px-6 py-2 rounded-lg transition"
                    >
                      Create Floor (Select Project)
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-6">
                  {canCreate
                    ? 'No floors have been created yet. Floors are automatically created when you create a project, but you can also create them manually.'
                    : 'No floors have been created yet. Floors are automatically created when projects are set up. Contact a Project Manager or Owner to create projects or additional floors.'}
                </p>
                {canCreate && (
                  <Link
                    href="/floors/new"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
                  >
                    Create First Floor
                  </Link>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basements Section */}
            {groupedFloors.basements.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-purple-50 px-6 py-3 border-b border-purple-200">
                  <h3 className="text-sm font-semibold text-purple-900">
                    Basements ({groupedFloors.basements.length})
                  </h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Floor Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Floor Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Actual Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groupedFloors.basements.map((floor) => (
                      <tr key={floor._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-purple-900">
                            {getFloorDisplayName(floor.floorNumber, null)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-900"
                          >
                            <div>
                              <div>{getFloorDisplayName(floor.floorNumber, floor.name)}</div>
                              {floor.usageCount !== undefined && (
                                <div className="text-xs text-gray-500 mt-1">
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
                          <span className="text-sm text-gray-900">
                            {formatCurrency(floor.totalBudget || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {formatCurrency(floor.actualCost || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {floor.projectId ? (
                              <Link
                                href={`/projects/${floor.projectId}`}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                {getProjectName(floor.projectId)}
                              </Link>
                            ) : (
                              'N/A'
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {canEdit ? 'Edit' : 'View'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Ground Floor Section */}
            {groupedFloors.ground.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-blue-50 px-6 py-3 border-b border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-900">
                    Ground Floor ({groupedFloors.ground.length})
                  </h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Floor Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Floor Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Actual Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groupedFloors.ground.map((floor) => (
                      <tr key={floor._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-blue-900">
                            {getFloorDisplayName(floor.floorNumber, null)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-900"
                          >
                            <div>
                              <div>{getFloorDisplayName(floor.floorNumber, floor.name)}</div>
                              {floor.usageCount !== undefined && (
                                <div className="text-xs text-gray-500 mt-1">
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
                          <span className="text-sm text-gray-900">
                            {formatCurrency(floor.totalBudget || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {formatCurrency(floor.actualCost || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {floor.projectId ? (
                              <Link
                                href={`/projects/${floor.projectId}`}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                {getProjectName(floor.projectId)}
                              </Link>
                            ) : (
                              'N/A'
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {canEdit ? 'Edit' : 'View'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Above-Ground Floors Section */}
            {groupedFloors.aboveGround.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Above-Ground Floors ({groupedFloors.aboveGround.length})
                  </h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Floor Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Floor Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Actual Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groupedFloors.aboveGround.map((floor) => (
                      <tr key={floor._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {getFloorDisplayName(floor.floorNumber, null)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-900"
                          >
                            <div>
                              <div>{getFloorDisplayName(floor.floorNumber, floor.name)}</div>
                              {floor.usageCount !== undefined && (
                                <div className="text-xs text-gray-500 mt-1">
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
                          <span className="text-sm text-gray-900">
                            {formatCurrency(floor.totalBudget || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {formatCurrency(floor.actualCost || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {floor.projectId ? (
                              <Link
                                href={`/projects/${floor.projectId}`}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                {getProjectName(floor.projectId)}
                              </Link>
                            ) : (
                              'N/A'
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {canEdit ? 'Edit' : 'View'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Summary Stats */}
        {floors.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total Floors</p>
              <p className="text-2xl font-bold text-gray-900">{floors.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">
                {floors.filter((f) => f.status === 'IN_PROGRESS').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {floors.filter((f) => f.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(floors.reduce((sum, f) => sum + (f.totalBudget || 0), 0))}
              </p>
            </div>
          </div>
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
              <p className="mt-4 text-gray-600">Loading floors...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <FloorsPageContent />
    </Suspense>
  );
}

