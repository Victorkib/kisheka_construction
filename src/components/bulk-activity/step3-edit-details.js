/**
 * Step 3: Edit Details Component
 * Editable table for editing activity details
 */

'use client';

import { useState, useEffect } from 'react';
import { ACTIVITY_TYPES, VISIT_PURPOSES, INSPECTION_TYPES, COMPLIANCE_STATUSES } from '@/lib/constants/professional-activities-constants';

const normalizeId = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return normalizeId(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  if (typeof value === 'object' && value._id) return normalizeId(value._id);
  return value.toString?.() || '';
};

export function Step3EditDetails({ wizardData, onUpdate, onValidationChange }) {
  const [activities, setActivities] = useState(wizardData.activities || []);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [professionalService, setProfessionalService] = useState(null);

  useEffect(() => {
    const activitiesFromWizard = wizardData.activities || [];
    // Auto-populate missing defaults from Step 1
    const activitiesWithDefaults = activitiesFromWizard.map((activity) => ({
      ...activity,
      phaseId: activity.phaseId || wizardData.defaultPhaseId || '',
      floorId: activity.floorId || wizardData.defaultFloorId || '',
    }));
    setActivities(activitiesWithDefaults);
    if (activitiesWithDefaults.some((a, idx) => {
      const original = activitiesFromWizard[idx];
      return a.phaseId !== original?.phaseId || a.floorId !== original?.floorId;
    })) {
      onUpdate({ activities: activitiesWithDefaults });
    }
  }, [wizardData.activities, wizardData.defaultPhaseId, wizardData.defaultFloorId, onUpdate]);

  useEffect(() => {
    const projectId = normalizeId(wizardData.projectId);
    if (projectId) {
      fetchPhases(projectId);
      fetchFloors(projectId);
    }
    const professionalServiceId = normalizeId(wizardData.professionalServiceId);
    if (professionalServiceId) {
      fetchProfessionalService(professionalServiceId);
    }
  }, [wizardData.projectId, wizardData.professionalServiceId]);

  useEffect(() => {
    // Validate all activities
    const isValid = activities.length > 0 && activities.every((a) => {
      const hasType = a.activityType && a.activityType.trim().length > 0;
      const hasDate = a.activityDate && new Date(a.activityDate).toString() !== 'Invalid Date';
      return hasType && hasDate;
    });
    onValidationChange(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities]);

  const fetchPhases = async (projectId) => {
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    }
  };

  const fetchFloors = async (projectId) => {
    try {
      const response = await fetch(`/api/floors?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
    }
  };

  const fetchProfessionalService = async (serviceId) => {
    try {
      const response = await fetch(`/api/professional-services/${serviceId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProfessionalService(data.data);
      }
    } catch (err) {
      console.error('Error fetching professional service:', err);
    }
  };

  const handleActivityUpdate = (index, field, value) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [field]: value };
    setActivities(updated);
    onUpdate({ activities: updated });
  };

  const handleRemove = (index) => {
    const updated = activities.filter((_, i) => i !== index);
    setActivities(updated);
    onUpdate({ activities: updated });
  };

  const getAvailableActivityTypes = () => {
    if (!professionalService) return ACTIVITY_TYPES.ALL;
    return professionalService.type === 'architect' 
      ? ACTIVITY_TYPES.ARCHITECT 
      : ACTIVITY_TYPES.ENGINEER;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Activity Details</h2>
        <p className="text-sm text-gray-600 mb-6">
          Review and edit details for each activity. You can modify individual fields or remove activities.
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No activities added yet</p>
          <p className="text-sm text-gray-500 mt-1">Go back to Step 2 to add activities</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Activity {index + 1}</h3>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="text-red-600 hover:text-red-900 text-sm"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Activity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={activity.activityType || ''}
                    onChange={(e) => handleActivityUpdate(index, 'activityType', e.target.value)}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Type</option>
                    {getAvailableActivityTypes().map((type) => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Activity Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={activity.activityDate ? new Date(activity.activityDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleActivityUpdate(index, 'activityDate', e.target.value)}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {phases.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phase (Optional)
                    </label>
                    <select
                      value={activity.phaseId || ''}
                      onChange={(e) => handleActivityUpdate(index, 'phaseId', e.target.value)}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No Phase</option>
                      {phases.map((phase) => (
                        <option key={phase._id} value={phase._id}>
                          {phase.phaseName} ({phase.phaseCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {floors.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Floor (Optional)
                    </label>
                    <select
                      value={activity.floorId || ''}
                      onChange={(e) => handleActivityUpdate(index, 'floorId', e.target.value)}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No Floor</option>
                      {floors.map((floor) => (
                        <option key={floor._id} value={floor._id}>
                          {floor.floorName} (Floor {floor.floorNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {activity.activityType === 'site_visit' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Visit Purpose
                      </label>
                      <select
                        value={activity.visitPurpose || ''}
                        onChange={(e) => handleActivityUpdate(index, 'visitPurpose', e.target.value)}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Purpose</option>
                        {VISIT_PURPOSES.map((purpose) => (
                          <option key={purpose} value={purpose}>
                            {purpose.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration (Hours)
                      </label>
                      <input
                        type="number"
                        value={activity.visitDuration || ''}
                        onChange={(e) => handleActivityUpdate(index, 'visitDuration', e.target.value)}
                        placeholder="0.0"
                        min="0"
                        step="0.5"
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {activity.activityType === 'inspection' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inspection Type
                      </label>
                      <select
                        value={activity.inspectionType || ''}
                        onChange={(e) => handleActivityUpdate(index, 'inspectionType', e.target.value)}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Type</option>
                        {INSPECTION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Compliance Status
                      </label>
                      <select
                        value={activity.complianceStatus || ''}
                        onChange={(e) => handleActivityUpdate(index, 'complianceStatus', e.target.value)}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Status</option>
                        {COMPLIANCE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={activity.notes || ''}
                    onChange={(e) => handleActivityUpdate(index, 'notes', e.target.value)}
                    placeholder="Activity notes..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

