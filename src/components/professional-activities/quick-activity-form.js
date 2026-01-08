/**
 * Quick Activity Entry Form Component
 * Streamlined form for quickly logging professional activities
 * Designed for owner to quickly enter activities received from professionals
 */

'use client';

import { useState, useEffect } from 'react';
import {
  ACTIVITY_TYPES,
  VISIT_PURPOSES,
  INSPECTION_TYPES,
  COMPLIANCE_STATUSES,
  ISSUE_SEVERITIES,
  TEST_TYPES,
  TEST_RESULTS,
} from '@/lib/constants/professional-activities-constants';

export function QuickActivityForm({
  initialData = null,
  professionalServices = [],
  projects = [],
  phases = [],
  floors = [],
  onSubmit,
  onCancel,
  loading = false,
  error = null,
  isEdit = false,
}) {
  const [formData, setFormData] = useState({
    professionalServiceId: '',
    projectId: '',
    phaseId: '',
    floorId: '',
    activityType: '',
    activityDate: new Date().toISOString().split('T')[0],
    visitPurpose: '',
    visitDuration: '',
    attendees: [],
    revisionNumber: '',
    revisionReason: '',
    affectedAreas: [],
    inspectionType: '',
    areasInspected: [],
    inspectionDuration: '',
    complianceStatus: '',
    codeCompliance: false,
    designCompliance: false,
    qualityStandards: false,
    issuesFound: [],
    materialTests: [],
    feesCharged: '',
    expensesIncurred: '',
    notes: '',
    observations: '',
    recommendations: '',
    followUpRequired: false,
    followUpDate: '',
    status: 'draft',
    requiresApproval: true,
  });

  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [attendeeInput, setAttendeeInput] = useState('');
  const [affectedAreaInput, setAffectedAreaInput] = useState('');
  const [areaInspectedInput, setAreaInspectedInput] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showMaterialTestForm, setShowMaterialTestForm] = useState(false);
  const [newIssue, setNewIssue] = useState({
    description: '',
    severity: 'minor',
    location: '',
  });
  const [newMaterialTest, setNewMaterialTest] = useState({
    materialName: '',
    testType: 'strength',
    testResult: 'pass',
    testDate: new Date().toISOString().split('T')[0],
  });

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        professionalServiceId: initialData.professionalServiceId?.toString() || initialData.professionalService?._id?.toString() || '',
        projectId: initialData.projectId?.toString() || initialData.project?._id?.toString() || '',
        phaseId: initialData.phaseId?.toString() || initialData.phase?._id?.toString() || '',
        floorId: initialData.floorId?.toString() || initialData.floor?._id?.toString() || '',
        activityType: initialData.activityType || '',
        activityDate: initialData.activityDate ? new Date(initialData.activityDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        visitPurpose: initialData.visitPurpose || '',
        visitDuration: initialData.visitDuration?.toString() || '',
        attendees: initialData.attendees || [],
        revisionNumber: initialData.revisionNumber || '',
        revisionReason: initialData.revisionReason || '',
        affectedAreas: initialData.affectedAreas || [],
        inspectionType: initialData.inspectionType || '',
        areasInspected: initialData.areasInspected || [],
        inspectionDuration: initialData.inspectionDuration?.toString() || '',
        complianceStatus: initialData.complianceStatus || '',
        codeCompliance: initialData.codeCompliance || false,
        designCompliance: initialData.designCompliance || false,
        qualityStandards: initialData.qualityStandards || false,
        issuesFound: initialData.issuesFound || [],
        materialTests: initialData.materialTests || [],
        feesCharged: initialData.feesCharged?.toString() || '',
        expensesIncurred: initialData.expensesIncurred?.toString() || '',
        notes: initialData.notes || '',
        observations: initialData.observations || '',
        recommendations: initialData.recommendations || '',
        followUpRequired: initialData.followUpRequired || false,
        followUpDate: initialData.followUpDate ? new Date(initialData.followUpDate).toISOString().split('T')[0] : '',
        status: initialData.status || 'draft',
        requiresApproval: initialData.requiresApproval !== undefined ? initialData.requiresApproval : true,
      });

      // Set selected professional
      if (initialData.professionalServiceId || initialData.professionalService?._id) {
        const serviceId = initialData.professionalServiceId?.toString() || initialData.professionalService?._id?.toString();
        const service = professionalServices.find(s => s._id?.toString() === serviceId);
        if (service) {
          setSelectedProfessional(service);
        }
      }
    }
  }, [initialData, professionalServices]);

  // Update selected professional when professionalServiceId changes
  useEffect(() => {
    if (formData.professionalServiceId) {
      const service = professionalServices.find(s => s._id?.toString() === formData.professionalServiceId);
      if (service) {
        setSelectedProfessional(service);
      }
    } else {
      setSelectedProfessional(null);
    }
  }, [formData.professionalServiceId, professionalServices]);

  // Filter phases and floors by selected project
  const availablePhases = phases.filter(
    (phase) => phase.projectId?.toString() === formData.projectId || phase.project?._id?.toString() === formData.projectId
  );
  const availableFloors = floors.filter(
    (floor) => floor.projectId?.toString() === formData.projectId || floor.project?._id?.toString() === formData.projectId
  );

  // Get available activity types based on selected professional
  const getAvailableActivityTypes = () => {
    if (!selectedProfessional) return ACTIVITY_TYPES.ALL;
    return selectedProfessional.type === 'architect' 
      ? ACTIVITY_TYPES.ARCHITECT 
      : ACTIVITY_TYPES.ENGINEER;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleAddAttendee = () => {
    if (attendeeInput.trim() && !formData.attendees.includes(attendeeInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        attendees: [...prev.attendees, attendeeInput.trim()],
      }));
      setAttendeeInput('');
    }
  };

  const handleRemoveAttendee = (attendee) => {
    setFormData((prev) => ({
      ...prev,
      attendees: prev.attendees.filter((a) => a !== attendee),
    }));
  };

  const handleAddAffectedArea = () => {
    if (affectedAreaInput.trim() && !formData.affectedAreas.includes(affectedAreaInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        affectedAreas: [...prev.affectedAreas, affectedAreaInput.trim()],
      }));
      setAffectedAreaInput('');
    }
  };

  const handleRemoveAffectedArea = (area) => {
    setFormData((prev) => ({
      ...prev,
      affectedAreas: prev.affectedAreas.filter((a) => a !== area),
    }));
  };

  const handleAddAreaInspected = () => {
    if (areaInspectedInput.trim() && !formData.areasInspected.includes(areaInspectedInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        areasInspected: [...prev.areasInspected, areaInspectedInput.trim()],
      }));
      setAreaInspectedInput('');
    }
  };

  const handleRemoveAreaInspected = (area) => {
    setFormData((prev) => ({
      ...prev,
      areasInspected: prev.areasInspected.filter((a) => a !== area),
    }));
  };

  const handleAddIssue = () => {
    if (!newIssue.description.trim()) return;

    setFormData((prev) => ({
      ...prev,
      issuesFound: [
        ...prev.issuesFound,
        {
          description: newIssue.description.trim(),
          severity: newIssue.severity,
          location: newIssue.location.trim() || null,
          status: 'identified',
        },
      ],
    }));

    setNewIssue({
      description: '',
      severity: 'minor',
      location: '',
    });
    setShowIssueForm(false);
  };

  const handleRemoveIssue = (index) => {
    setFormData((prev) => ({
      ...prev,
      issuesFound: prev.issuesFound.filter((_, i) => i !== index),
    }));
  };

  const handleAddMaterialTest = () => {
    if (!newMaterialTest.materialName.trim()) return;

    setFormData((prev) => ({
      ...prev,
      materialTests: [
        ...prev.materialTests,
        {
          materialName: newMaterialTest.materialName.trim(),
          testType: newMaterialTest.testType,
          testResult: newMaterialTest.testResult,
          testDate: newMaterialTest.testDate ? new Date(newMaterialTest.testDate) : new Date(),
        },
      ],
    }));

    setNewMaterialTest({
      materialName: '',
      testType: 'strength',
      testResult: 'pass',
      testDate: new Date().toISOString().split('T')[0],
    });
    setShowMaterialTestForm(false);
  };

  const handleRemoveMaterialTest = (index) => {
    setFormData((prev) => ({
      ...prev,
      materialTests: prev.materialTests.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Basic validation
    const errors = {};
    if (!formData.professionalServiceId) {
      errors.professionalServiceId = 'Professional service is required';
    }
    if (!formData.projectId) {
      errors.projectId = 'Project is required';
    }
    if (!formData.activityType) {
      errors.activityType = 'Activity type is required';
    }
    if (!formData.activityDate) {
      errors.activityDate = 'Activity date is required';
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    // Prepare submission data
    const submitData = {
      ...formData,
      visitDuration: formData.visitDuration ? parseFloat(formData.visitDuration) : null,
      inspectionDuration: formData.inspectionDuration ? parseFloat(formData.inspectionDuration) : null,
      feesCharged: formData.feesCharged ? parseFloat(formData.feesCharged) : null,
      expensesIncurred: formData.expensesIncurred ? parseFloat(formData.expensesIncurred) : null,
      followUpDate: formData.followUpDate || null,
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Professional Service <span className="text-red-500">*</span>
            </label>
            <select
              name="professionalServiceId"
              value={formData.professionalServiceId}
              onChange={handleChange}
              required
              disabled={isEdit}
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.professionalServiceId ? 'border-red-300' : 'border-gray-300'
              } ${isEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              <option value="">Select Professional Service</option>
              {professionalServices
                .filter((s) => s.status === 'active' && !s.deletedAt)
                .map((service) => (
                  <option key={service._id} value={service._id}>
                    {service.library?.name || 'N/A'} - {service.project?.projectName || 'N/A'}
                  </option>
                ))}
            </select>
            {validationErrors.professionalServiceId && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.professionalServiceId}</p>
            )}
            {selectedProfessional && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    {selectedProfessional.library?.name || 'N/A'} ({selectedProfessional.type === 'architect' ? 'Architect' : 'Engineer'})
                  </div>
                  <div className="text-gray-600">Project: {selectedProfessional.project?.projectName || 'N/A'}</div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Activity Type <span className="text-red-500">*</span>
            </label>
            <select
              name="activityType"
              value={formData.activityType}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.activityType ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select Activity Type</option>
              {getAvailableActivityTypes().map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
            {validationErrors.activityType && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.activityType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Activity Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="activityDate"
              value={formData.activityDate}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.activityDate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {validationErrors.activityDate && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.activityDate}</p>
            )}
          </div>

          {formData.projectId && (
            <>
              {availablePhases.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Phase (Optional)
                  </label>
                  <select
                    name="phaseId"
                    value={formData.phaseId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Phase (Optional)</option>
                    {availablePhases.map((phase) => (
                      <option key={phase._id} value={phase._id}>
                        {phase.phaseName} ({phase.phaseCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {availableFloors.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Floor (Optional)
                  </label>
                  <select
                    name="floorId"
                    value={formData.floorId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Floor (Optional)</option>
                    {availableFloors.map((floor) => (
                      <option key={floor._id} value={floor._id}>
                        {floor.floorName} ({floor.floorNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Activity-Specific Fields */}
      {formData.activityType === 'site_visit' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Visit Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Visit Purpose
              </label>
              <select
                name="visitPurpose"
                value={formData.visitPurpose}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Purpose (Optional)</option>
                {VISIT_PURPOSES.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purpose.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Duration (Hours)
              </label>
              <input
                type="number"
                name="visitDuration"
                value={formData.visitDuration}
                onChange={handleChange}
                placeholder="0.0"
                min="0"
                step="0.5"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Attendees
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAttendee();
                  }
                }}
                placeholder="Add attendee name and press Enter"
                className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAttendee}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            {formData.attendees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.attendees.map((attendee) => (
                  <span
                    key={attendee}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {attendee}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(attendee)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {formData.activityType === 'design_revision' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Design Revision Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Revision Number
              </label>
              <input
                type="text"
                name="revisionNumber"
                value={formData.revisionNumber}
                onChange={handleChange}
                placeholder="e.g., Rev. 2.1"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Revision Reason
              </label>
              <input
                type="text"
                name="revisionReason"
                value={formData.revisionReason}
                onChange={handleChange}
                placeholder="Reason for revision"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Affected Areas
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={affectedAreaInput}
                onChange={(e) => setAffectedAreaInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAffectedArea();
                  }
                }}
                placeholder="Add affected area and press Enter"
                className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAffectedArea}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            {formData.affectedAreas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.affectedAreas.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => handleRemoveAffectedArea(area)}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {formData.activityType === 'inspection' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Inspection Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Inspection Type
              </label>
              <select
                name="inspectionType"
                value={formData.inspectionType}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type (Optional)</option>
                {INSPECTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Duration (Hours)
              </label>
              <input
                type="number"
                name="inspectionDuration"
                value={formData.inspectionDuration}
                onChange={handleChange}
                placeholder="0.0"
                min="0"
                step="0.5"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Areas Inspected
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={areaInspectedInput}
                onChange={(e) => setAreaInspectedInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAreaInspected();
                  }
                }}
                placeholder="Add area and press Enter"
                className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAreaInspected}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            {formData.areasInspected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.areasInspected.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => handleRemoveAreaInspected(area)}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Compliance Status
              </label>
              <select
                name="complianceStatus"
                value={formData.complianceStatus}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Status (Optional)</option>
                {COMPLIANCE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="codeCompliance"
                  checked={formData.codeCompliance}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Code Compliant</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="designCompliance"
                  checked={formData.designCompliance}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Design Compliant</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="qualityStandards"
                  checked={formData.qualityStandards}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Meets Quality Standards</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Issues Found (for engineers) */}
      {selectedProfessional?.type === 'engineer' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Issues Found</h2>
          {formData.issuesFound.length > 0 && (
            <div className="mb-4 space-y-2">
              {formData.issuesFound.map((issue, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{issue.description}</div>
                    <div className="text-sm text-gray-600">
                      Severity: {issue.severity} {issue.location && `| Location: ${issue.location}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveIssue(index)}
                    className="text-red-600 hover:text-red-900 ml-4"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {!showIssueForm ? (
            <button
              type="button"
              onClick={() => setShowIssueForm(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              + Add Issue
            </button>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Issue Description <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newIssue.description}
                    onChange={(e) => setNewIssue(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the issue"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Severity
                  </label>
                  <select
                    value={newIssue.severity}
                    onChange={(e) => setNewIssue(prev => ({ ...prev, severity: e.target.value }))}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ISSUE_SEVERITIES.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={newIssue.location}
                    onChange={(e) => setNewIssue(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Location of issue"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddIssue}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Issue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowIssueForm(false);
                    setNewIssue({
                      description: '',
                      severity: 'minor',
                      location: '',
                    });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Material Tests (for engineers) */}
      {selectedProfessional?.type === 'engineer' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Material Tests</h2>
          {formData.materialTests.length > 0 && (
            <div className="mb-4 space-y-2">
              {formData.materialTests.map((test, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{test.materialName}</div>
                    <div className="text-sm text-gray-600">
                      {test.testType} - Result: {test.testResult}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterialTest(index)}
                    className="text-red-600 hover:text-red-900 ml-4"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {!showMaterialTestForm ? (
            <button
              type="button"
              onClick={() => setShowMaterialTestForm(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              + Add Material Test
            </button>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Material Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newMaterialTest.materialName}
                    onChange={(e) => setNewMaterialTest(prev => ({ ...prev, materialName: e.target.value }))}
                    placeholder="Material name"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Test Type
                  </label>
                  <select
                    value={newMaterialTest.testType}
                    onChange={(e) => setNewMaterialTest(prev => ({ ...prev, testType: e.target.value }))}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TEST_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Test Result
                  </label>
                  <select
                    value={newMaterialTest.testResult}
                    onChange={(e) => setNewMaterialTest(prev => ({ ...prev, testResult: e.target.value }))}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TEST_RESULTS.map((result) => (
                      <option key={result} value={result}>
                        {result.charAt(0).toUpperCase() + result.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Test Date
                  </label>
                  <input
                    type="date"
                    value={newMaterialTest.testDate}
                    onChange={(e) => setNewMaterialTest(prev => ({ ...prev, testDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddMaterialTest}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Test
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMaterialTestForm(false);
                    setNewMaterialTest({
                      materialName: '',
                      testType: 'strength',
                      testResult: 'pass',
                      testDate: new Date().toISOString().split('T')[0],
                    });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financial Information */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Information (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Fees Charged (KES)
            </label>
            <input
              type="number"
              name="feesCharged"
              value={formData.feesCharged}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Expenses Incurred (KES)
            </label>
            <input
              type="number"
              name="expensesIncurred"
              value={formData.expensesIncurred}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Notes and Observations */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes and Observations</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Observations
            </label>
            <textarea
              name="observations"
              value={formData.observations}
              onChange={handleChange}
              placeholder="Site observations..."
              rows={3}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Recommendations
            </label>
            <textarea
              name="recommendations"
              value={formData.recommendations}
              onChange={handleChange}
              placeholder="Recommendations..."
              rows={3}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes..."
              rows={2}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Follow-up */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Follow-up</h2>
        <div className="space-y-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              name="followUpRequired"
              checked={formData.followUpRequired}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Follow-up Required</span>
          </label>
          {formData.followUpRequired && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Follow-up Date
              </label>
              <input
                type="date"
                name="followUpDate"
                value={formData.followUpDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Status and Approval */}
      {isEdit && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="requiresApproval"
                checked={formData.requiresApproval}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Requires Approval</span>
            </label>
          </div>
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Activity' : 'Create Activity')}
        </button>
      </div>
    </form>
  );
}

