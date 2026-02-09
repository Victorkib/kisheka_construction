/**
 * Template Selector Component
 * Select and apply labour templates in bulk entry wizard
 */

'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, DollarSign, Users } from 'lucide-react';

export function TemplateSelector({ onTemplateSelected, currentProjectId, currentPhaseId }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/labour/templates?limit=50', {
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
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template) => {
    setSelectedTemplate(template._id);

    try {
      // Apply template with current project/phase context
      const response = await fetch(`/api/labour/templates/${template._id}/apply`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: currentProjectId,
          phaseId: currentPhaseId,
          entryDate: new Date().toISOString().split('T')[0],
          workerMap: {}, // Will be filled by user if needed
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to apply template');
      }

      // Pass generated entries to parent
      onTemplateSelected(data.data.labourEntries);
    } catch (err) {
      console.error('Error applying template:', err);
      alert(`Error applying template: ${err.message}`);
      setSelectedTemplate(null);
    }
  };

  const filteredTemplates = templates.filter((template) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        template.name.toLowerCase().includes(searchLower) ||
        template.description?.toLowerCase().includes(searchLower) ||
        template.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-sm text-gray-600">Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Template</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose a template to quickly populate workers. You can edit the entries after applying.
        </p>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
        />
      </div>

      {/* Templates List */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No templates found</p>
          <p className="text-sm mt-2">
            <a href="/labour/templates/new" className="text-blue-600 hover:text-blue-800">
              Create a template
            </a>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {filteredTemplates.map((template) => {
            const entryCount = template.labourEntries?.length || 0;
            const totalCost = template.estimatedTotalCost || 0;
            const isSelected = selectedTemplate === template._id;

            return (
              <div
                key={template._id}
                onClick={() => handleSelectTemplate(template)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{template.name}</h4>
                  {isSelected && <CheckCircle className="w-5 h-5 text-blue-600" />}
                </div>

                {template.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.description}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{entryCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    <span>{totalCost.toLocaleString()} KES</span>
                  </div>
                </div>

                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

