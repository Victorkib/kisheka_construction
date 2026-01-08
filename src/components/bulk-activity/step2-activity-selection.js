/**
 * Step 2: Activity Selection Component
 * Two modes: Template Mode and Manual Mode
 */

'use client';

import { useState, useEffect } from 'react';

export function Step2ActivitySelection({ wizardData, onUpdate, onValidationChange }) {
  const [activeTab, setActiveTab] = useState('template'); // 'template' or 'manual'
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [manualActivity, setManualActivity] = useState({
    activityType: '',
    activityDate: new Date().toISOString().split('T')[0],
    visitPurpose: '',
    visitDuration: '',
    inspectionType: '',
    notes: '',
  });

  // Get available activity types based on professional type
  const getAvailableActivityTypes = () => {
    if (!wizardData.professionalServiceId) return [];
    // We'll need to fetch the professional service to get the type
    // For now, return all types - will be filtered in Step 3
    return [
      'site_visit',
      'design_revision',
      'client_meeting',
      'inspection',
      'quality_check',
      'compliance_verification',
      'issue_resolution',
      'material_test',
      'document_upload',
    ];
  };

  // Fetch templates when professional service is selected
  useEffect(() => {
    if (wizardData.professionalServiceId && wizardData.projectId) {
      fetchTemplates();
    }
  }, [wizardData.professionalServiceId, wizardData.projectId]);

  // Validate and notify parent
  const activities = wizardData.activities || [];
  const isValid = activities.length > 0 && activities.every((a) => {
    const hasType = a.activityType && a.activityType.trim().length > 0;
    const hasDate = a.activityDate && new Date(a.activityDate).toString() !== 'Invalid Date';
    return hasType && hasDate;
  });

  useEffect(() => {
    onValidationChange(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid]);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      // Determine professional type from selected service
      // For now, fetch both types - filtering will happen in template selector
      const response = await fetch('/api/activity-templates?status=official,community&isPublic=true');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data.templates || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleUseTemplate = async (templateId) => {
    try {
      const response = await fetch(`/api/activity-templates/${templateId}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch template');
      }

      const template = data.data;
      const currentActivities = wizardData.activities || [];

      // Create activity from template
      const newActivity = {
        activityType: template.activityType,
        activityDate: new Date().toISOString().split('T')[0],
        visitPurpose: template.defaultData?.visitPurpose || '',
        visitDuration: template.defaultData?.visitDuration?.toString() || '',
        inspectionType: template.defaultData?.inspectionType || '',
        areasInspected: template.defaultData?.areasInspected || [],
        complianceStatus: template.defaultData?.complianceStatus || '',
        notes: template.defaultData?.notes || '',
        observations: template.defaultData?.observations || '',
        recommendations: template.defaultData?.recommendations || '',
        attendees: template.defaultData?.attendees || [],
        affectedAreas: template.defaultData?.affectedAreas || [],
        revisionReason: template.defaultData?.revisionReason || '',
        feesCharged: template.defaultFeeAmount?.toString() || '',
        expensesIncurred: template.defaultExpenseAmount?.toString() || '',
        templateId: templateId,
        phaseId: wizardData.defaultPhaseId || '',
        floorId: wizardData.defaultFloorId || '',
      };

      onUpdate({ activities: [...currentActivities, newActivity] });
    } catch (err) {
      console.error('Error using template:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddManualActivity = () => {
    if (!manualActivity.activityType || !manualActivity.activityDate) {
      alert('Please fill in activity type and date');
      return;
    }

    const currentActivities = wizardData.activities || [];
    const newActivity = {
      ...manualActivity,
      phaseId: wizardData.defaultPhaseId || '',
      floorId: wizardData.defaultFloorId || '',
    };

    onUpdate({ activities: [...currentActivities, newActivity] });

    // Reset form
    setManualActivity({
      activityType: '',
      activityDate: new Date().toISOString().split('T')[0],
      visitPurpose: '',
      visitDuration: '',
      inspectionType: '',
      notes: '',
    });
  };

  const handleRemoveActivity = (index) => {
    const updated = activities.filter((_, i) => i !== index);
    onUpdate({ activities: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Activities</h2>
        <p className="text-sm text-gray-600 mb-6">
          Add activities to your bulk entry. You can use templates or add activities manually.
        </p>
      </div>

      {/* Activities Count */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">
              {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'} added
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Continue adding activities or proceed to edit details
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'template'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📋 Templates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'manual'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ✏️ Manual Entry
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'template' ? (
          <div>
            {!wizardData.professionalServiceId ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-600">Please select a professional service in Step 1</p>
              </div>
            ) : loadingTemplates ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No templates available</p>
                <p className="text-sm text-gray-500 mt-1">Create a template to reuse activity configurations</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div
                    key={template._id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleUseTemplate(template._id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {template.type === 'architect_activity' ? 'Architect' : 'Engineer'}
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    )}
                    <div className="text-xs text-gray-500">
                      <div>Type: {template.activityType.replace('_', ' ')}</div>
                      <div>Used {template.usageCount || 0} times</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseTemplate(template._id);
                      }}
                      className="mt-3 w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Activity Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={manualActivity.activityType}
                  onChange={(e) => setManualActivity(prev => ({ ...prev, activityType: e.target.value }))}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Activity Type</option>
                  {getAvailableActivityTypes().map((type) => (
                    <option key={type} value={type}>
                      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Activity Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={manualActivity.activityDate}
                  onChange={(e) => setManualActivity(prev => ({ ...prev, activityDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={manualActivity.notes}
                onChange={(e) => setManualActivity(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Activity notes..."
                rows={2}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleAddManualActivity}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Activity
            </button>
          </div>
        )}
      </div>

      {/* Activities List */}
      {activities.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Added Activities</h3>
          <div className="space-y-2">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">
                    {activity.activityType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {activity.activityDate ? new Date(activity.activityDate).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveActivity(index)}
                  className="text-red-600 hover:text-red-900"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Warning */}
      {activities.length > 0 && !isValid && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800 font-medium mb-2">
            ⚠️ Some activities are incomplete. Please ensure all activities have:
          </p>
          <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
            <li>Activity type</li>
            <li>Activity date</li>
          </ul>
        </div>
      )}
    </div>
  );
}





