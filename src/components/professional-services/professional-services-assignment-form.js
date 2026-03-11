/**
 * Professional Services Assignment Form Component
 * Reusable form for assigning professionals to projects
 */

'use client';

import { useState, useEffect } from 'react';
import {
  CONTRACT_TYPES,
  PAYMENT_SCHEDULES,
  VISIT_FREQUENCIES,
  PAYMENT_STATUSES,
} from '@/lib/constants/professional-services-constants';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { ContractValueCalculator } from './ContractValueCalculator';

export function ProfessionalServicesAssignmentForm({
  initialData = null,
  presetLibraryId = '',
  professionals = [],
  projects = [],
  phases = [],
  onSubmit,
  onCancel,
  loading = false,
  error = null,
  isEdit = false,
}) {
  const inputFocusClass = 'focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary';
  const dateInputClass = `w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} [color-scheme:light_dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100`;

  const [formData, setFormData] = useState({
    libraryId: '',
    projectId: '',
    phaseId: '',
    serviceCategory: 'construction', // NEW: Service category (preconstruction or construction)
    assignedDate: new Date().toISOString().split('T')[0],
    contractType: '',
    contractValue: '',
    paymentSchedule: '',
    visitFrequency: '',
    contractStartDate: new Date().toISOString().split('T')[0],
    contractEndDate: '',
    contractDocumentUrl: '',
    paymentTerms: '',
    milestonePayments: [],
    status: 'active',
    notes: '',
  });

  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    milestoneName: '',
    milestoneDate: '',
    paymentAmount: '',
    paymentStatus: 'pending',
  });
  const [suggestedContractValue, setSuggestedContractValue] = useState(null);

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        libraryId: initialData.libraryId?.toString() || initialData.library?._id?.toString() || '',
        projectId: initialData.projectId?.toString() || initialData.project?._id?.toString() || '',
        phaseId: initialData.phaseId?.toString() || initialData.phase?._id?.toString() || '',
        serviceCategory: initialData.serviceCategory || 'construction',
        assignedDate: initialData.assignedDate ? new Date(initialData.assignedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        contractType: initialData.contractType || '',
        contractValue: initialData.contractValue?.toString() || '',
        paymentSchedule: initialData.paymentSchedule || '',
        visitFrequency: initialData.visitFrequency || '',
        contractStartDate: initialData.contractStartDate ? new Date(initialData.contractStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        contractEndDate: initialData.contractEndDate ? new Date(initialData.contractEndDate).toISOString().split('T')[0] : '',
        contractDocumentUrl: initialData.contractDocumentUrl || '',
        paymentTerms: initialData.paymentTerms || '',
        milestonePayments: initialData.milestonePayments || [],
        status: initialData.status || 'active',
        notes: initialData.notes || '',
      });
      
      // Set selected professional
      if (initialData.libraryId || initialData.library?._id) {
        const libId = initialData.libraryId?.toString() || initialData.library?._id?.toString();
        const prof = professionals.find(p => p._id?.toString() === libId);
        if (prof) {
          setSelectedProfessional(prof);
        }
      }
    }
  }, [initialData, professionals]);

  // Update selected professional when libraryId changes
  useEffect(() => {
    if (formData.libraryId) {
      const prof = professionals.find(p => p._id?.toString() === formData.libraryId);
      if (prof) {
        setSelectedProfessional(prof);
        // Pre-fill defaults from library
        if (!isEdit) {
          setFormData((prev) => ({
            ...prev,
            contractType: prev.contractType || prof.defaultContractType || '',
            paymentSchedule: prev.paymentSchedule || prof.defaultPaymentSchedule || '',
            visitFrequency: prev.visitFrequency || prof.defaultVisitFrequency || '',
          }));
        }
      }
    } else {
      setSelectedProfessional(null);
    }
  }, [formData.libraryId, professionals, isEdit]);

  // Support direct assignment entry from library page.
  useEffect(() => {
    if (isEdit || !presetLibraryId || formData.libraryId) return;
    const exists = professionals.some((p) => p._id?.toString() === presetLibraryId);
    if (exists) {
      setFormData((prev) => ({ ...prev, libraryId: presetLibraryId }));
    }
  }, [presetLibraryId, professionals, isEdit, formData.libraryId]);

  // Filter phases by selected project
  const availablePhases = phases.filter(
    (phase) => phase.projectId?.toString() === formData.projectId || phase.project?._id?.toString() === formData.projectId
  );

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

  const handleAddMilestone = () => {
    if (!newMilestone.milestoneName || !newMilestone.milestoneDate || !newMilestone.paymentAmount) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      milestonePayments: [
        ...prev.milestonePayments,
        {
          milestoneName: newMilestone.milestoneName,
          milestoneDate: new Date(newMilestone.milestoneDate),
          paymentAmount: parseFloat(newMilestone.paymentAmount),
          paymentStatus: newMilestone.paymentStatus,
        },
      ],
    }));

    setNewMilestone({
      milestoneName: '',
      milestoneDate: '',
      paymentAmount: '',
      paymentStatus: 'pending',
    });
    setShowMilestoneForm(false);
  };

  const handleRemoveMilestone = (index) => {
    setFormData((prev) => ({
      ...prev,
      milestonePayments: prev.milestonePayments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Basic validation
    const errors = {};
    if (!formData.libraryId) {
      errors.libraryId = 'Professional is required';
    }
    if (!formData.projectId) {
      errors.projectId = 'Project is required';
    }
    if (!formData.contractType) {
      errors.contractType = 'Contract type is required';
    }
    if (!formData.contractValue || parseFloat(formData.contractValue) <= 0) {
      errors.contractValue = 'Contract value must be greater than 0';
    }
    if (!formData.paymentSchedule) {
      errors.paymentSchedule = 'Payment schedule is required';
    }
    if (!formData.contractStartDate) {
      errors.contractStartDate = 'Contract start date is required';
    }
    if (formData.contractEndDate && formData.contractStartDate) {
      if (new Date(formData.contractEndDate) <= new Date(formData.contractStartDate)) {
        errors.contractEndDate = 'Contract end date must be after start date';
      }
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    // Prepare submission data
    const submitData = {
      ...formData,
      contractValue: parseFloat(formData.contractValue),
      milestonePayments: formData.milestonePayments.map((m) => ({
        ...m,
        paymentAmount: parseFloat(m.paymentAmount),
      })),
    };

    onSubmit(submitData);
  };

  const getContractTypes = () => {
    if (!selectedProfessional) return CONTRACT_TYPES.ALL;
    return selectedProfessional.type === 'architect' 
      ? CONTRACT_TYPES.ARCHITECT 
      : CONTRACT_TYPES.ENGINEER;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="ds-bg-danger/10 border ds-border-danger/40 ds-text-danger px-4 py-3 rounded-lg flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Professional Selection */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Professional Selection</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Professional <span className="text-red-500">*</span>
            </label>
            <select
              name="libraryId"
              value={formData.libraryId}
              onChange={handleChange}
              required
              disabled={isEdit}
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg ${inputFocusClass} ${
                validationErrors.libraryId ? 'border-red-400/60' : 'ds-border-subtle'
              } ${isEdit ? 'ds-bg-surface-muted cursor-not-allowed' : ''}`}
            >
              <option value="">Select Professional</option>
              {professionals
                .filter((p) => p.isActive && !p.deletedAt)
                .map((professional) => (
                  <option key={professional._id} value={professional._id}>
                    {professional.name} ({professional.type === 'architect' ? 'Architect' : 'Engineer'})
                  </option>
                ))}
            </select>
            {validationErrors.libraryId && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.libraryId}</p>
            )}
            {selectedProfessional && (
              <div className="mt-2 p-3 ds-bg-accent-subtle rounded-lg border ds-border-accent-subtle">
                <div className="text-sm">
                  <div className="font-medium ds-text-primary">{selectedProfessional.name}</div>
                  {selectedProfessional.email && (
                    <div className="ds-text-secondary">Email: {selectedProfessional.email}</div>
                  )}
                  {selectedProfessional.phone && (
                    <div className="ds-text-secondary">Phone: {selectedProfessional.phone}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Service Category */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Service Category <span className="text-red-500">*</span>
            </label>
            <select
              name="serviceCategory"
              value={formData.serviceCategory}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg ${inputFocusClass} ${
                validationErrors.serviceCategory ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            >
              <option value="construction">Construction Services</option>
              <option value="preconstruction">Preconstruction Services</option>
            </select>
            {validationErrors.serviceCategory && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.serviceCategory}</p>
            )}
            <p className="mt-1 text-xs ds-text-secondary">
              {formData.serviceCategory === 'preconstruction' 
                ? 'Preconstruction services (design, permits, approvals) are charged to the preconstruction budget.'
                : 'Construction services (site inspections, construction oversight) are charged to the construction budget.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              required
              disabled={isEdit}
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg ${inputFocusClass} ${
                validationErrors.projectId ? 'border-red-400/60' : 'ds-border-subtle'
              } ${isEdit ? 'ds-bg-surface-muted cursor-not-allowed' : ''}`}
            >
              <option value="">Select Project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectName} ({project.projectCode})
                </option>
              ))}
            </select>
            {validationErrors.projectId && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.projectId}</p>
            )}
          </div>

          {formData.projectId && (
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">
                Phase (Optional)
              </label>
              <select
                name="phaseId"
                value={formData.phaseId}
                onChange={handleChange}
                className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass}`}
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
        </div>
      </div>

      {/* Contract Details */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Contract Details</h2>
        
        {/* Contract Value Calculator */}
        {selectedProfessional && formData.paymentSchedule && formData.contractType && formData.contractStartDate && (
          <div className="mb-6">
            <ContractValueCalculator
              professional={selectedProfessional}
              paymentSchedule={formData.paymentSchedule}
              contractType={formData.contractType}
              contractStartDate={formData.contractStartDate}
              contractEndDate={formData.contractEndDate || null}
              visitFrequency={formData.visitFrequency || null}
              currentContractValue={formData.contractValue}
              onSuggestedValueChange={(value) => {
                setSuggestedContractValue(value);
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Contract Type <span className="text-red-500">*</span>
            </label>
            <select
              name="contractType"
              value={formData.contractType}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg ${inputFocusClass} ${
                validationErrors.contractType ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            >
              <option value="">Select Contract Type</option>
              {getContractTypes().map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
            {validationErrors.contractType && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.contractType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Contract Value (KES) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="contractValue"
                value={formData.contractValue}
                onChange={handleChange}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                required
                className={`flex-1 px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg ${inputFocusClass} placeholder:ds-text-muted ${
                  validationErrors.contractValue ? 'border-red-400/60' : 'ds-border-subtle'
                }`}
              />
              {suggestedContractValue && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      contractValue: suggestedContractValue.toString(),
                    }));
                  }}
                  className="px-4 py-2 ds-bg-success text-white rounded-lg hover:ds-bg-success focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:ring-offset-2 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  Use Suggested
                </button>
              )}
            </div>
            {validationErrors.contractValue && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.contractValue}</p>
            )}
            {suggestedContractValue && !formData.contractValue && (
              <p className="mt-1 text-xs ds-text-muted">
                Suggested: {suggestedContractValue.toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Payment Schedule <span className="text-red-500">*</span>
            </label>
            <select
              name="paymentSchedule"
              value={formData.paymentSchedule}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg ${inputFocusClass} ${
                validationErrors.paymentSchedule ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            >
              <option value="">Select Payment Schedule</option>
              {PAYMENT_SCHEDULES.map((schedule) => (
                <option key={schedule} value={schedule}>
                  {schedule.charAt(0).toUpperCase() + schedule.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
            {validationErrors.paymentSchedule && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.paymentSchedule}</p>
            )}
          </div>

          {selectedProfessional?.type === 'engineer' && (
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">
                Visit Frequency
              </label>
              <select
                name="visitFrequency"
                value={formData.visitFrequency}
                onChange={handleChange}
                className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass}`}
              >
                <option value="">Select Visit Frequency (Optional)</option>
                {VISIT_FREQUENCIES.map((freq) => (
                  <option key={freq} value={freq}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Contract Dates */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Contract Dates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Assigned Date
            </label>
            <input
              type="date"
              name="assignedDate"
              value={formData.assignedDate}
              onChange={handleChange}
              className={dateInputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Contract Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="contractStartDate"
              value={formData.contractStartDate}
              onChange={handleChange}
              required
              className={`${dateInputClass} ${
                validationErrors.contractStartDate ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            />
            {validationErrors.contractStartDate && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.contractStartDate}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Contract End Date (Optional)
            </label>
            <input
              type="date"
              name="contractEndDate"
              value={formData.contractEndDate}
              onChange={handleChange}
              className={`${dateInputClass} ${
                validationErrors.contractEndDate ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            />
            {validationErrors.contractEndDate && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.contractEndDate}</p>
            )}
          </div>
        </div>
      </div>

      {/* Milestone Payments (if payment schedule is milestone) */}
      {formData.paymentSchedule === 'milestone' && (
        <div>
          <h2 className="text-lg font-semibold ds-text-primary mb-4">Milestone Payments</h2>
          {formData.milestonePayments.length > 0 && (
            <div className="mb-4 space-y-2">
              {formData.milestonePayments.map((milestone, index) => (
                <div key={index} className="flex items-center justify-between p-3 ds-bg-surface-muted rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium ds-text-primary">{milestone.milestoneName}</div>
                    <div className="text-sm ds-text-secondary">
                      {new Date(milestone.milestoneDate).toLocaleDateString()} - {formatCurrency(milestone.paymentAmount)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMilestone(index)}
                    className="text-red-600 hover:text-red-900 ml-4"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {!showMilestoneForm ? (
            <button
              type="button"
              onClick={() => setShowMilestoneForm(true)}
              className="px-4 py-2 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface-muted"
            >
              + Add Milestone
            </button>
          ) : (
            <div className="p-4 ds-bg-surface-muted rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold ds-text-secondary mb-1">
                    Milestone Name
                  </label>
                  <input
                    type="text"
                    value={newMilestone.milestoneName}
                    onChange={(e) => setNewMilestone(prev => ({ ...prev, milestoneName: e.target.value }))}
                    placeholder="e.g., Design Complete"
                    className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold ds-text-secondary mb-1">
                    Milestone Date
                  </label>
                  <input
                    type="date"
                    value={newMilestone.milestoneDate}
                    onChange={(e) => setNewMilestone(prev => ({ ...prev, milestoneDate: e.target.value }))}
                    className={dateInputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold ds-text-secondary mb-1">
                    Payment Amount (KES)
                  </label>
                  <input
                    type="number"
                    value={newMilestone.paymentAmount}
                    onChange={(e) => setNewMilestone(prev => ({ ...prev, paymentAmount: e.target.value }))}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass}`}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMilestoneForm(false);
                      setNewMilestone({
                        milestoneName: '',
                        milestoneDate: '',
                        paymentAmount: '',
                        paymentStatus: 'pending',
                      });
                    }}
                    className="px-4 py-2 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Additional Information */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Additional Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Payment Terms
            </label>
            <input
              type="text"
              name="paymentTerms"
              value={formData.paymentTerms}
              onChange={handleChange}
              placeholder="e.g., Net 30, 50% upfront"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Contract Document (Optional)
            </label>
            <CloudinaryUploadWidget
              uploadPreset="Construction_Accountability_System"
              folder={`Kisheka_construction/professional-services/contracts/${formData.projectId || 'general'}`}
              label="Upload Contract Document"
              value={formData.contractDocumentUrl}
              onChange={(url) => setFormData(prev => ({ ...prev, contractDocumentUrl: url }))}
              onDelete={() => setFormData(prev => ({ ...prev, contractDocumentUrl: '' }))}
              maxSizeMB={10}
              acceptedTypes={['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes about this assignment..."
              rows={3}
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>

          {isEdit && (
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass}`}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="terminated">Terminated</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (isEdit ? 'Updating...' : 'Assigning...') : (isEdit ? 'Update Assignment' : 'Assign Professional')}
        </button>
      </div>
    </form>
  );
}

