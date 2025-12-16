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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No templates available</p>
        <p className="text-sm text-gray-500 mt-1">Create a template to reuse material combinations</p>
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
      [TEMPLATE_STATUS.OFFICIAL]: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Official' },
      [TEMPLATE_STATUS.COMMUNITY]: { bg: 'bg-green-100', text: 'text-green-800', label: 'Community' },
      [TEMPLATE_STATUS.PRIVATE]: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Private' },
      [TEMPLATE_STATUS.DEPRECATED]: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Deprecated' },
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Use a Template</h3>
          <p className="text-sm text-gray-600">
            Select a template to quickly create a bulk request with pre-filled materials.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Statuses</option>
                <option value={TEMPLATE_STATUS.OFFICIAL}>Official</option>
                <option value={TEMPLATE_STATUS.COMMUNITY}>Community</option>
                <option value={TEMPLATE_STATUS.PRIVATE}>Private</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Project Phase</label>
              <select
                value={filters.projectPhase}
                onChange={(e) => setFilters((prev) => ({ ...prev, projectPhase: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
              <label className="block text-sm font-semibold text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Search templates..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setFilters({ status: '', projectPhase: '', search: '' })}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No templates found</p>
          <p className="text-sm text-gray-500 mt-1">
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
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all bg-white"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{template.name}</h4>
                  {template.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{template.description}</p>
                  )}
                </div>
                <div className="ml-2 flex flex-col gap-1">
                  {template.status && getStatusBadge(template.status)}
                  {template.isPublic && !template.status && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Public
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Materials:</span>
                  <span className="font-medium text-gray-900">{template.materials?.length || 0}</span>
                </div>
                {template.estimatedTotalCost && (
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Est. Cost:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(template.estimatedTotalCost)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Used:</span>
                  <span className="font-medium text-gray-900">{template.usageCount || 0} times</span>
                </div>
                {template.projectPhase && (
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Phase:</span>
                    <span className="font-medium text-gray-900">
                      {template.projectPhase.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </span>
                  </div>
                )}
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="inline-flex px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                        {tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span className="inline-flex px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
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
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
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

