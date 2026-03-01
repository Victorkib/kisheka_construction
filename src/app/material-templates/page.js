/**
 * Material Templates List Page
 * View, create, and manage material templates
 * 
 * Route: /material-templates
 */

 'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ConfirmationModal } from '@/components/modals';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { TEMPLATE_STATUS, PROJECT_PHASES } from '@/lib/schemas/material-template-schema';

function MaterialTemplatesPageContent() {
  const router = useRouter();
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    createdBy: 'all', // 'all', 'me', or userId
    isPublic: 'all', // 'all', 'true', 'false'
    status: '',
    projectPhase: '',
    search: '',
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [filters, pagination.page]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.createdBy === 'me' && { createdBy: 'me' }),
        ...(filters.isPublic !== 'all' && { isPublic: filters.isPublic }),
        ...(filters.status && { status: filters.status }),
        ...(filters.projectPhase && { projectPhase: filters.projectPhase }),
        ...(filters.search && { search: filters.search }),
        sortBy: 'usageCount',
        sortOrder: 'desc',
      });

      const response = await fetch(`/api/material-templates?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch templates');
      }

      setTemplates(data.data.templates || []);
      setPagination(data.data.pagination || pagination);
    } catch (err) {
      setError(err.message);
      console.error('Fetch templates error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      setDeleting(true);

      const response = await fetch(`/api/material-templates/${templateToDelete}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete template');
      }

      toast.showSuccess('Template deleted successfully');
      fetchTemplates();
      setShowDeleteModal(false);
      setTemplateToDelete(null);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleUseTemplate = async (templateId) => {
    // Redirect to bulk request page with template pre-selected
    router.push(`/material-requests/bulk?templateId=${templateId}`);
  };

  const handleValidateTemplate = async (templateId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/material-templates/${templateId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationStatus: 'valid',
          status: TEMPLATE_STATUS.OFFICIAL,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to validate template');
      }

      toast.showSuccess('Template validated and marked as official');
      fetchTemplates();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE');
  };

  const canCreate = canAccess('create_material_template');
  const canManage = canAccess('manage_material_templates');
  const canValidate = canAccess('validate_material_template');

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold ds-text-primary">Material Templates</h1>
            <p className="ds-text-secondary mt-2">Save and reuse common material combinations</p>
          </div>
          {canCreate && (
            <Link
              href="/material-templates/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ds-bg-accent-primary hover:ds-bg-accent-hover"
            >
              + Create Template
            </Link>
          )}
        </div>

        <PrerequisiteGuide
          title="Templates speed up material requests"
          description="Define templates after your typical item sets are known."
          prerequisites={[
            'Common materials are identified',
            'Projects or phases are defined',
          ]}
          actions={[
            { href: '/material-library', label: 'Material Library' },
            { href: '/material-templates/new', label: 'Create Template' },
            { href: '/material-requests/new', label: 'New Request' },
          ]}
          tip="Use templates for recurring procurement cycles."
        />

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">Filter by Creator</label>
              <select
                value={filters.createdBy}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, createdBy: e.target.value }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Templates</option>
                <option value="me">My Templates</option>
                <option value="public">Public Templates</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, status: e.target.value }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value={TEMPLATE_STATUS.OFFICIAL}>Official</option>
                <option value={TEMPLATE_STATUS.COMMUNITY}>Community</option>
                <option value={TEMPLATE_STATUS.PRIVATE}>Private</option>
                <option value={TEMPLATE_STATUS.DEPRECATED}>Deprecated</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">Project Phase</label>
              <select
                value={filters.projectPhase}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, projectPhase: e.target.value }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Phases</option>
                {PROJECT_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {phase.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, search: e.target.value }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                placeholder="Search templates..."
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ createdBy: 'all', isPublic: 'all', status: '', projectPhase: '', search: '' });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Templates Grid */}
        {loading ? (
          <LoadingTable rows={6} columns={4} />
        ) : templates.length === 0 ? (
          <div className="text-center py-12 ds-bg-surface-muted rounded-lg">
            <p className="ds-text-secondary">No templates found</p>
            {canCreate && (
              <Link
                href="/material-templates/new"
                className="mt-4 inline-block ds-text-accent-primary hover:ds-text-accent-hover font-medium"
              >
                Create your first template →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template._id}
                className="ds-bg-surface rounded-lg border ds-border-subtle p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold ds-text-primary mb-1">{template.name}</h3>
                    {template.description && (
                      <p className="text-sm ds-text-secondary line-clamp-2">{template.description}</p>
                    )}
                  </div>
                  <div className="ml-2 flex flex-col gap-1">
                    {template.status && (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        template.status === TEMPLATE_STATUS.OFFICIAL ? 'bg-blue-100 text-blue-800' :
                        template.status === TEMPLATE_STATUS.COMMUNITY ? 'bg-green-100 text-green-800' :
                        template.status === TEMPLATE_STATUS.PRIVATE ? 'ds-bg-surface-muted ds-text-primary' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {template.status === TEMPLATE_STATUS.OFFICIAL ? 'Official' :
                         template.status === TEMPLATE_STATUS.COMMUNITY ? 'Community' :
                         template.status === TEMPLATE_STATUS.PRIVATE ? 'Private' : 'Deprecated'}
                      </span>
                    )}
                    {template.isPublic && !template.status && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Public
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="ds-text-secondary">Materials:</span>
                    <span className="font-medium ds-text-primary">{template.materials?.length || 0}</span>
                  </div>
                  {template.estimatedTotalCost && (
                    <div className="flex justify-between text-sm">
                      <span className="ds-text-secondary">Est. Cost:</span>
                      <span className="font-medium ds-text-primary">
                        {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(template.estimatedTotalCost)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="ds-text-secondary">Used:</span>
                    <span className="font-medium ds-text-primary">{template.usageCount || 0} times</span>
                  </div>
                  {template.projectPhase && (
                    <div className="flex justify-between text-sm">
                      <span className="ds-text-secondary">Phase:</span>
                      <span className="font-medium ds-text-primary">
                        {template.projectPhase.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="ds-text-secondary">Created by:</span>
                    <span className="font-medium ds-text-primary">{template.createdByName || 'Unknown'}</span>
                  </div>
                  {template.lastUsedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="ds-text-secondary">Last used:</span>
                      <span className="font-medium ds-text-primary">{formatDate(template.lastUsedAt)}</span>
                    </div>
                  )}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="inline-flex px-2 py-0.5 text-xs rounded ds-bg-surface-muted ds-text-secondary">
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="inline-flex px-2 py-0.5 text-xs rounded ds-bg-surface-muted ds-text-secondary">
                          +{template.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t ds-border-subtle">
                  <button
                    onClick={() => handleUseTemplate(template._id.toString())}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Use Template
                  </button>
                  {canManage && (
                    <>
                      <Link
                        href={`/material-templates/${template._id}/edit`}
                        className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary text-sm font-medium"
                      >
                        Edit
                      </Link>
                      {canValidate && template.status !== TEMPLATE_STATUS.OFFICIAL && (
                        <button
                          onClick={() => handleValidateTemplate(template._id.toString())}
                          className="px-4 py-2 border border-green-400/60 rounded-lg hover:bg-green-50 text-green-700 text-sm font-medium"
                          title="Mark as official"
                        >
                          Validate
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setTemplateToDelete(template._id.toString());
                          setShowDeleteModal(true);
                        }}
                        className="px-4 py-2 border border-red-400/60 rounded-lg hover:bg-red-50 text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm ds-text-secondary">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))
              }
              disabled={pagination.page === pagination.pages}
              className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setTemplateToDelete(null);
          }}
          onConfirm={handleDelete}
          title="Delete Template"
          message="Are you sure you want to delete this template? This action cannot be undone."
          confirmText="Delete"
          confirmColor="red"
          isLoading={deleting}
        />
      </div>
    </AppLayout>
  );
}

export default function MaterialTemplatesPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={6} columns={4} />
          </div>
        </AppLayout>
      }
    >
      <MaterialTemplatesPageContent />
    </Suspense>
  );
}

