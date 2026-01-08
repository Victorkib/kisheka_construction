/**
 * Professional Fees Form Component
 * Reusable form for creating and editing professional fees
 */

'use client';

import { useState, useEffect } from 'react';
import {
  FEE_TYPES,
  PAYMENT_METHODS,
  CURRENCIES,
} from '@/lib/constants/professional-fees-constants';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';

export function ProfessionalFeesForm({
  initialData = null,
  professionalServices = [],
  projects = [],
  phases = [],
  activities = [],
  onSubmit,
  onCancel,
  loading = false,
  error = null,
  isEdit = false,
}) {
  const [formData, setFormData] = useState({
    professionalServiceId: '',
    activityId: '',
    projectId: '',
    phaseId: '',
    feeType: '',
    description: '',
    amount: '',
    currency: 'KES',
    paymentMethod: '',
    paymentDate: '',
    referenceNumber: '',
    receiptUrl: '',
    invoiceNumber: '',
    invoiceDate: '',
    invoiceUrl: '',
    dueDate: '',
    status: 'PENDING',
  });

  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        professionalServiceId: initialData.professionalServiceId?.toString() || initialData.professionalService?._id?.toString() || '',
        activityId: initialData.activityId?.toString() || initialData.activity?._id?.toString() || '',
        projectId: initialData.projectId?.toString() || initialData.project?._id?.toString() || '',
        phaseId: initialData.phaseId?.toString() || initialData.phase?._id?.toString() || '',
        feeType: initialData.feeType || '',
        description: initialData.description || '',
        amount: initialData.amount?.toString() || '',
        currency: initialData.currency || 'KES',
        paymentMethod: initialData.paymentMethod || '',
        paymentDate: initialData.paymentDate ? new Date(initialData.paymentDate).toISOString().split('T')[0] : '',
        referenceNumber: initialData.referenceNumber || '',
        receiptUrl: initialData.receiptUrl || '',
        invoiceNumber: initialData.invoiceNumber || '',
        invoiceDate: initialData.invoiceDate ? new Date(initialData.invoiceDate).toISOString().split('T')[0] : '',
        invoiceUrl: initialData.invoiceUrl || '',
        dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : '',
        status: initialData.status || 'PENDING',
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
        // Auto-set projectId if not already set
        if (!formData.projectId && service.project?._id) {
          setFormData((prev) => ({
            ...prev,
            projectId: service.project._id.toString(),
          }));
        }
      }
    } else {
      setSelectedProfessional(null);
    }
  }, [formData.professionalServiceId, professionalServices]);

  // Filter phases and activities by selected project and professional service
  const availablePhases = phases.filter(
    (phase) => phase.projectId?.toString() === formData.projectId || phase.project?._id?.toString() === formData.projectId
  );
  const availableActivities = activities.filter(
    (activity) => 
      activity.professionalServiceId?.toString() === formData.professionalServiceId &&
      (activity.projectId?.toString() === formData.projectId || activity.project?._id?.toString() === formData.projectId)
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
    if (!formData.feeType) {
      errors.feeType = 'Fee type is required';
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = 'Amount is required and must be greater than 0';
    }
    if (formData.invoiceDate && formData.dueDate) {
      if (new Date(formData.dueDate) < new Date(formData.invoiceDate)) {
        errors.dueDate = 'Due date must be after or equal to invoice date';
      }
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    // Prepare submission data
    const submitData = {
      ...formData,
      amount: parseFloat(formData.amount),
    };

    onSubmit(submitData);
  };

  // Get available fee types based on selected professional
  const getAvailableFeeTypes = () => {
    if (!selectedProfessional) return FEE_TYPES.ALL;
    return selectedProfessional.type === 'architect' 
      ? FEE_TYPES.ARCHITECT 
      : FEE_TYPES.ENGINEER;
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
              Fee Type <span className="text-red-500">*</span>
            </label>
            <select
              name="feeType"
              value={formData.feeType}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.feeType ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select Fee Type</option>
              {getAvailableFeeTypes().map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
            {validationErrors.feeType && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.feeType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              required
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 ${
                validationErrors.amount ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {validationErrors.amount && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.amount}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Currency
            </label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CURRENCIES.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </div>

          {formData.projectId && availablePhases.length > 0 && (
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

          {formData.professionalServiceId && availableActivities.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Related Activity (Optional)
              </label>
              <select
                name="activityId"
                value={formData.activityId}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Activity (Optional)</option>
                {availableActivities.map((activity) => (
                  <option key={activity._id} value={activity._id}>
                    {activity.activityCode} - {activity.activityType?.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Fee description..."
            rows={2}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Invoice Information */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Information (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Invoice Number
            </label>
            <input
              type="text"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleChange}
              placeholder="Invoice number"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Invoice Date
            </label>
            <input
              type="date"
              name="invoiceDate"
              value={formData.invoiceDate}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleChange}
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.dueDate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {validationErrors.dueDate && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.dueDate}</p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Invoice Document (Optional)
          </label>
          <CloudinaryUploadWidget
            uploadPreset="Construction_Accountability_System"
            folder={`Kisheka_construction/professional-fees/invoices/${formData.projectId || 'general'}`}
            label="Upload Invoice"
            value={formData.invoiceUrl}
            onChange={(url) => setFormData(prev => ({ ...prev, invoiceUrl: url }))}
            onDelete={() => setFormData(prev => ({ ...prev, invoiceUrl: '' }))}
            maxSizeMB={10}
            acceptedTypes={['application/pdf', 'image/*']}
          />
        </div>
      </div>

      {/* Payment Information (Optional) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Payment Method (Optional)</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Payment Date
            </label>
            <input
              type="date"
              name="paymentDate"
              value={formData.paymentDate}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Reference Number
            </label>
            <input
              type="text"
              name="referenceNumber"
              value={formData.referenceNumber}
              onChange={handleChange}
              placeholder="Payment reference"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Receipt Document (Optional)
          </label>
          <CloudinaryUploadWidget
            uploadPreset="Construction_Accountability_System"
            folder={`Kisheka_construction/professional-fees/receipts/${formData.projectId || 'general'}`}
            label="Upload Receipt"
            value={formData.receiptUrl}
            onChange={(url) => setFormData(prev => ({ ...prev, receiptUrl: url }))}
            onDelete={() => setFormData(prev => ({ ...prev, receiptUrl: '' }))}
            maxSizeMB={10}
            acceptedTypes={['application/pdf', 'image/*']}
          />
        </div>
      </div>

      {/* Status (Edit Mode Only) */}
      {isEdit && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
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
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAID">Paid</option>
              <option value="ARCHIVED">Archived</option>
            </select>
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
          {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Fee' : 'Create Fee')}
        </button>
      </div>
    </form>
  );
}

