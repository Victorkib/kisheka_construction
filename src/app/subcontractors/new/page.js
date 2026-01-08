/**
 * New Subcontractor Page
 * Form to create a new subcontractor assignment
 * 
 * Route: /subcontractors/new
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { SUBCONTRACTOR_TYPES, SUBCONTRACTOR_STATUSES, CONTRACT_TYPES, getSubcontractorTypeLabel, getContractTypeLabel } from '@/lib/constants/subcontractor-constants';

export default function NewSubcontractorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { canAccess } = usePermissions();
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const projectIdFromUrl = searchParams.get('projectId');
  const phaseIdFromUrl = searchParams.get('phaseId');
  
  const [formData, setFormData] = useState({
    projectId: projectIdFromUrl || '',
    phaseId: phaseIdFromUrl || '',
    subcontractorName: '',
    subcontractorType: '',
    contactPerson: '',
    phone: '',
    email: '',
    contractValue: '',
    contractType: 'fixed_price',
    startDate: '',
    endDate: '',
    paymentSchedule: [],
    status: 'pending',
    notes: ''
  });

  const [newPayment, setNewPayment] = useState({
    milestone: '',
    amount: '',
    dueDate: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
    } else {
      setPhases([]);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      setLoadingPhases(true);
      const response = await fetch(`/api/phases?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setNewPayment((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const addPayment = () => {
    if (!newPayment.milestone || !newPayment.amount || !newPayment.dueDate) {
      toast.showError('Please fill in all payment fields');
      return;
    }

    const payment = {
      milestone: newPayment.milestone.trim(),
      amount: parseFloat(newPayment.amount),
      dueDate: newPayment.dueDate,
      paid: false,
      paidDate: null,
      paymentReference: ''
    };

    setFormData((prev) => ({
      ...prev,
      paymentSchedule: [...prev.paymentSchedule, payment]
    }));

    setNewPayment({ milestone: '', amount: '', dueDate: '' });
  };

  const removePayment = (index) => {
    setFormData((prev) => ({
      ...prev,
      paymentSchedule: prev.paymentSchedule.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Validate payment schedule doesn't exceed contract value
      if (formData.paymentSchedule.length > 0 && formData.contractValue) {
        const totalScheduled = formData.paymentSchedule.reduce((sum, p) => sum + (p.amount || 0), 0);
        if (totalScheduled > parseFloat(formData.contractValue) * 1.1) {
          throw new Error(`Total payment schedule (${totalScheduled}) exceeds contract value (${formData.contractValue}) by more than 10%`);
        }
      }

      const response = await fetch('/api/subcontractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create subcontractor');
      }

      toast.showSuccess('Subcontractor created successfully');
      router.push(`/subcontractors/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to create subcontractor');
      console.error('Create subcontractor error:', err);
    } finally {
      setSaving(false);
    }
  };

  const totalScheduled = formData.paymentSchedule.reduce((sum, p) => sum + (p.amount || 0), 0);
  const contractValue = parseFloat(formData.contractValue) || 0;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/subcontractors" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Subcontractors
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">New Subcontractor Assignment</h1>
          <p className="text-gray-600 mt-1">Create a new subcontractor assignment for a phase</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                required
                disabled={loadingProjects}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select Project</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>

            {/* Phase Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase <span className="text-red-500">*</span>
              </label>
              <select
                name="phaseId"
                value={formData.phaseId}
                onChange={handleChange}
                required
                disabled={loadingPhases || !formData.projectId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">{formData.projectId ? 'Select Phase' : 'Select Project First'}</option>
                {phases.map((phase) => (
                  <option key={phase._id} value={phase._id}>
                    {phase.phaseName} ({phase.phaseCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Subcontractor Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcontractor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="subcontractorName"
                value={formData.subcontractorName}
                onChange={handleChange}
                required
                minLength={2}
                placeholder="e.g., ABC Electrical Services"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Subcontractor Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcontractor Type <span className="text-red-500">*</span>
              </label>
              <select
                name="subcontractorType"
                value={formData.subcontractorType}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type</option>
                {SUBCONTRACTOR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {getSubcontractorTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+254 700 000 000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Contract Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Value (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="contractValue"
                  value={formData.contractValue}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="contractType"
                  value={formData.contractType}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CONTRACT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getContractTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  min={formData.startDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Payment Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Schedule (Optional)
              </label>
              
              {formData.paymentSchedule.length > 0 && (
                <div className="mb-4 space-y-2">
                  {formData.paymentSchedule.map((payment, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <span className="font-medium">{payment.milestone}</span>
                        <span className="text-gray-600 ml-2">
                          - KES {payment.amount.toLocaleString()} due {new Date(payment.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePayment(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  
                  {contractValue > 0 && (
                    <div className="text-sm text-gray-600 mt-2">
                      Total Scheduled: KES {totalScheduled.toLocaleString()} / KES {contractValue.toLocaleString()}
                      {totalScheduled > contractValue * 1.1 && (
                        <span className="text-red-600 ml-2">⚠ Exceeds contract value by more than 10%</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Milestone name"
                  value={newPayment.milestone}
                  onChange={(e) => handlePaymentChange({ target: { name: 'milestone', value: e.target.value } })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={newPayment.amount}
                  onChange={(e) => handlePaymentChange({ target: { name: 'amount', value: e.target.value } })}
                  min="0"
                  step="0.01"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  placeholder="Due date"
                  value={newPayment.dueDate}
                  onChange={(e) => handlePaymentChange({ target: { name: 'dueDate', value: e.target.value } })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addPayment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Payment
                </button>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SUBCONTRACTOR_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                placeholder="Additional notes about this subcontractor assignment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link
                href="/subcontractors"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                isLoading={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Subcontractor
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}


