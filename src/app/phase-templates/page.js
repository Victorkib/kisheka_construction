/**
 * Phase Templates List Page
 * Displays all phase templates with filtering and search
 * 
 * Route: /phase-templates
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingTable } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { NoDataEmptyState } from '@/components/empty-states';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { TEMPLATE_TYPES } from '@/lib/schemas/phase-template-schema';

function PhaseTemplatesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    templateType: searchParams.get('templateType') || '',
    search: searchParams.get('search') || ''
  });
  const [permissionChecked, setPermissionChecked] = useState(false);

  // Check permissions on mount only
  // Phase templates should be accessible to same roles as phases
  useEffect(() => {
    // Wait for user to load before checking
    if (user === undefined) return; // Still loading
    
    const role = user?.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager'];
    
    if (!user || !role || !allowedRoles.includes(role)) {
      toast.showError('You do not have permission to view phase templates');
      router.push('/dashboard');
      return;
    }
    setPermissionChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchTemplates = useCallback(async () => {
    if (!permissionChecked) return;
    
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters.templateType) queryParams.set('templateType', filters.templateType);
      if (filters.search) queryParams.set('search', filters.search);

      const response = await fetch(`/api/phase-templates?${queryParams.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch templates');
      }

      setTemplates(data.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch templates error:', err);
      // Only show toast for actual errors, not permission errors
      if (!err.message.includes('permission')) {
        toast.showError(err.message || 'Failed to load templates');
      }
    } finally {
      setLoading(false);
    }
  }, [filters.templateType, filters.search, permissionChecked, toast]);

  // Fetch templates when filters change and permission is checked
  useEffect(() => {
    if (permissionChecked) {
      fetchTemplates();
    }
  }, [fetchTemplates, permissionChecked]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    
    const params = new URLSearchParams();
    if (key === 'templateType' && value) params.set('templateType', value);
    if (key === 'search' && value) params.set('search', value);
    router.push(`/phase-templates?${params.toString()}`, { scroll: false });
  };

  const handleDelete = async (templateId, templateName) => {
    if (!confirm(`Are you sure you want to delete "${templateName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/phase-templates/${templateId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete template');
      }

      toast.showSuccess('Template deleted successfully');
      fetchTemplates();
    } catch (err) {
      toast.showError(err.message || 'Failed to delete template');
      console.error('Delete template error:', err);
    }
  };

  const getTemplateTypeColor = (type) => {
    const colors = {
      'residential': 'bg-blue-100 text-blue-800',
      'commercial': 'bg-green-100 text-green-800',
      'infrastructure': 'bg-purple-100 text-purple-800',
      'custom': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (!permissionChecked) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable numRows={5} numCols={5} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Phase Templates</h1>
          {user && ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase()) && (
            <Link
              href="/phase-templates/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              + Create Template
            </Link>
          )}
        </div>

        <PrerequisiteGuide
          title="Templates standardize phase setup"
          description="Create templates to reuse phase structures across projects."
          prerequisites={[
            'Typical phase structure is defined',
            'Project types are known',
          ]}
          actions={[
            { href: '/phase-templates/new', label: 'Create Template' },
            { href: '/phases/new', label: 'Create Phase' },
          ]}
          tip="Use templates to keep scheduling consistent."
        />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="templateType-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                Template Type
              </label>
              <select
                id="templateType-filter"
                value={filters.templateType}
                onChange={(e) => handleFilterChange('templateType', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                {TEMPLATE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="search-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                id="search-filter"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search templates..."
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ templateType: '', search: '' });
                  router.push('/phase-templates', { scroll: false });
                }}
                className="w-full px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        ) : templates.length === 0 ? (
          <NoDataEmptyState 
            message="No phase templates found. Create your first template to get started."
            actionLabel="Create Template"
            actionHref="/phase-templates/new"
            canAction={user && ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase())}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div key={template._id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {template.templateName}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTemplateTypeColor(template.templateType)}`}>
                        {template.templateType.charAt(0).toUpperCase() + template.templateType.slice(1)}
                      </span>
                    </div>
                    {user && ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase()) && (
                      <div className="flex gap-2">
                        <Link
                          href={`/phase-templates/${template._id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDelete(template._id, template.templateName)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {template.description && (
                    <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phases:</span>
                      <span className="font-semibold text-gray-900">{template.phases?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Times Used:</span>
                      <span className="font-semibold text-gray-900">{template.usageCount || 0}</span>
                    </div>
                    {template.lastUsedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Used:</span>
                        <span className="font-semibold text-gray-900">
                          {new Date(template.lastUsedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Link
                      href={`/phase-templates/${template._id}`}
                      className="block w-full text-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function PhaseTemplatesPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PhaseTemplatesPageContent />
    </Suspense>
  );
}
