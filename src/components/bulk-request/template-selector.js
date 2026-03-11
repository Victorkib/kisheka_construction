/**
 * Template Selector Component
 * Allows selecting and using material templates in the bulk request wizard
 */

'use client';

import { useState, useEffect } from 'react';
import { LoadingButton } from '@/components/loading';
import { TEMPLATE_STATUS, PROJECT_PHASES } from '@/lib/schemas/material-template-schema';

export function TemplateSelector({ onTemplateSelected, currentProjectId, currentFloorId, currentCategoryId }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingTemplate, setUsingTemplate] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    projectPhase: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [filters]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        isPublic: 'true',
        limit: '20',
        sortBy: 'usageCount',
        sortOrder: 'desc',
        ...(filters.status && { status: filters.status }),
        ...(filters.projectPhase && { projectPhase: filters.projectPhase }),
        ...(filters.search && { search: filters.search }),
        ...(currentFloorId && { applicableFloor: currentFloorId }),
      });

      const response = await fetch(`/api/material-templates?${queryParams}`);
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data.templates || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async (templateId) => {
    try {
      setUsingTemplate(templateId);

      // Fetch template details
      const response = await fetch(`/api/material-templates/${templateId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch template');
      }

      const template = data.data;

      // Convert template materials to wizard format
      const materials = template.materials.map((m) => ({
        name: m.name,
        quantityNeeded: m.quantityNeeded,
        quantityPerUnit: m.quantityPerUnit,
        unit: m.unit,
        categoryId: m.categoryId?.toString(),
        category: m.category,
        estimatedUnitCost: m.estimatedUnitCost,
        estimatedCost: m.estimatedCost,
        description: m.description,
        specifications: m.specifications,
        libraryMaterialId: m.libraryMaterialId?.toString(),
        isScalable: m.isScalable,
        scalingFactor: m.scalingFactor,
      }));

      // Notify parent with materials
      onTemplateSelected({
        materials: materials,
        templateId: templateId,
        defaultSettings: template.defaultProjectSettings,
      });
    } catch (err) {
      console.error('Error using template:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setUsingTemplate(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 ds-border-accent-primary mx-auto"></div>
        <p className="mt-2 text-sm ds-text-secondary">Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 ds-bg-surface-muted rounded-lg">
        <p className="ds-text-secondary">No templates available</p>
        <p className="text-sm ds-text-muted mt-1">Create a template to reuse material combinations</p>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const badges = {
      [TEMPLATE_STATUS.OFFICIAL]: { bg: 'ds-bg-accent-subtle', text: 'ds-text-accent-primary', label: 'Official' },
      [TEMPLATE_STATUS.COMMUNITY]: { bg: 'ds-bg-success/10', text: 'ds-text-success', label: 'Community' },
      [TEMPLATE_STATUS.PRIVATE]: { bg: 'ds-bg-surface-muted', text: 'ds-text-primary', label: 'Private' },
      [TEMPLATE_STATUS.DEPRECATED]: { bg: 'ds-bg-warning/10', text: 'ds-text-warning', label: 'Deprecated' },
    };
    const badge = badges[status] || badges[TEMPLATE_STATUS.COMMUNITY];
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold ds-text-primary mb-2">Use a Template</h3>
          <p className="text-sm ds-text-secondary">
            Select a template to quickly create a bulk request with pre-filled materials.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-1.5 text-sm border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary cursor-pointer"
        >
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary text-sm"
              >
                <option value="">All Statuses</option>
                <option value={TEMPLATE_STATUS.OFFICIAL}>Official</option>
                <option value={TEMPLATE_STATUS.COMMUNITY}>Community</option>
                <option value={TEMPLATE_STATUS.PRIVATE}>Private</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">Project Phase</label>
              <select
                value={filters.projectPhase}
                onChange={(e) => setFilters((prev) => ({ ...prev, projectPhase: e.target.value }))}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary text-sm"
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
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Search templates..."
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setFilters({ status: '', projectPhase: '', search: '' })}
              className="text-sm ds-text-accent-primary hover:ds-text-accent-hover cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 ds-border-accent-primary mx-auto"></div>
          <p className="mt-2 text-sm ds-text-secondary">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 ds-bg-surface-muted rounded-lg">
          <p className="ds-text-secondary">No templates found</p>
          <p className="text-sm ds-text-muted mt-1">
            {filters.search || filters.status || filters.projectPhase
              ? 'Try adjusting your filters'
              : 'Create a template to reuse material combinations'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {templates.map((template) => (
            <div
              key={template._id}
              className="border ds-border-subtle rounded-lg p-4 hover:ds-border-strong hover:shadow-md transition-all ds-bg-surface"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold ds-text-primary">{template.name}</h4>
                  {template.description && (
                    <p className="text-xs ds-text-secondary mt-1 line-clamp-2">{template.description}</p>
                  )}
                </div>
                <div className="ml-2 flex flex-col gap-1">
                  {template.status && getStatusBadge(template.status)}
                  {template.isPublic && !template.status && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full ds-bg-success/10 ds-text-success">
                      Public
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-sm ds-text-secondary">
                  <span>Materials:</span>
                  <span className="font-medium ds-text-primary">{template.materials?.length || 0}</span>
                </div>
                {template.estimatedTotalCost && (
                  <div className="flex items-center justify-between text-sm ds-text-secondary">
                    <span>Est. Cost:</span>
                    <span className="font-medium ds-text-primary">{formatCurrency(template.estimatedTotalCost)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm ds-text-secondary">
                  <span>Used:</span>
                  <span className="font-medium ds-text-primary">{template.usageCount || 0} times</span>
                </div>
                {template.projectPhase && (
                  <div className="flex items-center justify-between text-sm ds-text-secondary">
                    <span>Phase:</span>
                    <span className="font-medium ds-text-primary">
                      {template.projectPhase.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </span>
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

              <LoadingButton
                onClick={() => handleUseTemplate(template._id.toString())}
                isLoading={usingTemplate === template._id.toString()}
                loadingText="Loading..."
                className="w-full px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover text-sm font-medium cursor-pointer"
              >
                Use Template
              </LoadingButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

