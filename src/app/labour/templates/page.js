/**
 * Labour Templates Page
 * List and manage labour templates
 * 
 * Route: /labour/templates
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { Plus, Edit, Trash2, Copy, CheckCircle, Clock, DollarSign } from 'lucide-react';

function LabourTemplatesPageContent() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, search, statusFilter]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/labour/templates?limit=100', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data?.templates || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast.showError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(searchLower) ||
          template.description?.toLowerCase().includes(searchLower) ||
          template.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((template) => template.status === statusFilter);
    }

    setFilteredTemplates(filtered);
  };

  const handleDelete = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    setDeletingId(templateId);
    try {
      const response = await fetch(`/api/labour/templates/${templateId}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete template');
      }

      toast.showSuccess('Template deleted successfully');
      fetchTemplates();
    } catch (err) {
      toast.showError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleApply = (templateId) => {
    router.push(`/labour/batches/new?templateId=${templateId}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading templates..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold ds-text-primary">Labour Templates</h1>
            <p className="ds-text-secondary mt-1">Save and reuse common labour entry patterns</p>
          </div>
          <Link
            href="/labour/templates/new"
            className="flex items-center gap-2 px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover"
          >
            <Plus className="w-5 h-5" />
            Create Template
          </Link>
        </div>

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, description, or tags..."
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="official">Official</option>
                <option value="community">Community</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <p className="ds-text-secondary mb-4">No templates found</p>
            <Link
              href="/labour/templates/new"
              className="ds-text-accent-primary hover:ds-text-accent-hover font-medium"
            >
              Create your first template
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const entryCount = template.labourEntries?.length || 0;
              const totalCost = template.estimatedTotalCost || 0;

              return (
                <div
                  key={template._id}
                  className="ds-bg-surface rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold ds-text-primary mb-1">{template.name}</h3>
                      {template.description && (
                        <p className="text-sm ds-text-secondary line-clamp-2">{template.description}</p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        template.status === 'official'
                          ? 'bg-green-100 text-green-800'
                          : template.status === 'community'
                          ? 'bg-blue-100 text-blue-800'
                          : 'ds-bg-surface-muted ds-text-primary'
                      }`}
                    >
                      {template.status}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm ds-text-secondary">
                      <Clock className="w-4 h-4" />
                      <span>{entryCount} workers</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm ds-text-secondary">
                      <DollarSign className="w-4 h-4" />
                      <span>{totalCost.toLocaleString()} KES</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {template.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 ds-bg-surface-muted ds-text-secondary text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="px-2 py-1 ds-bg-surface-muted ds-text-secondary text-xs rounded">
                          +{template.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Usage Stats */}
                  {template.usageCount > 0 && (
                    <div className="mb-4 text-xs ds-text-muted">
                      Used {template.usageCount} time{template.usageCount !== 1 ? 's' : ''}
                      {template.lastUsedAt && (
                        <span className="ml-2">
                          • Last used {new Date(template.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t">
                    <button
                      onClick={() => handleApply(template._id)}
                      className="flex-1 px-3 py-2 ds-bg-accent-primary text-white text-sm rounded-lg hover:ds-bg-accent-hover"
                    >
                      Apply
                    </button>
                    <Link
                      href={`/labour/templates/${template._id}`}
                      className="px-3 py-2 border ds-border-subtle ds-text-secondary text-sm rounded-lg hover:ds-bg-surface-muted"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(template._id)}
                      disabled={deletingId === template._id}
                      className="px-3 py-2 border border-red-400/60 text-red-700 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === template._id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function LabourTemplatesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LabourTemplatesPageContent />
    </Suspense>
  );
}

