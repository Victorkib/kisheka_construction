/**
 * Archived Projects List Page
 * Displays all archived projects with restore and permanent delete options
 * 
 * Route: /projects/archive
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSpinner } from '@/components/loading';
import { ArchiveBadge } from '@/components/badges';
import { ConfirmationModal, RestoreModal } from '@/components/modals';
import { useToast } from '@/components/toast';

function ArchivedProjectsPageContent() {
  const router = useRouter();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [dependencies, setDependencies] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

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
        setCanManage(role === 'owner');
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/projects?archived=true', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch archived projects');
      }

      setProjects(data.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch archived projects error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (project) => {
    setSelectedProject(project);
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedProject) return;

    setRestoring(true);
    try {
      const response = await fetch(`/api/projects/${selectedProject._id}/restore`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to restore project');
      }

      toast.showSuccess(data.message || 'Project restored successfully!');
      setShowRestoreModal(false);
      setSelectedProject(null);
      await fetchProjects();
    } catch (err) {
      toast.showError(err.message || 'Failed to restore project');
      console.error('Restore project error:', err);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteClick = async (project) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
    setImpactLoading(true);

    try {
      const response = await fetch(`/api/projects/${project._id}/dependencies`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (data.success && data.data) {
        const { dependencies: dependencyMap, investorAllocations, finances } = data.data;
        setDependencies({
          ...(dependencyMap || {}),
          investorAllocations: investorAllocations || dependencyMap?.investorAllocations || 0,
        });
        setFinancialData({
          totalUsed: finances?.totalUsed || 0,
          totalInvested: finances?.totalInvested || 0,
          capitalBalance: finances?.capitalBalance || 0,
        });
      } else {
        setDependencies(null);
        setFinancialData(null);
      }
    } catch (err) {
      console.error('Fetch dependency map error:', err);
      setDependencies(null);
      setFinancialData(null);
    } finally {
      setImpactLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProject) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${selectedProject._id}?force=true`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete project');
      }

      toast.showSuccess(data.message || 'Project permanently deleted successfully!');
    setShowDeleteModal(false);
      setSelectedProject(null);
    setDependencies(null);
    setFinancialData(null);
      await fetchProjects();
    } catch (err) {
      toast.showError(err.message || 'Failed to delete project');
      console.error('Delete project error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={5} columns={6} />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
          <Link href="/projects" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Projects
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/projects"
            className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block"
          >
            ← Back to Projects
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Archived Projects</h1>
              <p className="text-gray-600 mt-1">
                {projects.length} archived project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Projects Table */}
        {projects.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No archived projects</h3>
            <p className="mt-1 text-sm text-gray-500">
              There are no archived projects at this time.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Archived Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Budget
                      </th>
                      {canManage && (
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {projects.map((project) => (
                      <tr key={project._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <Link
                              href={`/projects/${project._id}`}
                              className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                            >
                              {project.projectName}
                            </Link>
                            <p className="text-xs text-gray-500 mt-0.5">{project.projectCode}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <ArchiveBadge />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(project.deletedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(project.budget?.total || 0)}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-3">
                              <button
                                onClick={() => handleRestoreClick(project)}
                                disabled={restoring}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50 font-medium"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => handleDeleteClick(project)}
                                disabled={deleting}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {projects.map((project) => (
                <div key={project._id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <Link
                        href={`/projects/${project._id}`}
                        className="text-base font-semibold text-gray-900 hover:text-blue-600 block"
                      >
                        {project.projectName}
                      </Link>
                      <p className="text-sm text-gray-500 mt-0.5">{project.projectCode}</p>
                    </div>
                    <ArchiveBadge />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Budget</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">
                        {formatCurrency(project.budget?.total || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Archived</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">
                        {formatDate(project.deletedAt)}
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                      <button
                        onClick={() => handleRestoreClick(project)}
                        disabled={restoring}
                        className="flex-1 text-center text-sm font-medium text-green-600 hover:text-green-900 disabled:opacity-50 py-2"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDeleteClick(project)}
                        disabled={deleting}
                        className="flex-1 text-center text-sm font-medium text-red-600 hover:text-red-900 disabled:opacity-50 py-2"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Restore Modal */}
        <RestoreModal
          isOpen={showRestoreModal}
          onClose={() => !restoring && setShowRestoreModal(false)}
          onRestore={handleRestoreConfirm}
          title="Restore Project"
          message="Are you sure you want to restore this project? All dependencies will be restored as well."
          itemName={selectedProject?.projectName}
          isLoading={restoring}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            if (deleting || impactLoading) return;
            setShowDeleteModal(false);
            setSelectedProject(null);
            setDependencies(null);
            setFinancialData(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Project Permanently"
          message={
            selectedProject ? (
              <>
                <p className="mb-3">
                  Are you sure you want to permanently delete <strong>"{selectedProject.projectName}"</strong>?
                </p>
                <p className="text-sm text-gray-600">
                  This will permanently remove the project and all linked records.
                </p>
                {impactLoading && (
                  <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span>Loading impact summary...</span>
                  </div>
                )}
                <p className="text-red-600 font-medium mt-2">This action cannot be undone.</p>
              </>
            ) : (
              'Are you sure you want to proceed?'
            )
          }
          confirmText="Delete Permanently"
          cancelText="Cancel"
          variant="danger"
          isLoading={deleting}
          financialImpact={financialData}
          dependencies={dependencies}
        actionsDisabled={impactLoading}
        actionsDisabledReason={impactLoading ? 'Loading impact summary before enabling delete...' : ''}
        />
      </div>
    </AppLayout>
  );
}

export default function ArchivedProjectsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading archived projects...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <ArchivedProjectsPageContent />
    </Suspense>
  );
}

